import {
  users,
  contracts,
  royalties,
  auditLogs,
  contentItems,
  contractContent,
  type User,
  type UpsertUser,
  type Contract,
  type InsertContract,
  type Royalty,
  type InsertRoyalty,
  type AuditLog,
  type InsertAuditLog,
  type ContentItem,
  type InsertContentItem,
  type ContractContent,
  type InsertContractContent,
} from "../shared/schema";
import { db } from "./db";
import { eq, and, or, gte, lte, lt, desc, sql, inArray, isNull, ne } from "drizzle-orm";

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
    filter?: string;
    expiring?: string;
  }): Promise<Contract[]>;

  // Rights availability
  checkRightsAvailability(params: {
    partner: string;
    territory?: string;
    platform?: string;
    startDate: string;
    endDate: string;
  }): Promise<{ available: boolean; conflicts: Contract[]; suggestions?: { territories: string[]; platforms: string[] } }>;

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

  // Content catalog operations
  getContentItems(): Promise<ContentItem[]>;
  getContentItem(id: string): Promise<ContentItem | undefined>;
  createContentItem(item: InsertContentItem): Promise<ContentItem>;
  updateContentItem(id: string, item: Partial<InsertContentItem>): Promise<ContentItem>;
  deleteContentItem(id: string): Promise<void>;

  // Contract-Content linking
  getContractContent(contractId: string): Promise<(ContractContent & { content: ContentItem })[]>;
  getContentContracts(contentId: string): Promise<(ContractContent & { contract: Contract })[]>;
  linkContentToContract(link: InsertContractContent): Promise<ContractContent>;
  unlinkContentFromContract(contractId: string, contentId: string): Promise<void>;
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
  
  // Helper method to auto-update expired contracts
  private async updateExpiredContracts(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Update contracts where:
    // - status is "Active"
    // - endDate is in the past
    // - autoRenew is false or null
    await db
      .update(contracts)
      .set({ status: "Expired", updatedAt: new Date() })
      .where(
        and(
          eq(contracts.status, "Active"),
          lt(contracts.endDate, today),
          or(
            eq(contracts.autoRenew, false),
            isNull(contracts.autoRenew)
          )
        )
      );
  }
  
  async getContracts(): Promise<Contract[]> {
    // Auto-update any expired contracts before fetching
    await this.updateExpiredContracts();
    return await db.select().from(contracts).orderBy(desc(contracts.createdAt));
  }

  async getContract(id: string): Promise<Contract | undefined> {
    // Auto-update any expired contracts before fetching
    await this.updateExpiredContracts();
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
    // Delete related royalties first
    await db.delete(royalties).where(eq(royalties.contractId, id));
    // Delete related contract-content links
    await db.delete(contractContent).where(eq(contractContent.contractId, id));
    // Now delete the contract
    await db.delete(contracts).where(eq(contracts.id, id));
  }

  async getContractsByFilters(filters: {
    status?: string;
    territory?: string;
    search?: string;
    filter?: string;
    expiring?: string;
  }): Promise<Contract[]> {
    // Auto-update any expired contracts before fetching
    await this.updateExpiredContracts();
    let query = db.select().from(contracts);
    
    const conditions = [];
    
    if (filters.status) {
      conditions.push(eq(contracts.status, filters.status as any));
    }
    
    if (filters.territory) {
      // Use ILIKE for partial match to handle comma-separated territories like "US, Canada"
      conditions.push(sql`${contracts.territory} ILIKE ${`%${filters.territory}%`}`);
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
    
    // Handle expiring filter (30, 60, 90 days)
    if (filters.expiring && ['30', '60', '90'].includes(filters.expiring)) {
      const days = parseInt(filters.expiring);
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const expiringDate = new Date();
      expiringDate.setDate(expiringDate.getDate() + days);
      const expiringDateStr = expiringDate.toISOString().split('T')[0];
      
      conditions.push(eq(contracts.status, 'Active'));
      conditions.push(sql`${contracts.endDate} IS NOT NULL`);
      conditions.push(sql`${contracts.endDate}::date >= ${todayStr}::date`);
      conditions.push(sql`${contracts.endDate}::date <= ${expiringDateStr}::date`);
    } else if (filters.filter === 'expiring') {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const expiringDate = new Date();
      expiringDate.setDate(expiringDate.getDate() + 60);
      const expiringDateStr = expiringDate.toISOString().split('T')[0];
      
      conditions.push(eq(contracts.status, 'Active'));
      conditions.push(sql`${contracts.endDate} IS NOT NULL`);
      conditions.push(sql`${contracts.endDate}::date >= ${todayStr}::date`);
      conditions.push(sql`${contracts.endDate}::date <= ${expiringDateStr}::date`);
    } else if (filters.filter === 'active') {
      conditions.push(eq(contracts.status, 'Active'));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(contracts.createdAt));
  }

  // Rights availability
  async checkRightsAvailability(params: {
    partner: string;
    territory?: string;
    platform?: string;
    startDate: string;
    endDate: string;
  }): Promise<{ available: boolean; conflicts: Contract[]; suggestions?: { territories: string[]; platforms: string[] } }> {
    // Build conditions - territory and platform can be comma-separated in DB
    const conditions: any[] = [
      eq(contracts.partner, params.partner),
      or(
        eq(contracts.status, "Active"),
        eq(contracts.status, "In Perpetuity")
      ),
      // Date overlap: contract overlaps if contract.start <= check.end AND contract.end >= check.start
      and(
        lte(contracts.startDate, params.endDate),
        or(
          gte(contracts.endDate, params.startDate),
          isNull(contracts.endDate) // Handle auto-renew contracts with no end date
        )
      )
    ];

    // Only add territory filter if provided
    if (params.territory) {
      conditions.push(sql`${contracts.territory} ILIKE ${'%' + params.territory + '%'}`);
    }

    // Only add platform filter if provided
    if (params.platform) {
      conditions.push(sql`${contracts.platform} ILIKE ${'%' + params.platform + '%'}`);
    }

    const conflicts = await db
      .select()
      .from(contracts)
      .where(and(...conditions));

    // Check if any conflicts are exclusive - if so, suggest alternatives
    const hasExclusive = conflicts.some((c: Contract) => c.exclusivity === "Exclusive");
    let suggestions: { territories: string[]; platforms: string[] } | undefined;

    if (hasExclusive) {
      // Find territories and platforms where this partner's content is NOT exclusively licensed
      const allTerritories = ["Global", "US", "Canada", "UK"];
      const allPlatforms = ["SVOD", "TVOD", "AVOD", "FAST", "Linear"];

      // Get all exclusive contracts for this partner in the date range
      const exclusiveContracts = await db
        .select()
        .from(contracts)
        .where(
          and(
            eq(contracts.partner, params.partner),
            eq(contracts.exclusivity, "Exclusive"),
            or(
              eq(contracts.status, "Active"),
              eq(contracts.status, "In Perpetuity")
            ),
            and(
              lte(contracts.startDate, params.endDate),
              gte(contracts.endDate, params.startDate)
            )
          )
        );

      const exclusiveTerritories = new Set(exclusiveContracts.map((c: Contract) => c.territory));
      const exclusivePlatforms = new Set(exclusiveContracts.map((c: Contract) => c.platform));

      suggestions = {
        territories: allTerritories.filter(t => !exclusiveTerritories.has(t)),
        platforms: allPlatforms.filter(p => !exclusivePlatforms.has(p)),
      };
    }

    return {
      available: conflicts.length === 0,
      conflicts,
      suggestions,
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

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const expiringDate = new Date();
    expiringDate.setDate(expiringDate.getDate() + 60); // 60 days from now
    const expiringDateStr = expiringDate.toISOString().split('T')[0];

    const [expiringSoonResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(contracts)
      .where(
        and(
          eq(contracts.status, "Active"),
          sql`${contracts.endDate} IS NOT NULL`,
          sql`${contracts.endDate}::date >= ${todayStr}::date`,
          sql`${contracts.endDate}::date <= ${expiringDateStr}::date`
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

  // Content catalog operations
  async getContentItems(): Promise<ContentItem[]> {
    return await db.select().from(contentItems).orderBy(desc(contentItems.createdAt));
  }

  async getContentItem(id: string): Promise<ContentItem | undefined> {
    const [item] = await db.select().from(contentItems).where(eq(contentItems.id, id));
    return item;
  }

  async createContentItem(item: InsertContentItem): Promise<ContentItem> {
    const [created] = await db.insert(contentItems).values(item).returning();
    return created;
  }

  async updateContentItem(id: string, item: Partial<InsertContentItem>): Promise<ContentItem> {
    const [updated] = await db
      .update(contentItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(contentItems.id, id))
      .returning();
    return updated;
  }

  async deleteContentItem(id: string): Promise<void> {
    await db.delete(contractContent).where(eq(contractContent.contentId, id));
    await db.delete(contentItems).where(eq(contentItems.id, id));
  }

  // Contract-Content linking
  async getContractContent(contractId: string): Promise<(ContractContent & { content: ContentItem })[]> {
    const links = await db
      .select()
      .from(contractContent)
      .innerJoin(contentItems, eq(contractContent.contentId, contentItems.id))
      .where(eq(contractContent.contractId, contractId));
    
    return links.map(row => ({
      ...row.contract_content,
      content: row.content_items,
    }));
  }

  async getContentContracts(contentId: string): Promise<(ContractContent & { contract: Contract })[]> {
    const links = await db
      .select()
      .from(contractContent)
      .innerJoin(contracts, eq(contractContent.contractId, contracts.id))
      .where(eq(contractContent.contentId, contentId));
    
    return links.map(row => ({
      ...row.contract_content,
      contract: row.contracts,
    }));
  }

  async linkContentToContract(link: InsertContractContent): Promise<ContractContent> {
    const [created] = await db.insert(contractContent).values(link).returning();
    return created;
  }

  async unlinkContentFromContract(contractId: string, contentId: string): Promise<void> {
    await db
      .delete(contractContent)
      .where(
        and(
          eq(contractContent.contractId, contractId),
          eq(contractContent.contentId, contentId)
        )
      );
  }
}

export const storage = new DatabaseStorage();
