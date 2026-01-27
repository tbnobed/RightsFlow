import {
  users,
  contracts,
  royalties,
  auditLogs,
  type User,
  type UpsertUser,
  type Contract,
  type InsertContract,
  type Royalty,
  type InsertRoyalty,
  type AuditLog,
  type InsertAuditLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, gte, lte, desc, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByInviteToken(token: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  createUser(userData: any): Promise<User>;
  updateUser(id: string, userData: any): Promise<User>;
  updateUserLastLogin(id: string): Promise<void>;
  deleteUser(id: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Contract operations
  getContracts(): Promise<Contract[]>;
  getContract(id: string): Promise<Contract | undefined>;
  createContract(contract: InsertContract): Promise<Contract>;
  updateContract(id: string, contract: Partial<InsertContract>): Promise<Contract>;
  deleteContract(id: string): Promise<void>;
  getContractsByFilters(filters: {
    status?: string;
    territory?: string;
    search?: string;
  }): Promise<Contract[]>;

  // Rights availability
  checkRightsAvailability(params: {
    partner: string;
    territory: string;
    platform: string;
    startDate: string;
    endDate: string;
  }): Promise<{ available: boolean; conflicts: Contract[] }>;

  // Royalty operations
  getRoyalties(): Promise<(Royalty & { contract: Contract })[]>;
  getRoyalty(id: string): Promise<Royalty | undefined>;
  createRoyalty(royalty: InsertRoyalty): Promise<Royalty>;
  updateRoyalty(id: string, royalty: Partial<InsertRoyalty>): Promise<Royalty>;
  getRoyaltiesByContract(contractId: string): Promise<Royalty[]>;

  // Audit operations
  getAuditLogs(filters?: {
    action?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<(AuditLog & { user: User | null })[]>;
  createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog>;

  // Dashboard stats
  getDashboardStats(period?: string): Promise<{
    activeContracts: number;
    expiringSoon: number;
    totalRoyalties: string;
    pendingReviews: number;
    periodLabel: string;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByInviteToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.inviteToken, token));
    return user;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.resetToken, token));
    return user;
  }

  async createUser(userData: any): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: string, userData: any): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserLastLogin(id: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async deleteUser(id: string): Promise<void> {
    // First, nullify the userId in audit logs to preserve the audit trail
    await db
      .update(auditLogs)
      .set({ userId: null })
      .where(eq(auditLogs.userId, id));
    
    // Also nullify any contracts created by this user
    await db
      .update(contracts)
      .set({ createdBy: null })
      .where(eq(contracts.createdBy, id));
    
    // Also nullify any royalties calculated by this user
    await db
      .update(royalties)
      .set({ calculatedBy: null })
      .where(eq(royalties.calculatedBy, id));
    
    // Now delete the user
    await db.delete(users).where(eq(users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Contract operations
  async getContracts(): Promise<Contract[]> {
    return await db.select().from(contracts).orderBy(desc(contracts.createdAt));
  }

  async getContract(id: string): Promise<Contract | undefined> {
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, id));
    return contract;
  }

  async createContract(contract: InsertContract): Promise<Contract> {
    const [newContract] = await db.insert(contracts).values(contract).returning();
    return newContract;
  }

  async updateContract(id: string, contract: Partial<InsertContract>): Promise<Contract> {
    const [updatedContract] = await db
      .update(contracts)
      .set({ ...contract, updatedAt: new Date() })
      .where(eq(contracts.id, id))
      .returning();
    return updatedContract;
  }

  async deleteContract(id: string): Promise<void> {
    await db.delete(contracts).where(eq(contracts.id, id));
  }

  async getContractsByFilters(filters: {
    status?: string;
    territory?: string;
    search?: string;
  }): Promise<Contract[]> {
    let query = db.select().from(contracts);
    
    const conditions = [];
    
    if (filters.status) {
      conditions.push(eq(contracts.status, filters.status as any));
    }
    
    if (filters.territory) {
      conditions.push(eq(contracts.territory, filters.territory));
    }
    
    if (filters.search) {
      conditions.push(
        or(
          sql`${contracts.partner} ILIKE ${`%${filters.search}%`}`,
          sql`${contracts.licensee} ILIKE ${`%${filters.search}%`}`,
          sql`${contracts.licensor} ILIKE ${`%${filters.search}%`}`
        )
      );
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(contracts.createdAt));
  }

  // Rights availability
  async checkRightsAvailability(params: {
    partner: string;
    territory: string;
    platform: string;
    startDate: string;
    endDate: string;
  }): Promise<{ available: boolean; conflicts: Contract[] }> {
    const conflicts = await db
      .select()
      .from(contracts)
      .where(
        and(
          eq(contracts.partner, params.partner),
          eq(contracts.territory, params.territory),
          eq(contracts.platform, params.platform),
          or(
            eq(contracts.status, "Active"),
            eq(contracts.status, "Pending")
          ),
          // Date overlap: contract overlaps if contract.start <= check.end AND contract.end >= check.start
          and(
            lte(contracts.startDate, params.endDate),
            gte(contracts.endDate, params.startDate)
          )
        )
      );

    return {
      available: conflicts.length === 0,
      conflicts,
    };
  }

  // Royalty operations
  async getRoyalties(): Promise<(Royalty & { contract: Contract })[]> {
    return await db
      .select()
      .from(royalties)
      .leftJoin(contracts, eq(royalties.contractId, contracts.id))
      .orderBy(desc(royalties.calculatedAt))
      .then(rows => 
        rows.map(row => ({
          ...row.royalties,
          contract: row.contracts!
        }))
      );
  }

  async getRoyalty(id: string): Promise<Royalty | undefined> {
    const [royalty] = await db.select().from(royalties).where(eq(royalties.id, id));
    return royalty;
  }

  async createRoyalty(royalty: InsertRoyalty): Promise<Royalty> {
    const [newRoyalty] = await db.insert(royalties).values(royalty).returning();
    return newRoyalty;
  }

  async updateRoyalty(id: string, royalty: Partial<InsertRoyalty>): Promise<Royalty> {
    const [updatedRoyalty] = await db
      .update(royalties)
      .set(royalty)
      .where(eq(royalties.id, id))
      .returning();
    return updatedRoyalty;
  }

  async getRoyaltiesByContract(contractId: string): Promise<Royalty[]> {
    return await db
      .select()
      .from(royalties)
      .where(eq(royalties.contractId, contractId))
      .orderBy(desc(royalties.calculatedAt));
  }

  // Audit operations
  async getAuditLogs(filters?: {
    action?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<(AuditLog & { user: User | null })[]> {
    let query = db
      .select()
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id));

    const conditions = [];

    if (filters?.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }

    if (filters?.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }

    if (filters?.startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(filters.startDate)));
    }

    if (filters?.endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(filters.endDate)));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query
      .orderBy(desc(auditLogs.createdAt))
      .then(rows => 
        rows.map(row => ({
          ...row.audit_logs,
          user: row.users
        }))
      );
  }

  async createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog> {
    const [newAuditLog] = await db.insert(auditLogs).values(auditLog).returning();
    return newAuditLog;
  }

  // Dashboard stats
  async getDashboardStats(period: string = "month"): Promise<{
    activeContracts: number;
    expiringSoon: number;
    totalRoyalties: string;
    pendingReviews: number;
    periodLabel: string;
  }> {
    const [activeContractsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(contracts)
      .where(eq(contracts.status, "Active"));

    const expiringDate = new Date();
    expiringDate.setDate(expiringDate.getDate() + 60); // 60 days from now

    const [expiringSoonResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(contracts)
      .where(
        and(
          eq(contracts.status, "Active"),
          lte(contracts.endDate, expiringDate.toISOString().split('T')[0])
        )
      );

    // Calculate date range based on period
    const now = new Date();
    let periodStart: Date;
    let periodLabel: string;
    
    switch (period) {
      case "quarter":
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        periodStart = new Date(now.getFullYear(), quarterMonth, 1);
        periodLabel = `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
        break;
      case "year":
        periodStart = new Date(now.getFullYear(), 0, 1);
        periodLabel = `${now.getFullYear()}`;
        break;
      case "month":
      default:
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });
        break;
    }

    const [totalRoyaltiesResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(royalty_amount), 0)` })
      .from(royalties)
      .where(
        and(
          eq(royalties.status, "Paid"),
          gte(royalties.calculatedAt, periodStart)
        )
      );

    const [pendingReviewsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(royalties)
      .where(eq(royalties.status, "Pending"));

    return {
      activeContracts: activeContractsResult.count,
      expiringSoon: expiringSoonResult.count,
      totalRoyalties: totalRoyaltiesResult.total,
      pendingReviews: pendingReviewsResult.count,
      periodLabel,
    };
  }
}

export const storage = new DatabaseStorage();
