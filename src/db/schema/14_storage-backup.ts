import {
  pgTable,
  uuid,
  text,
  pgEnum,
  bigint,
  jsonb,
  index,
  timestamp,
} from "drizzle-orm/pg-core";
import { timestamps } from "@/db/schema/00_common";
import { StorageChannel, storageChannel } from "@/db/schema/12_storage-channel";
import { backup } from "@/db/schema/07_database";
import { backupEngineEnum } from "@/db/schema/types";
import { relations, sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const backupStorageStatusEnum = pgEnum("backup_storage_status", [
  "pending",
  "success",
  "failed",
]);

export const backupPresenceEnum = pgEnum("backup_presence", [
  "present",
  "missing",
  "unknown",
]);

const count = z.number().int().nonnegative();
// What one restic snapshot changed (`size` = new data; pack headers, index and snapshot files excluded).
export const snapshotStatsSchema = z.object({
  filesNew: count,
  filesChanged: count,
  filesUnmodified: count,
  // Files of the parent snapshot this one no longer has (null when unknown; absent before it was reported).
  filesRemoved: count.nullable().optional(),
});
// What one sync run changed (`size` = bytes transferred). replicaBytes is null when the
// agent could not measure it; sizeDelta is set by the dashboard from the previous run.
export const syncStatsSchema = z.object({
  filesTransferred: count,
  filesDeleted: count,
  replicaBytes: count.nullable(),
  sizeDelta: z.number().int().nullable().optional(),
});
export type SnapshotStats = z.infer<typeof snapshotStatsSchema>;
export type SyncStats = z.infer<typeof syncStatsSchema>;

export const backupStorage = pgTable(
  "backup_storage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    backupId: uuid("backup_id")
      .notNull()
      .references(() => backup.id, { onDelete: "cascade" }),
    storageChannelId: uuid("storage_channel_id")
      .notNull()
      .references(() => storageChannel.id, { onDelete: "cascade" }),
    status: backupStorageStatusEnum("status").notNull().default("pending"),
    path: text("path"),
    size: bigint("size", { mode: "number" }),
    checksum: text("checksum"),
    // archive: `path` is a file; restic: `path` is a snapshot id (P2); sync: `path` is the replica directory.
    engine: backupEngineEnum("engine").notNull().default("archive"),
    // restic and sync: what the run changed.
    stats: jsonb("stats").$type<SnapshotStats | SyncStats>(),
    presence: backupPresenceEnum("presence").notNull().default("unknown"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastCheckError: text("last_check_error"),
    ...timestamps,
  },
  (table) => [
    index("idx_backup_storage_treemap")
      .on(table.storageChannelId)
      .where(sql`status = 'success' AND size IS NOT NULL`),
    index("idx_backup_storage_presence_due")
      .on(table.presence, table.lastCheckedAt)
      .where(sql`deleted_at IS NULL AND status = 'success'`),
  ],
);

export const backupStorageRelations = relations(backupStorage, ({ one }) => ({
  backup: one(backup, {
    fields: [backupStorage.backupId],
    references: [backup.id],
  }),
  storageChannel: one(storageChannel, {
    fields: [backupStorage.storageChannelId],
    references: [storageChannel.id],
  }),
}));

export const backupStorageSchema = createSelectSchema(backupStorage, {
  stats: z.union([snapshotStatsSchema, syncStatsSchema]).nullable(),
});
export type BackupStorage = z.infer<typeof backupStorageSchema>;

export type BackupStorageWith = BackupStorage & {
  storageChannel?: StorageChannel | null;
};
