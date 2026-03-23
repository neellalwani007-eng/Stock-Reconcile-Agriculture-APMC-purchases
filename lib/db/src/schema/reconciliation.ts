import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const saleRecords = pgTable("sale_records", {
  id: serial("id").primaryKey(),
  saleDate: text("sale_date").notNull(),
  item: text("item").notNull(),
  qty: numeric("qty", { precision: 12, scale: 4 }).notNull(),
  rate: numeric("rate", { precision: 12, scale: 4 }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 4 }).notNull(),
  purchaseBillDate: text("purchase_bill_date"),
  status: text("status").notNull().default("Pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const purchaseRecords = pgTable("purchase_records", {
  id: serial("id").primaryKey(),
  billDate: text("bill_date").notNull(),
  purchaseDate: text("purchase_date").notNull(),
  item: text("item").notNull(),
  qty: numeric("qty", { precision: 12, scale: 4 }).notNull(),
  rate: numeric("rate", { precision: 12, scale: 4 }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 4 }).notNull(),
  status: text("status").notNull().default("Unmatched"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSaleRecordSchema = createInsertSchema(saleRecords).omit({ id: true, createdAt: true });
export const insertPurchaseRecordSchema = createInsertSchema(purchaseRecords).omit({ id: true, createdAt: true });

export type InsertSaleRecord = z.infer<typeof insertSaleRecordSchema>;
export type SaleRecord = typeof saleRecords.$inferSelect;
export type InsertPurchaseRecord = z.infer<typeof insertPurchaseRecordSchema>;
export type PurchaseRecord = typeof purchaseRecords.$inferSelect;
