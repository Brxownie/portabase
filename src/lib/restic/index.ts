import "server-only";
import {and, eq, inArray} from "drizzle-orm";
import {db} from "@/db";
import * as drizzleDb from "@/db";
import {getMasterServerKeyContent} from "@/features/agents/utils/keys.server";
import {toRcloneTarget} from "@/features/channel/components/storages/rclone/target";
import type {StorageProviderKind} from "@/features/storages/types";
import {getBackupFolderName} from "@/utils/file-prefix";
import {isUUID} from "@/utils/text";
import {logger} from "@/lib/logger";
import {
    forget,
    forgetMany,
    listSnapshots,
    orphanSnapshotIds,
    prune,
    purge,
    snapshotRowIds,
    withResticRepo,
    type ResticRepo,
} from "@/lib/restic/repo";

const log = logger.child({module: "lib/restic"});

async function onChannelRepo<T>(
    channelId: string,
    generatedId: string,
    fn: (repo: ResticRepo) => Promise<T>,
): Promise<T> {
    const channel = await db.query.storageChannel.findFirst({
        where: eq(drizzleDb.schemas.storageChannel.id, channelId),
    });
    if (!channel) throw new Error(`storage channel ${channelId} not found`);
    const target = await toRcloneTarget(channel.provider as StorageProviderKind, channel.config);
    try {
        const masterKey = await getMasterServerKeyContent();
        return await withResticRepo(target.rclone, getBackupFolderName(), generatedId, masterKey, fn);
    } finally {
        target.cleanup();
    }
}

export async function forgetSnapshot(channelId: string, generatedId: string, snapshotId: string): Promise<void> {
    const outcome = await onChannelRepo(channelId, generatedId, (repo) => forget(repo, snapshotId));
    if (outcome === "repository-missing") {
        log.warn(
            {channelId, generatedId, snapshotId},
            "restic repository not found; snapshot row released without forget (check the channel path / BACKUP_FOLDER_NAME)",
        );
    }
}

export const pruneRepo = (channelId: string, generatedId: string) =>
    onChannelRepo(channelId, generatedId, prune);

export const purgeRepo = (channelId: string, generatedId: string) =>
    onChannelRepo(channelId, generatedId, purge);

/**
 * Local repositories only (append-only for agents, spec B): forgets the snapshots the
 * agent could not discard after a failed run. Returns how many were forgotten.
 */
export const forgetOrphanSnapshots = (channelId: string, generatedId: string) =>
    onChannelRepo(channelId, generatedId, async (repo) => {
        const snapshots = await listSnapshots(repo);
        const rowIds = snapshotRowIds(snapshots).filter(isUUID);
        if (rowIds.length === 0) return 0;
        const {backupStorage} = drizzleDb.schemas;
        const failed = await db.query.backupStorage.findMany({
            where: and(inArray(backupStorage.id, rowIds), eq(backupStorage.status, "failed")),
            columns: {id: true},
        });
        const orphans = orphanSnapshotIds(snapshots, new Set(failed.map((r) => r.id)));
        await forgetMany(repo, orphans);
        return orphans.length;
    });
