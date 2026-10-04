"use server";
import { ActionError, userAction } from "@/lib/safe-actions/actions";
import { z } from "zod";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import * as drizzleDb from "@/db";
import { JobLog } from "@/db/schema/17_job-log";
import { assertCanReadDatabase } from "@/features/database/utils/database-acl";

export const fetchJobLogsAction = userAction
    .inputSchema(
        z.object({
            backupId: z.string().optional(),
            restorationId: z.string().optional(),
        }),
    )
    .action(async ({ parsedInput }): Promise<JobLog[]> => {
        const { backupId, restorationId } = parsedInput;
        const { backup, restoration, jobLog } = drizzleDb.schemas;

        // Resolve the job to its database first, so the caller's access can be checked.
        let databaseId: string | null | undefined;
        let where;
        if (backupId) {
            where = eq(jobLog.backupId, backupId);
            databaseId = (await db.query.backup.findFirst({
                columns: { databaseId: true },
                where: eq(backup.id, backupId),
            }))?.databaseId;
        } else if (restorationId) {
            where = eq(jobLog.restorationId, restorationId);
            databaseId = (await db.query.restoration.findFirst({
                columns: { databaseId: true },
                where: eq(restoration.id, restorationId),
            }))?.databaseId;
        }
        if (!databaseId || !where) return [];

        try {
            await assertCanReadDatabase(databaseId);
        } catch {
            throw new ActionError("Not authorized");
        }

        return (await db.query.jobLog.findMany({
            where,
            orderBy: (l, { asc }) => [asc(l.loggedAt)],
        })) as JobLog[];
    });
