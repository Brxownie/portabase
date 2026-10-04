import {mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";

import type {RcloneConfig} from "@/features/channel/components/storages/rclone/types";
import {capture, remotePath} from "@/lib/restic/repo";

/** `<remote>:<base>/<folder>/sync/<generatedId>` — the agent writes into `…/current`. */
export function syncReplicaPath(rclone: RcloneConfig, folderName: string, generatedId: string): string {
    const folder = folderName.trim().replace(/^\/+|\/+$/g, "") || "backups";
    return remotePath(rclone, `${folder}/sync/${generatedId}`);
}

/** `rclone purge` of one directory; a directory that is already gone is fine. */
export async function purgeRcloneDir(rclone: RcloneConfig, target: string): Promise<void> {
    const dir = await mkdtemp(path.join(tmpdir(), "portabase-sync-"));
    try {
        const config = path.join(dir, "rclone.conf");
        await writeFile(config, rclone.configText, {mode: 0o600});
        const purge = await capture("rclone", ["--config", config, "purge", target], process.env);
        if (purge.code === 0) return;
        // Exit codes for a missing path differ between backends: check what is left.
        const left = await capture("rclone", ["--config", config, "lsf", "--max-depth", "1", target], process.env);
        if ((left.code === 0 && left.stdout.trim() === "") || left.code === 3) return;
        throw new Error(`rclone purge failed (exit ${purge.code}): ${purge.stderr.split("\n").slice(-3).join(" | ")}`);
    } finally {
        await rm(dir, {recursive: true, force: true});
    }
}
