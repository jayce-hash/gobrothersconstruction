# GO Brothers Construction website

This is a rebuild of the earlier static site, now with a password-protected owner dashboard at **/admin**. Art can add project photos, edit services, steps and reviews, and update contact info from his phone. Edits go live without a redeploy, and he doesn't need a Netlify or GitHub account.

It runs on the same system as the other JW Digital sites. Netlify Functions serve the page and the dashboard API, and Netlify Blobs stores saved content and photos.

## What changed from the old site

- **Services.** The old site was commercial only, with pre-construction, field execution, structural and high-end finish. It now matches what his latest post says they do: remodels and renovations, commercial build-outs, concrete and structural, and general contracting.
- **Voice.** The headline is "We finish," his own promise from the post. The About section is in his words: faith, hard work, honesty, trust, relationships that last, and building for the long term.
- **Removed claims.** "100% Accountability," "4+ Core Services" and "Texas landmarks" are gone.
- **Contact.** There's now a phone-first contact section with call, text, Instagram and email buttons, plus a free-estimate checklist.
- **Behind the scenes.** I added SEO structured data with the Euless address and the editing dashboard.

## Setup (replaces the old site in the existing repo)

Add `ADMIN_PASSWORD` in Netlify first, then push this folder to `jayce-hash/gobrothersconstruction`. See the Terminal steps in the chat.

## Check with Art before launch

1. **Domain.** His email is art@gobroswork.com, but a business directory lists gobroswork.org as his website. Ask which one he owns and point it at this site.
2. **Google reviews.** A directory shows 5.0 stars from 30 Google reviews. Copy 2–3 of them word for word into **Reviews**.
3. **Photos.** Upload real project photos. Before-and-after shots work best.
4. **Logo.** The footer uses the Garner Organization logo from the old site. If GO Brothers has its own logo, swap it in.
