import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const PREFIX = "enc:v1:";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.SECRETS_KEY;
  if (!raw) {
    throw new Error(
      "SECRETS_KEY is not set. Generate one with `openssl rand -base64 32`.",
    );
  }
  // Accept a 32-byte base64/hex key directly, otherwise derive one via scrypt.
  let key: Buffer;
  const asBase64 = Buffer.from(raw, "base64");
  const asHex = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : null;
  if (asHex && asHex.length === 32) {
    key = asHex;
  } else if (asBase64.length === 32) {
    key = asBase64;
  } else {
    key = scryptSync(raw, "flo-blog-generator:secrets", 32);
  }
  cachedKey = key;
  return key;
}

/** Encrypt a plaintext string. Returns a self-describing token. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Decrypt a token produced by `encrypt`. Returns null for empty input. */
export function decrypt(token: string | null | undefined): string | null {
  if (!token) return null;
  if (!token.startsWith(PREFIX)) {
    // Tolerate legacy/plaintext values rather than throwing.
    return token;
  }
  const buf = Buffer.from(token.slice(PREFIX.length), "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

export function isEncrypted(token: string | null | undefined): boolean {
  return !!token && token.startsWith(PREFIX);
}

/** Mask a secret for display, e.g. "sk-...AB12". */
export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  const v = value.trim();
  if (v.length <= 8) return "••••";
  return `${v.slice(0, 3)}••••${v.slice(-4)}`;
}
