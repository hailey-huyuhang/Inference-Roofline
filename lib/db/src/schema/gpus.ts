import { boolean, integer, pgTable, real, serial, text } from "drizzle-orm/pg-core";

export const gpusTable = pgTable("gpus", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  hbmBandwidthGbS: real("hbm_bandwidth_gb_s").notNull(),
  denseBf16Tflops: real("dense_bf16_tflops").notNull(),
  memoryGb: real("memory_gb").notNull(),
  hourlyCostUsd: real("hourly_cost_usd").notNull(),
});

export type Gpu = typeof gpusTable.$inferSelect;