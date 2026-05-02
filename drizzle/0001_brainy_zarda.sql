CREATE TABLE "review_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"section_id" text NOT NULL,
	"mode" text DEFAULT 'open' NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"mastery_score" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_rating" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "review_schedules_user_section_unique" ON "review_schedules" USING btree ("user_id","section_id");--> statement-breakpoint
CREATE INDEX "review_schedules_user_due_idx" ON "review_schedules" USING btree ("user_id","due_at");--> statement-breakpoint
ALTER TABLE "review_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "review_schedules_user_isolation" ON "review_schedules" USING ("user_id" = current_setting('app.current_user_id', true));
