(() => {
  "use strict";
  const CFG = window.BOS_CONFIG || {};
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const ICON = {
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3"/></svg>',
  };

  let manifest = null;
  let flat = [];            // every item, in display order
  let visible = [];         // items currently shown (for viewer prev/next)
  let activeWing = "all";
  let current = -1;

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

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  // ---------------------------------------------------------------- sign-in
  async function signIn() {
    const mode = CFG.authMode || "none";
    if (mode === "cloudflare-access") {
      try {
        const r = await fetch("/cdn-cgi/access/get-identity", { credentials: "include" });
        if (r.ok) {
          const id = await r.json();
          if (id.email) { $("#who-email").textContent = id.email; $("#who").hidden = false; }
        }
      } catch (_) { /* local preview: no Cloudflare */ }
      return;
    }
    if (mode !== "google-signin") return;

    const saved = sessionStorage.getItem("bos-user");
    if (saved && allowed(saved)) return showUser(saved);

    $("#gate").hidden = false;
    await new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.onload = () => {
        google.accounts.id.initialize({
          client_id: CFG.googleClientId,
          callback: (res) => {
            const p = JSON.parse(decodeURIComponent(escape(atob(res.credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))));
            if (p.email_verified && allowed(p.email)) {
              try { sessionStorage.setItem("bos-user", p.email); } catch (_) {}
              $("#gate").hidden = true;
              showUser(p.email);
              resolve();
            } else {
              $("#gate-error").textContent = `${p.email} doesn't have access. Sign in with a BOS account.`;
              google.accounts.id.disableAutoSelect();
            }
          },
        });
        google.accounts.id.renderButton($("#gsi-button"), { theme: "outline", size: "large", shape: "pill", text: "signin_with" });
      };
      document.head.appendChild(s);
    });
  }
  function allowed(email) {
    email = String(email).toLowerCase();
    const list = (CFG.allowedEmails || []).map((e) => e.toLowerCase());
    const doms = (CFG.allowedDomains || []).map((d) => d.toLowerCase().replace(/^@/, ""));
    return list.includes(email) || doms.includes(email.split("@")[1]);
  }
  function showUser(email) {
    $("#who-email").textContent = email;
    $("#who-out").href = "#";
    $("#who-out").onclick = (e) => { e.preventDefault(); sessionStorage.removeItem("bos-user"); location.reload(); };
    $("#who").hidden = false;
  }

  // ---------------------------------------------------------------- render
  function render() {
    const tabs = $("#wing-tabs");
    const total = flat.length;
    tabs.innerHTML =
      `<button class="tab" role="tab" data-wing="all" aria-selected="true">All wings <span class="n">${total}</span></button>` +
      manifest.categories.map((c) => `<button class="tab" role="tab" data-wing="${esc(c.slug)}" aria-selected="false">${esc(c.title)} <span class="n">${c.count}</span></button>`).join("");

    const totalBytes = manifest.categories.reduce((a, c) => a + c.bytes, 0);
    $("#hero-stats").textContent = `${total} pieces across ${manifest.categories.length} wings, ${bytes(totalBytes)} in total.`;

    $("#wings-root").innerHTML = manifest.categories.map((c) => {
      const groups = new Map();
      c.items.forEach((it) => { if (!groups.has(it.collection)) groups.set(it.collection, []); groups.get(it.collection).push(it); });
      // loose files first, then sub-folders
      const keys = [...groups.keys()].sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b, undefined, { numeric: true })));
      const body = c.count === 0
        ? `<div class="empty"><b>Nothing here yet.</b> Images added to the matching Drive folder appear here automatically within about an hour.</div>`
        : keys.map((k) => {
            const items = groups.get(k);
            const head = k ? `<h3 class="collection" data-collection>${esc(pretty(k))} <span class="n">${items.length}</span></h3>` : "";
            return head + `<div class="grid">${items.map(card).join("")}</div>`;
          }).join("");
      return `<section class="wing" id="wing-${esc(c.slug)}" data-slug="${esc(c.slug)}" data-frame="${esc(c.frame)}" aria-labelledby="t-${esc(c.slug)}">
        <div class="wing-head">
          <div>
            <h2 class="wing-title" id="t-${esc(c.slug)}">${esc(c.title)}<span class="n">${c.count}</span></h2>
            ${c.description ? `<p class="wing-desc">${esc(c.description)}</p>` : ""}
          </div>
          ${c.count ? `<button class="btn" type="button" data-zip="${esc(c.slug)}">${ICON.down}Download wing (${bytes(c.bytes)})</button>` : ""}
        </div>
        ${body}
      </section>`;
    }).join("");

    const d = new Date(manifest.generatedAt);
    $("#synced").textContent = isNaN(d) ? "" : `Last updated ${d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
    applyFilter();
  }

  function card(it) {
    const label = esc(it.name);
    return `<figure class="piece" data-id="${it.id}" data-search="${esc((it.name + " " + it.collection).toLowerCase())}">
      <button class="frame" type="button" data-open="${it.id}" aria-label="View ${label}">
        <div class="mat"><img src="${url(it.thumb)}" alt="${label}" loading="lazy" decoding="async"${it.w ? ` width="${it.w}" height="${it.h}"` : ""}></div>
      </button>
      <figcaption class="plate">
        <div class="plate-text">
          <p class="plate-name">${label}</p>
          <p class="plate-meta">${meta(it)}</p>
        </div>
        <div class="plate-actions">
          <button class="icon-btn" type="button" data-copy="${it.id}" title="Copy image" aria-label="Copy ${label}">${ICON.copy}</button>
          <a class="icon-btn" href="${url(it.file)}" download="${esc(fileName(it.file))}" title="Download" aria-label="Download ${label}">${ICON.down}</a>
        </div>
      </figcaption>
    </figure>`;
  }

  // ---------------------------------------------------------------- filter
  function applyFilter() {
    const q = $("#search").value.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    visible = [];
    let shownWings = 0;
    $$(".wing").forEach((w) => {
      const inWing = activeWing === "all" || w.dataset.slug === activeWing;
      let n = 0;
      $$(".grid", w).forEach((g) => {
        let gn = 0;
        $$(".piece", g).forEach((p) => {
          const hit = inWing && terms.every((t) => p.dataset.search.includes(t));
          p.hidden = !hit;
          if (hit) { gn++; visible.push(p.dataset.id); }
        });
        g.hidden = gn === 0;
        const h = g.previousElementSibling;
        if (h && h.hasAttribute("data-collection")) h.hidden = gn === 0;
        n += gn;
      });
      const isEmptyWing = !$(".grid", w);
      w.hidden = !inWing || (terms.length > 0 && n === 0) || (isEmptyWing && terms.length > 0);
      if (!w.hidden) shownWings++;
    });
    const none = $("#no-results");
    none.hidden = shownWings > 0;
    none.textContent = terms.length ? `No pieces match “${q}”. Try a shorter word, or switch to All wings.` : "";
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
    if (!window.ClipboardItem || !navigator.clipboard?.write) {
      toast("This browser can't copy images. Use Download instead.");
      return;
    }
    try {
      // The promise is handed to ClipboardItem right away so Safari keeps the click permission.
      const png = fetch(url(it.file)).then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); }).then(toPng);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      toast(`Copied “${it.name}”. Paste into your slide with Ctrl+V or ⌘V.`);
    } catch (e) {
      console.warn(e);
      toast("Couldn't copy this image. Use Download instead.");
    }
  }

  // ---------------------------------------------------------------- viewer
  const byId = new Map();
  function openViewer(id) {
    current = visible.indexOf(id);
    if (current < 0) { visible = [id]; current = 0; }
    showCurrent();
    const v = $("#viewer");
    if (!v.open) v.showModal();
  }
  function showCurrent() {
    const it = byId.get(visible[current]);
    const wing = manifest.categories.find((c) => c.slug === it.wing);
    $("#v-img").src = url(it.file);
    $("#v-img").alt = it.name;
    $("#v-name").textContent = it.name;
    $("#v-wing").textContent = wing.title + (it.collection ? `, ${pretty(it.collection)}` : "");
    $("#v-meta").textContent = meta(it);
    $("#v-download").href = url(it.file);
    $("#v-download").setAttribute("download", fileName(it.file));
    $("#v-prev").hidden = $("#v-next").hidden = visible.length < 2;
  }
  function step(d) {
    current = (current + d + visible.length) % visible.length;
    showCurrent();
  }

  // ---------------------------------------------------------------- zip
  let abortZip = null;
  async function exportZip(slug) {
    if (!window.JSZip) { toast("ZIP tool is still loading. Try again in a moment."); return; }
    const cats = slug === "all" ? manifest.categories : manifest.categories.filter((c) => c.slug === slug);
    const items = cats.flatMap((c) => c.items.map((it) => ({ ...it, folder: c.title })));
    if (!items.length) { toast("Nothing to download yet."); return; }
    const totalBytes = items.reduce((a, i) => a + i.size, 0);
    if (totalBytes > 1.5 * 1073741824 && !confirm(`This ZIP is ${bytes(totalBytes)}. Large ZIPs can be slow on older laptops. Continue?`)) return;

    const dlg = $("#zipper"), bar = $("#z-bar"), text = $("#z-text");
    const ctrl = new AbortController();
    abortZip = ctrl;
    bar.style.width = "0%";
    text.textContent = `0 of ${items.length} files, ${bytes(totalBytes)} total`;
    dlg.showModal();

    const zip = new JSZip();
    const root = slug === "all" ? "BOS Assets" : cats[0].title;
    let done = 0, got = 0;
    const queue = items.slice();
    const worker = async () => {
      while (queue.length) {
        const it = queue.shift();
        const r = await fetch(url(it.file), { signal: ctrl.signal });
        if (!r.ok) throw new Error(`${it.file}: HTTP ${r.status}`);
        const buf = await r.arrayBuffer();
        const path = [root, slug === "all" ? it.folder : null, it.collection || null, fileName(it.file)].filter(Boolean).join("/");
        zip.file(path, buf, { binary: true });
        done++; got += it.size;
        bar.style.width = `${Math.round((got / totalBytes) * 90)}%`;
        text.textContent = `${done} of ${items.length} files, ${bytes(got)} of ${bytes(totalBytes)}`;
      }
    };
    try {
      await Promise.all(Array.from({ length: 6 }, worker));
      text.textContent = "Wrapping up the ZIP…";
      const blob = await zip.generateAsync({ type: "blob", compression: "STORE", streamFiles: true }, (m) => {
        bar.style.width = `${90 + Math.round(m.percent / 10)}%`;
      });
      if (ctrl.signal.aborted) return;
      const stamp = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${root.replace(/[^\w&-]+/g, "-")}-${stamp}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      toast(`Downloaded ${items.length} files as a ZIP.`);
    } catch (e) {
      if (e.name !== "AbortError") { console.error(e); toast("ZIP stopped: a file couldn't be fetched. Check your connection and try again."); }
    } finally {
      abortZip = null;
      if (dlg.open) dlg.close();
    }
  }

  // ---------------------------------------------------------------- prefs
  function setPref(kind, val) {
    document.body.dataset[kind] = val;
    $$(`[data-${kind}]`, $(".view-tools")).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[kind] === val)));
    try { localStorage.setItem(`bos-${kind}`, val); } catch (_) {}
  }

  // ---------------------------------------------------------------- events
  function wire() {
    document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-open],[data-copy],[data-zip],[data-wing],[data-bg],[data-size]");
      if (!t) return;
      if (t.dataset.open) openViewer(t.dataset.open);
      else if (t.dataset.copy) copyItem(byId.get(t.dataset.copy));
      else if (t.dataset.zip) exportZip(t.dataset.zip);
      else if (t.dataset.wing) {
        activeWing = t.dataset.wing;
        $$(".tab").forEach((b) => b.setAttribute("aria-selected", String(b === t)));
        applyFilter();
        const target = activeWing === "all" ? $("#top") : $(`#wing-${activeWing}`);
        target && target.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      } else if (t.dataset.bg) setPref("bg", t.dataset.bg);
      else if (t.dataset.size) setPref("size", t.dataset.size);
    });
    $("#export-all").addEventListener("click", () => exportZip("all"));
    $("#search").addEventListener("input", applyFilter);
    document.addEventListener("keydown", (e) => {
      const v = $("#viewer");
      if (v.open) {
        if (e.key === "ArrowLeft") step(-1);
        if (e.key === "ArrowRight") step(1);
        return;
      }
      if (e.key === "/" && document.activeElement !== $("#search")) { e.preventDefault(); $("#search").focus(); }
    });
    $("#v-prev").onclick = () => step(-1);
    $("#v-next").onclick = () => step(1);
    $("#v-close").onclick = () => $("#viewer").close();
    $("#v-copy").onclick = () => copyItem(byId.get(visible[current]));
    $("#viewer").addEventListener("click", (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
    $("#z-cancel").onclick = () => { abortZip && abortZip.abort(); $("#zipper").close(); toast("ZIP cancelled."); };
  }

  // ---------------------------------------------------------------- boot
  async function boot() {
    let bg = "wall", size = "m";
    try { bg = localStorage.getItem("bos-bg") || bg; size = localStorage.getItem("bos-size") || size; } catch (_) {}
    setPref("bg", bg); setPref("size", size);
    wire();
    await signIn();
    try {
      const r = await fetch("data/manifest.json", { cache: "no-cache" });
      if (!r.ok) throw new Error(r.status);
      manifest = await r.json();
    } catch (e) {
      $("#wings-root").innerHTML = `<div class="empty"><b>The gallery list couldn't load.</b> Refresh the page. If it keeps happening, the sync job may not have run yet.</div>`;
      return;
    }
    manifest.categories.forEach((c) => c.items.forEach((it) => { it.wing = c.slug; flat.push(it); byId.set(it.id, it); }));
    render();
  }
  boot();
})();
