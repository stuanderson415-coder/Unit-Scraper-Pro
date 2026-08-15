import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const unitHistoryTable = pgTable("unit_history", {
  id: serial("id").primaryKey(),
  unitCode: text("unit_code").notNull(),
  unitTitle: text("unit_title").notNull(),
  source: text("source").notNull(), // 'code' or 'pdf'
  lookedUpAt: timestamp("looked_up_at").defaultNow().notNull(),
});

export const insertUnitHistorySchema = createInsertSchema(
  unitHistoryTable,
).omit({ id: true, lookedUpAt: true });
export type InsertUnitHistory = z.infer<typeof insertUnitHistorySchema>;
export type UnitHistory = typeof unitHistoryTable.$inferSelect;
