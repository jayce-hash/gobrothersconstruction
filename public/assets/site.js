(() => {
  // ---- Mobile menu ----
  const burger = document.querySelector(".hamburger");
  const links = document.getElementById("nav-links");
  const setMenu = (open) => {
    links.classList.toggle("open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  burger?.addEventListener("click", () => setMenu(!links.classList.contains("open")));
  links?.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => e.key === "Escape" && links?.classList.contains("open") && setMenu(false));

  // ---- Reveal on scroll ----
  const els = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))),
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((el) => io.observe(el));
  } else els.forEach((el) => el.classList.add("in"));

  // ---- Gallery: filters + show more ----
  const grid = document.querySelector(".grid");
  if (grid) {
    const PAGE = parseInt(grid.dataset.page, 10) || 12;
    const tiles = [...grid.querySelectorAll(".tile")];
    const more = document.querySelector(".more");
    let filter = "all";
    let limit = PAGE;

    const matching = () => tiles.filter((t) => filter === "all" || t.dataset.cat === filter);
    const update = () => {
      const m = matching();
      tiles.forEach((t) => (t.hidden = true));
      m.slice(0, limit).forEach((t) => (t.hidden = false));
      const left = m.length - limit;
      more.hidden = left <= 0;
      if (left > 0) more.textContent = `Show more photos (${left})`;
    };
    document.querySelectorAll(".chip").forEach((chip) =>
      chip.addEventListener("click", () => {
        document.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
        filter = chip.dataset.filter;
        limit = PAGE;
        update();
      })
    );
    more?.addEventListener("click", () => {
      const first = matching()[limit];
      limit += PAGE;
      update();
      first?.querySelector("button")?.focus({ preventScroll: true });
    });
    update();

    // ---- Lightbox ----
    const dlg = document.querySelector(".lightbox");
    const img = dlg.querySelector("img");
    const cap = dlg.querySelector("figcaption");
    let list = [];
    let idx = 0;
    const show = (i) => {
      idx = (i + list.length) % list.length;
      const btn = list[idx];
      const thumb = btn.querySelector("img");
      img.src = btn.dataset.full;
      img.alt = thumb.alt;
      cap.textContent = thumb.alt;
    };
    grid.addEventListener("click", (e) => {
      const btn = e.target.closest(".tile-btn");
      if (!btn) return;
      list = matching().map((t) => t.querySelector(".tile-btn"));
      show(list.indexOf(btn));
      dlg.showModal();
    });
    dlg.querySelector(".lb-close").addEventListener("click", () => dlg.close());
    dlg.querySelector(".lb-prev").addEventListener("click", () => show(idx - 1));
    dlg.querySelector(".lb-next").addEventListener("click", () => show(idx + 1));
    dlg.addEventListener("click", (e) => e.target === dlg && dlg.close());
    dlg.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") show(idx - 1);
      if (e.key === "ArrowRight") show(idx + 1);
    });
    let x0 = null;
    dlg.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
    dlg.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  }
})();
