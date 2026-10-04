"use server";

import {z} from "zod";
import {and, inArray, isNotNull, isNull} from "drizzle-orm";
import {db} from "@/db";
import * as drizzleDb from "@/db";
import {ServerActionResult} from "@/types/action-type";
import {userAction} from "@/lib/safe-actions/actions";
import {assertDatabasesInOrgProject} from "@/features/database/actions/bulk-restore.action";

const bulkSchema = z.object({
    projectId: z.uuid(),
    databaseIds: z.array(z.uuid()).min(1),
});

export const bulkBackupAction = userAction
    .inputSchema(bulkSchema)
    .action(async ({parsedInput}): Promise<ServerActionResult<{queued: number; skipped: {databaseId: string; reason: string}[]}>> => {
        try {
            const {projectId, databaseIds} = parsedInput;
            await assertDatabasesInOrgProject(projectId, databaseIds);

            const activeBackups = await db.query.backup.findMany({
                where: and(
                    inArray(drizzleDb.schemas.backup.databaseId, databaseIds),
                    inArray(drizzleDb.schemas.backup.status, ["waiting", "ongoing"]),
                    isNull(drizzleDb.schemas.backup.deletedAt),
                ),
                columns: {databaseId: true},
            });
            const busy = new Set(activeBackups.map((b) => b.databaseId));
            const conflicted = await db.query.database.findMany({
                where: and(
                    inArray(drizzleDb.schemas.database.id, databaseIds),
                    isNotNull(drizzleDb.schemas.database.methodConflict),
                ),
                columns: {id: true},
            });
            const suspended = new Set(conflicted.map((d) => d.id));
            const toQueue = databaseIds.filter((id) => !busy.has(id) && !suspended.has(id));
            const skipped = [
                ...[...busy].map((databaseId) => ({databaseId, reason: "backup already in progress"})),
                ...[...suspended].filter((id) => !busy.has(id)).map((databaseId) => ({databaseId, reason: "backup method conflict"})),
            ];

            if (toQueue.length > 0) {
                await db
                    .insert(drizzleDb.schemas.backup)
                    .values(toQueue.map((databaseId) => ({databaseId, status: "waiting" as const})));
            }

            return {
                success: true,
                value: {queued: toQueue.length, skipped},
                actionSuccess: {
                    message: `Queued ${toQueue.length} backup(s)${skipped.length ? `, ${skipped.length} skipped` : ""}.`,
                },
            };
        } catch (error) {
            return {
                success: false,
                actionError: {
                    message: "Failed to queue backups.",
                    status: 500,
                    cause: error instanceof Error ? error.message : "Unknown error",
                },
            };
        }
    });
