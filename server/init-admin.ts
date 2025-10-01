import { db } from "./db.js";
import { users } from "../shared/schema.js";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

// Initialize default admin user if none exists
export async function initializeAdminUser() {
  try {
    console.log("Checking for existing admin users...");
    
    // Check if any admin users exist
    const existingAdmins = await db
      .select()
      .from(users)
      .where(eq(users.role, "Admin"))
      .limit(1);

    if (existingAdmins.length > 0) {
      console.log("Admin user already exists. Skipping initialization.");
      return;
    }

    // Get admin credentials from environment or use defaults
    const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    const adminFirstName = process.env.ADMIN_FIRST_NAME || "System";
    const adminLastName = process.env.ADMIN_LAST_NAME || "Administrator";

    console.log(`Creating default admin user: ${adminEmail}`);

    // Hash the password
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // Create the admin user
    const [newAdmin] = await db.insert(users).values({
      email: adminEmail,
      password: hashedPassword,
      firstName: adminFirstName,
      lastName: adminLastName,
      role: "Admin",
      isActive: true,
      inviteStatus: "accepted",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    console.log("✓ Default admin user created successfully!");
    console.log(`  Email: ${adminEmail}`);
    
    if (process.env.NODE_ENV === 'production') {
      console.log("\n⚠️  SECURITY WARNING:");
      console.log("  Change the default admin password immediately after first login!");
      console.log("  Set ADMIN_EMAIL and ADMIN_PASSWORD in your .env file for custom credentials.");
    }

    return newAdmin;
  } catch (error) {
    console.error("Error initializing admin user:", error);
    throw error;
  }
}
