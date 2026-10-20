/* GO Brothers Construction website dashboard */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "html") el.innerHTML = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
    return el;
  };

  const TOKEN_KEY = "gob-admin-token";
  const store = {
    get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
    set: (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch {} },
    clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch {} },
  };

  const S = {
    token: store.get(),
    content: null,
    photos: [],
    savedContent: "",
    savedPhotos: "",
    tab: "photos",
    filter: "all",
    selecting: false,
    selected: new Set(),
    uploading: false,
    batchCategory: "",
  };

  // ---------- helpers ----------
  const toastEl = $("#toast");
  let toastTimer;
  function toast(msg, bad = false) {
    toastEl.textContent = msg;
    toastEl.classList.toggle("bad", bad);
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), bad ? 6000 : 3200);
  }

  async function api(path, { method = "GET", body, form } = {}) {
    const headers = { Authorization: `Bearer ${S.token}` };
    if (body) headers["Content-Type"] = "application/json";
    const res = await fetch(`/api/${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
    let data = {};
    try { data = await res.json(); } catch {}
    if (res.status === 401 && path !== "login") {
      signOut("You've been signed out. Please sign in again.");
      throw new Error("signed out");
    }
    if (!res.ok) throw new Error(data.error || `Something went wrong (${res.status}).`);
    return data;
  }

  const getPath = (path) => path.split(".").reduce((o, k) => (o ? o[k] : undefined), S.content);
  const setPath = (path, val) => {
    const keys = path.split(".");
    const last = keys.pop();
    keys.reduce((o, k) => o[k], S.content)[last] = val;
  };

  const photoSnapshot = (list) => JSON.stringify(list.map(({ id, alt, category, hidden }) => ({ id, alt: alt || "", category: category || "", hidden: !!hidden })));
  const contentDirty = () => JSON.stringify(S.content) !== S.savedContent;
  const photosDirty = () => photoSnapshot(S.photos) !== S.savedPhotos;
  const isDirty = () => S.content && (contentDirty() || photosDirty());
  function refreshSavebar() { $("#savebar").hidden = !isDirty(); }

  // ---------- sign in / out ----------
  function showLogin(msg = "") {
    $("#app").hidden = true;
    $("#login").hidden = false;
    $("#login-error").textContent = msg;
    setTimeout(() => $("#pw").focus(), 50);
  }
  function signOut(msg) {
    S.token = null;
    store.clear();
    showLogin(msg);
  }

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.submitter || $("#login-form button");
    btn.disabled = true;
    $("#login-error").textContent = "";
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: $("#pw").value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't sign in.");
      S.token = data.token;
      store.set(data.token);
      $("#pw").value = "";
      await loadData();
    } catch (err) {
      $("#login-error").textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  $("#logout").addEventListener("click", () => {
    if (isDirty() && !confirm("You have unsaved changes. Sign out anyway?")) return;
    signOut("");
  });

  async function loadData() {
    const data = await api("data");
    S.content = data.content;
    S.photos = data.photos;
    S.savedContent = JSON.stringify(S.content);
    S.savedPhotos = photoSnapshot(S.photos);
    $("#login").hidden = true;
    $("#app").hidden = false;
    const fromHash = location.hash.slice(1);
    if (TABS[fromHash]) S.tab = fromHash;
    render();
  }

  // ---------- saving ----------
  $("#save").addEventListener("click", save);
  $("#discard").addEventListener("click", () => {
    if (!confirm("Undo all changes since your last save?")) return;
    S.content = JSON.parse(S.savedContent);
    const meta = new Map(JSON.parse(S.savedPhotos).map((p, i) => [p.id, { ...p, i }]));
    S.photos = S.photos
      .filter((p) => meta.has(p.id))
      .map((p) => ({ ...p, ...meta.get(p.id) }))
      .sort((a, b) => a.i - b.i)
      .map(({ i, ...p }) => p);
    render();
  });

  async function save() {
    const btn = $("#save");
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      if (contentDirty()) {
        const res = await api("content", { method: "PUT", body: { content: S.content } });
        S.content = res.content;
        S.savedContent = JSON.stringify(S.content);
      }
      if (photosDirty()) {
        const res = await api("photos", {
          method: "PUT",
          body: { photos: S.photos.map(({ id, alt, category, hidden }) => ({ id, alt, category, hidden })) },
        });
        S.photos = res.photos;
        S.savedPhotos = photoSnapshot(S.photos);
      }
      toast("Saved! Your website is updated.");
      render();
    } catch (err) {
      if (err.message !== "signed out") toast(err.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = "Save & publish";
      refreshSavebar();
    }
  }

  window.addEventListener("beforeunload", (e) => {
    if (isDirty() || S.uploading) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  // ---------- form building blocks ----------
  let uid = 0;
  function field({ label, path, hint, type = "text", placeholder, rows }) {
    const id = `f${++uid}`;
    const val = getPath(path) ?? "";
    const input =
      type === "textarea" || type === "tall"
        ? h("textarea", { id, class: type === "tall" ? "tall" : "", placeholder, rows })
        : h("input", { id, type, placeholder, autocomplete: "off" });
    input.value = val;
    input.addEventListener("input", () => {
      setPath(path, input.value);
      refreshSavebar();
    });
    return h("div", { class: "field" }, h("label", { for: id }, label, hint ? h("span", { class: "hint", text: hint }) : null), input);
  }

  function linesField({ label, path, hint, placeholder }) {
    const id = `f${++uid}`;
    const ta = h("textarea", { id, placeholder });
    ta.value = (getPath(path) || []).join("\n");
    ta.addEventListener("input", () => {
      setPath(path, ta.value.split("\n").map((s) => s.trim()).filter(Boolean));
      refreshSavebar();
    });
    return h("div", { class: "field" }, h("label", { for: id }, label, h("span", { class: "hint", text: hint || "Put each one on its own line." })), ta);
  }

  function toggleField({ label, path }) {
    const cb = h("input", { type: "checkbox" });
    cb.checked = !!getPath(path);
    cb.addEventListener("change", () => {
      setPath(path, cb.checked);
      refreshSavebar();
    });
    return h("label", { class: "toggle" }, cb, label);
  }

  const formatHelp = () =>
    h(
      "div",
      { class: "format-help", html: "<strong>Formatting tips:</strong> start a line with <code>-</code> for a bullet point · leave a blank line for a new paragraph · <code>**words**</code> makes them <strong>bold</strong> · <code>## Heading</code> makes a small heading (each one becomes its own column)" }
    );

  function listEditor({ path, title, fields, addText, blank }) {
    const wrap = h("div");
    const items = getPath(path);
    items.forEach((item, i) => {
      const move = (d) => {
        const j = i + d;
        if (j < 0 || j >= items.length) return;
        [items[i], items[j]] = [items[j], items[i]];
        rerender();
      };
      wrap.append(
        h(
          "div",
          { class: "card" },
          h(
            "div",
            { class: "card-head" },
            h("h3", { text: title(item, i) }),
            h(
              "div",
              { class: "card-tools" },
              h("button", { class: "btn icon-btn", type: "button", title: "Move up", "aria-label": "Move up", disabled: i === 0, onclick: () => move(-1) }, "↑"),
              h("button", { class: "btn icon-btn", type: "button", title: "Move down", "aria-label": "Move down", disabled: i === items.length - 1, onclick: () => move(1) }, "↓"),
              h(
                "button",
                {
                  class: "btn icon-btn danger",
                  type: "button",
                  title: "Remove",
                  "aria-label": "Remove",
                  onclick: () => {
                    if (!confirm(`Remove "${title(item, i)}"?`)) return;
                    items.splice(i, 1);
                    rerender();
                  },
                },
                "🗑"
              )
            )
          ),
          fields.map((f) => field({ ...f, path: `${path}.${i}.${f.key}` }))
        )
      );
    });
    wrap.append(
      h("div", { class: "add-row" }, h("button", { class: "btn pink", type: "button", onclick: () => { items.push(structuredClone(blank)); rerender(true); } }, `＋ ${addText}`))
    );
    return wrap;
  }

  const intro = (title, text) => h("div", { class: "intro" }, h("h2", { text: title }), text ? h("p", { text }) : null);
  const card = (...kids) => h("div", { class: "card" }, ...kids);

  // ---------- tabs ----------
  const TABS = {
    photos: renderPhotos,
    menu: () => [
      intro("Services", "What you offer. Each one opens when visitors tap it."),
      card(field({ label: "Section title", path: "menu.heading" })),
      formatHelp(),
      listEditor({
        path: "menu.items",
        title: (it) => it.title || "New section",
        addText: "Add a service",
        blank: { title: "", body: "", note: "" },
        fields: [
          { key: "title", label: "Title" },
          { key: "body", label: "Details", type: "tall" },
          { key: "note", label: "Highlight (optional)", hint: "Shows in a pink box at the bottom, like \"Free estimates on all remodels\"" },
        ],
      }),
    ],
    reviews: () => [
      intro("Reviews", "Paste in kind words from customers. The newest or best ones usually go first."),
      card(field({ label: "Section title", path: "reviews.heading" })),
      listEditor({
        path: "reviews.items",
        title: (it, i) => it.name || `Review ${i + 1}`,
        addText: "Add a review",
        blank: { text: "", name: "" },
        fields: [
          { key: "text", label: "What they said", type: "textarea", hint: "No need to add quote marks" },
          { key: "name", label: "Name and city", placeholder: "Like Mike R., Arlington" },
        ],
      }),
    ],
    about: () => [
      intro("About you", "The About section, plus the steps in Our process."),
      card(
        field({ label: "Section title", path: "about.heading" }),
        field({ label: "Greeting", path: "about.title" }),
        field({ label: "Your story", path: "about.body", type: "tall", hint: "Leave a blank line between paragraphs. **words** makes them bold." })
      ),
      card(
        field({ label: "Second column title", path: "about.listTitle" }),
        field({ label: "Second column text", path: "about.listBody", type: "textarea" }),
        linesField({ label: "List", path: "about.list", hint: "One per line." })
      ),
      card(
        field({ label: "Our process: title", path: "steps.heading" }),
        linesField({ label: "Our process: steps", path: "steps.items", hint: "One step per line, in order. They're numbered for you." })
      ),
    ],
    info: () => [
      intro("Contact & info", "Your phone, email, socials, and the banner at the top of the site."),
      card(
        h("h3", { text: "Top banner", style: "margin-bottom:.75rem" }),
        toggleField({ label: "Show a banner at the top of the site", path: "announcement.show" }),
        field({ label: "Banner message", path: "announcement.text", placeholder: "Example: Fully booked through December 15. Now taking orders for January!" })
      ),
      card(
        h("h3", { text: "Your business", style: "margin-bottom:.75rem" }),
        h("div", { class: "row" }, field({ label: "Phone", path: "business.phone", type: "tel" }), field({ label: "Email", path: "business.email", type: "email" })),
        h("div", { class: "row" }, field({ label: "Instagram link", path: "business.instagram", type: "url" }), field({ label: "Facebook link", path: "business.facebook", type: "url" })),
        h("div", { class: "row" }, field({ label: "Street address", path: "business.street" }), field({ label: "ZIP", path: "business.zip" })),
        h("div", { class: "row" }, field({ label: "City", path: "business.city", hint: "Shown in Google results and the footer" }), field({ label: "Area you serve", path: "business.serviceArea" })),
        h("div", { class: "row" }, field({ label: "Tagline", path: "business.tagline", hint: "Used in Google results" }), field({ label: "Your name", path: "business.ownerName" })),
        field({ label: "Headline", path: "business.headline", hint: "The big line at the top of the site" }),
        field({ label: "Line under the headline", path: "business.services", type: "textarea", hint: "Also used in Google results" }),
        field({ label: "License number (optional)", path: "business.license", hint: "Shown in the footer when filled in" }),
        linesField({ label: "Highlights under the logo", path: "trust", hint: "One per line, like Free estimates or Hablamos Español" })
      ),
      card(
        h("h3", { text: "Order section", style: "margin-bottom:.75rem" }),
        field({ label: "Title", path: "contact.heading" }),
        field({ label: "Message", path: "contact.body", type: "textarea" }),
        linesField({ label: "\"Please include\" list", path: "contact.checklist", hint: "One per line. These also pre-fill the email customers send you." })
      ),
      card(
        h("h3", { text: "Photo gallery", style: "margin-bottom:.75rem" }),
        field({ label: "Gallery title", path: "gallery.heading" }),
        field({ label: "Line under the title", path: "gallery.intro" }),
        linesField({ label: "Photo categories", path: "gallery.categories", hint: "One per line. Customers can tap these to filter your photos. Only categories with photos in them are shown." })
      ),
    ],
    policies: () => [
      intro("Good to know", "Optional: warranties, payment terms, or anything clients should know. This section stays hidden until you add something."),
      card(field({ label: "Section title", path: "policies.heading" }), field({ label: "Intro", path: "policies.intro", type: "textarea" })),
      formatHelp(),
      listEditor({
        path: "policies.items",
        title: (it) => it.title || "New policy",
        addText: "Add a policy",
        blank: { title: "", body: "" },
        fields: [
          { key: "title", label: "Title" },
          { key: "body", label: "Details", type: "tall" },
        ],
      }),
      card(field({ label: "Closing line", path: "policies.outro", type: "textarea" })),
    ],
    help: renderHelp,
  };

  function render() {
    document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === S.tab)));
    const panel = $("#panel");
    panel.replaceChildren(...[TABS[S.tab]()].flat());
    refreshSavebar();
  }
  function rerender(scrollBottom = false) {
    const y = window.scrollY;
    render();
    window.scrollTo(0, scrollBottom ? document.body.scrollHeight : y);
  }

  document.querySelectorAll(".tabs button").forEach((b) =>
    b.addEventListener("click", () => {
      S.tab = b.dataset.tab;
      history.replaceState(null, "", `#${S.tab}`);
      render();
      window.scrollTo(0, 0);
    })
  );

  // ---------- photos ----------
  const categories = () => S.content.gallery.categories;

  function categorySelect(value, onchange, { emptyLabel = "No category" } = {}) {
    const sel = h("select", { "aria-label": "Category" }, h("option", { value: "", text: emptyLabel }), categories().map((c) => h("option", { value: c, text: c })));
    if (value && !categories().includes(value)) sel.append(h("option", { value, text: value }));
    sel.value = value || "";
    sel.addEventListener("change", () => onchange(sel.value));
    return sel;
  }

  function visiblePhotos() {
    const f = S.filter;
    return S.photos.filter((p) =>
      f === "all" ? true : f === "__none" ? !p.category : f === "__hidden" ? p.hidden : p.category === f
    );
  }

  function renderPhotos() {
    const out = [intro("Photos", "Add new photos, put your favorites first, and remove old ones. New photos go live right away.")];

    // Upload box
    const fileInput = h("input", { type: "file", accept: "image/*", multiple: true, hidden: true });
    fileInput.addEventListener("change", () => {
      if (fileInput.files.length) uploadFiles([...fileInput.files]);
      fileInput.value = "";
    });
    const drop = h(
      "div",
      { class: "drop" },
      h("h2", { text: "Add photos" }),
      h("p", { text: "Pick as many as you like from your phone or computer. They're resized automatically, so they load fast." }),
      h("button", { class: "btn primary", type: "button", disabled: S.uploading, onclick: () => fileInput.click() }, "📷 Choose photos"),
      h("div", { class: "drop-opts" }, h("span", { text: "Put new photos in:" }), categorySelect(S.batchCategory, (v) => (S.batchCategory = v))),
      fileInput
    );
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", (e) => {
      const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
      if (files.length && !S.uploading) uploadFiles(files);
    });
    out.push(drop, h("div", { id: "progress" }));

    // Tools
    const counts = { hidden: S.photos.filter((p) => p.hidden).length };
    const filterSel = h(
      "select",
      { "aria-label": "Show" },
      h("option", { value: "all", text: `All photos (${S.photos.length})` }),
      categories().map((c) => h("option", { value: c, text: `${c} (${S.photos.filter((p) => p.category === c).length})` })),
      h("option", { value: "__none", text: `No category (${S.photos.filter((p) => !p.category).length})` }),
      h("option", { value: "__hidden", text: `Hidden (${counts.hidden})` })
    );
    filterSel.value = S.filter;
    filterSel.addEventListener("change", () => {
      S.filter = filterSel.value;
      rerender();
    });
    out.push(
      h(
        "div",
        { class: "photo-tools" },
        h("div", { class: "left" }, filterSel),
        h(
          "button",
          {
            class: "btn sm",
            type: "button",
            onclick: () => {
              S.selecting = !S.selecting;
              S.selected.clear();
              rerender();
            },
          },
          S.selecting ? "Done selecting" : "Select several"
        )
      )
    );
    out.push(
      h(
        "p",
        { class: "small-print", style: "margin-bottom:.75rem" },
        S.filter === "all" && !S.selecting
          ? "Photos at the top show first on your site. Drag the ⠿ handle to reorder, or tap ⤒ to move a photo to the top."
          : S.selecting
          ? "Tap photos to select them, then choose what to do."
          : "To reorder photos, switch back to \"All photos\"."
      )
    );

    if (S.selecting) out.push(bulkBar());

    const list = h("ul", { class: "photos", id: "photo-list" });
    const shown = visiblePhotos();
    if (!shown.length) list.append(h("li", { class: "empty", text: S.photos.length ? "No photos here." : "No photos yet. Add some above!" }));
    shown.forEach((p) => list.append(photoRow(p)));
    out.push(list);

    if (window.Sortable && S.filter === "all" && !S.selecting && shown.length > 1) {
      setTimeout(() => {
        const el = $("#photo-list");
        if (!el) return;
        Sortable.create(el, {
          handle: ".ph-handle",
          animation: 150,
          delay: 0,
          onEnd: () => {
            const order = [...el.querySelectorAll(".ph")].map((li) => li.dataset.id);
            const byId = new Map(S.photos.map((p) => [p.id, p]));
            S.photos = order.map((id) => byId.get(id));
            refreshSavebar();
          },
        });
      });
    }
    return out;
  }

  function photoRow(p) {
    const canDrag = S.filter === "all" && !S.selecting;
    const li = h("li", { class: `ph${p.hidden ? " is-hidden" : ""}${S.selected.has(p.id) ? " selected" : ""}`, "data-id": p.id });
    const img = h("img", { class: "ph-img", src: p.thumb || p.src, alt: p.alt || "Project photo", loading: "lazy" });
    img.addEventListener("click", () => (S.selecting ? toggleSelect(p, li) : viewPhoto(p)));

    const desc = h("input", { type: "text", placeholder: "Describe it (optional)", "aria-label": "Photo description" });
    desc.value = p.alt || "";
    desc.addEventListener("input", () => { p.alt = desc.value; refreshSavebar(); });

    const hideBtn = h("button", { class: "btn sm", type: "button", title: p.hidden ? "Show on site" : "Hide from site" }, p.hidden ? "👁 Show" : "Hide");
    hideBtn.addEventListener("click", () => { p.hidden = !p.hidden; rerender(); });

    const topBtn = h("button", { class: "btn sm", type: "button", title: "Move to top", "aria-label": "Move to top" }, "⤒");
    topBtn.addEventListener("click", () => {
      S.photos = [p, ...S.photos.filter((x) => x !== p)];
      rerender();
      toast("Moved to the top. Remember to save.");
    });

    const delBtn = h("button", { class: "btn sm danger", type: "button", title: "Delete", "aria-label": "Delete photo" }, "🗑");
    delBtn.addEventListener("click", () => deletePhotos([p.id]));

    li.append(
      h("span", { class: `ph-handle${canDrag ? "" : " off"}`, "aria-hidden": "true", title: "Drag to reorder" }, "⠿"),
      img,
      h(
        "div",
        { class: "ph-fields" },
        desc,
        categorySelect(p.category, (v) => { p.category = v; refreshSavebar(); }),
        h("div", { class: "ph-actions" }, hideBtn, canDrag ? topBtn : null, delBtn, p.hidden ? h("span", { class: "badge", text: "Hidden" }) : null)
      )
    );
    if (S.selecting) {
      const cb = h("input", { type: "checkbox", class: "ph-check", "aria-label": "Select photo" });
      cb.checked = S.selected.has(p.id);
      cb.addEventListener("change", () => toggleSelect(p, li, cb.checked));
      li.append(cb);
    }
    return li;
  }

  function toggleSelect(p, li, force) {
    const on = force ?? !S.selected.has(p.id);
    on ? S.selected.add(p.id) : S.selected.delete(p.id);
    li.classList.toggle("selected", on);
    const cb = li.querySelector(".ph-check");
    if (cb) cb.checked = on;
    const count = $("#sel-count");
    if (count) count.textContent = `${S.selected.size} selected`;
  }

  function bulkBar() {
    const pick = () => S.photos.filter((p) => S.selected.has(p.id));
    const need = () => (S.selected.size ? true : (toast("Select some photos first.", true), false));
    return h(
      "div",
      { class: "bulkbar" },
      h("strong", { id: "sel-count", text: `${S.selected.size} selected` }),
      h(
        "div",
        { style: "display:flex;gap:.4rem;flex-wrap:wrap;align-items:center" },
        h("button", { class: "btn sm", type: "button", onclick: () => { visiblePhotos().forEach((p) => S.selected.add(p.id)); rerender(); } }, "Select all"),
        categorySelect("", (v) => {
          if (!need()) return;
          pick().forEach((p) => (p.category = v));
          toast(`Category set. Remember to save.`);
          rerender();
        }, { emptyLabel: "Set category…" }),
        h("button", { class: "btn sm", type: "button", onclick: () => { if (!need()) return; pick().forEach((p) => (p.hidden = true)); rerender(); } }, "Hide"),
        h("button", { class: "btn sm", type: "button", onclick: () => { if (!need()) return; pick().forEach((p) => (p.hidden = false)); rerender(); } }, "Show"),
        h("button", { class: "btn sm danger", type: "button", onclick: () => need() && deletePhotos([...S.selected]) }, "Delete")
      )
    );
  }

  function viewPhoto(p) {
    const dlg = h("dialog", { class: "viewer" }, h("img", { src: p.src, alt: p.alt || "" }), h("button", { class: "btn", type: "button", onclick: () => dlg.close() }, "Close ✕"));
    dlg.addEventListener("click", (e) => e.target === dlg && dlg.close());
    dlg.addEventListener("close", () => dlg.remove());
    document.body.append(dlg);
    dlg.showModal();
  }

  async function deletePhotos(ids) {
    const n = ids.length;
    if (!confirm(n === 1 ? "Delete this photo from your website? This can't be undone." : `Delete ${n} photos from your website? This can't be undone.`)) return;
    try {
      await api("photos/delete", { method: "POST", body: { ids } });
      const gone = new Set(ids);
      S.photos = S.photos.filter((p) => !gone.has(p.id));
      S.savedPhotos = photoSnapshot(JSON.parse(S.savedPhotos).filter((p) => !gone.has(p.id)));
      S.selected.clear();
      toast(n === 1 ? "Photo deleted." : `${n} photos deleted.`);
      rerender();
    } catch (err) {
      if (err.message !== "signed out") toast(err.message, true);
    }
  }

  // Resize in the browser so uploads are quick and the site stays fast.
  async function decode(file) {
    if ("createImageBitmap" in window) {
      try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch {}
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
      img.src = url;
    });
  }
  function toJpeg(src, maxW, maxH, quality) {
    const w0 = src.width, h0 = src.height;
    const scale = Math.min(1, maxW / w0, maxH / h0);
    const c = document.createElement("canvas");
    c.width = Math.round(w0 * scale);
    c.height = Math.round(h0 * scale);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(src, 0, 0, c.width, c.height);
    return new Promise((res, rej) => c.toBlob((b) => (b ? res({ blob: b, w: c.width, h: c.height }) : rej(new Error("resize failed"))), "image/jpeg", quality));
  }

  async function uploadFiles(files) {
    if (S.uploading) return;
    S.uploading = true;
    const box = $("#progress");
    const bar = h("span");
    const label = h("strong");
    const fails = h("div", { class: "fails" });
    box.replaceChildren(h("div", { class: "progress" }, label, h("div", { class: "small-print", text: "Keep this page open until it finishes." }), h("div", { class: "progress-bar" }, bar), fails));
    document.querySelectorAll(".drop button").forEach((b) => (b.disabled = true));

    let done = 0;
    const failed = [];
    for (const file of files) {
      label.textContent = `Adding photo ${done + failed.length + 1} of ${files.length}…`;
      try {
        let bmp;
        try { bmp = await decode(file); } catch {
          throw new Error(/heic|heif/i.test(file.type + file.name) ? "HEIC photo couldn't be read on this computer. Try uploading it from your iPhone instead." : "This file couldn't be read as a photo.");
        }
        const full = await toJpeg(bmp, 1800, 1800, 0.82);
        const sm = await toJpeg(bmp, 700, 875, 0.78);
        bmp.close?.();
        const form = new FormData();
        form.append("full", full.blob, "full.jpg");
        form.append("sm", sm.blob, "sm.jpg");
        form.append("w", sm.w);
        form.append("h", sm.h);
        form.append("category", S.batchCategory);
        let res;
        try { res = await api("photos", { method: "POST", form }); }
        catch (e) { if (e.message === "signed out") throw e; await new Promise((r) => setTimeout(r, 1500)); res = await api("photos", { method: "POST", form }); }
        S.photos.unshift(res.photo);
        S.savedPhotos = photoSnapshot([res.photo, ...JSON.parse(S.savedPhotos)]);
        done++;
      } catch (err) {
        if (err.message === "signed out") break;
        failed.push(`${file.name}: ${err.message}`);
        fails.textContent = `Couldn't add ${failed.length}: ${failed.join(" · ")}`;
      }
      bar.style.width = `${((done + failed.length) / files.length) * 100}%`;
    }
    S.uploading = false;
    if (S.tab === "photos") {
      rerender();
      if (failed.length) {
        $("#progress").replaceChildren(h("div", { class: "progress" }, h("strong", { text: `Added ${done} of ${files.length} photos.` }), h("div", { class: "fails", text: failed.join(" · ") })));
      }
    }
    if (done) toast(done === 1 ? "Photo added to your site!" : `${done} photos added to your site!`);
  }

  // ---------- help ----------
  function renderHelp() {
    return [
      intro("How to use your dashboard", null),
      h(
        "div",
        { class: "card help" },
        h("h3", { text: "Saving" }),
        h("p", { text: "Text changes, photo order, categories and descriptions are saved when you tap \"Save & publish\" in the bar at the bottom. Your website updates within a few seconds. Adding or deleting photos happens right away." }),
        h("h3", { text: "Adding photos" }),
        h("ol", {}, h("li", { text: "Go to Photos and tap \"Choose photos\"." }), h("li", { text: "Pick a category first if they're all the same kind (optional)." }), h("li", { text: "Select as many photos as you want. Keep the page open until it says they're added." })),
        h("p", { text: "New photos go to the top of your gallery. Big phone photos are shrunk automatically so the site stays fast." }),
        h("h3", { text: "Choosing what shows first" }),
        h("p", { text: "Drag the ⠿ handle to reorder, or tap ⤒ to send a photo to the top. Customers see the first 12, then tap \"Show more\". Your Gallery section and menu link only appear once you have at least one photo. Then tap Save." }),
        h("h3", { text: "Cleaning up lots of photos at once" }),
        h("p", { text: "Tap \"Select several\", tap the photos you want, then delete them, hide them, or give them all a category." }),
        h("h3", { text: "Hide vs. delete" }),
        h("p", { text: "Hide keeps a photo in your dashboard but takes it off the website (good for older projects). Delete removes it for good." }),
        h("h3", { text: "Descriptions" }),
        h("p", { text: "A short description like \"Retail build-out in Euless\" helps people using screen readers and helps Google find your work. It's optional." }),
        h("h3", { text: "The top banner" }),
        h("p", { text: "In Contact & Info, turn on the banner for things like \"Booked through December 15\" or holiday ordering deadlines. Turn it off when it's no longer true." }),
        h("h3", { text: "Put the dashboard on your phone's home screen" }),
        h("ul", {}, h("li", { text: "iPhone: open this page in Safari, tap Share, then \"Add to Home Screen\"." }), h("li", { text: "Android: open this page in Chrome, tap ⋮, then \"Add to Home screen\"." })),
        h("h3", { text: "Signing in" }),
        h("p", { text: "You stay signed in on this device for 30 days. If you forget your password, ask your web person to reset it." })
      ),
      passwordCard(),
    ];
  }

  function passwordCard() {
    const cur = h("input", { type: "password", id: "pw-cur", autocomplete: "current-password" });
    const next = h("input", { type: "password", id: "pw-new", autocomplete: "new-password" });
    const again = h("input", { type: "password", id: "pw-again", autocomplete: "new-password" });
    const msg = h("p", { class: "error", role: "alert" });
    const btn = h("button", { class: "btn primary", type: "submit" }, "Change password");
    const form = h(
      "form",
      { class: "card" },
      h("h3", { text: "Change your password", style: "margin-bottom:.75rem" }),
      h("div", { class: "field" }, h("label", { for: "pw-cur" }, "Current password"), cur),
      h("div", { class: "row" },
        h("div", { class: "field" }, h("label", { for: "pw-new" }, "New password", h("span", { class: "hint", text: "At least 8 characters" })), next),
        h("div", { class: "field" }, h("label", { for: "pw-again" }, "Type it again", h("span", { class: "hint", text: "\u00a0" })), again)
      ),
      msg,
      btn
    );
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg.textContent = "";
      if (next.value !== again.value) return (msg.textContent = "The new passwords don't match.");
      btn.disabled = true;
      try {
        const res = await api("password", { method: "PUT", body: { current: cur.value, next: next.value } });
        S.token = res.token;
        store.set(res.token);
        form.reset();
        toast("Password changed. Other devices will need to sign in again.");
      } catch (err) {
        if (err.message !== "signed out") msg.textContent = err.message;
      } finally {
        btn.disabled = false;
      }
    });
    return form;
  }

  // ---------- start ----------
  if (S.token) loadData().catch((err) => err.message !== "signed out" && showLogin(err.message));
  else showLogin();
})();
