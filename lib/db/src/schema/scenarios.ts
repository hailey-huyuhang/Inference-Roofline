import { integer, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";

export const scenariosTable = pgTable("scenarios", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  modelId: integer("model_id").notNull(),
  gpuId: integer("gpu_id").notNull(),
  precision: text("precision").notNull(),
  batchSize: integer("batch_size").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  mfu: real("mfu").notNull().default(0.4),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Scenario = typeof scenariosTable.$inferSelect;