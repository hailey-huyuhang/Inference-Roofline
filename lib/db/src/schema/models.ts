import { boolean, integer, pgTable, real, serial, text } from "drizzle-orm/pg-core";

export const modelsTable = pgTable("models", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  paramsBillions: real("params_billions").notNull(),
  numLayers: integer("num_layers").notNull(),
  hiddenSize: integer("hidden_size").notNull(),
  numAttentionHeads: integer("num_attention_heads").notNull(),
  numKvHeads: integer("num_kv_heads").notNull(),
  isMoe: boolean("is_moe").notNull().default(false),
  activeParamsBillions: real("active_params_billions").notNull(),
});

export type Model = typeof modelsTable.$inferSelect;