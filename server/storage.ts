import {
  type User, type InsertUser,
  type Template, type InsertTemplate,
  type AiPrompt, type InsertAiPrompt,
  type Dictation, type InsertDictation,
  users, templates, aiPrompts, dictations,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getTemplates(): Promise<Template[]>;
  getTemplate(id: number): Promise<Template | undefined>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  updateTemplate(id: number, data: Partial<InsertTemplate>): Promise<Template | undefined>;
  deleteTemplate(id: number): Promise<void>;

  getPrompts(): Promise<AiPrompt[]>;
  getPrompt(id: number): Promise<AiPrompt | undefined>;
  getPromptByType(promptType: string): Promise<AiPrompt | undefined>;
  createPrompt(prompt: InsertAiPrompt): Promise<AiPrompt>;
  updatePrompt(id: number, data: Partial<InsertAiPrompt>): Promise<AiPrompt | undefined>;
  deletePrompt(id: number): Promise<void>;

  getDictations(): Promise<Dictation[]>;
  getDictation(id: number): Promise<Dictation | undefined>;
  createDictation(dictation: InsertDictation): Promise<Dictation>;
  updateDictation(id: number, data: Partial<InsertDictation>): Promise<Dictation | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getTemplates(): Promise<Template[]> {
    return db.select().from(templates).orderBy(desc(templates.createdAt));
  }

  async getTemplate(id: number): Promise<Template | undefined> {
    const [template] = await db.select().from(templates).where(eq(templates.id, id));
    return template || undefined;
  }

  async createTemplate(template: InsertTemplate): Promise<Template> {
    const [created] = await db.insert(templates).values(template).returning();
    return created;
  }

  async updateTemplate(id: number, data: Partial<InsertTemplate>): Promise<Template | undefined> {
    const [updated] = await db.update(templates).set({ ...data, updatedAt: new Date() }).where(eq(templates.id, id)).returning();
    return updated || undefined;
  }

  async deleteTemplate(id: number): Promise<void> {
    await db.delete(templates).where(eq(templates.id, id));
  }

  async getPrompts(): Promise<AiPrompt[]> {
    return db.select().from(aiPrompts).orderBy(desc(aiPrompts.createdAt));
  }

  async getPrompt(id: number): Promise<AiPrompt | undefined> {
    const [prompt] = await db.select().from(aiPrompts).where(eq(aiPrompts.id, id));
    return prompt || undefined;
  }

  async getPromptByType(promptType: string): Promise<AiPrompt | undefined> {
    const [prompt] = await db.select().from(aiPrompts).where(eq(aiPrompts.promptType, promptType));
    return prompt || undefined;
  }

  async createPrompt(prompt: InsertAiPrompt): Promise<AiPrompt> {
    const [created] = await db.insert(aiPrompts).values(prompt).returning();
    return created;
  }

  async updatePrompt(id: number, data: Partial<InsertAiPrompt>): Promise<AiPrompt | undefined> {
    const [updated] = await db.update(aiPrompts).set({ ...data, updatedAt: new Date() }).where(eq(aiPrompts.id, id)).returning();
    return updated || undefined;
  }

  async deletePrompt(id: number): Promise<void> {
    await db.delete(aiPrompts).where(eq(aiPrompts.id, id));
  }

  async getDictations(): Promise<Dictation[]> {
    return db.select().from(dictations).orderBy(desc(dictations.createdAt));
  }

  async getDictation(id: number): Promise<Dictation | undefined> {
    const [dictation] = await db.select().from(dictations).where(eq(dictations.id, id));
    return dictation || undefined;
  }

  async createDictation(dictation: InsertDictation): Promise<Dictation> {
    const [created] = await db.insert(dictations).values(dictation).returning();
    return created;
  }

  async updateDictation(id: number, data: Partial<InsertDictation>): Promise<Dictation | undefined> {
    const [updated] = await db.update(dictations).set(data).where(eq(dictations.id, id)).returning();
    return updated || undefined;
  }
}

export const storage = new DatabaseStorage();
