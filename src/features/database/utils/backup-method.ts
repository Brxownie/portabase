/** Files methods: wire values (ping, databases.json, config form) vs stored engines. */
export type BackupEngine = "archive" | "restic" | "sync";
export type WireMethod = "archive" | "snapshot" | "sync";

export const METHOD_LABELS: Record<BackupEngine, string> = {
    archive: "Archive",
    restic: "Snapshots",
    sync: "Sync",
};

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
