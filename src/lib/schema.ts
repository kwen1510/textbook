import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const progressState = pgEnum("progress_state", ["unread", "reading", "completed", "needs_review"]);
export const noteType = pgEnum("note_type", ["note", "highlight", "question", "voice"]);
export const transcriptionStatus = pgEnum("transcription_status", ["pending", "completed", "failed"]);

export const courseSources = pgTable("course_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  repository: text("repository").notNull(),
  commitSha: varchar("commit_sha", { length: 64 }).notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow().notNull(),
});

export const chapters = pgTable("chapters", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  sourcePath: text("source_path").notNull(),
  orderIndex: integer("order_index").notNull(),
});

export const sections = pgTable("sections", {
  id: text("id").primaryKey(),
  chapterId: text("chapter_id").notNull(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  sourcePath: text("source_path").notNull(),
  orderIndex: integer("order_index").notNull(),
});

export const notes = pgTable("notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  sectionId: text("section_id").notNull(),
  type: noteType("type").default("note").notNull(),
  body: text("body").notNull(),
  tags: text("tags").array().default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("notes_user_section_idx").on(table.userId, table.sectionId),
  index("notes_user_updated_idx").on(table.userId, table.updatedAt),
]);

export const progress = pgTable("progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  sectionId: text("section_id").notNull(),
  state: progressState("state").default("unread").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("progress_user_section_unique").on(table.userId, table.sectionId),
]);

export const recallPrompts = pgTable("recall_prompts", {
  id: uuid("id").defaultRandom().primaryKey(),
  sectionId: text("section_id").notNull(),
  prompt: text("prompt").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const recallAttempts = pgTable("recall_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  sectionId: text("section_id").notNull(),
  prompt: text("prompt").notNull(),
  answer: text("answer").notNull(),
  rating: text("rating").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("recall_attempts_user_section_idx").on(table.userId, table.sectionId),
]);

export const transcriptionJobs = pgTable("transcription_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  sectionId: text("section_id"),
  status: transcriptionStatus("status").default("pending").notNull(),
  model: text("model").default("whisper-large-v3-turbo").notNull(),
  transcript: text("transcript"),
  error: text("error"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
