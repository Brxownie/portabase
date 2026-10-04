import "server-only";
import {eq} from "drizzle-orm";
import {db} from "@/db";
import * as drizzleDb from "@/db";
import {toRcloneTarget} from "@/features/channel/components/storages/rclone/target";
import type {StorageProviderKind} from "@/features/storages/types";
import {getBackupFolderName} from "@/utils/file-prefix";
import {purgeRcloneDir, syncReplicaPath} from "@/lib/sync/replica";

export async function purgeSyncReplica(channelId: string, generatedId: string): Promise<void> {
    const channel = await db.query.storageChannel.findFirst({
        where: eq(drizzleDb.schemas.storageChannel.id, channelId),
    });
    if (!channel) throw new Error(`storage channel ${channelId} not found`);
    const target = await toRcloneTarget(channel.provider as StorageProviderKind, channel.config);
    try {
        await purgeRcloneDir(target.rclone, syncReplicaPath(target.rclone, getBackupFolderName(), generatedId));
    } finally {
        target.cleanup();
    }
}
