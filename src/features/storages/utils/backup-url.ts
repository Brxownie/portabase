import crypto from "node:crypto";
import path from "node:path";

export function signBackupToken(fileName: string, expiresAt: number, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`${fileName}${expiresAt}`).digest("hex");
}

export type BackupTokenCheck =
  | { ok: true }
  | { ok: false; reason: "missing" | "invalid" | "expired" };

export function verifyBackupToken(
  fileName: string,
  expires: string | null,
  token: string | null,
  secret: string,
): BackupTokenCheck {
  if (!token || !expires) {
    return { ok: false, reason: "missing" };
  }

  const expiresAt = parseInt(expires, 10);
  if (!Number.isFinite(expiresAt)) {
    return { ok: false, reason: "invalid" };
  }

  const expected = signBackupToken(fileName, expiresAt, secret);
  const given = Buffer.from(token);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    return { ok: false, reason: "invalid" };
  }

  if (Date.now() > expiresAt) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true };
}

export function resolveWithin(base: string, target: string): string | null {
  const baseResolved = path.resolve(base);
  const full = path.resolve(baseResolved, target);
  if (full !== baseResolved && !full.startsWith(baseResolved + path.sep)) {
    return null;
  }
  return full;
}
