ALTER TYPE "public"."event_kind" ADD VALUE 'error_sync';--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"database_id" uuid NOT NULL,
	"storage_channel_id" uuid,
	"method" text NOT NULL,
	"status" "status" DEFAULT 'waiting' NOT NULL,
	"files_transferred" integer,
	"bytes_transferred" bigint,
	"files_deleted" integer,
	"error" text,
	"duration_ms" bigint,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "databases" ADD COLUMN "sync_channel_id" uuid;--> statement-breakpoint
ALTER TABLE "databases" ADD COLUMN "sync_policy" text;--> statement-breakpoint
ALTER TABLE "job_log" ADD COLUMN "sync_run_id" uuid;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_database_id_databases_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."databases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_storage_channel_id_storage_channel_id_fk" FOREIGN KEY ("storage_channel_id") REFERENCES "public"."storage_channel"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_sync_runs_database" ON "sync_runs" USING btree ("database_id","created_at");--> statement-breakpoint
ALTER TABLE "databases" ADD CONSTRAINT "databases_sync_channel_id_storage_channel_id_fk" FOREIGN KEY ("sync_channel_id") REFERENCES "public"."storage_channel"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_log" ADD CONSTRAINT "job_log_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE cascade ON UPDATE no action;