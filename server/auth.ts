import bcrypt from "bcrypt";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { nanoid } from "nanoid";
import { loginSchema, CreateUserData, InviteUserData, AcceptInviteData, inviteUserSchema, acceptInviteSchema } from "@shared/schema";
import { storage } from "./storage";
import { sendUserInviteEmail, sendPasswordResetEmail } from "./sendgrid";

// In-memory token store for iframe fallback authentication
const tokenSessionMap = new Map<string, { sessionId: string; userId: string; userRole: string; userEmail: string; expires: Date }>();

// Clean up expired tokens periodically
setInterval(() => {
  const now = new Date();
  for (const [token, data] of tokenSessionMap.entries()) {
    if (data.expires < now) {
      tokenSessionMap.delete(token);
    }
  }
}, 60000); // Clean up every minute

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
  
  // Replit uses HTTPS externally but may use HTTP internally
  // We need to trust the proxy and set cookie settings appropriately
  const isSecure = process.env.NODE_ENV === "production" || process.env.REPL_ID !== undefined;
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? "none" : "lax",
      maxAge: sessionTtl,
    },
  });
}

// Auth middleware - checks both session cookies and Authorization header (for iframe fallback)
export function isAuthenticated(req: any, res: Response, next: NextFunction) {
  // First check session cookie
  if (req.session && req.session.userId) {
    return next();
  }
  
  // Fallback: check Authorization header for token-based auth (iframe support)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const tokenData = tokenSessionMap.get(token);
    
    if (tokenData && tokenData.expires > new Date()) {
      // Attach user info to request for downstream use
      req.session = req.session || {};
      req.session.userId = tokenData.userId;
      req.session.userRole = tokenData.userRole;
      req.session.userEmail = tokenData.userEmail;
      return next();
    }
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

// Admin or Sales Manager middleware (for audit trail access)
export function isAdminOrSalesManager(req: any, res: Response, next: NextFunction) {
  if (req.session && req.session.userId && 
      (req.session.userRole === "Admin" || req.session.userRole === "Sales Manager")) {
    return next();
  }
  return res.status(403).json({ message: "Admin or Sales Manager access required" });
}

// Can approve royalties middleware
export function canApproveRoyalties(req: any, res: Response, next: NextFunction) {
  const allowedRoles = ["Admin", "Finance", "Sales Manager"];
  if (req.session && req.session.userId && allowedRoles.includes(req.session.userRole)) {
    return next();
  }
  return res.status(403).json({ message: "You don't have permission to approve royalties" });
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
      
      // Generate a fallback token for iframe scenarios where cookies don't work
      const sessionToken = nanoid(32);
      const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week
      tokenSessionMap.set(sessionToken, {
        sessionId: req.sessionID,
        userId: user.id,
        userRole: user.role,
        userEmail: user.email,
        expires: tokenExpiry,
      });
      
      // Explicitly save session before responding
      req.session.save((err: any) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Login failed - session error" });
        }
        res.json({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          sessionToken, // Include token for iframe fallback
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req: any, res) => {
    // Clear token from map if provided
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      tokenSessionMap.delete(token);
    }
    
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
        inviteStatus: user.inviteStatus,
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

  // Delete user (admin only)
  app.delete("/api/auth/users/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      
      // Prevent deleting yourself
      if (userId === req.session.userId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      await storage.deleteUser(userId);
      
      // Create audit log
      await storage.createAuditLog({
        action: "User Deleted",
        entityType: "User",
        entityId: userId,
        oldValues: { email: user.email, role: user.role },
        userId: req.session.userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Reset user password (admin only)
  app.post("/api/auth/users/:id/reset-password", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const { password } = req.body;
      
      // Prevent resetting your own password through this endpoint
      if (userId === req.session.userId) {
        return res.status(400).json({ message: "Cannot reset your own password. Use the change password feature instead" });
      }
      
      if (!password || password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Hash new password
      const hashedPassword = await hashPassword(password);
      
      await storage.updateUser(userId, { password: hashedPassword });
      
      // Create audit log
      await storage.createAuditLog({
        action: "User Password Reset",
        entityType: "User",
        entityId: userId,
        newValues: { email: user.email },
        userId: req.session.userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Send password reset link (admin only)
  app.post("/api/auth/users/:id/send-reset-link", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      
      // Prevent sending reset link to yourself
      if (userId === req.session.userId) {
        return res.status(400).json({ message: "Cannot send password reset link to yourself" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Generate reset token
      const resetToken = nanoid(32);
      const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      // Update user with reset token
      await storage.updateUser(userId, {
        resetToken,
        resetTokenExpiry,
      });
      
      // Get base URL from request
      const protocol = req.protocol || (req.get('x-forwarded-proto') || 'http');
      const host = req.get('host');
      const baseUrl = `${protocol}://${host}`;
      
      // Send password reset email
      await sendPasswordResetEmail(user.email, resetToken, baseUrl);
      
      // Create audit log
      await storage.createAuditLog({
        action: "Password Reset Link Sent",
        entityType: "User",
        entityId: userId,
        newValues: { email: user.email },
        userId: req.session.userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.json({ message: "Password reset link sent successfully" });
    } catch (error) {
      console.error("Error sending password reset link:", error);
      res.status(500).json({ message: "Failed to send password reset link" });
    }
  });

  // Invite user (admin or sales manager)
  app.post("/api/auth/invite", isAuthenticated, isAdminOrSalesManager, async (req: any, res) => {
    try {
      const inviteData = inviteUserSchema.parse(req.body) as InviteUserData;
      
      // Sales Manager can only invite Sales users
      if (req.session.userRole === "Sales Manager" && inviteData.role !== "Sales") {
        return res.status(403).json({ message: "Sales Managers can only invite Sales users" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(inviteData.email);
      
      let user;
      let isResend = false;
      
      if (existingUser) {
        // If user has already accepted, don't allow reinvite
        if (existingUser.inviteStatus === "accepted") {
          return res.status(400).json({ message: "User has already accepted the invitation" });
        }
        
        // If user has pending invite, allow resending
        if (existingUser.inviteStatus === "pending") {
          isResend = true;
          
          // Generate new invite token
          const inviteToken = nanoid(32);
          const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
          
          // Update existing user with new token and data
          user = await storage.updateUser(existingUser.id, {
            firstName: inviteData.firstName,
            lastName: inviteData.lastName,
            role: inviteData.role,
            inviteToken,
            inviteTokenExpiry,
            inviteStatus: "pending",
          });
        } else {
          return res.status(400).json({ message: "User already exists" });
        }
      } else {
        // Generate invite token
        const inviteToken = nanoid(32);
        const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        
        // Create user with pending status
        user = await storage.createUser({
          ...inviteData,
          password: null,
          inviteToken,
          inviteTokenExpiry,
          inviteStatus: "pending",
        });
      }
      
      // Get inviter info
      const inviter = await storage.getUser(req.session.userId);
      const inviterName = inviter ? `${inviter.firstName} ${inviter.lastName}` : "Admin";
      
      // Get base URL from request
      const protocol = req.protocol || (req.get('x-forwarded-proto') || 'http');
      const host = req.get('host');
      const baseUrl = `${protocol}://${host}`;
      
      // Send invite email
      await sendUserInviteEmail(inviteData.email, user.inviteToken!, inviterName, baseUrl);
      
      // Create audit log
      await storage.createAuditLog({
        action: isResend ? "User Invite Resent" : "User Invited",
        entityType: "User",
        entityId: user.id,
        newValues: { email: user.email, role: user.role },
        userId: req.session.userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.status(isResend ? 200 : 201).json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        inviteStatus: user.inviteStatus,
        resent: isResend,
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
      
      // Generate a fallback token for iframe scenarios
      const sessionToken = nanoid(32);
      const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      tokenSessionMap.set(sessionToken, {
        sessionId: req.sessionID,
        userId: updatedUser.id,
        userRole: updatedUser.role,
        userEmail: updatedUser.email,
        expires: tokenExpiry,
      });
      
      // Explicitly save session before responding
      req.session.save((err: any) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Failed to complete login" });
        }
        res.json({
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          role: updatedUser.role,
          sessionToken,
        });
      });
    } catch (error) {
      console.error("Error accepting invite:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  // Reset password with token (public endpoint)
  app.post("/api/auth/reset-password", async (req: any, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      
      // Find user by reset token
      const user = await storage.getUserByResetToken(token);
      if (!user) {
        return res.status(404).json({ message: "Invalid or expired reset link" });
      }
      
      // Check if token has expired
      if (user.resetTokenExpiry && new Date() > user.resetTokenExpiry) {
        return res.status(400).json({ message: "Reset link has expired" });
      }
      
      // Hash new password
      const hashedPassword = await hashPassword(password);
      
      // Update user with new password and clear reset token
      await storage.updateUser(user.id, {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      });
      
      // Create audit log
      await storage.createAuditLog({
        action: "Password Reset via Link",
        entityType: "User",
        entityId: user.id,
        newValues: { email: user.email },
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Verify reset token
  app.get("/api/auth/verify-reset-token/:token", async (req: any, res) => {
    try {
      const { token } = req.params;
      
      const user = await storage.getUserByResetToken(token);
      if (!user) {
        return res.status(404).json({ valid: false, message: "Invalid reset link" });
      }
      
      // Check if token has expired
      if (user.resetTokenExpiry && new Date() > user.resetTokenExpiry) {
        return res.status(400).json({ valid: false, message: "Reset link has expired" });
      }
      
      res.json({
        valid: true,
        email: user.email,
      });
    } catch (error) {
      console.error("Error verifying reset token:", error);
      res.status(500).json({ valid: false, message: "Error verifying reset link" });
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