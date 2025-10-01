import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security: Validate critical secrets are set and not using defaults
function validateProductionSecrets() {
  const defaultSecrets = [
    'change_this_to_a_random_secret_in_production',
    'change_this_to_a_random_secret_minimum_32_characters',
  ];

  if (!process.env.SESSION_SECRET) {
    throw new Error(
      'FATAL: SESSION_SECRET must be set in production. Generate one with: openssl rand -hex 32'
    );
  }

  if (defaultSecrets.includes(process.env.SESSION_SECRET)) {
    throw new Error(
      'FATAL: SESSION_SECRET is using a default/placeholder value. Set a unique secret in production.'
    );
  }

  if (process.env.SESSION_SECRET.length < 32) {
    throw new Error(
      'FATAL: SESSION_SECRET must be at least 32 characters long for security.'
    );
  }

  const defaultPasswords = ['promissio_secure_password'];
  const dbUrl = process.env.DATABASE_URL || '';
  
  if (defaultPasswords.some(pwd => dbUrl.includes(pwd))) {
    console.warn(
      'WARNING: DATABASE_URL appears to use a default password. For production, use a strong unique password.'
    );
  }
}

validateProductionSecrets();

function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Serve static files from the public directory (built frontend)
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Fall through to index.html if the file doesn't exist (SPA routing)
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Default to 5000 if not specified
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`Server running in production mode on port ${port}`);
  });
})();
