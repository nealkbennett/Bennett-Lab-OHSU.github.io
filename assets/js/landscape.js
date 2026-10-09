/*
 * Landscape controller.
 *
 * Shows a Shan Shui Inf ink-wash landscape behind the site and pans it
 * sideways as the page scrolls. The heavy work (generating the scenery and
 * building SVG) happens in a Web Worker. Here the SVG comes back as tiles that
 * are drawn once onto canvases, so moving the camera is a single CSS
 * transform handled by the compositor. Scrolling never re-renders vector art.
 *
 * Settings come from the JSON in #landscape-config (written by the layout from
 * _config.yml). Pages tell the camera where to start through
 * data-landscape-x on #page; the router calls Landscape.travel(x) after a page
 * swap and the camera glides there.
 */
(function () {
  "use strict";

  var host = document.getElementById("landscape");
  var configEl = document.getElementById("landscape-config");
  if (!host || !configEl || !window.Worker) return;

  var cfg;
  try {
    cfg = JSON.parse(configEl.textContent);
  } catch (e) {
    return;
  }

  var TILE = 1024; // landscape units per tile
  var HEIGHT = 700; // landscape units from top to bottom
  var PORTRAIT_UNITS = 560; // how many units fit across a phone held upright

  var seed = String(cfg.seed || "landscape");
  try {
    var override = new URLSearchParams(location.search).get("seed");
    // Handy for previewing: ?seed=anything. Treated purely as text, and kept short.
    if (override) seed = override.slice(0, 64);
  } catch (e) {}

  var scrollRate = Number(cfg.scroll) || 0.45; // landscape units per scrolled pixel
  var driftRate = Number(cfg.drift) || 0; // units per second while idle
  var driftMax = Number(cfg.driftMax) || 3000;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // ---- DOM ---------------------------------------------------------------
  var strip = document.createElement("div");
  strip.className = "landscape-strip";
  host.appendChild(strip);

  // ---- state -------------------------------------------------------------
  var base = 0; // where this page starts, in landscape units
  var driftOffset = 0;
  var cam = 0; // current camera x (left edge), units
  var scale = 1; // px per unit
  var tilePx = TILE;
  var viewUnits = 1000; // how many units fit across the window
  var tiles = new Map(); // index -> { state, img }
  var lastKey = "";
  var revealed = false;
  var rafId = 0;
  var lastTime = 0;
  var travelUntil = 0;

  // ---- worker ------------------------------------------------------------
  var worker;
  try {
    worker = new Worker(cfg.worker);
  } catch (e) {
    return;
  }

  var saveData = navigator.connection && navigator.connection.saveData;
  var lowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;
  worker.postMessage({
    t: "init",
    seed: seed,
    tileWidth: TILE,
    height: HEIGHT,
    structures: cfg.structures !== false, // false: no buildings, boats or people
    prefetchTo: cfg.prefetchTo && !saveData && !lowMemory ? Number(cfg.prefetchTo) : 0,
  });

  worker.onmessage = function (event) {
    var m = event.data;
    if (m.t === "tile") receiveTile(m.index, m.svg);
  };
  worker.onerror = function () {
    host.classList.add("is-broken");
  };

  // ---- layout ------------------------------------------------------------
  function layout() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var s = vw / vh < 0.9 ? vw / PORTRAIT_UNITS : vh / HEIGHT;
    tilePx = Math.max(64, Math.round(TILE * s)); // whole pixels so tile edges meet cleanly
    scale = tilePx / TILE;
    viewUnits = vw / scale;
    strip.style.height = Math.round(HEIGHT * scale) + "px";
    tiles.forEach(function (tile, index) {
      if (tile.state === "ready" && Math.abs(tile.scale - scale) / scale > 0.12) {
        dropTile(index); // drawn too small or too large for this window; make it again
      } else if (tile.img) {
        positionTile(tile.img, index);
      }
    });
    lastKey = "";
  }

  function positionTile(img, index) {
    img.style.left = index * tilePx + "px";
    img.style.width = tilePx + "px";
  }

  // ---- tiles -------------------------------------------------------------
  // Each SVG tile is drawn once onto a canvas and the SVG document is then
  // thrown away. A multi-megabyte SVG kept alive as an <img> costs hundreds of
  // megabytes of browser memory; a bitmap costs a few.
  function receiveTile(index, svg) {
    var tile = tiles.get(index);
    if (!tile) return; // scrolled away before it arrived
    var url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    var source = new Image();
    tile.state = "loading";
    var finished = false;
    var finish = function (ok) {
      if (finished) return; // clearing source.src below fires a stray "error"
      finished = true;
      source.onload = source.onerror = null;
      URL.revokeObjectURL(url);
      source.removeAttribute("src");
      if (tiles.get(index) !== tile) return; // dropped while drawing
      if (!ok) {
        tiles.delete(index);
        return;
      }
      tile.state = "ready";
      strip.appendChild(tile.img);
      // Two frames so the first paint happens at opacity 0, then fade in.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          tile.img.classList.add("is-ready");
        });
      });
      checkReveal();
      schedule();
    };
    source.onload = function () {
      try {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var w = Math.round(tilePx * dpr);
        var h = Math.round(HEIGHT * scale * dpr);
        while (w * h > 9e6 && dpr > 1) { // keep huge screens within a sane budget
          dpr = Math.max(1, dpr - 0.25);
          w = Math.round(tilePx * dpr);
          h = Math.round(HEIGHT * scale * dpr);
        }
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(source, 0, 0, w, h);
        canvas.className = "landscape-tile";
        canvas.style.height = "100%";
        positionTile(canvas, index);
        tile.img = canvas;
        tile.scale = scale;
        finish(true);
      } catch (e) {
        finish(false);
      }
    };
    source.onerror = function () { finish(false); };
    source.src = url;
  }

  function dropTile(index) {
    var tile = tiles.get(index);
    if (!tile) return;
    tiles.delete(index);
    if (tile.img) tile.img.remove();
  }

  function isReady(index) {
    var t = tiles.get(index);
    return !!t && t.state === "ready";
  }

  // Right edge of the scenery that is ready, counting from the tile on screen.
  function frontier() {
    var i = Math.max(0, Math.floor(cam / TILE));
    while (isReady(i)) i += 1;
    return i * TILE;
  }

  function checkReveal() {
    if (revealed) return;
    var first = Math.max(0, Math.floor(cam / TILE));
    var last = Math.floor((cam + viewUnits) / TILE);
    for (var i = first; i <= last; i++) if (!isReady(i)) return;
    revealed = true;
    host.classList.add("is-ready");
  }

  function syncTiles() {
    var first = Math.max(0, Math.floor(cam / TILE));
    var last = Math.max(first, Math.floor((cam + viewUnits) / TILE));
    var key = first + ":" + last;
    if (key === lastKey) return;
    lastKey = key;

    // What is on screen comes first, then a little scenery ahead and behind.
    var wanted = [];
    var i;
    for (i = first; i <= last; i++) wanted.push(i);
    wanted.push(last + 1, last + 2);
    if (first - 1 >= 0) wanted.push(first - 1);

    tiles.forEach(function (_, index) {
      if (index < first - 2 || index > last + 3) dropTile(index);
    });

    var ask = [];
    wanted.forEach(function (index) {
      var tile = tiles.get(index);
      if (!tile) {
        tiles.set(index, { state: "pending", img: null });
        ask.push(index);
      } else if (tile.state === "pending") {
        ask.push(index);
      }
    });
    if (ask.length) worker.postMessage({ t: "want", tiles: ask });
  }

  // ---- camera ------------------------------------------------------------
  function targetX() {
    if (reduceMotion.matches) return base;
    return Math.max(0, base + window.scrollY * scrollRate + driftOffset);
  }

  function schedule() {
    if (!rafId) rafId = requestAnimationFrame(frame);
  }

  function frame(now) {
    rafId = 0;
    var dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;

    var moving = !reduceMotion.matches;
    if (moving && driftRate && !document.hidden && driftOffset < driftMax) {
      driftOffset = Math.min(driftMax, driftOffset + driftRate * dt);
    }

    var want = targetX();
    // Never glide past scenery that hasn't been drawn yet.
    want = Math.min(want, Math.max(cam, frontier() - viewUnits));

    var tau = reduceMotion.matches ? 0.001 : now < travelUntil ? 0.55 : 0.18;
    cam += (want - cam) * (1 - Math.exp(-dt / tau));
    if (Math.abs(want - cam) < 0.02) cam = want;

    strip.style.transform = "translate3d(" + -cam * scale + "px,0,0)";
    syncTiles();
    checkReveal();

    var settled = cam === want;
    var drifting = moving && driftRate && driftOffset < driftMax && !document.hidden;
    if (!settled || drifting) schedule();
  }

  // ---- public API --------------------------------------------------------
  window.Landscape = {
    // Move the camera's starting point for a new page and glide there.
    travel: function (x) {
      base = Math.max(0, Number(x) || 0);
      travelUntil = performance.now() + 2200;
      schedule();
    },
    // Set the starting point without gliding (first page load).
    place: function (x) {
      base = Math.max(0, Number(x) || 0);
      cam = targetX();
      lastKey = "";
      schedule();
    },
  };

  // ---- go ----------------------------------------------------------------
  var page = document.getElementById("page");
  layout();
  window.Landscape.place(page ? page.getAttribute("data-landscape-x") : 0);

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", function () {
    layout();
    schedule();
  });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      lastTime = performance.now();
      schedule();
    }
  });
  if (reduceMotion.addEventListener) reduceMotion.addEventListener("change", schedule);
})();
