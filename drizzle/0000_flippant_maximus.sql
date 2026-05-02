CREATE TYPE "public"."note_type" AS ENUM('note', 'highlight', 'question', 'voice');--> statement-breakpoint
CREATE TYPE "public"."progress_state" AS ENUM('unread', 'reading', 'completed', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."transcription_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "chapters" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"source_path" text NOT NULL,
	"order_index" integer NOT NULL,
	CONSTRAINT "chapters_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "course_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository" text NOT NULL,
	"commit_sha" varchar(64) NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"section_id" text NOT NULL,
	"type" "note_type" DEFAULT 'note' NOT NULL,
	"body" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"section_id" text NOT NULL,
	"state" "progress_state" DEFAULT 'unread' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recall_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"section_id" text NOT NULL,
	"prompt" text NOT NULL,
	"answer" text NOT NULL,
	"rating" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recall_prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" text NOT NULL,
	"prompt" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" text PRIMARY KEY NOT NULL,
	"chapter_id" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"source_path" text NOT NULL,
	"order_index" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcription_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"section_id" text,
	"status" "transcription_status" DEFAULT 'pending' NOT NULL,
	"model" text DEFAULT 'whisper-large-v3-turbo' NOT NULL,
	"transcript" text,
	"error" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "notes_user_section_idx" ON "notes" USING btree ("user_id","section_id");--> statement-breakpoint
CREATE INDEX "notes_user_updated_idx" ON "notes" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "progress_user_section_unique" ON "progress" USING btree ("user_id","section_id");--> statement-breakpoint
CREATE INDEX "recall_attempts_user_section_idx" ON "recall_attempts" USING btree ("user_id","section_id");--> statement-breakpoint
ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "recall_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transcription_jobs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_user_isolation" ON "notes" USING ("user_id" = current_setting('app.current_user_id', true));--> statement-breakpoint
CREATE POLICY "progress_user_isolation" ON "progress" USING ("user_id" = current_setting('app.current_user_id', true));--> statement-breakpoint
CREATE POLICY "recall_attempts_user_isolation" ON "recall_attempts" USING ("user_id" = current_setting('app.current_user_id', true));--> statement-breakpoint
CREATE POLICY "transcription_jobs_user_isolation" ON "transcription_jobs" USING ("user_id" = current_setting('app.current_user_id', true));
