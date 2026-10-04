"use server";

import {z} from "zod";
import {db} from "@/db";
import {and, eq, isNull} from "drizzle-orm";
import * as drizzleDb from "@/db";
import {ActionError, userAction} from "@/lib/safe-actions/actions";
import {PolicyScopeSchema} from "@/features/database/schemas/policy-scope.schema";
import {assertCanManagePolicyScope} from "@/features/database/utils/database-acl";

export async function updateBackupPolicyService(
    scope: {type: "database" | "project"; id: string},
    backupPolicy: string
) {
    const cronPolicy = backupPolicy === "" ? null : backupPolicy;

    if (scope.type === "database") {
        const [updated] = await db
            .update(drizzleDb.schemas.database)
            .set({backupPolicy: cronPolicy})
            .where(eq(drizzleDb.schemas.database.id, scope.id))
            .returning()
            .execute();
        if (cronPolicy == null) {
            await db.delete(drizzleDb.schemas.retentionPolicy)
                .where(and(
                    eq(drizzleDb.schemas.retentionPolicy.databaseId, scope.id),
                    isNull(drizzleDb.schemas.retentionPolicy.projectId),
                )).execute();
        }
        return updated;
    }

    const [updated] = await db
        .update(drizzleDb.schemas.project)
        .set({backupPolicy: cronPolicy})
        .where(eq(drizzleDb.schemas.project.id, scope.id))
        .returning()
        .execute();
    if (cronPolicy == null) {
        await db.delete(drizzleDb.schemas.retentionPolicy)
            .where(and(
                eq(drizzleDb.schemas.retentionPolicy.projectId, scope.id),
                isNull(drizzleDb.schemas.retentionPolicy.databaseId),
            )).execute();
    }
    return updated;
}

export const updateBackupPolicyAction = userAction
    .inputSchema(z.object({scope: PolicyScopeSchema, backupPolicy: z.string()}))
    .action(async ({parsedInput}) => {
        // An empty policy stops the backups and drops the scope's retention.
        await assertCanManagePolicyScope(parsedInput.scope).catch(() => {
            throw new ActionError("Not authorized");
        });
        const updated = await updateBackupPolicyService(parsedInput.scope, parsedInput.backupPolicy);
        return {data: updated};
    });
