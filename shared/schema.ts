import { sql } from "drizzle-orm";
import { pgTable, text, varchar, json, real, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const audioFiles = pgTable("audio_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  duration: real("duration").notNull(),
  filePath: text("file_path").notNull(),
});

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  data: json("data").notNull(), // Contains tracks, clips, settings etc.
  createdAt: text("created_at").default(sql`(now())`),
  updatedAt: text("updated_at").default(sql`(now())`),
});

export const insertAudioFileSchema = createInsertSchema(audioFiles).pick({
  name: true,
  originalName: true,
  mimeType: true,
  size: true,
  duration: true,
  filePath: true,
});

export const insertProjectSchema = createInsertSchema(projects).pick({
  name: true,
  data: true,
});

export type InsertAudioFile = z.infer<typeof insertAudioFileSchema>;
export type AudioFile = typeof audioFiles.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
