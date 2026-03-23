import { pgTable, serial, text, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const saleRecords = pgTable("sale_records", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  saleDate: text("sale_date").notNull(),
  item: text("item").notNull(),
  qty: numeric("qty", { precision: 12, scale: 4 }).notNull(),
  rate: numeric("rate", { precision: 12, scale: 4 }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 4 }).notNull(),
  purchaseBillDate: text("purchase_bill_date"),
  status: text("status").notNull().default("Pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("sale_records_user_idx").on(t.userId),
  index("sale_records_date_idx").on(t.userId, t.saleDate),
]);

export const purchaseRecords = pgTable("purchase_records", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  billDate: text("bill_date").notNull(),
  purchaseDate: text("purchase_date").notNull(),
  item: text("item").notNull(),
  qty: numeric("qty", { precision: 12, scale: 4 }).notNull(),
  rate: numeric("rate", { precision: 12, scale: 4 }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 4 }).notNull(),
  status: text("status").notNull().default("Unmatched"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("purchase_records_user_idx").on(t.userId),
  index("purchase_records_date_idx").on(t.userId, t.billDate),
]);

export const insertSaleRecordSchema = createInsertSchema(saleRecords).omit({ id: true, createdAt: true });
export const insertPurchaseRecordSchema = createInsertSchema(purchaseRecords).omit({ id: true, createdAt: true });

export type InsertSaleRecord = z.infer<typeof insertSaleRecordSchema>;
export type SaleRecord = typeof saleRecords.$inferSelect;
export type InsertPurchaseRecord = z.infer<typeof insertPurchaseRecordSchema>;
export type PurchaseRecord = typeof purchaseRecords.$inferSelect;
