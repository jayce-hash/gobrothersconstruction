import { esc, inline, format, brand } from "./markup.mjs";

const SITE_URL = (process.env.URL || "https://gobrothersconstruction.netlify.app").replace(/\/$/, "");
const ASSET_V = "4";

const safeUrl = (u) => (/^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "");
const digits = (p) => String(p || "").replace(/[^\d+]/g, "");
const slug = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const WORDMARK = '<span class="wm"><img src="/img/mark.webp" alt="" class="nav-logo" width="678" height="700"><span class="wm-text"><b>GO Brothers</b> Construction</span></span>';
const igHandle = (u) => (String(u || "").match(/instagram\.com\/([A-Za-z0-9._]+)/i) || [])[1] || "";

const ICON = {
  ig: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
  fb: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
};

function socials(b, cls) {
  const ig = safeUrl(b.instagram);
  const fb = safeUrl(b.facebook);
  return `<div class="${cls}">${
    ig ? `<a href="${esc(ig)}" target="_blank" rel="noopener" aria-label="Instagram">${ICON.ig}</a>` : ""
  }${fb ? `<a href="${esc(fb)}" target="_blank" rel="noopener" aria-label="Facebook">${ICON.fb}</a>` : ""}</div>`;
}

function accordion(items) {
  return items
    .filter((i) => i && (i.title || i.body))
    .map(
      (i) => `
      <details class="acc">
        <summary>${inline(i.title)}</summary>
        <div class="acc-body">${format(i.body)}${i.note ? `<p class="note">${inline(i.note)}</p>` : ""}</div>
      </details>`
    )
    .join("");
}

function gallery(c, photos) {
  const visible = photos.filter((p) => !p.hidden && p.src);
  if (!visible.length) return "";
  const used = new Set(visible.map((p) => p.category).filter(Boolean));
  const cats = c.gallery.categories.filter((x) => used.has(x));
  // include any category used on a photo but since removed from the list
  for (const u of used) if (!cats.includes(u)) cats.push(u);

  const chips =
    cats.length > 1
      ? `<div class="chips" role="group" aria-label="Filter photos">
          <button type="button" class="chip" aria-pressed="true" data-filter="all">All</button>
          ${cats.map((x) => `<button type="button" class="chip" aria-pressed="false" data-filter="${esc(slug(x))}">${esc(x)}</button>`).join("")}
        </div>`
      : "";

  const name = c.business.name;
  const altFor = (p) => p.alt || (p.category ? `${p.category} order from ${name}` : `Custom order from ${name}`);
  const tiles = visible
    .map((p) => ({ ...p, alt: altFor(p) }))
    .map(
      (p, i) => `
        <li class="tile" data-cat="${esc(slug(p.category))}">
          <button type="button" class="tile-btn" data-full="${esc(p.src)}" data-index="${i}" aria-label="View larger: ${esc(p.alt || "project photo")}">
            <img src="${esc(p.thumb || p.src)}" alt="${esc(p.alt || "")}" loading="${i < 4 ? "eager" : "lazy"}" decoding="async"${p.w && p.h ? ` width="${p.w}" height="${p.h}"` : ""}>
          </button>
        </li>`
    )
    .join("");

  return `
  <section id="gallery" class="section gallery" aria-labelledby="gallery-title">
    <h2 id="gallery-title" class="section-title">${inline(c.gallery.heading)}</h2>
    ${c.gallery.intro ? `<p class="section-intro">${inline(c.gallery.intro)}</p>` : ""}
    ${chips}
    <ul class="grid" data-page="12">${tiles}</ul>
    <div class="more-wrap"><button type="button" class="btn outline more" hidden>Show more photos</button></div>
  </section>`;
}

export function renderPage(c, photos) {
  const b = c.business;
  const phone = digits(b.phone);
  const year = new Date().getFullYear();
  const title = `Remodels, Build-Outs & Concrete in Dallas–Fort Worth | ${b.name}`;
  const desc = `${b.name}: ${b.services} in ${b.city}, serving ${b.serviceArea}.`;
  const ig = igHandle(b.instagram);
  const hasPhotos = photos.some((p) => !p.hidden && p.src);
  const mailBody = `Hi ${String(b.ownerName || "").split(" ")[0] || "there"}!\n\nI'd like to ask about a custom order.\n\n${c.contact.checklist
    .map((x) => `${x}: `)
    .join("\n")}\n\nThank you!`;
  const mailto = `mailto:${b.email}?subject=${encodeURIComponent("Free estimate request")}&body=${encodeURIComponent(mailBody)}`;

  const schema = {
    "@context": "https://schema.org",
    "@type": "GeneralContractor",
    areaServed: b.serviceArea,
    name: b.name,
    url: SITE_URL + "/",
    image: SITE_URL + "/img/social-preview.jpg",
    telephone: b.phone,
    email: b.email || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: b.street || undefined,
      postalCode: b.zip || undefined,
      addressLocality: String(b.city).split(",")[0].trim(),
      addressRegion: (String(b.city).split(",")[1] || "").trim(),
      addressCountry: "US",
    },
    founder: b.ownerName,
    sameAs: [safeUrl(b.instagram), safeUrl(b.facebook)].filter(Boolean),
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE_URL}/">
<meta name="theme-color" content="#121a36">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE_URL}/">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE_URL}/img/social-preview.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/img/favicon.png">
<link rel="apple-touch-icon" href="/img/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800;900&family=Figtree:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css?v=${ASSET_V}">
<script>if(!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("js")</script>
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${c.announcement.show && c.announcement.text ? `<div class="announce" role="note">${inline(c.announcement.text)}</div>` : ""}
<header class="nav">
  <div class="nav-left">
    <a href="#top" class="nav-brand" aria-label="${esc(b.name)} home">${WORDMARK}</a>
    ${phone ? `<a class="nav-phone" href="tel:${esc(phone)}">${esc(b.phone)}</a>` : ""}
  </div>
  <nav class="nav-links" id="nav-links" aria-label="Main">
    <a href="#menu">Services</a>
    ${c.steps.items.length ? `<a href="#book">How it works</a>` : ""}
    ${hasPhotos ? `<a href="#gallery">Projects</a>` : ""}
    ${c.reviews.items.some((r) => r && r.text) ? `<a href="#reviews">Reviews</a>` : ""}
    <a href="#about">About</a>
    <a href="#contact" class="nav-cta">Free estimate</a>
  </nav>
  <button class="hamburger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="nav-links"><span></span><span></span><span></span></button>
</header>

<main id="main">
  <div id="top" class="hero">
    <img class="hero-mark" src="/img/mark.webp" alt="" width="678" height="700">
    <div class="hero-inner">
    <h1 class="reveal">${esc(b.headline)}</h1>
    <p class="hero-sub reveal">${esc(b.services)}</p>
    <div class="hero-ctas reveal">
      ${phone ? `<a class="btn" href="tel:${esc(phone)}">Call ${esc(b.phone)}</a>` : ""}
      <a class="btn ghost" href="#contact">Get a free estimate</a>
    </div>
    </div>
  </div>
  ${c.trust.length ? `<ul class="trust" role="list">${c.trust.filter(Boolean).map((t) => `<li>${inline(t)}</li>`).join("")}</ul>` : ""}


  <section id="menu" class="section" aria-labelledby="menu-title">
    <h2 id="menu-title" class="section-title">${inline(c.menu.heading)}</h2>
    <div class="acc-wrap reveal">${accordion(c.menu.items)}</div>
  </section>

  ${
    c.steps.items.length
      ? `<section id="book" class="section steps-section" aria-labelledby="book-title">
    <h2 id="book-title" class="section-title">${inline(c.steps.heading)}</h2>
    <ol class="steps reveal">${c.steps.items.filter(Boolean).map((x, i) => `<li><span class="step-n" aria-hidden="true">${i + 1}</span><span>${inline(x)}</span></li>`).join("")}</ol>
  </section>`
      : ""
  }

  ${
    c.reviews.items.length
      ? `<section id="reviews" class="reviews" aria-labelledby="reviews-title">
    <h2 id="reviews-title" class="section-title">${inline(c.reviews.heading)}</h2>
    <div class="review-grid">
      ${c.reviews.items
        .filter((r) => r && r.text)
        .map(
          (r) => `<figure class="review reveal"><blockquote><p>“${inline(r.text)}”</p></blockquote>${
            r.name ? `<figcaption>${esc(r.name)}</figcaption>` : ""
          }</figure>`
        )
        .join("")}
    </div>
  </section>`
      : ""
  }

  ${gallery(c, photos)}

  <section id="about" class="section" aria-labelledby="about-title">
    <h2 id="about-title" class="section-title">${inline(c.about.heading)}</h2>
    <div class="card about reveal">
      <div>
        <h3>${inline(c.about.title)}</h3>
        ${format(c.about.body)}
      </div>
      ${
        c.about.list.length || c.about.listBody
          ? `<div>
        <h3>${inline(c.about.listTitle)}</h3>
        ${format(c.about.listBody)}
        <ul class="diet">${c.about.list.filter(Boolean).map((d) => `<li>${inline(d)}</li>`).join("")}</ul>
      </div>`
          : ""
      }
    </div>
  </section>




  ${c.policies.items.length ? `  <section id="policies" class="section" aria-labelledby="policies-title">
    <h2 id="policies-title" class="section-title">${inline(c.policies.heading)}</h2>
    ${c.policies.intro ? `<p class="section-intro">${inline(c.policies.intro)}</p>` : ""}
    <div class="acc-wrap reveal">${accordion(c.policies.items)}</div>
    ${c.policies.outro ? `<p class="outro">${inline(c.policies.outro)}</p>` : ""}
  </section>` : ""}

  <section id="contact" class="section" aria-labelledby="contact-title">
    <div class="card contact reveal">
      <h2 id="contact-title" class="section-title">${inline(c.contact.heading)}</h2>
      ${c.contact.body ? `<p class="contact-body">${inline(c.contact.body)}</p>` : ""}
      ${
        c.contact.checklist.length
          ? `<div class="checklist"><p>When you reach out, please include:</p><ul>${c.contact.checklist
              .filter(Boolean)
              .map((x) => `<li>${inline(x)}</li>`)
              .join("")}</ul></div>`
          : ""
      }
      <div class="btn-group">
        ${phone ? `<a href="tel:${esc(phone)}" class="btn">Call ${esc(b.phone)}</a>` : ""}
        ${phone ? `<a href="sms:${esc(phone)}" class="btn outline">Send a Text</a>` : ""}
        ${ig ? `<a href="https://ig.me/m/${esc(ig)}" target="_blank" rel="noopener" class="btn outline">Message on Instagram</a>` : ""}
        ${b.email ? `<a href="${esc(mailto)}" class="btn outline">Email Us</a>` : ""}
      </div>
      ${b.email ? `<p class="contact-email">${esc(b.email)}</p>` : ""}
      ${b.street ? `<p class="contact-email"><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.street}, ${b.city} ${b.zip}`)}" target="_blank" rel="noopener">${esc(b.street)}, ${esc(b.city)} ${esc(b.zip)}</a></p>` : ""}
    </div>
  </section>
</main>

<footer class="footer">
  <p class="footer-brand"><img src="/img/logo-light.webp" alt="Garner Organization" class="footer-logo" width="1100" height="226" loading="lazy"></p>
  <p class="footer-meta">© ${year} ${esc(b.name)} LLC, a Garner Organization company. Serving ${esc(b.serviceArea)}.</p>
  ${b.license ? `<p class="footer-meta"><a >${esc(b.license)}</a></p>` : ""}
  ${socials(b, "footer-socials")}
  <p class="agency">Digital experience by <a href="https://jwdigital.ink" target="_blank" rel="noopener">JW Digital</a></p>
</footer>

<dialog class="lightbox" aria-label="Photo viewer">
  <button type="button" class="lb-close" aria-label="Close">×</button>
  <button type="button" class="lb-prev" aria-label="Previous photo">‹</button>
  <figure><img alt=""><figcaption></figcaption></figure>
  <button type="button" class="lb-next" aria-label="Next photo">›</button>
</dialog>
<script src="/assets/site.js?v=${ASSET_V}" defer></script>
</body>
</html>`;
}

export { brand };
