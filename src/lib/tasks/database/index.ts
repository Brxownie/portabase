import { db } from "@/db";
import { enforceRetentionCount } from "@/lib/tasks/database/retention-count";
import { enforceRetentionDays } from "@/lib/tasks/database/retention-days";
import { enforceRetentionGFS } from "@/lib/tasks/database/retention-gsf";
import { DatabaseWith, retentionPolicy } from "@/db/schema/07_database";
import { and, eq, isNotNull, isNull, ne, or } from "drizzle-orm";
import * as drizzleDb from "@/db";
import { logger } from "@/lib/logger";
import { forgetOrphanSnapshots, pruneRepo } from "@/lib/restic";
import { resolveRetentionPolicy } from "@/features/database/utils/policy-resolution";

const log = logger.child({ module: "tasks/database" });

export const retentionCleanTask = async () => {
  try {
    const databases = await db.query.database.findMany({
      where: isNull(drizzleDb.schemas.database.deletedAt),
      with: {
        retentionPolicy: true,
        project: { with: { retentionPolicy: true } },
        backups: {
          where: isNull(drizzleDb.schemas.backup.deletedAt),
        },
      },
    });
    log.info(`Retention databases number: ${databases.length}`);
    for (const dbRow of databases) {
      const policy = resolveRetentionPolicy(dbRow as DatabaseWith);
      if (!policy) continue;
      await enforceRetention(dbRow.id, policy);
    }
    await pruneResticRepos();
  } catch (e: any) {
    log.error({ error: e }, "Retention cleanup failed");
    throw e;
  }
};

export async function enforceRetention(
  databaseId: string,
  policy: typeof retentionPolicy.$inferSelect,
) {
  log.info({ name: "enforceRetention" }, `Retention started for ${databaseId}`);

  switch (policy.type) {
    case "count":
      await enforceRetentionCount(databaseId, policy.count ?? 7);
      break;

    case "days":
      await enforceRetentionDays(databaseId, policy.days ?? 30);
      break;

    case "gfs":
      await enforceRetentionGFS(databaseId, {
        hourly: policy.gfsHourly ?? 0,
        daily: policy.gfsDaily ?? 7,
        weekly: policy.gfsWeekly ?? 4,
        monthly: policy.gfsMonthly ?? 12,
        yearly: policy.gfsYearly ?? 3,
      });
      break;
  }
}

/**
 * One prune per (source, channel) repository that ever held a snapshot, after
 * the retention forgets. Stateless; space freed by manual deletes is reclaimed
 * here too. Errors are logged, rows are not touched.
 */
export async function pruneResticRepos() {
  const repos = await db
    .selectDistinct({
      generatedId: drizzleDb.schemas.database.agentDatabaseId,
      channelId: drizzleDb.schemas.backupStorage.storageChannelId,
      provider: drizzleDb.schemas.storageChannel.provider,
    })
    .from(drizzleDb.schemas.backupStorage)
    .innerJoin(drizzleDb.schemas.backup, eq(drizzleDb.schemas.backup.id, drizzleDb.schemas.backupStorage.backupId))
    .innerJoin(drizzleDb.schemas.database, eq(drizzleDb.schemas.database.id, drizzleDb.schemas.backup.databaseId))
    .innerJoin(drizzleDb.schemas.storageChannel, eq(drizzleDb.schemas.storageChannel.id, drizzleDb.schemas.backupStorage.storageChannelId))
    .where(
      and(
        eq(drizzleDb.schemas.backupStorage.engine, "restic"),
        // Rows that never produced a snapshot (failed copies) have no repository, except
        // on `local`, where a failed run leaves its snapshot for the dashboard (spec B).
        or(
          ne(drizzleDb.schemas.backupStorage.path, ""),
          eq(drizzleDb.schemas.storageChannel.provider, "local"),
        ),
        isNull(drizzleDb.schemas.database.deletedAt),
        isNotNull(drizzleDb.schemas.database.agentDatabaseId),
      ),
    );

  for (const repo of repos) {
    if (repo.provider === "local") {
      try {
        const forgotten = await forgetOrphanSnapshots(repo.channelId, repo.generatedId!);
        if (forgotten > 0) log.info({ name: "pruneResticRepos", ...repo, forgotten }, "orphan snapshots forgotten");
      } catch (error) {
        log.error(
          { name: "pruneResticRepos", ...repo, error: error instanceof Error ? error.message : String(error) },
          "orphan snapshot forget failed",
        );
      }
    }
    try {
      await pruneRepo(repo.channelId, repo.generatedId!);
      log.info({ name: "pruneResticRepos", ...repo }, "restic repository pruned");
    } catch (error) {
      log.error(
        { name: "pruneResticRepos", ...repo, error: error instanceof Error ? error.message : String(error) },
        "restic prune failed",
      );
    }
  }
}
