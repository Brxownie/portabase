/**
 * First exclude pattern that Snapshots cannot honour: restic has no `{a,b}`
 * alternation (spike S5), so the backup and the mirror restore would diverge.
 */
export function unsupportedSnapshotPattern(config: unknown): string | undefined {
    const exclude = (config as { options?: { exclude?: unknown } } | null | undefined)?.options?.exclude;
    if (!Array.isArray(exclude)) return undefined;
    return exclude.find((p): p is string => typeof p === "string" && /[{}]/.test(p));
}
