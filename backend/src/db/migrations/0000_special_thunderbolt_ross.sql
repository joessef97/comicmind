CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."panel_status" AS ENUM('pending', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "generation_job_panels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"panel_number" integer NOT NULL,
	"status" "panel_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"image_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"comic_id" text,
	"draft_id" text,
	"idempotency_key" text,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"total_panels" integer NOT NULL,
	"completed_panels" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "generation_job_panels" ADD CONSTRAINT "generation_job_panels_job_id_generation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."generation_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "generation_job_panels_job_panel_key" ON "generation_job_panels" USING btree ("job_id","panel_number");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_jobs_user_idempotency_key" ON "generation_jobs" USING btree ("user_id","idempotency_key") WHERE "generation_jobs"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "generation_jobs_user_created_idx" ON "generation_jobs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "generation_jobs_status_idx" ON "generation_jobs" USING btree ("status");