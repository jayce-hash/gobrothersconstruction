import { getStore } from "@netlify/blobs";
import { purgeCache } from "@netlify/functions";
import { DEFAULT_CONTENT, DEFAULT_PHOTOS } from "./defaults.mjs";

// "site" holds content.json + photos.json. "photos" holds the uploaded image files.
export const siteStore = () => getStore({ name: "site", consistency: "strong" });
export const photoStore = () => getStore({ name: "photos", consistency: "strong" });

// Fill in anything missing from saved content with defaults, so new fields
// added in future code updates never break an older saved copy.
function merge(def, saved) {
  if (Array.isArray(def)) return Array.isArray(saved) ? saved : def;
  if (def && typeof def === "object") {
    const out = {};
    for (const k of Object.keys(def)) out[k] = merge(def[k], saved ? saved[k] : undefined);
    return out;
  }
  return saved === undefined || saved === null ? def : saved;
}

export async function loadContent() {
  try {
    const saved = await siteStore().get("content.json", { type: "json" });
    return merge(DEFAULT_CONTENT, saved || {});
  } catch (err) {
    console.error("loadContent failed, using defaults", err);
    return structuredClone(DEFAULT_CONTENT);
  }
}

export async function loadPhotos() {
  try {
    const saved = await siteStore().get("photos.json", { type: "json" });
    return Array.isArray(saved) ? saved : structuredClone(DEFAULT_PHOTOS);
  } catch (err) {
    console.error("loadPhotos failed, using defaults", err);
    return structuredClone(DEFAULT_PHOTOS);
  }
}

export async function saveContent(content) {
  await siteStore().setJSON("content.json", content);
  await refreshSite();
}

export async function savePhotos(photos) {
  await siteStore().setJSON("photos.json", photos);
  await refreshSite();
}

// Clear the cached homepage so changes show up right away.
export async function refreshSite() {
  try {
    await purgeCache({ tags: ["page"] });
  } catch (err) {
    // Not available in local dev; harmless.
    console.warn("purgeCache skipped:", err.message);
  }
}
