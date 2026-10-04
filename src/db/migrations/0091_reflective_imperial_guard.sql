ALTER TYPE "public"."backup_engine" ADD VALUE 'sync';--> statement-breakpoint
ALTER TABLE "databases" ADD COLUMN "method_conflict" text;--> statement-breakpoint
ALTER TABLE "backup_storage" ADD COLUMN "files_transferred" integer;--> statement-breakpoint
ALTER TABLE "backup_storage" ADD COLUMN "files_deleted" integer;