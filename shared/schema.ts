import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  decimal,
  boolean,
  date,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { enum: ["Admin", "Legal", "Finance", "Sales Manager", "Sales"] }).notNull().default("Sales"),
  isActive: boolean("is_active").notNull().default(true),
  inviteToken: varchar("invite_token"),
  inviteTokenExpiry: timestamp("invite_token_expiry"),
  inviteStatus: varchar("invite_status", { enum: ["pending", "accepted"] }),
  resetToken: varchar("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contracts table
export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partner: varchar("partner").notNull(),
  licensor: varchar("licensor").notNull(),
  licensee: varchar("licensee").notNull(),
  territory: varchar("territory").notNull(),
  platform: varchar("platform"),
  content: varchar("content"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  autoRenew: boolean("auto_renew").default(false),
  royaltyType: varchar("royalty_type", { enum: ["Revenue Share", "Flat Fee"] }).default("Revenue Share"),
  royaltyRate: decimal("royalty_rate", { precision: 5, scale: 2 }),
  flatFeeAmount: decimal("flat_fee_amount", { precision: 15, scale: 2 }),
  exclusivity: varchar("exclusivity", { enum: ["Exclusive", "Non-Exclusive", "Limited Exclusive"] }).default("Non-Exclusive"),
  status: varchar("status", { enum: ["Active", "Expired", "In Perpetuity", "Terminated"] }).default("Active"),
  reportingFrequency: varchar("reporting_frequency", { enum: ["Monthly", "Quarterly", "Annually", "None"] }).default("None"),
  paymentTerms: varchar("payment_terms", { enum: ["Net 30", "Net 60", "Net 90"] }).default("Net 30"),
  minimumPayment: decimal("minimum_payment", { precision: 15, scale: 2 }),
  contractDocumentUrl: varchar("contract_document_url"),
  parentContractId: varchar("parent_contract_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

// Royalty calculations table
export const royalties = pgTable("royalties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").references(() => contracts.id).notNull(),
  reportingPeriod: varchar("reporting_period").notNull(),
  revenue: decimal("revenue", { precision: 15, scale: 2 }).notNull(),
  royaltyAmount: decimal("royalty_amount", { precision: 15, scale: 2 }).notNull(),
  status: varchar("status", { enum: ["Pending", "Approved", "Paid"] }).default("Pending"),
  calculatedAt: timestamp("calculated_at").defaultNow(),
  calculatedBy: varchar("calculated_by").references(() => users.id),
});

// Audit trail table
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: varchar("action").notNull(),
  entityType: varchar("entity_type").notNull(),
  entityId: varchar("entity_id"),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  userId: varchar("user_id").references(() => users.id),
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Content catalog table
export const contentItems = pgTable("content_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  type: varchar("type", { enum: ["Film", "TV Series", "TBN FAST", "TBN Linear", "WoF FAST"] }).notNull(),
  description: text("description"),
  season: integer("season"),
  episodeCount: integer("episode_count"),
  releaseYear: integer("release_year"),
  genre: varchar("genre"),
  duration: integer("duration"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

// Contract-Content junction table (many-to-many)
export const contractContent = pgTable("contract_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").references(() => contracts.id).notNull(),
  contentId: varchar("content_id").references(() => contentItems.id).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const contractsRelations = relations(contracts, ({ one, many }) => ({
  creator: one(users, {
    fields: [contracts.createdBy],
    references: [users.id],
  }),
  royalties: many(royalties),
  contractContents: many(contractContent),
}));

export const contentItemsRelations = relations(contentItems, ({ one, many }) => ({
  creator: one(users, {
    fields: [contentItems.createdBy],
    references: [users.id],
  }),
  contractContents: many(contractContent),
}));

export const contractContentRelations = relations(contractContent, ({ one }) => ({
  contract: one(contracts, {
    fields: [contractContent.contractId],
    references: [contracts.id],
  }),
  content: one(contentItems, {
    fields: [contractContent.contentId],
    references: [contentItems.id],
  }),
}));

export const royaltiesRelations = relations(royalties, ({ one }) => ({
  contract: one(contracts, {
    fields: [royalties.contractId],
    references: [contracts.id],
  }),
  calculator: one(users, {
    fields: [royalties.calculatedBy],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  createdContracts: many(contracts),
  calculatedRoyalties: many(royalties),
  auditLogs: many(auditLogs),
  createdContentItems: many(contentItems),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  partner: z.string().min(1, "Partner name is required"),
  content: z.string().min(1, "Content/Title is required"),
  licensor: z.string().min(1, "Licensor is required"),
  licensee: z.string().min(1, "Licensee is required"),
  territory: z.string().min(1, "Territory is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

export const insertRoyaltySchema = createInsertSchema(royalties).omit({
  id: true,
  calculatedAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertContentItemSchema = createInsertSchema(contentItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContractContentSchema = createInsertSchema(contractContent).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contracts.$inferSelect;
export type InsertRoyalty = z.infer<typeof insertRoyaltySchema>;
export type Royalty = typeof royalties.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertContentItem = z.infer<typeof insertContentItemSchema>;
export type ContentItem = typeof contentItems.$inferSelect;
export type InsertContractContent = z.infer<typeof insertContractContentSchema>;
export type ContractContent = typeof contractContent.$inferSelect;

// Availability request schema
export const availabilityRequestSchema = z.object({
  partner: z.string().min(1, "Partner name is required"),
  territory: z.string().min(1, "Territory is required"),
  platform: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be in YYYY-MM-DD format"),
}).refine(
  (data) => new Date(data.startDate) <= new Date(data.endDate),
  { message: "End date must be after start date", path: ["endDate"] }
);

export type AvailabilityRequest = z.infer<typeof availabilityRequestSchema>;

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["Admin", "Legal", "Finance", "Sales Manager", "Sales"]),
});

export const inviteUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["Admin", "Legal", "Finance", "Sales Manager", "Sales"]),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1, "Invite token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const updateUserSchema = createUserSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type LoginData = z.infer<typeof loginSchema>;
export type CreateUserData = z.infer<typeof createUserSchema>;
export type InviteUserData = z.infer<typeof inviteUserSchema>;
export type AcceptInviteData = z.infer<typeof acceptInviteSchema>;
export type UpdateUserData = z.infer<typeof updateUserSchema>;
