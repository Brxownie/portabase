import "server-only";
import {Backup, DatabaseWith} from "@/db/schema/07_database";
import {dispatchStorage} from "@/features/storages/utils/storages.dispatch";
import type {
    StorageGetInput,
    StorageInput,
    StorageMetaData,
    StorageResult,
    StorageUploadInput
} from "@/features/storages/types";
import * as drizzleDb from "@/db";
import {withUpdatedAt} from "@/db/utils";
import {eq} from "drizzle-orm";
import {db} from "@/db";
import {createHash, createHmac, timingSafeEqual} from "crypto";
import {env} from "@/env.mjs";
import {getServerUrl} from "@/utils/get-server-url";
import path from "path";
import {getBackupFolderName} from "@/utils/file-prefix";
import {resolveStoragePolicies} from "@/features/database/utils/policy-resolution";

function computeChecksum(buffer: Buffer): string {
    return createHash("sha256").update(buffer).digest("hex");
}

export async function storeBackupFiles(
    backup: Backup,
    database: DatabaseWith,
    file: Buffer,
    fileName: string
): Promise<StorageResult[]> {

    const settings = await db.query.setting.findFirst({
        where: eq(drizzleDb.schemas.setting.name, "system"),
        with: {storageChannel: true},
    });

    const defaultPolicy = settings?.storageChannel
        ? [{
            id: null,
            storageChannelId: settings.storageChannel.id,
            enabled: settings.storageChannel.enabled,
        }]
        : [];

    const enabledPolicies = resolveStoragePolicies(database).filter(p => p.enabled);

    const policies = enabledPolicies.length > 0
        ? enabledPolicies
        : defaultPolicy;

    if (!policies.length) {
        await db
            .update(drizzleDb.schemas.backup)
            .set(withUpdatedAt({
                status: "failed",
            }))
            .where(eq(drizzleDb.schemas.backup.id, backup.id));
        return [];
    }

    // `<folder>/restic` and `<folder>/sync` are served to agents (spec B): keep imports out of them.
    const slug = database.project?.slug;
    const projectDir = slug === "sync" || slug === "restic" ? `project-${slug}` : slug;
    const path = `${getBackupFolderName()}/${projectDir}/${fileName}`;
    const size = file.length;
    const checksum = computeChecksum(file);

    const results = await Promise.all(
        policies.map(async policy => {
            const [backupStorage] = await db
                .insert(drizzleDb.schemas.backupStorage)
                .values({
                    backupId: backup.id,
                    storageChannelId: policy.storageChannelId,
                    status: "pending",
                    path,
                    size,
                    checksum,
                })
                .returning();

            const input: StorageInput = {
                action: "upload",
                data: {path, file},
            };

            let result: StorageResult;

            try {
                if (policy.id) {
                    result = await dispatchStorage(input, policy.id);
                } else {
                    result = await dispatchStorage(input, undefined, policy.storageChannelId);
                }

            } catch (_err) {
                result = {
                    success: false,
                    provider: null,
                    error: _err instanceof Error ? _err.message : "Unknown error"
                };
            }

            await db
                .update(drizzleDb.schemas.backupStorage)
                .set(withUpdatedAt({status: result.success ? "success" : "failed"}))
                .where(eq(drizzleDb.schemas.backupStorage.id, backupStorage.id));

            return result;
        })
    );


    const backupStatus = results.some(r => r.success) ? "success" : "failed";

    await db
        .update(drizzleDb.schemas.backup)
        .set(withUpdatedAt({
            status: backupStatus,
            fileSize: size
        }))
        .where(eq(drizzleDb.schemas.backup.id, backup.id));

    return results;
}



/**
 * Signature of a backup download URL (`/api/files/backups`, served without a session):
 * HMAC with PROJECT_SECRET, which agents never hold, over the channel, the path and the expiry.
 */
function backupUrlSignature(storageId: string, filePath: string, expires: string): string {
    return createHmac("sha256", env.PROJECT_SECRET).update(`backups\n${storageId}\n${filePath}\n${expires}`).digest("hex");
}

export function verifyBackupUrl(storageId: string, filePath: string, expires: string, token: string): boolean {
    const expected = Buffer.from(backupUrlSignature(storageId, filePath, expires));
    const given = Buffer.from(token);
    return given.length === expected.length && timingSafeEqual(given, expected) && Date.now() <= Number(expires);
}

export async function generateFileUrl(input: { data: StorageGetInput | StorageUploadInput, metadata?: StorageMetaData }): Promise<string | null> {
    const fileName = path.basename(input.data.path);
    const baseUrl = getServerUrl();
    const metadata = input.metadata;

    if (!metadata){
        return null;
    }

    let params = new URLSearchParams({
        storageId: metadata.storageId,
    });

    if (metadata.fileKind === "backups") {
        const expiresAt = (Date.now() + 60 * 1000).toString();

        params.set("path", input.data.path);
        params.set("token", backupUrlSignature(metadata.storageId, input.data.path, expiresAt));
        params.set("expires", expiresAt);
        return `${baseUrl}/api/files/${metadata.fileKind}/?${params.toString()}`
    }else if (metadata.fileKind === "images") {
        return `${baseUrl}/api/files/${metadata.fileKind}/${fileName}?${params.toString()}`
    }else {
        return null
    }
}