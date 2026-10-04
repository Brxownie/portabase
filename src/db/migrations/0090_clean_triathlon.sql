ALTER TABLE "databases" DROP CONSTRAINT "databases_sync_channel_id_storage_channel_id_fk";
--> statement-breakpoint
ALTER TABLE "job_log" DROP CONSTRAINT "job_log_sync_run_id_sync_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "sync_runs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "sync_runs" CASCADE;--> statement-breakpoint
ALTER TABLE "alert_policy" ALTER COLUMN "event_kind" SET DATA TYPE text[] USING "event_kind"::text[];--> statement-breakpoint
UPDATE "alert_policy" SET "event_kind" = array_remove("event_kind", 'error_sync') WHERE 'error_sync' = ANY("event_kind");--> statement-breakpoint
DROP TYPE "public"."event_kind";--> statement-breakpoint
CREATE TYPE "public"."event_kind" AS ENUM('error_backup', 'error_restore', 'success_restore', 'success_backup', 'weekly_report', 'error_health_agent', 'error_health_database', 'error_backup_missing', 'success_backup_recovered');--> statement-breakpoint
ALTER TABLE "alert_policy" ALTER COLUMN "event_kind" SET DATA TYPE "public"."event_kind"[] USING "event_kind"::"public"."event_kind"[];--> statement-breakpoint
ALTER TABLE "databases" DROP COLUMN "sync_channel_id";--> statement-breakpoint
ALTER TABLE "databases" DROP COLUMN "sync_policy";--> statement-breakpoint
ALTER TABLE "job_log" DROP COLUMN "sync_run_id";
