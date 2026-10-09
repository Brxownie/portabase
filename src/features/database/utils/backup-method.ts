import type {BackupStorage} from "@/db/schema/14_storage-backup";
import {formatBytes} from "@/utils/text";

/** Files methods: wire values (ping, databases.json, config form) vs stored engines. */
export type BackupEngine = "archive" | "restic" | "sync";
export type WireMethod = "archive" | "snapshot" | "sync";

export const METHOD_LABELS: Record<BackupEngine, string> = {
    archive: "Archive",
    restic: "Snapshots",
    sync: "Sync",
};

/** What one run does, and how to read its Size and Changes. */
export const METHOD_DESCRIPTIONS: Record<BackupEngine, string> = {
    archive: "Each run uploads a full tar(.gz) archive of the directory. Size is the archive size.",
    restic:
        "Each run adds an incremental, deduplicated restic snapshot: only new and changed data is uploaded. " +
        "Size is the size of the files scanned; the repository grows by the new data plus restic metadata.",
    sync:
        "Each run mirrors the directory onto each storage: new and changed files are uploaded, files removed " +
        "from the source are deleted from the replica. Only the latest state is kept and it cannot be restored " +
        "from Portabase. Size is the replica size after the run.",
};

/** A sync source runs syncs, not restorable backups. */
export const isSync = (database: {backupEngine: BackupEngine}) => database.backupEngine === "sync";

export const signedBytes = (bytes: number) => `${bytes < 0 ? "−" : "+"}${formatBytes(Math.abs(bytes))}`;

/** What a successful snapshot or sync run changed on one storage, or null without counters. */
export function describeRun(storage: Pick<BackupStorage, "status" | "size" | "stats">): string | null {
    const stats = storage.stats;
    if (storage.status !== "success" || !stats) return null;
    if ("filesNew" in stats) {
        const removed = stats.filesRemoved == null ? "" : `, ${stats.filesRemoved} removed`;
        return `${stats.filesNew} new, ${stats.filesChanged} changed, ${stats.filesUnmodified} unmodified${removed} file(s) · ${signedBytes(storage.size ?? 0)} new data`;
    }
    const delta = stats.sizeDelta == null ? "" : ` · storage ${signedBytes(stats.sizeDelta)}`;
    return `${stats.filesTransferred} file(s) transferred (${formatBytes(storage.size ?? 0)}), ${stats.filesDeleted} deleted${delta}`;
}

export function engineFromWire(method: unknown): BackupEngine | undefined {
    switch (method) {
        case "archive":
            return "archive";
        case "snapshot":
            return "restic";
        case "sync":
            return "sync";
        default:
            return undefined;
    }
}

export function wireFromEngine(engine: BackupEngine): WireMethod {
    return engine === "restic" ? "snapshot" : engine;
}

/**
 * The method databases.json announces when it differs from the locked one, else null.
 * `announced` undefined (dashboard-managed source, older agent) never conflicts.
 */
export function resolveMethodConflict(stored: BackupEngine, announced: string | undefined): string | null {
    if (announced === undefined) return null;
    return engineFromWire(announced) === stored ? null : announced;
}

/** Takes `options.method` out of a files config (the method lives in `backupEngine`). */
export function splitMethod(config: Record<string, unknown>): {config: Record<string, unknown>; method?: string} {
    const options = config.options;
    if (!options || typeof options !== "object" || Array.isArray(options) || !("method" in options)) {
        return {config};
    }
    const {method, ...rest} = options as Record<string, unknown>;
    const out: Record<string, unknown> = {...config};
    if (Object.keys(rest).length > 0) out.options = rest;
    else delete out.options;
    return {config: out, method: typeof method === "string" ? method : undefined};
}

/** A files config with `options.method` set, for display in the config form. */
export function withMethod(config: Record<string, unknown> | null | undefined, method: WireMethod): Record<string, unknown> {
    const base = config ?? {};
    const options = base.options && typeof base.options === "object" && !Array.isArray(base.options)
        ? (base.options as Record<string, unknown>)
        : {};
    return {...base, options: {...options, method}};
}
