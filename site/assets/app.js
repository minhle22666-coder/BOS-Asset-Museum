(() => {
  "use strict";
  const CFG = window.BOS_CONFIG || {};
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------------------------------------------------------- words
  const STORY = [
    { meta: "Transmission 1 of 3, stardate 2049", text: "Somewhere past the edge of the office, a small crew called BOS kept a whole company in orbit. Orders shipped, numbers checked, lights always on." },
    { meta: "Transmission 2 of 3", text: "Along the way they made things. A logo that glows in the dark. A crew of green explorers in silver suits. A sky for every meeting screen." },
    { meta: "Transmission 3 of 3", text: "So they built a planet to keep it all safe and opened the doors to everyone. Every piece in these halls is yours to take on your next mission." },
  ];
  // Each hall has its own colour, icon, guide pose and guide lines. Unknown halls fall back to "_".
  const HALL = {
    "logo-mascot": { hue: "#74f0b4", pose: "hero", lines: ["These are the originals. Handle with care!", "Copy a logo, paste it on your cover slide."] },
    "desktop-background": { hue: "#7cc4ff", pose: "fly", lines: ["Pick a sky for your screen.", "Download one and set it as your wallpaper."] },
    "slide-design": { hue: "#a994ff", pose: "tablet", lines: ["Copy a pose, paste it into your slide. Easy.", "Switch to Wall to see every pose at once."] },
    "mini-games": { hue: "#f2a2ff", pose: "thumbs", lines: ["Game night? Grab the whole set with one ZIP.", "Good luck, players!"] },
    _: { hue: "#8fe3ff", pose: "float", lines: ["Fresh arrivals from the BOS Drive."] },
  };
  const HOME_LINES = ["Hi! I'm your guide. Scroll down to start the tour.", "Psst, every picture here can be copied straight into your slides."];
  const POSE = { wave: [389, 511], hero: [304, 517], fly: [409, 564], tablet: [405, 515], thumbs: [358, 482], float: [409, 513], point: [386, 501] };

  const ICON = {
    // Duotone hall icons: .d1 is the soft glass layer, .d2 the solid shape, .k a cut-out in the page colour.
    home: '<img src="assets/planet/favicon-64.png" alt="" width="26" height="26">',
    "logo-mascot": '<svg class="duo" viewBox="0 0 24 24" aria-hidden="true"><path class="d1" d="M12 2.5 20 7v10l-8 4.5L4 17V7z"/><path class="d2" d="m12 7.2 1.45 2.95 3.25.47-2.35 2.3.55 3.24L12 14.63l-2.9 1.53.55-3.24-2.35-2.3 3.25-.47z"/></svg>',
    "desktop-background": '<svg class="duo" viewBox="0 0 24 24" aria-hidden="true"><rect class="d1" x="2.5" y="3.5" width="19" height="13.5" rx="2.6"/><path class="d2" d="M2.5 14.2 7.6 9.6l3.6 3.1 2.9-2.4 7.4 5.5v.6a2.6 2.6 0 0 1-2.6 2.6H5.1a2.6 2.6 0 0 1-2.6-2.6z"/><circle class="d2" cx="16.6" cy="7.6" r="1.6"/><path class="s" d="M9 21h6"/></svg>',
    "slide-design": '<svg class="duo" viewBox="0 0 24 24" aria-hidden="true"><rect class="d1" x="6.5" y="2.5" width="15" height="11" rx="2.4"/><rect class="d2" x="2.5" y="7" width="15" height="11" rx="2.4"/><path class="k" d="m10 9.4 1 2.1 2.1 1-2.1 1-1 2.1-1-2.1-2.1-1 2.1-1z"/><path class="s" d="M7 21h6"/></svg>',
    "mini-games": '<svg class="duo" viewBox="0 0 24 24" aria-hidden="true"><path class="d1" d="M7.5 5.5h9a5 5 0 0 1 4.9 6l-.9 4.4a2.6 2.6 0 0 1-4.5 1.2L14.6 15H9.4L8 17.1a2.6 2.6 0 0 1-4.5-1.2l-.9-4.4a5 5 0 0 1 4.9-6z"/><path class="d2" d="M7.4 8.6h1.2v1.8h1.8v1.2H8.6v1.8H7.4v-1.8H5.6v-1.2h1.8z"/><circle class="d2" cx="15.6" cy="9.6" r="1.15"/><circle class="d2" cx="17.6" cy="12" r="1.15"/></svg>',
    _: '<svg class="duo" viewBox="0 0 24 24" aria-hidden="true"><path class="d1" d="M2.5 7A2.5 2.5 0 0 1 5 4.5h4l2 2h8A2.5 2.5 0 0 1 21.5 9v9a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 18z"/><path class="d2" d="m12 9.5 1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z"/></svg>',
    orbit: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="6" width="7" height="12" rx="1.6"/><path d="M5.5 8v8M2.5 10v4M18.5 8v8M21.5 10v4"/></svg>',
    wall: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.6"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.6"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.6"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.6"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14"/></svg>',
    zip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8.5 12 4l7 4.5v8L12 21l-7-4.5z"/><path d="M5 8.5 12 13l7-4.5M12 13v8"/></svg>',
  };

  // ---------------------------------------------------------------- utils
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const url = (p) => p.split("/").map(encodeURIComponent).join("/");
  const fileName = (p) => p.split("/").pop();
  const ext = (p) => fileName(p).split(".").pop().toUpperCase();
  function bytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${Math.round(n / 1024)} KB`;
    if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
    return `${(n / 1073741824).toFixed(2)} GB`;
  }
  const meta = (it) => [ext(it.file), it.w ? `${it.w} × ${it.h}` : null, bytes(it.size)].filter(Boolean).join(", ");
  const pretty = (s) => s.replace(/[-_]+/g, " ").trim();
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const pad = (n) => String(n).padStart(2, "0");
  const hallOf = (slug) => HALL[slug] || HALL._;
  const pref = {
    get(k, d) { try { return localStorage.getItem(`bos-${k}`) || d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(`bos-${k}`, v); } catch (_) {} },
  };

  let toastTimer;
  // sticky = stays until the next message (used while a refresh is running)
  function toast(msg, sticky = false) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    t.classList.toggle("sticky", sticky);
    clearTimeout(toastTimer);
    if (!sticky) toastTimer = setTimeout(() => t.classList.remove("show", "sticky"), msg.length > 70 ? 6000 : 3200);
  }

  // ---------------------------------------------------------------- sign-in (Cloudflare Access guards the door; we only show who you are)
  async function whoAmI() {
    if ((CFG.authMode || "none") !== "cloudflare-access") return;
    try {
      const r = await fetch("/cdn-cgi/access/get-identity", { credentials: "include", cache: "no-store" });
      if (!r.ok) return;
      const id = await r.json();
      if (!id.email) return;
      $("#me-initial").textContent = id.email[0].toUpperCase();
      $("#me-hint").textContent = `Sign out ${id.email}`;
      $("#me").setAttribute("aria-label", `Signed in as ${id.email}. Sign out`);
      $("#me").hidden = false;
    } catch (_) {}
  }

  // ---------------------------------------------------------------- state
  let manifest = { categories: [] };
  const byId = new Map();
  const deck = { p: 0, target: 0, index: 0, count: 1, dragging: false };
  const halls = [];   // { cat, page, orbit, wall, view }
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };

  // ---------------------------------------------------------------- build
  function build() {
    const cats = manifest.categories;
    const pill = $("#pill");
    const pills = [{ slug: "home", title: "Home", icon: ICON.home, hue: "#9fb4ff" }].concat(
      cats.map((c) => ({ slug: c.slug, title: c.title, icon: ICON[c.slug] || ICON._, hue: hallOf(c.slug).hue }))
    );
    pill.innerHTML = pills.map((p, i) => `
      <button class="pill-btn" type="button" data-go="${i}" style="--hue:${p.hue}" aria-label="${esc(p.title)}">
        <span class="pill-ico">${p.icon}</span><span class="pill-label">${esc(i === 0 ? "Home" : shortTitle(p.title))}</span>
      </button>`).join("");
    $("#progress").innerHTML = pills.map((p, i) => `<span style="--hue:${p.hue}" data-i="${i}"></span>`).join("");

    const deckEl = $("#deck");
    cats.forEach((c, k) => {
      const h = hallOf(c.slug);
      const page = document.createElement("section");
      page.className = "page page-hall";
      page.dataset.index = String(k + 1);
      page.dataset.slug = c.slug;
      page.dataset.frame = c.frame;
      page.style.setProperty("--hue", h.hue);
      page.setAttribute("aria-label", c.title);
      page.innerHTML = `
        <header class="hall-head">
          <div class="hall-id">
            <span class="hall-badge">${ICON[c.slug] || ICON._}</span>
            <div>
              <p class="hall-no">Hall ${pad(k + 1)}<span>${plural(c.count, "piece")}</span></p>
              <h2 class="hall-title">${esc(c.title)}</h2>
              ${c.description ? `<p class="hall-desc">${esc(c.description)}</p>` : ""}
            </div>
          </div>
          ${c.count ? `<div class="hall-tools">
            <div class="switch" role="group" aria-label="How to show this hall">
              <button type="button" data-view="orbit" aria-pressed="true">${ICON.orbit}<span>Orbit</span></button>
              <button type="button" data-view="wall" aria-pressed="false">${ICON.wall}<span>Wall</span></button>
              <i class="switch-glider" aria-hidden="true"></i>
            </div>
            <button class="orb-btn" type="button" data-zip="${esc(c.slug)}" aria-label="Download this hall as a ZIP">${ICON.zip}<span class="hint">Download this hall (${bytes(c.bytes)})</span></button>
          </div>` : ""}
        </header>
        <div class="hall-body"></div>`;
      deckEl.appendChild(page);
      const hall = { cat: c, page, view: "orbit", orbit: null, wall: null };
      halls.push(hall);
      const body = $(".hall-body", page);
      if (!c.count) {
        body.innerHTML = `<div class="empty"><b>This hall is still being set up.</b>Pieces added to the matching Drive folder land here automatically within about an hour.</div>`;
      } else {
        hall.orbit = new Orbit(body, c.items, c.frame, hall);
        hall.wall = new Wall(body, c.items, hall);
        setView(hall, pref.get("view", CFG.defaultView === "grid" ? "wall" : "orbit"), true);
      }
    });
    deck.count = cats.length + 1;
  }
  const shortTitle = (t) => t.replace(/^Logo & Mascot.*/i, "Logo & Mascot").replace(/^Mascot Materials for /i, "").replace(/^Materials for /i, "");

  function setView(hall, view, silent) {
    hall.view = view;
    hall.page.dataset.view = view;
    $$(".switch button", hall.page).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
    if (view === "orbit") { hall.wall.hide(); hall.orbit.show(!silent); }
    else { hall.orbit.hide(); hall.wall.show(!silent); }
    if (!silent) pref.set("view", view);
    if (halls[deck.index - 1] === hall) document.body.dataset.view = view;
  }

  // ---------------------------------------------------------------- Orbit: a spiral of pieces you spin like a carousel
  class Orbit {
    constructor(parent, items, frame, hall) {
      this.items = items; this.hall = hall; this.frame = frame;
      this.pos = 0; this.target = 0; this.intro = 0; this.dirty = true; this.touched = false;
      this.el = document.createElement("div");
      this.el.className = "orbit";
      this.el.innerHTML = `
        <div class="orbit-stage" tabindex="0" role="listbox" aria-label="Pieces in this hall. Use the left and right arrow keys to turn.">
          <div class="helix"></div>
          <div class="orbit-floor" aria-hidden="true"></div>
        </div>
        <div class="orbit-caption">
          <p class="oc-count"></p>
          <p class="oc-name"></p>
          <p class="oc-meta"></p>
          <div class="oc-actions">
            <button class="btn-go btn-sm" type="button" data-act="copy">${ICON.copy}<span>Copy</span></button>
            <a class="btn-ghost btn-sm" data-act="download">${ICON.down}<span>Download</span></a>
          </div>
        </div>`;
      parent.appendChild(this.el);
      this.stage = $(".orbit-stage", this.el);
      this.helix = $(".helix", this.el);
      this.cards = items.map((it, i) => {
        const b = document.createElement("div");
        b.className = "card";
        b.dataset.i = i;
        b.setAttribute("role", "option");
        b.innerHTML = `<div class="card-face"><img src="${url(it.thumb)}" alt="${esc(it.name)}" loading="lazy" decoding="async" draggable="false"></div>`;
        this.helix.appendChild(b);
        return b;
      });
      $('[data-act="copy"]', this.el).onclick = () => copyItem(this.items[this.index]);
      this.stage.addEventListener("click", (e) => {
        if (this.justDragged) return;
        const c = e.target.closest(".card");
        if (!c) return;
        const i = +c.dataset.i;
        if (i === this.index) openViewer(this.hall, i); else this.go(i);
      });
      this.stage.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openViewer(this.hall, this.index); }
      });
      this.measure();
      // open a few pieces in, so the spiral fans out on both sides
      this.go(Math.min(Math.floor((items.length - 1) / 2), 3), true);
    }
    measure() {
      const W = innerWidth, H = innerHeight;
      const wide = this.frame === "wide";
      const h = clamp(H * (W < 760 ? 0.36 : 0.42), 200, 400);
      const w = wide ? h * 1.6 : h * 0.86;
      this.w = w; this.h = h;
      const N = this.items.length;
      this.perTurn = N > 12 ? 12 : Math.max(N, 8);
      this.step = 360 / this.perTurn;
      this.R = Math.max(w * 0.9, (w / 2 + 26) / Math.tan(Math.PI / this.perTurn));
      this.pitch = N > this.perTurn ? (h * 1.12) / this.perTurn : 0;
      this.el.style.setProperty("--cw", `${w}px`);
      this.el.style.setProperty("--ch", `${h}px`);
      this.cards.forEach((c, i) => {
        c.style.transform = `rotateY(${i * this.step}deg) translateZ(${this.R}px) translateY(${i * this.pitch}px)`;
      });
      this.dirty = true;
    }
    get index() { return clamp(Math.round(this.target), 0, this.items.length - 1); }
    go(i, instant) {
      this.target = clamp(i, 0, this.items.length - 1);
      if (instant) this.pos = this.target;
      this.dirty = true;
      this.caption();
    }
    nudge(d) { this.touched = true; this.go(this.index + d); }
    caption() {
      const i = this.index, it = this.items[i];
      $(".oc-count", this.el).textContent = `${pad(i + 1)} / ${pad(this.items.length)}`;
      $(".oc-name", this.el).textContent = it.name;
      $(".oc-meta", this.el).textContent = [it.collection ? pretty(it.collection) : null, meta(it)].filter(Boolean).join(", ");
      const dl = $('[data-act="download"]', this.el);
      dl.href = url(it.file);
      dl.setAttribute("download", fileName(it.file));
      this.cards.forEach((c, k) => c.setAttribute("aria-selected", String(k === i)));
    }
    show(animate) {
      this.el.hidden = false;
      this.measure();
      this.intro = animate && !reduce ? 1 : 0;
      this.dirty = true;
    }
    hide() { this.el.hidden = true; }
    // drag support (called by the deck's pointer router)
    dragStart() { this.drag0 = this.pos; this.touched = true; }
    dragMove(dx) { this.target = this.pos = clamp(this.drag0 - dx / (this.w * 0.7), -0.4, this.items.length - 0.6); this.dirty = true; }
    dragEnd(vx) {
      this.justDragged = true; setTimeout(() => (this.justDragged = false), 0);
      this.go(Math.round(this.pos - vx * 6));
    }
    tick(dt, active) {
      if (this.el.hidden) return;
      // gentle self-turning until someone touches it, so the hall feels alive
      if (active && !this.touched && !reduce) {
        this.idle = (this.idle || 0) + dt;
        if (this.idle > 3.8 && this.items.length > 1) { this.idle = 0; this.go((this.index + 1) % this.items.length); }
      }
      const k = 1 - Math.pow(0.0008, dt);
      if (Math.abs(this.target - this.pos) > 0.0005) { this.pos += (this.target - this.pos) * k; this.dirty = true; }
      if (this.intro > 0) { this.intro = Math.max(0, this.intro - dt / 1.1); this.dirty = true; }
      if (!this.dirty) return;
      this.dirty = false;
      const e = 1 - Math.pow(1 - this.intro, 3); // 1 → 0, eased
      const spin = this.pos * this.step + e * 140;
      this.helix.style.transform = `translateZ(${-this.R - e * 400}px) rotateY(${-spin}deg) translateY(${-this.pos * this.pitch}px)`;
      this.helix.style.opacity = String(1 - e * 0.8);
      const front = this.index;
      this.cards.forEach((c, i) => {
        const d = Math.abs(i - this.pos);
        const vis = d < this.perTurn / 2 + 0.5;
        c.style.visibility = vis ? "visible" : "hidden";
        if (!vis) return;
        c.style.opacity = String(clamp(1.25 - d / (this.perTurn / 2.6), 0.12, 1));
        c.classList.toggle("is-front", i === front);
      });
    }
  }

  // ---------------------------------------------------------------- Wall: every piece at once
  class Wall {
    constructor(parent, items, hall) {
      this.hall = hall;
      this.el = document.createElement("div");
      this.el.className = "wall";
      this.el.hidden = true;
      const groups = new Map();
      items.forEach((it, i) => { const k = it.collection; if (!groups.has(k)) groups.set(k, []); groups.get(k).push([it, i]); });
      const keys = [...groups.keys()].sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b, undefined, { numeric: true })));
      this.el.innerHTML = keys.map((k) => `
        ${k ? `<h3 class="wall-group">${esc(pretty(k))}<span>${groups.get(k).length}</span></h3>` : ""}
        <div class="wall-grid">${groups.get(k).map(([it, i]) => `
          <figure class="tile" data-i="${i}">
            <button class="tile-face" type="button" data-open="${i}" aria-label="Open ${esc(it.name)}">
              <img src="${url(it.thumb)}" alt="${esc(it.name)}" loading="lazy" decoding="async">
              <span class="glare" aria-hidden="true"></span>
            </button>
            <figcaption>
              <span class="tile-name" title="${esc(it.name)}">${esc(it.name)}</span>
              <span class="tile-actions">
                <button type="button" data-copy="${i}" aria-label="Copy ${esc(it.name)}" title="Copy">${ICON.copy}</button>
                <a href="${url(it.file)}" download="${esc(fileName(it.file))}" aria-label="Download ${esc(it.name)}" title="Download">${ICON.down}</a>
              </span>
            </figcaption>
          </figure>`).join("")}</div>`).join("");
      parent.appendChild(this.el);
      this.el.addEventListener("click", (e) => {
        const o = e.target.closest("[data-open]"), c = e.target.closest("[data-copy]");
        if (o) openViewer(hall, +o.dataset.open);
        else if (c) copyItem(hall.cat.items[+c.dataset.copy]);
      });
      if (fine) {
        let hot = null;
        const cool = () => { if (hot) { hot.classList.remove("hot"); hot.style.cssText = ""; hot = null; } };
        this.el.addEventListener("pointermove", (e) => {
          const t = e.target.closest(".tile");
          if (t !== hot) { cool(); if (t) { hot = t; t.classList.add("hot"); } }
          if (!t) return;
          const r = t.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          t.style.setProperty("--gx", `${px * 100}%`);
          t.style.setProperty("--gy", `${py * 100}%`);
          if (!reduce) { t.style.setProperty("--rx", `${(0.5 - py) * 12}deg`); t.style.setProperty("--ry", `${(px - 0.5) * 14}deg`); }
        });
        this.el.addEventListener("pointerleave", cool);
        this.el.addEventListener("scroll", cool, { passive: true });
      }
    }
    show(animate) {
      this.el.hidden = false;
      this.el.scrollTop = 0;
      if (animate && !reduce) {
        this.el.classList.remove("enter"); void this.el.offsetWidth; this.el.classList.add("enter");
        $$(".tile", this.el).forEach((t, k) => t.style.setProperty("--d", `${Math.min(k, 24) * 35}ms`));
      }
    }
    hide() { this.el.hidden = true; }
  }

  // ---------------------------------------------------------------- the deck of pages
  function go(i, instant) {
    i = clamp(Math.round(i), 0, deck.count - 1);
    const changed = i !== deck.index;
    deck.target = i;
    if (instant) deck.p = i;
    deck.index = i;
    document.body.dataset.page = String(i);
    $$(".page").forEach((pg) => {
      const on = +pg.dataset.index === i;
      pg.toggleAttribute("inert", !on);
      pg.setAttribute("aria-hidden", String(!on));
      pg.classList.toggle("is-current", on);
    });
    $$(".pill-btn").forEach((b) => b.setAttribute("aria-current", String(+b.dataset.go === i)));
    $$("#progress span").forEach((s) => s.classList.toggle("on", +s.dataset.i === i));
    const hall = halls[i - 1];
    const hash = hall ? `#hall-${hall.cat.slug}` : "#home";
    if (location.hash !== hash) history.replaceState(null, "", hash);
    document.documentElement.style.setProperty("--hue", hall ? hallOf(hall.cat.slug).hue : "#9fb4ff");
    document.body.dataset.view = hall ? hall.view : "home";
    if (changed || instant) guideTo(i);
  }
  const next = (d) => go(deck.index + d);
  function goChecked(i) {
    if (deck.count < 2) { toast("The halls haven't loaded. Refresh the page, or press the Refresh button to fetch them from Drive."); return; }
    go(i);
  }

  function renderDeck() {
    const H = innerHeight;
    $$(".page").forEach((pg) => {
      const d = +pg.dataset.index - deck.p;
      const a = Math.min(Math.abs(d), 1.2);
      if (a >= 1.15) { if (pg.style.display !== "none") pg.style.display = "none"; return; }
      if (pg.style.display === "none") pg.style.display = "";
      pg.style.transform = `translate3d(0, ${d * H}px, ${-a * 260}px) rotateX(${clamp(-d * 22, -30, 30)}deg)`;
      pg.style.opacity = String(Math.max(0, 1 - a));
      pg.style.zIndex = String(10 - Math.round(a * 5));
    });
    // the hall behind you slides and turns as you travel
    const span = Math.max(1, deck.count - 1);
    const t = deck.p / span;
    const frac = deck.p - Math.round(deck.p);
    const img = $(".world-img");
    const fx = pointer.sx * 14, fy = pointer.sy * 10;
    img.style.transform = `translate3d(${(-t * 12 + 6).toFixed(3)}%, ${(Math.sin(deck.p * 1.3) * 2).toFixed(3)}%, 0) translate(${fx}px, ${fy}px) scale(${1.32 + Math.abs(frac) * 0.08}) rotate(${(frac * 2.2).toFixed(3)}deg)`;
    $(".progress").style.setProperty("--p", String(deck.p / span));
    const pl = $("#planet");
    pl.style.setProperty("--deck", deck.p.toFixed(4));
    pl.style.setProperty("--fx", `${(pointer.sx * -18).toFixed(2)}px`);
    pl.style.setProperty("--fy", `${(pointer.sy * -12).toFixed(2)}px`);
  }

  // ---------------------------------------------------------------- the guide
  let guidePage = -1, bubbleTimer, lineIdx = 0;
  const seen = new Set();
  function guideTo(i) {
    const g = $("#guide");
    const hall = halls[i - 1];
    const pose = hall ? hallOf(hall.cat.slug).pose : "wave";
    if (guidePage === i) return;
    guidePage = i;
    lineIdx = 0;
    hideBubble();
    g.classList.toggle("in-hall", i > 0);
    const swap = () => {
      const img = $("#guide-img");
      img.src = `assets/planet/mascot-${pose}.webp`;
      img.width = POSE[pose][0]; img.height = POSE[pose][1];
      g.classList.remove("leaving");
      // greet once per hall (on phones only on the home page, so the tip never covers a picture)
      if (!seen.has(i) && (i === 0 || innerWidth > 760)) { seen.add(i); setTimeout(() => { if (guidePage === i) say(); }, 1100); }
    };
    if (reduce) return swap();
    g.classList.add("leaving");
    setTimeout(swap, 380);
  }
  function lines() { const h = halls[guidePage - 1]; return h ? hallOf(h.cat.slug).lines : HOME_LINES; }
  function say() {
    const L = lines();
    const b = $("#bubble");
    b.textContent = L[lineIdx % L.length];
    lineIdx++;
    $("#guide").classList.remove("hop"); void $("#guide").offsetWidth;
    $("#guide").classList.add("talk", "hop");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(hideBubble, 3600);
  }
  function hideBubble() { $("#guide").classList.remove("talk"); }

  // ---------------------------------------------------------------- story on the home page
  function story() {
    const bars = $("#story-bars"), text = $("#story-text"), metaEl = $("#story-meta");
    bars.innerHTML = STORY.map(() => "<span><i></i></span>").join("");
    let k = 0, timer, typing;
    function show(n) {
      k = (n + STORY.length) % STORY.length;
      clearTimeout(timer); clearInterval(typing);
      metaEl.textContent = STORY[k].meta;
      $$("span", bars).forEach((s, j) => { s.className = j < k ? "done" : j === k ? "now" : ""; });
      const full = STORY[k].text;
      const hold = 4200;
      if (reduce) { text.textContent = full; timer = setTimeout(() => show(k + 1), 9000); return; }
      let c = 0;
      text.textContent = "";
      text.classList.add("typing");
      const per = 26;
      bars.style.setProperty("--dur", `${full.length * per + hold}ms`);
      typing = setInterval(() => {
        c = Math.min(full.length, c + 2);
        text.textContent = full.slice(0, c);
        if (c >= full.length) { clearInterval(typing); text.classList.remove("typing"); }
      }, per * 2);
      timer = setTimeout(() => show(k + 1), full.length * per + hold);
    }
    $("#story").addEventListener("click", () => show(k + 1));
    show(0);
  }

  // ---------------------------------------------------------------- floating light motes
  function motes() {
    const c = $("#motes"), g = c.getContext("2d");
    let W, H, dots = [];
    const resize = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      W = innerWidth; H = innerHeight;
      c.width = W * dpr; c.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = Array.from({ length: Math.round(Math.min(90, W / 16)) }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.3 + Math.random() * 0.7, r: Math.random() * 1.6 + 0.4, v: 4 + Math.random() * 10, ph: Math.random() * 6.3 }));
    };
    resize();
    addEventListener("resize", resize);
    return (dt, time) => {
      g.clearRect(0, 0, W, H);
      for (const d of dots) {
        d.y -= d.v * dt * d.z;
        if (d.y < -10) { d.y = H + 10; d.x = Math.random() * W; }
        const yy = (((d.y - deck.p * 160 * d.z) % (H + 20)) + H + 20) % (H + 20) - 10;
        const xx = d.x + pointer.sx * 20 * d.z + Math.sin(time * 0.6 + d.ph) * 6;
        const a = (0.25 + 0.55 * d.z) * (0.6 + 0.4 * Math.sin(time * 1.5 + d.ph));
        g.fillStyle = `rgba(190,230,255,${a.toFixed(3)})`;
        g.beginPath(); g.arc(xx, yy, d.r * d.z, 0, 6.283); g.fill();
      }
    };
  }

  // ---------------------------------------------------------------- input: one router for drags, wheel and keys
  function input() {
    const deckEl = $("#deck");
    let s = null;
    deckEl.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || $("#viewer").open) return;
      const wall = e.target.closest(".wall");
      if (wall && e.pointerType !== "mouse") return; // phones scroll the wall natively
      if (e.target.closest("button, a")) { s = { x: e.clientX, y: e.clientY, soft: true }; return; }
      const hall = halls[deck.index - 1];
      s = { x: e.clientX, y: e.clientY, t: performance.now(), axis: null, orbit: e.target.closest(".orbit-stage") && hall?.view === "orbit" ? hall.orbit : null, wall: !!wall, p0: deck.p, lx: e.clientX, vx: 0, ly: e.clientY, vy: 0, lt: performance.now() };
    });
    addEventListener("pointermove", (e) => {
      pointer.x = (e.clientX / innerWidth) * 2 - 1;
      pointer.y = (e.clientY / innerHeight) * 2 - 1;
      if (!s || s.soft) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (!s.axis && Math.hypot(dx, dy) > 8) {
        s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (s.axis === "x" && s.orbit) s.orbit.dragStart();
        else if (s.axis === "y" && !s.wall) { deck.dragging = true; document.body.classList.add("dragging"); }
        else { s = null; return; }
      }
      const now = performance.now(), dt = Math.max(1, now - s.lt);
      s.vx = (e.clientX - s.lx) / dt; s.vy = (e.clientY - s.ly) / dt; s.lx = e.clientX; s.ly = e.clientY; s.lt = now;
      if (s.axis === "x" && s.orbit) s.orbit.dragMove(dx);
      if (s.axis === "y" && deck.dragging) deck.p = deck.target = clamp(s.p0 - dy / innerHeight, -0.25, deck.count - 0.75);
    });
    const end = () => {
      if (!s) return;
      if (s.axis === "x" && s.orbit) s.orbit.dragEnd(s.vx);
      if (s.axis === "y" && deck.dragging) {
        deck.dragging = false; document.body.classList.remove("dragging");
        const moved = deck.p - s.p0;
        const flick = -s.vy > 0.5 ? 1 : s.vy > 0.5 ? -1 : 0;
        go(Math.abs(moved) > 0.18 || flick ? Math.round(s.p0) + (flick || Math.sign(moved)) : Math.round(s.p0));
      }
      s = null;
    };
    addEventListener("pointerup", end);
    addEventListener("pointercancel", end);

    // phones: when the wall is scrolled to its end, keep swiping to change hall
    let ts = null;
    deckEl.addEventListener("touchstart", (e) => { const w = e.target.closest(".wall"); ts = w ? { w, y: e.touches[0].clientY, top: w.scrollTop <= 0, bottom: w.scrollTop + w.clientHeight >= w.scrollHeight - 2 } : null; }, { passive: true });
    deckEl.addEventListener("touchend", (e) => {
      if (!ts) return;
      const dy = e.changedTouches[0].clientY - ts.y;
      if (dy > 90 && ts.top) next(-1);
      else if (dy < -90 && ts.bottom) next(1);
      ts = null;
    }, { passive: true });

    let acc = 0, lock = 0, accTimer;
    addEventListener("wheel", (e) => {
      if ($("#viewer").open || $("#zipper").open) return;
      const hall = halls[deck.index - 1];
      // sideways scrolling turns the orbit
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        if (hall?.view === "orbit" && hall.orbit) {
          e.preventDefault();
          hall.orbit.wx = (hall.orbit.wx || 0) + e.deltaX;
          if (Math.abs(hall.orbit.wx) > 60) { hall.orbit.nudge(Math.sign(hall.orbit.wx)); hall.orbit.wx = 0; }
        }
        return;
      }
      // the wall scrolls normally until it reaches an end
      const wall = e.target.closest?.(".wall");
      if (wall) {
        const atTop = wall.scrollTop <= 0, atBottom = wall.scrollTop + wall.clientHeight >= wall.scrollHeight - 2;
        if ((e.deltaY < 0 && !atTop) || (e.deltaY > 0 && !atBottom)) return;
      }
      e.preventDefault();
      const now = performance.now();
      if (now < lock) return;
      acc += e.deltaY;
      clearTimeout(accTimer); accTimer = setTimeout(() => (acc = 0), 160);
      if (Math.abs(acc) > 45) { next(Math.sign(acc)); acc = 0; lock = now + 850; }
    }, { passive: false });

    addEventListener("keydown", (e) => {
      if ($("#viewer").open) {
        if (e.key === "ArrowLeft") stepViewer(-1);
        if (e.key === "ArrowRight") stepViewer(1);
        return;
      }
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const hall = halls[deck.index - 1];
      if (["ArrowDown", "PageDown"].includes(e.key) || (e.key === " " && !e.target.closest("button, a, [role=listbox]"))) { e.preventDefault(); next(1); }
      else if (["ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); next(-1); }
      else if (e.key === "Home") go(0);
      else if (hall?.view === "orbit" && hall.orbit && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { e.preventDefault(); hall.orbit.nudge(e.key === "ArrowLeft" ? -1 : 1); }
    });

    document.addEventListener("click", (e) => {
      const g = e.target.closest("[data-go]");
      if (g) { e.preventDefault(); goChecked(+g.dataset.go); return; }
      const v = e.target.closest("button[data-view]");
      if (v) { const hall = halls[deck.index - 1]; if (hall && hall.view !== v.dataset.view) setView(hall, v.dataset.view); return; }
      const z = e.target.closest("[data-zip]");
      if (z) exportZip(z.dataset.zip);
    });
    // a ring of light where you press, so every press feels answered
    document.addEventListener("pointerdown", (e) => {
      const b = e.target.closest(".btn-go, .btn-ghost, .pill-btn, .switch button");
      if (!b || reduce) return;
      const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2;
      const w = document.createElement("span");
      w.className = "ripple";
      w.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
      b.appendChild(w);
      setTimeout(() => w.remove(), 700);
    });
    $("#export-all").addEventListener("click", () => exportZip("all"));
    $("#refresh").addEventListener("click", refreshFromDrive);
    $("#guide").addEventListener("click", say);

    addEventListener("hashchange", () => fromHash(false));
    let rz;
    addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => halls.forEach((h) => h.orbit && !h.orbit.el.hidden && h.orbit.measure()), 150); });
  }
  function fromHash(instant) {
    const m = location.hash.match(/^#hall-(.+)$/);
    const i = m ? halls.findIndex((h) => h.cat.slug === decodeURIComponent(m[1])) + 1 : 0;
    go(Math.max(0, i), instant);
  }

  // ---------------------------------------------------------------- copy
  function toPng(blob) {
    if (blob.type === "image/png") return Promise.resolve(blob);
    return new Promise((resolve, reject) => {
      const img = new Image();
      const u = URL.createObjectURL(blob);
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth || 1024; c.height = img.naturalHeight || 1024;
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error("convert failed"))), "image/png");
      };
      img.onerror = () => reject(new Error("decode failed"));
      img.src = u;
    });
  }
  async function copyItem(it) {
    if (!it) return;
    if (!window.ClipboardItem || !navigator.clipboard?.write) { toast("This browser can't copy images. Use Download instead."); return; }
    try {
      // The promise goes into ClipboardItem straight away so Safari keeps the click permission.
      const png = fetch(url(it.file)).then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); }).then(toPng);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      toast(`Copied “${it.name}”. Paste it into your slide.`);
    } catch (e) {
      console.warn(e);
      toast("Couldn't copy this one. Use Download instead.");
    }
  }

  // ---------------------------------------------------------------- viewer
  const V = { hall: null, i: 0 };
  function openViewer(hall, i) {
    V.hall = hall; V.i = i;
    showViewer();
    const v = $("#viewer");
    v.classList.remove("closing");
    if (!v.open) v.showModal();
  }
  function showViewer() {
    const items = V.hall.cat.items, it = items[V.i];
    const img = $("#v-img");
    img.classList.remove("in"); void img.offsetWidth;
    img.src = url(it.file); img.alt = it.name;
    img.classList.add("in");
    $("#v-stage").dataset.frame = V.hall.cat.frame;
    $("#v-where").textContent = V.hall.cat.title + (it.collection ? `, ${pretty(it.collection)}` : "");
    $("#v-name").textContent = it.name;
    $("#v-meta").textContent = `${meta(it)}. ${V.i + 1} of ${items.length}`;
    $("#v-download").href = url(it.file);
    $("#v-download").setAttribute("download", fileName(it.file));
    $("#v-prev").hidden = $("#v-next").hidden = items.length < 2;
    if (V.hall.view === "orbit" && V.hall.orbit) V.hall.orbit.go(V.i);
  }
  function stepViewer(d) { const n = V.hall.cat.items.length; V.i = (V.i + d + n) % n; showViewer(); }
  function closeViewer() {
    const v = $("#viewer");
    if (!v.open) return;
    if (reduce) return v.close();
    v.classList.add("closing");
    setTimeout(() => { v.close(); v.classList.remove("closing"); }, 220);
  }

  // ---------------------------------------------------------------- zip
  let abortZip = null;
  async function exportZip(slug) {
    if (!window.JSZip) { toast("The ZIP tool is still loading. Try again in a moment."); return; }
    const cats = slug === "all" ? manifest.categories : manifest.categories.filter((c) => c.slug === slug);
    const items = cats.flatMap((c) => c.items.map((it) => ({ ...it, folder: c.title })));
    if (!items.length) { toast("Nothing to download yet."); return; }
    const total = items.reduce((a, i) => a + i.size, 0);
    if (total > 1.5 * 1073741824 && !confirm(`This ZIP is ${bytes(total)}. Large ZIPs can be slow on older laptops. Continue?`)) return;
    const dlg = $("#zipper"), bar = $("#z-bar"), text = $("#z-text");
    const ctrl = new AbortController();
    abortZip = ctrl;
    bar.style.width = "0%";
    text.textContent = `0 of ${items.length} files, ${bytes(total)} in total`;
    dlg.showModal();
    const zip = new JSZip();
    const root = slug === "all" ? "Planet BOS" : cats[0].title;
    let done = 0, got = 0;
    const queue = items.slice();
    const worker = async () => {
      while (queue.length) {
        const it = queue.shift();
        const r = await fetch(url(it.file), { signal: ctrl.signal });
        if (!r.ok) throw new Error(`${it.file}: HTTP ${r.status}`);
        zip.file([root, slug === "all" ? it.folder : null, it.collection || null, fileName(it.file)].filter(Boolean).join("/"), await r.arrayBuffer(), { binary: true });
        done++; got += it.size;
        bar.style.width = `${Math.round((got / total) * 90)}%`;
        text.textContent = `${done} of ${items.length} files, ${bytes(got)} of ${bytes(total)}`;
      }
    };
    try {
      await Promise.all(Array.from({ length: 6 }, worker));
      text.textContent = "Wrapping up the ZIP…";
      const blob = await zip.generateAsync({ type: "blob", compression: "STORE", streamFiles: true }, (m) => { bar.style.width = `${90 + Math.round(m.percent / 10)}%`; });
      if (ctrl.signal.aborted) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${root.replace(/[^\w&-]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      toast(`Downloaded ${plural(items.length, "file")} as a ZIP.`);
    } catch (e) {
      if (e.name !== "AbortError") { console.error(e); toast("The ZIP stopped because a file couldn't be fetched. Check your connection and try again."); }
    } finally {
      abortZip = null;
      if (dlg.open) dlg.close();
    }
  }

  // ---------------------------------------------------------------- refresh from Drive
  // The button asks the site's worker to start the GitHub "Sync gallery" job, then follows it:
  // copy from Drive (1-2 min) -> Cloudflare publishes (about 1 min) -> the page reloads with the new pieces.
  let refreshing = false;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function refreshFromDrive() {
    if (refreshing) { toast("Already fetching from Drive. Hang on…", true); return; }
    refreshing = true;
    const btn = $("#refresh");
    btn.classList.add("spinning");
    const done = (msg) => { refreshing = false; btn.classList.remove("spinning"); if (msg) toast(msg); };
    try {
      toast("Asking the crew to fetch new pieces from Drive…", true);
      const r = await fetch("/api/refresh", { method: "POST", cache: "no-store" });
      if (r.status === 501) return done("The Refresh button isn't switched on yet. The site owner needs to add the GitHub token in Cloudflare.");
      if (!r.ok) return done("Couldn't start the refresh. Try again in a minute.");
      const start = await r.json();
      const prev = start.state === "started" ? start.previousRunId : undefined;
      const t0 = Date.now();
      let run = null;
      while (Date.now() - t0 < 12 * 60000) {
        await wait(6000);
        const s = await (await fetch("/api/refresh", { cache: "no-store" })).json();
        if (!s.run || (prev !== undefined && s.run.id === prev)) { toast("Waiting for the crew to start…", true); continue; }
        if (s.state === "running") { toast("Copying new pieces from Drive. This takes a minute or two…", true); continue; }
        if (s.state === "failed") return done("The refresh hit a problem. The site owner can see why on GitHub, Actions tab.");
        if (s.state === "done") { run = s; break; }
      }
      if (!run) return done("This is taking longer than usual. Check back in a few minutes.");
      if (!run.changed) return done("All up to date. Nothing new in Drive.");
      // wait for Cloudflare to publish the new gallery list
      const before = manifest.generatedAt;
      const t1 = Date.now();
      while (Date.now() - t1 < 5 * 60000) {
        toast("New pieces found. Publishing them to the site…", true);
        await wait(6000);
        try {
          const m = await (await fetch(`data/manifest.json?t=${Date.now()}`, { cache: "no-store" })).json();
          if (m.generatedAt !== before) { toast("Done! Loading the new pieces…", true); await wait(900); location.reload(); return; }
        } catch (_) {}
      }
      done("The new pieces are almost there. Reload the page in a minute.");
    } catch (e) {
      console.error(e);
      done("Couldn't reach the refresh service. Check your connection and try again.");
    }
  }

  // ---------------------------------------------------------------- loop
  function loop() {
    const drawMotes = reduce ? null : motes();
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!deck.dragging) {
        const k = 1 - Math.pow(0.002, dt);
        deck.p += (deck.target - deck.p) * k;
        if (Math.abs(deck.target - deck.p) < 0.0004) deck.p = deck.target;
      }
      pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 3);
      pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 3);
      renderDeck();
      const g = $("#guide");
      g.style.setProperty("--mx", `${(pointer.sx * -16).toFixed(2)}px`);
      g.style.setProperty("--my", `${(pointer.sy * -10).toFixed(2)}px`);
      halls.forEach((h, k) => h.orbit && h.orbit.tick(dt, deck.index === k + 1 && Math.abs(deck.p - deck.target) < 0.01));
      if (drawMotes) drawMotes(dt, now / 1000);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- boot
  async function boot() {
    whoAmI();
    try {
      const r = await fetch("data/manifest.json", { cache: "no-cache" });
      if (!r.ok) throw new Error(r.status);
      manifest = await r.json();
    } catch (_) {
      toast("Can't find the gallery list (data/manifest.json). Press Refresh to fetch it from Drive, or ask the site owner.", true);
    }
    manifest.categories.forEach((c) => c.items.forEach((it) => { it.wing = c.slug; byId.set(it.id, it); }));
    build();
    input();
    story();
    $("#v-prev").onclick = () => stepViewer(-1);
    $("#v-next").onclick = () => stepViewer(1);
    $("#v-close").onclick = closeViewer;
    $("#v-copy").onclick = () => copyItem(V.hall.cat.items[V.i]);
    $("#viewer").addEventListener("click", (e) => { if (e.target === e.currentTarget || e.target.id === "v-stage") closeViewer(); });
    $("#viewer").addEventListener("cancel", (e) => { e.preventDefault(); closeViewer(); });
    $("#z-cancel").onclick = () => { abortZip && abortZip.abort(); $("#zipper").close(); toast("ZIP cancelled."); };
    fromHash(true);
    loop();
    requestAnimationFrame(() => document.body.classList.add("ready"));
  }
  boot();
})();
