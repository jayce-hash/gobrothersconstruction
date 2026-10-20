// Dashboard API. Everything except /api/login requires the owner to be signed in.
import { randomBytes } from "node:crypto";
import { checkPassword, issueToken, verifyRequest, passwordConfigured, setPassword } from "../../lib/auth.mjs";
import { loadContent, loadPhotos, saveContent, savePhotos, photoStore } from "../../lib/store.mjs";
import { DEFAULT_CONTENT } from "../../lib/defaults.mjs";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

// Shape used to validate saved content (lists that start empty still need an item shape).
const SCHEMA = structuredClone(DEFAULT_CONTENT);
SCHEMA.reviews.items = [{ text: "", name: "" }];
SCHEMA.menu.items = [{ title: "", body: "", note: "" }];
SCHEMA.policies.items = [{ title: "", body: "" }];
SCHEMA.about.list = [""];
SCHEMA.steps.items = [""];
SCHEMA.trust = [""];
SCHEMA.contact.checklist = [""];
SCHEMA.gallery.categories = [""];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_TEXT = 20000;
const MAX_IMAGE = 4 * 1024 * 1024;

// Keep only the fields the site knows about, with the right types.
function clean(def, input) {
  if (Array.isArray(def)) {
    if (!Array.isArray(input)) return [];
    const shape = def[0];
    return input.slice(0, 300).map((v) => clean(shape ?? "", v)).filter((v) => (typeof v === "string" ? v : true));
  }
  if (def && typeof def === "object") {
    const out = {};
    const src = input && typeof input === "object" ? input : {};
    for (const k of Object.keys(def)) out[k] = clean(def[k], src[k]);
    // allow "note" on policy items even though the default shape lacks it
    if ("title" in def && "body" in def && typeof src.note === "string") out.note = src.note.slice(0, 500).trim();
    return out;
  }
  if (typeof def === "boolean") return input === true;
  if (typeof def === "number") return Number.isFinite(input) ? input : def;
  return typeof input === "string" ? input.slice(0, MAX_TEXT).trim() : "";
}

function sniffImage(buf) {
  const b = new Uint8Array(buf.slice(0, 12));
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return "image/webp";
  return null;
}

const cleanPhotoMeta = (p) => ({
  alt: String(p.alt || "").slice(0, 300).trim(),
  category: String(p.category || "").slice(0, 60).trim(),
  hidden: p.hidden === true,
});

export default async (req) => {
  const route = new URL(req.url).pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");
  const method = req.method;

  try {
    // ---- Sign in ----
    if (route === "login" && method === "POST") {
      if (!(await passwordConfigured()))
        return json({ error: "The dashboard password hasn't been set up yet (ADMIN_PASSWORD in Netlify)." }, 503);
      const { password } = await req.json().catch(() => ({}));
      if (!(await checkPassword(password))) {
        await sleep(800);
        return json({ error: "That password isn't right. Try again." }, 401);
      }
      return json({ token: await issueToken() });
    }

    if (!(await verifyRequest(req))) return json({ error: "Please sign in again." }, 401);

    // ---- Change password (signs out other devices) ----
    if (route === "password" && method === "PUT") {
      const { current, next } = await req.json().catch(() => ({}));
      if (!(await checkPassword(current))) {
        await sleep(800);
        return json({ error: "Your current password isn't right." }, 400);
      }
      if (typeof next !== "string" || next.trim().length < 8)
        return json({ error: "Please use at least 8 characters for your new password." }, 400);
      await setPassword(next);
      return json({ ok: true, token: await issueToken() });
    }

    // ---- Load everything for the dashboard ----
    if (route === "data" && method === "GET") {
      const [content, photos] = await Promise.all([loadContent(), loadPhotos()]);
      return json({ content, photos });
    }

    // ---- Save words / settings ----
    if (route === "content" && method === "PUT") {
      const body = await req.json();
      const content = clean(SCHEMA, body.content);
      await saveContent(content);
      return json({ ok: true, content });
    }

    // ---- Upload one photo (full size + small preview, already shrunk in the browser) ----
    if (route === "photos" && method === "POST") {
      const form = await req.formData();
      const full = form.get("full");
      const sm = form.get("sm");
      if (!full || !sm || typeof full === "string" || typeof sm === "string")
        return json({ error: "Missing photo." }, 400);
      if (full.size > MAX_IMAGE || sm.size > MAX_IMAGE) return json({ error: "That photo is too large." }, 413);

      const [fullBuf, smBuf] = await Promise.all([full.arrayBuffer(), sm.arrayBuffer()]);
      const fullType = sniffImage(fullBuf);
      const smType = sniffImage(smBuf);
      if (!fullType || !smType) return json({ error: "That file isn't a photo we can use." }, 415);

      const id = Date.now().toString(36) + "-" + randomBytes(4).toString("hex");
      const store = photoStore();
      await Promise.all([
        store.set(`${id}/full`, fullBuf, { metadata: { type: fullType } }),
        store.set(`${id}/sm`, smBuf, { metadata: { type: smType } }),
      ]);

      const w = parseInt(form.get("w"), 10);
      const h = parseInt(form.get("h"), 10);
      const photo = {
        id,
        src: `/media/${id}/full`,
        thumb: `/media/${id}/sm`,
        ...(w > 0 && h > 0 ? { w, h } : {}),
        ...cleanPhotoMeta({ alt: form.get("alt"), category: form.get("category") }),
      };
      const photos = await loadPhotos();
      photos.unshift(photo); // newest first
      await savePhotos(photos);
      return json({ ok: true, photo });
    }

    // ---- Reorder / edit photo details ----
    if (route === "photos" && method === "PUT") {
      const { photos: incoming } = await req.json();
      if (!Array.isArray(incoming)) return json({ error: "Bad request." }, 400);
      const current = await loadPhotos();
      const byId = new Map(current.map((p) => [p.id, p]));
      const seen = new Set();
      const next = [];
      for (const p of incoming) {
        const existing = byId.get(p.id);
        if (!existing || seen.has(p.id)) continue;
        seen.add(p.id);
        next.push({ ...existing, ...cleanPhotoMeta(p) });
      }
      // Never drop a photo just because the dashboard had an old list.
      for (const p of current) if (!seen.has(p.id)) next.push(p);
      await savePhotos(next);
      return json({ ok: true, photos: next });
    }

    // ---- Delete photos ----
    if (route === "photos/delete" && method === "POST") {
      const { ids } = await req.json();
      if (!Array.isArray(ids)) return json({ error: "Bad request." }, 400);
      const remove = new Set(ids.map(String));
      const current = await loadPhotos();
      const next = current.filter((p) => !remove.has(p.id));
      await savePhotos(next);
      const store = photoStore();
      await Promise.all(
        current
          .filter((p) => remove.has(p.id) && !p.id.startsWith("seed-"))
          .flatMap((p) => [store.delete(`${p.id}/full`), store.delete(`${p.id}/sm`)])
      );
      return json({ ok: true, photos: next });
    }

    return json({ error: "Not found." }, 404);
  } catch (err) {
    console.error(err);
    return json({ error: "Something went wrong saving that. Please try again." }, 500);
  }
};

export const config = { path: "/api/*" };
