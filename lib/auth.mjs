import { createHmac, createHash, timingSafeEqual, scryptSync, randomBytes } from "node:crypto";
import { siteStore } from "./store.mjs";

// Two ways to sign in:
//  1. The owner's own password, set and changed inside the dashboard
//     (stored hashed in Netlify Blobs as auth.json).
//  2. ADMIN_PASSWORD (Netlify environment variable): the web developer's master
//     key, used for first sign-in and if the owner ever forgets her password.
// Changing either one signs everyone out.

const DAYS = 30;
const envPassword = () => (process.env.ADMIN_PASSWORD || "").trim();

const sha = (s) => createHash("sha256").update(String(s)).digest();
const safeEqual = (a, b) => timingSafeEqual(sha(a), sha(b));
const b64 = (s) => Buffer.from(s).toString("base64url");

async function stored() {
  try {
    return (await siteStore().get("auth.json", { type: "json" })) || null;
  } catch {
    return null;
  }
}

async function secret() {
  const s = await stored();
  return [process.env.SESSION_SECRET || "", envPassword(), s?.hash || ""].join("|");
}

export const passwordConfigured = async () => envPassword().length > 0 || !!(await stored());

export async function checkPassword(attempt) {
  const pw = String(attempt || "").trim();
  if (!pw) return false;
  const s = await stored();
  if (s?.salt && s?.hash) {
    const h = scryptSync(pw, s.salt, 32).toString("hex");
    if (safeEqual(h, s.hash)) return true;
  }
  return envPassword().length > 0 && safeEqual(pw, envPassword());
}

export async function setPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(pw).trim(), salt, 32).toString("hex");
  await siteStore().setJSON("auth.json", { salt, hash, changed: new Date().toISOString() });
}

export async function issueToken() {
  const payload = b64(JSON.stringify({ exp: Date.now() + DAYS * 864e5 }));
  const sig = createHmac("sha256", await secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export async function verifyRequest(req) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !(await passwordConfigured())) return false;
  const expected = createHmac("sha256", await secret()).update(payload).digest("base64url");
  if (!safeEqual(sig, expected)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}
