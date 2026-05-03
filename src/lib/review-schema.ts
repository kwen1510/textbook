import { sql } from "drizzle-orm";
import { getDb } from "./db";

let ensuredReviewSchema = false;

export async function ensureReviewScheduleSchema() {
  if (ensuredReviewSchema) return;
  const db = getDb();

  await db.execute(sql`create extension if not exists "pgcrypto"`);
  await db.execute(sql`
    create table if not exists "review_schedules" (
      "id" uuid primary key default gen_random_uuid() not null,
      "user_id" text not null,
      "section_id" text not null,
      "mode" text default 'open' not null,
      "due_at" timestamp with time zone default now() not null,
      "interval_days" integer default 0 not null,
      "mastery_score" integer default 0 not null,
      "attempts" integer default 0 not null,
      "last_rating" text,
      "updated_at" timestamp with time zone default now() not null
    )
  `);
  await db.execute(sql`alter table "review_schedules" add column if not exists "mode" text default 'open' not null`);
  await db.execute(sql`alter table "review_schedules" add column if not exists "due_at" timestamp with time zone default now() not null`);
  await db.execute(sql`alter table "review_schedules" add column if not exists "interval_days" integer default 0 not null`);
  await db.execute(sql`alter table "review_schedules" add column if not exists "mastery_score" integer default 0 not null`);
  await db.execute(sql`alter table "review_schedules" add column if not exists "attempts" integer default 0 not null`);
  await db.execute(sql`alter table "review_schedules" add column if not exists "last_rating" text`);
  await db.execute(sql`alter table "review_schedules" add column if not exists "updated_at" timestamp with time zone default now() not null`);
  await db.execute(sql`create unique index if not exists "review_schedules_user_section_unique" on "review_schedules" using btree ("user_id", "section_id")`);
  await db.execute(sql`create index if not exists "review_schedules_user_due_idx" on "review_schedules" using btree ("user_id", "due_at")`);
  await db.execute(sql`alter table "review_schedules" enable row level security`);
  await db.execute(sql`
    do $$
    begin
      if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'review_schedules'
          and policyname = 'review_schedules_user_isolation'
      ) then
        create policy "review_schedules_user_isolation"
        on "review_schedules"
        using ("user_id" = current_setting('app.current_user_id', true));
      end if;
    end
    $$;
  `);

  ensuredReviewSchema = true;
}
