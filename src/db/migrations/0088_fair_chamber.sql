CREATE TYPE "public"."backup_engine" AS ENUM('archive', 'restic');--> statement-breakpoint
ALTER TABLE "databases" ADD COLUMN "backup_engine" "backup_engine" DEFAULT 'archive' NOT NULL;--> statement-breakpoint
ALTER TABLE "backup_storage" ADD COLUMN "engine" "backup_engine" DEFAULT 'archive' NOT NULL;