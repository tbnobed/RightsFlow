import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use pg driver for production/Docker, Neon for development
let pool: any;
let db: any;

if (process.env.NODE_ENV === 'production') {
  // Standard pg driver for production/Docker
  const pg = (await import('pg')).default;
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const { Pool } = pg;
  
  pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
  
  db = drizzle({ client: pool, schema });
} else {
  // Neon serverless for development (with ws for WebSocket support)
  const { Pool: NeonPool, neonConfig } = await import('@neondatabase/serverless');
  const { drizzle } = await import('drizzle-orm/neon-serverless');
  const ws = (await import('ws')).default;
  
  neonConfig.webSocketConstructor = ws;
  
  pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  db = drizzle({ client: pool, schema });
}

export { pool, db };