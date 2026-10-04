import * as drizzleDb from "@/db";
import {db as dbClient} from "@/db";
import {eq} from "drizzle-orm";
import {logger} from "@/lib/logger";
import {sendNotificationsBackupRestore} from "@/features/notifications/utils/notifications.helpers";
import type {BackupStorage} from "@/db/schema/14_storage-backup";
import {agentSupportsRestic, MIN_RESTIC_AGENT_VERSION} from "@/features/agents/utils/version";
import {encryptStorages} from "@/utils/status-crypto";
import {getBackupFolderName} from "@/utils/file-prefix";
import type {PingDatabaseStorageChannels} from "./storage-channels.helpers";

const log = logger.child({module: "api/agent/status/restoration"});

export async function handleFailedRestoration(restorationId: string, databaseId: string, reason: string): Promise<void> {
    try {
        await dbClient
            .insert(drizzleDb.schemas.jobLog)
            .values({
                backupId: null,
                restorationId,
                loggedAt: new Date(),
                entryType: "log",
                level: "error",
                message: reason,
                command: null,
                output: null,
                exitCode: null,
                durationMs: null,
            });

        const databaseWithPolicies = await dbClient.query.database.findFirst({
            where: eq(drizzleDb.schemas.database.id, databaseId),
            with: {alertPolicies: true, project: {with: {alertPolicies: true}}},
        });

        if (databaseWithPolicies) {
            await sendNotificationsBackupRestore(databaseWithPolicies, "error_restore");
        }
    } catch (err) {
        log.error({error: err, name: "handleFailedRestoration"}, "Failed to record restoration failure job log / notification");
    }
}

/**
 * Restore payload for a snapshot: no signed URL, the agent reads the
 * repository itself. The channel travels encrypted, like `storages`.
 */
export async function buildResticRestore(
    backupStorage: BackupStorage,
    agentVersion: string | undefined,
    masterKey: Buffer | null,
): Promise<{ payload: Record<string, unknown> } | { error: string }> {
    if (!agentSupportsRestic(agentVersion)) {
        return {error: `Agent too old for snapshot restore (needs ${MIN_RESTIC_AGENT_VERSION} or later)`};
    }
    if (!masterKey) {
        return {error: "Master key unavailable; cannot send the snapshot restore"};
    }
    try {
        const channel = await dbClient.query.storageChannel.findFirst({
            where: eq(drizzleDb.schemas.storageChannel.id, backupStorage.storageChannelId),
        });
        if (!channel) {
            return {error: "The storage channel of this snapshot no longer exists"};
        }
        const storage: PingDatabaseStorageChannels = {
            id: channel.id,
            provider: channel.provider,
            config: channel.config,
            folderName: getBackupFolderName(),
        };
        return {
            payload: {
                engine: "restic",
                snapshotId: backupStorage.path,
                storageCiphertext: encryptStorages([storage], masterKey),
            },
        };
    } catch (err) {
        // A throw here would 500 every ping and leave the restoration waiting.
        return {error: `Snapshot restore payload could not be built: ${err instanceof Error ? err.message : String(err)}`};
    }
}
