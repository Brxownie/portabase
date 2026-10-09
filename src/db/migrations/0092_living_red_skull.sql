ALTER TABLE "backup_storage" ADD COLUMN "stats" jsonb;--> statement-breakpoint
UPDATE "backup_storage" SET "stats" = jsonb_build_object('filesTransferred', "files_transferred", 'filesDeleted', COALESCE("files_deleted", 0), 'replicaBytes', NULL) WHERE "files_transferred" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "backup_storage" DROP COLUMN "files_transferred";--> statement-breakpoint
ALTER TABLE "backup_storage" DROP COLUMN "files_deleted";
