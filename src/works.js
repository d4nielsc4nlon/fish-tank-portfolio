// src/works.js
// Responsive masonry/bento grid using all files in src/assets/selected_works/*
// Background scene is provided by src/scene.js.

import "./scene.js";

const WORKS_GLOBAL_KEY = "__DANIEL_WORKS_PAGE__";

function titleFromPath(p) {
  const file = (p.split("/").pop() || "").replace(/\.(png|jpe?g|webp|gif)$/i, "");
  return file.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}


function injectStyles() {
  if (document.getElementById("worksStyles")) return;
  const style = document.createElement("style");
  style.id = "worksStyles";
  style.textContent = `
    html, body { margin:0; height:100%; background:#061a2a; }
    body { overflow:hidden; color:white; font-family: monospace; }

    .pixel{
      image-rendering: pixelated;
      text-rendering: geometricPrecision;
      -webkit-font-smoothing: none;
      letter-spacing: 1px;
    }

    .worksWrap{
      position: fixed;
      inset: 0;
      z-index: 80;
      pointer-events: none;
      padding: 76px 22px 22px;
      box-sizing: border-box;
    }

  .worksScroller{
  width: min(1240px, 100%);
  height: calc(100vh - 110px);
  margin: 0 auto;
  overflow: auto;
  pointer-events: auto;
  border: 1px solid rgba(255,255,255,.28);
  background: rgba(0,0,0,.06);   /* ✅ lighter so scene shows through */
  backdrop-filter: blur(2px);    /* optional, subtle */
}

    .worksGrid{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      grid-auto-rows: 10px;
      grid-auto-flow: dense;
      gap: 12px;
      padding: 12px;
      box-sizing: border-box;
    }

  .workCard{
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.35);
  background: rgba(0,0,0,.10);
  cursor: pointer;
  user-select:none;

  /* motion */
  --parallaxY: 0px;
  --hoverLift: 0px;
  --hoverScale: 1;
  transform: translate3d(0, calc(var(--parallaxY) + var(--hoverLift)), 0) scale(var(--hoverScale));
  transition: transform 220ms ease, border-color 180ms ease, box-shadow 220ms ease;
  will-change: transform;
}

/* Kevin-ish hover expand (inflate above neighbors) */
.workCard:hover{
  border-color: rgba(255,255,255,.92);
  --hoverLift: -6px;
  --hoverScale: 1.04;
  z-index: 5;
  box-shadow: 0 18px 60px rgba(0,0,0,.55);
}

.workCard:hover .workMedia{
  transform: scale(1.08);
  filter: brightness(1.06) contrast(1.02);
}

.workMedia{
  width: 100%;
  display:block;
  height: auto;
  object-fit: cover;

  transform: scale(1.01);
  transition: transform 260ms ease, filter 220ms ease;
  will-change: transform;
}

.workLabel{
  position:absolute;
  left: 10px;
  right: 10px;
  bottom: 10px;
  padding: 8px 10px;
  border: 1px solid rgba(255,255,255,.35);
  background: rgba(0,0,0,.35);
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 140ms ease, transform 140ms ease;
  pointer-events:none;
  font-size: 12px;
  line-height: 1.2;
}

.workCard:hover .workLabel{
  opacity: 1;
  transform: translateY(0);
}
    .topbar{
      position: fixed;
      left: 18px;
      right: 18px;
      top: 18px;
      display:flex;
      justify-content: space-between;
      align-items:center;
      gap: 12px;
      z-index: 120;
      pointer-events:none;
    }

    .back{
      pointer-events:auto;
      text-decoration:none;
      color:white;
      opacity:.9;
      border:1px solid rgba(255,255,255,.35);
      padding:8px 10px;
      background: rgba(0,0,0,.25);
      display:inline-flex;
      align-items:center;
      gap:10px;
    }
    .back:hover{ opacity: 1; border-color: rgba(255,255,255,.7); }

    .lb{
      position: fixed;
      inset: 0;
      z-index: 300;
      display:none;
      background: rgba(0,0,0,.72);
      pointer-events:auto;
    }
    .lb.show{ display:block; }

    .lbInner{
      position:absolute;
      inset: 18px;
      display:grid;
      grid-template-rows: auto 1fr;
      gap: 12px;
    }

    .lbBar{
      display:flex;
      justify-content: space-between;
      align-items:center;
      gap: 12px;
      padding: 10px 12px;
      border: 1px solid rgba(255,255,255,.45);
      background: rgba(0,0,0,.35);
    }

    .lbBtns{ display:flex; gap:8px; }
    .lbBtn{
      border: 1px solid rgba(255,255,255,.35);
      background: rgba(0,0,0,.25);
      color: white;
      padding: 8px 10px;
      cursor:pointer;
      font: 12px/1.2 monospace;
      letter-spacing: 1px;
    }
    .lbBtn:hover{ border-color: rgba(255,255,255,.85); }

/* Lightbox: make every piece "fit" correctly and allow scroll for tall images */
.lbMedia{
  border: 1px solid rgba(255,255,255,.45);
  background: rgba(0,0,0,.25);
  overflow: auto;                 /* ✅ important */
  display: block;                 /* ✅ allow scrolling */
  padding: 12px;
}

.lbMedia img{
  display: block;
  margin: 0 auto;
  max-width: 100%;
  height: auto;
  max-height: calc(100vh - 160px); /* ✅ fits viewbox */
  object-fit: contain;
}

    @media (max-width: 720px){
      .worksWrap{ padding: 66px 14px 14px; }
      .worksScroller{ height: calc(100vh - 96px); }
      .worksGrid{ gap: 10px; padding: 10px; }
    }
  `;
  document.head.appendChild(style);
}

function getWorkItems() {
  // ✅ Folder name is selected_works
  const modules = import.meta.glob("./assets/selected_works/*.{png,jpg,jpeg,webp,gif}", {
    eager: true,
    import: "default",
  });

  const items = Object.entries(modules).map(([path, url]) => ({
    path,
    url,
    title: titleFromPath(path),
  }));

 // Randomize order on each page load
return shuffle(items);
}

function makeTopbar() {
  if (document.querySelector(".topbar")) return;

  const bar = document.createElement("div");
  bar.className = "topbar pixel";
  bar.innerHTML = `
    <a class="back pixel" href="/">← BACK TO TANK</a>
    <div class="pixel" style="opacity:.8;">SELECTED WORKS</div>
  `;
  document.body.appendChild(bar);
}

function ensureLightbox() {
  // Single instance
  let lb = document.querySelector(".lb");
  if (lb) return lb;

  lb = document.createElement("div");
  lb.className = "lb pixel";
  lb.innerHTML = `
    <div class="lbInner">
      <div class="lbBar">
        <div id="lbTitle" style="opacity:.9;">PREVIEW</div>
        <div class="lbBtns">
          <button class="lbBtn" id="lbPrev">← PREV</button>
          <button class="lbBtn" id="lbNext">NEXT →</button>
          <button class="lbBtn" id="lbClose">CLOSE ✕</button>
        </div>
      </div>
      <div class="lbMedia"><img id="lbImg" alt="Work preview" /></div>
    </div>
  `;
  document.body.appendChild(lb);
  return lb;
}

/**
 * Masonry sizing:
 * grid-auto-rows = 10px in CSS
 * span rows based on actual rendered height of each card (after image load)
 */
function sizeMasonryItem(card, rowHeight = 10, gap = 12) {
  const img = card.querySelector("img");
  if (!img) return;

  // If not laid out yet, skip
  const rect = img.getBoundingClientRect();
  if (!rect.height) return;

  const span = Math.ceil((rect.height + gap) / (rowHeight + gap));
  card.style.gridRowEnd = `span ${Math.max(6, span)}`;
}

function getColumnCount(gridEl) {
  const cols = getComputedStyle(gridEl).gridTemplateColumns;
  // e.g. "260px 260px 260px"
  return cols.split(" ").filter(Boolean).length || 1;
}

function assignColumnIndex(cards, gridEl) {
  // Use each card’s x-position relative to grid to infer its column index
  const gridRect = gridEl.getBoundingClientRect();
  const colCount = getColumnCount(gridEl);

  // measure a typical column width from computed template
  const cols = getComputedStyle(gridEl).gridTemplateColumns.split(" ").filter(Boolean);
  const colW = cols[0] ? parseFloat(cols[0]) : (gridRect.width / colCount);

  cards.forEach((card) => {
    const r = card.getBoundingClientRect();
    const x = Math.max(0, r.left - gridRect.left);
    const col = Math.max(0, Math.min(colCount - 1, Math.round(x / Math.max(1, colW))));
    card.dataset.col = String(col);
  });

  return colCount;
}

function makeParallaxController(scroller, cards, gridEl) {
  let raf = 0;

  function update() {
    raf = 0;
    const st = scroller.scrollTop;
    const colCount = getColumnCount(gridEl);
    const mid = (colCount - 1) / 2;

    // subtle: 0–10px drift depending on column distance from center
    cards.forEach((card) => {
      const col = Number(card.dataset.col || 0);
      const dist = col - mid;
      const y = (st * 0.012) * dist; // tweak 0.010–0.018 to taste
      card.style.setProperty("--parallaxY", `${y.toFixed(2)}px`);
    });
  }

  function requestUpdate() {
    if (!raf) raf = requestAnimationFrame(update);
  }

  // initial + events
  requestUpdate();
  scroller.addEventListener("scroll", requestUpdate, { passive: true });

  return {
    updateNow: update,
    destroy() {
      scroller.removeEventListener("scroll", requestUpdate);
      if (raf) cancelAnimationFrame(raf);
    }
  };
}


function buildGallery(items) {
  document.getElementById("worksWrap")?.remove();

  const wrap = document.createElement("div");
  wrap.id = "worksWrap";
  wrap.className = "worksWrap pixel";

  const scroller = document.createElement("div");
  scroller.className = "worksScroller";

  const grid = document.createElement("div");
  grid.className = "worksGrid";

  scroller.appendChild(grid);
  wrap.appendChild(scroller);
  document.body.appendChild(wrap);

  // Lightbox wiring (single instance)
  const lb = ensureLightbox();
  const titleEl = lb.querySelector("#lbTitle");
  const imgEl = lb.querySelector("#lbImg");

  let lbItems = items;
  let lbIdx = 0;

  function renderLB() {
    const it = lbItems[lbIdx];
    if (!it) return;
    titleEl.textContent = it.title.toUpperCase();
    imgEl.src = it.url;
  }
  function openLB(startIndex) {
    lbItems = items;
    lbIdx = startIndex;
    lb.classList.add("show");
    renderLB();
  }
  function closeLB() {
    lb.classList.remove("show");
  }
  function prevLB() {
    if (!lbItems.length) return;
    lbIdx = (lbIdx - 1 + lbItems.length) % lbItems.length;
    renderLB();
  }
  function nextLB() {
    if (!lbItems.length) return;
    lbIdx = (lbIdx + 1) % lbItems.length;
    renderLB();
  }

  // Attach lightbox listeners once
  if (!lb.__wired) {
    lb.__wired = true;
    lb.querySelector("#lbClose").addEventListener("click", closeLB);
    lb.querySelector("#lbPrev").addEventListener("click", prevLB);
    lb.querySelector("#lbNext").addEventListener("click", nextLB);
    lb.addEventListener("click", (e) => {
      if (e.target === lb) closeLB();
    });
    window.addEventListener("keydown", (e) => {
      if (!lb.classList.contains("show")) return;
      if (e.key === "Escape") closeLB();
      if (e.key === "ArrowLeft") prevLB();
      if (e.key === "ArrowRight") nextLB();
    });
  }

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "workCard pixel";
    empty.style.gridRowEnd = "span 18";
    empty.innerHTML = `
      <div style="padding:14px; opacity:.9;">
        Drop images/gifs into <b>src/assets/selected_works/</b><br/>
        (png/jpg/webp/gif)
      </div>
    `;
    grid.appendChild(empty);
    return;
  }

  const cards = [];

  items.forEach((it, i) => {
    const card = document.createElement("div");
    card.className = "workCard pixel";

    const img = document.createElement("img");
    img.className = "workMedia";
    img.src = it.url;
    img.alt = it.title;

    const label = document.createElement("div");
    label.className = "workLabel pixel";
    label.textContent = it.title.toUpperCase();

    card.appendChild(img);
    card.appendChild(label);

    card.addEventListener("click", () => openLB(i));

    img.addEventListener("load", () => sizeMasonryItem(card));
    if (img.complete) queueMicrotask(() => sizeMasonryItem(card));

    grid.appendChild(card);
    cards.push(card);
  });

  // After cards exist, assign columns and enable per-column parallax
let parallaxCtrl = null;

const enableParallax = () => {
  assignColumnIndex(cards, grid);
  parallaxCtrl?.destroy?.();
  parallaxCtrl = makeParallaxController(scroller, cards, grid);
  parallaxCtrl.updateNow();
};

enableParallax();

  // Reflow masonry on resize (ensure we don't stack listeners)
  const state = window[WORKS_GLOBAL_KEY];
  if (state?.cleanupResize) state.cleanupResize();

 const onResize = () => {
  cards.forEach((c) => sizeMasonryItem(c));
  assignColumnIndex(cards, grid);
  // nudge parallax update if active
  scroller.dispatchEvent(new Event("scroll"));
};

  window.addEventListener("resize", onResize, { passive: true });
  window.visualViewport?.addEventListener("resize", onResize);
  window.visualViewport?.addEventListener("scroll", onResize);

  window[WORKS_GLOBAL_KEY].cleanupResize = () => {
    window.removeEventListener("resize", onResize);
    window.visualViewport?.removeEventListener("resize", onResize);
    window.visualViewport?.removeEventListener("scroll", onResize);
    parallaxCtrl?.destroy?.();
  };

  // Extra settles (fonts/layout/cached images)
  requestAnimationFrame(onResize);
  setTimeout(onResize, 80);
  setTimeout(onResize, 300);
}

function init() {
  // Avoid double-init (HMR / multiple entry execution)
  if (window[WORKS_GLOBAL_KEY]?.initialized) return;
  window[WORKS_GLOBAL_KEY] = { initialized: true, cleanupResize: null };

  injectStyles();
  //makeTopbar();
  buildGallery(getWorkItems());
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
