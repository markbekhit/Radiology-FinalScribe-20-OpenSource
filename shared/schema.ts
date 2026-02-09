import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/chat";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const templateSections = z.object({
  name: z.string(),
  key: z.string(),
  normalText: z.string(),
  order: z.number(),
});

export type TemplateSection = z.infer<typeof templateSections>;

export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  region: text("region").notNull(),
  modality: text("modality").notNull().default("MRI"),
  sections: jsonb("sections").notNull().$type<TemplateSection[]>(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const templatesRelations = relations(templates, ({ many }) => ({
  dictations: many(dictations),
}));

export const insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templates.$inferSelect;

export const aiPrompts = pgTable("ai_prompts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  promptType: text("prompt_type").notNull(),
  content: text("content").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertAiPromptSchema = createInsertSchema(aiPrompts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAiPrompt = z.infer<typeof insertAiPromptSchema>;
export type AiPrompt = typeof aiPrompts.$inferSelect;

export const dictations = pgTable("dictations", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").references(() => templates.id),
  rawTranscription: text("raw_transcription"),
  identifiedRegion: text("identified_region"),
  structuredReport: jsonb("structured_report").$type<Record<string, string>>(),
  impressions: text("impressions"),
  status: text("status").notNull().default("recording"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const dictationsRelations = relations(dictations, ({ one }) => ({
  template: one(templates, {
    fields: [dictations.templateId],
    references: [templates.id],
  }),
}));

export const insertDictationSchema = createInsertSchema(dictations).omit({
  id: true,
  createdAt: true,
});

export type InsertDictation = z.infer<typeof insertDictationSchema>;
export type Dictation = typeof dictations.$inferSelect;
