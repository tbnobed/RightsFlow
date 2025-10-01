import bcrypt from "bcrypt";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { nanoid } from "nanoid";
import { loginSchema, CreateUserData, InviteUserData, AcceptInviteData, inviteUserSchema, acceptInviteSchema } from "@shared/schema";
import { storage } from "./storage";
import { sendUserInviteEmail } from "./sendgrid";

// Session configuration
export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

// Auth middleware
export function isAuthenticated(req: any, res: Response, next: NextFunction) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ message: "Authentication required" });
}

// Admin middleware
export function isAdmin(req: any, res: Response, next: NextFunction) {
  if (req.session && req.session.userId && req.session.userRole === "Admin") {
    return next();
  }
  return res.status(403).json({ message: "Admin access required" });
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Set up authentication routes
export function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Login endpoint
  app.post("/api/auth/login", async (req: any, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      if (!user || !user.isActive) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      if (!user.password) {
        return res.status(401).json({ message: "Account not activated. Please check your email for the invitation link." });
      }
      
      const isValidPassword = await verifyPassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Update last login
      await storage.updateUserLastLogin(user.id);
      
      // Set session
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.userEmail = user.email;
      
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req: any, res) => {
    req.session.destroy((err: any) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !user.isActive) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Create user (admin only)
  app.post("/api/auth/users", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userData = req.body as CreateUserData;
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
      
      // Hash password
      const hashedPassword = await hashPassword(userData.password);
      
      // Create user
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });
      
      // Create audit log
      await storage.createAuditLog({
        action: "User Created",
        entityType: "User",
        entityId: user.id,
        newValues: { email: user.email, role: user.role },
        userId: req.session.userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.status(201).json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // List all users (admin only)
  app.get("/api/auth/users", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      })));
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Update user (admin only)
  app.put("/api/auth/users/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const updateData = req.body;
      
      // Hash password if provided
      if (updateData.password) {
        updateData.password = await hashPassword(updateData.password);
      }
      
      const oldUser = await storage.getUser(userId);
      const updatedUser = await storage.updateUser(userId, updateData);
      
      // Create audit log
      await storage.createAuditLog({
        action: "User Updated",
        entityType: "User",
        entityId: userId,
        oldValues: oldUser,
        newValues: updatedUser,
        userId: req.session.userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
      });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Toggle user active status (admin only)
  app.patch("/api/auth/users/:id/toggle", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const { isActive } = req.body;
      
      const oldUser = await storage.getUser(userId);
      if (!oldUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const updatedUser = await storage.updateUser(userId, { isActive });
      
      // Create audit log
      await storage.createAuditLog({
        action: isActive ? "User Activated" : "User Deactivated",
        entityType: "User",
        entityId: userId,
        oldValues: { isActive: oldUser.isActive },
        newValues: { isActive },
        userId: req.session.userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
      });
    } catch (error) {
      console.error("Error toggling user status:", error);
      res.status(500).json({ message: "Failed to toggle user status" });
    }
  });

  // Invite user (admin only)
  app.post("/api/auth/invite", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const inviteData = inviteUserSchema.parse(req.body) as InviteUserData;
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(inviteData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
      
      // Generate invite token
      const inviteToken = nanoid(32);
      const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      // Create user with pending status
      const user = await storage.createUser({
        ...inviteData,
        password: null,
        inviteToken,
        inviteTokenExpiry,
        inviteStatus: "pending",
      });
      
      // Get inviter info
      const inviter = await storage.getUser(req.session.userId);
      const inviterName = inviter ? `${inviter.firstName} ${inviter.lastName}` : "Admin";
      
      // Send invite email
      await sendUserInviteEmail(inviteData.email, inviteToken, inviterName);
      
      // Create audit log
      await storage.createAuditLog({
        action: "User Invited",
        entityType: "User",
        entityId: user.id,
        newValues: { email: user.email, role: user.role },
        userId: req.session.userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.status(201).json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        inviteStatus: user.inviteStatus,
      });
    } catch (error) {
      console.error("Error inviting user:", error);
      res.status(500).json({ message: "Failed to send invitation" });
    }
  });

  // Accept invite and set password
  app.post("/api/auth/accept-invite", async (req: any, res) => {
    try {
      const { token, password } = acceptInviteSchema.parse(req.body) as AcceptInviteData;
      
      // Find user by invite token
      const user = await storage.getUserByInviteToken(token);
      if (!user) {
        return res.status(404).json({ message: "Invalid or expired invitation" });
      }
      
      // Check if token has expired
      if (user.inviteTokenExpiry && new Date() > user.inviteTokenExpiry) {
        return res.status(400).json({ message: "Invitation has expired" });
      }
      
      // Check if already accepted
      if (user.inviteStatus === "accepted") {
        return res.status(400).json({ message: "Invitation already accepted" });
      }
      
      // Hash password
      const hashedPassword = await hashPassword(password);
      
      // Update user with password and mark as accepted
      const updatedUser = await storage.updateUser(user.id, {
        password: hashedPassword,
        inviteStatus: "accepted",
        inviteToken: null,
        inviteTokenExpiry: null,
      });
      
      // Create audit log
      await storage.createAuditLog({
        action: "Invitation Accepted",
        entityType: "User",
        entityId: user.id,
        newValues: { inviteStatus: "accepted" },
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      // Auto-login the user
      req.session.userId = updatedUser.id;
      req.session.userRole = updatedUser.role;
      req.session.userEmail = updatedUser.email;
      
      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
      });
    } catch (error) {
      console.error("Error accepting invite:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  // Verify invite token
  app.get("/api/auth/verify-invite/:token", async (req: any, res) => {
    try {
      const { token } = req.params;
      
      const user = await storage.getUserByInviteToken(token);
      if (!user) {
        return res.status(404).json({ message: "Invalid invitation" });
      }
      
      if (user.inviteTokenExpiry && new Date() > user.inviteTokenExpiry) {
        return res.status(400).json({ message: "Invitation has expired" });
      }
      
      if (user.inviteStatus === "accepted") {
        return res.status(400).json({ message: "Invitation already accepted" });
      }
      
      res.json({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
    } catch (error) {
      console.error("Error verifying invite:", error);
      res.status(500).json({ message: "Failed to verify invitation" });
    }
  });
}