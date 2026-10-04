import {hkdfSync} from "node:crypto";
import path from "node:path";

export const LOCAL_STORAGE_USER = "portabase";

/**
 * Credential of the local-storage servers (`/storage/restic`, `/storage/sync`, spec B):
 * hex(HKDF-SHA256(master key, salt = "", info = "portabase/local-storage/v1", 32)).
 * Every agent derives the same value (services/restic/password.rs).
 */
export function localStorageCredential(masterKey: Buffer): {user: string; pass: string} {
    const pass = Buffer.from(
        hkdfSync("sha256", masterKey, Buffer.alloc(0), "portabase/local-storage/v1", 32),
    ).toString("hex");
    return {user: LOCAL_STORAGE_USER, pass};
}

/** The `local` channel's root on disk, absolute. */
export function localStorageRoot(privatePath: string): string {
    return path.resolve(privatePath, "uploads");
}
