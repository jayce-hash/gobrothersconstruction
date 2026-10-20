// Serves photos uploaded through the dashboard: /media/<id>/<full|sm>
import { photoStore } from "../../lib/store.mjs";

export default async (req) => {
  const m = new URL(req.url).pathname.match(/^\/media\/([a-z0-9-]+)\/(full|sm)$/i);
  if (!m) return new Response("Not found", { status: 404 });

  const res = await photoStore().getWithMetadata(`${m[1]}/${m[2]}`, { type: "stream" });
  if (!res) return new Response("Not found", { status: 404 });

  return new Response(res.data, {
    headers: {
      "Content-Type": res.metadata?.type || "image/jpeg",
      // Each upload gets a unique address, so it can be cached forever.
      "Cache-Control": "public, max-age=31536000, immutable",
      "Netlify-CDN-Cache-Control": "public, durable, max-age=31536000, immutable",
    },
  });
};

export const config = { path: "/media/*" };
