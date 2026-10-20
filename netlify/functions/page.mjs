// Serves the homepage, built fresh from whatever the owner saved in /admin.
// The result is cached on Netlify's CDN and cleared automatically on every save.
import { loadContent, loadPhotos } from "../../lib/store.mjs";
import { renderPage } from "../../lib/render.mjs";

export default async () => {
  const [content, photos] = await Promise.all([loadContent(), loadPhotos()]);
  return new Response(renderPage(content, photos), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": "public, durable, max-age=31536000, stale-while-revalidate=86400",
      "Netlify-Cache-Tag": "page",
      "Cache-Tag": "page",
    },
  });
};

export const config = { path: "/" };
