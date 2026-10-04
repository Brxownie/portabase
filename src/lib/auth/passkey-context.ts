import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/env.mjs";

export function signPasskeyContext(name: string, email: string): string {
  const payload = Buffer.from(
    JSON.stringify({ name, email, exp: Date.now() + 5 * 60 * 1000 }),
  ).toString("base64url");
  const sig = createHmac("sha256", env.PROJECT_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyPasskeyContext(
  token: string,
): { name: string; email: string } | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", env.PROJECT_SECRET)
    .update(payload)
    .digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (
    sigBuf.length !== expectedBuf.length ||
    !timingSafeEqual(sigBuf, expectedBuf)
  )
    return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data?.exp !== "number" || data.exp < Date.now()) return null;
    return { name: data.name, email: data.email };
  } catch {
    return null;
  }
}
