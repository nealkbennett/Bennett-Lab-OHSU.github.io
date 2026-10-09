/*
 * Landscape worker.
 *
 * Generates the Shan Shui Inf landscape off the main thread and hands back
 * one SVG document per tile. The page never sees the heavy generator code or
 * the multi-megabyte SVG strings until they are ready to be turned into
 * images, so scrolling stays smooth while new scenery is being made.
 *
 * Determinism: the generator is a seeded PRNG stream, so chunks must always be
 * made in the same order or the landscape changes. Chunks are therefore made
 * by a fixed sequence of steps (1, 2, 3, ...) no matter which tiles are asked
 * for or in what order. The same seed gives the same scroll on every visit.
 *
 * Messages in:  { t: "init", seed, tileWidth, height, prefetchTo, structures }
 *               { t: "want", tiles: [index, ...] }   // replaces the previous list
 * Messages out: { t: "ready" }
 *               { t: "tile", index, svg }
 */
importScripts("shanshui-core.js");

var Core = self.ShanShuiCore;
var MEM = Core.MEM;
var CHUNK = Core.chunkWidth; // 512 units per generation column

// Objects reach out from their anchor x: mountains about 450 units either way,
// the faint distant ranges up to 1500 units to the right. Tiles include every
// object that could touch them, so neighbouring tiles agree about the scenery
// on their shared edge and no seam shows.
var REACH_LEFT = 520; // how far an object extends left of its anchor
var REACH_RIGHT = 1550; // how far an object extends right of its anchor

var tileWidth = 1024;
var viewHeight = 700;
var stepsDone = 0;
var wanted = [];
var prefetchTo = 0;
var working = false;

// Pagodas, houses, pavilions, pylons and boats (with their fishermen and other
// people) all come from the generator's Arch module. Replacing its builders with
// empty ones leaves mountains, water, rocks, mist and trees.
function removeStructures() {
  Object.keys(Core.Arch).forEach(function (name) {
    if (typeof Core.Arch[name] === "function") {
      Core.Arch[name] = function () {
        return "";
      };
    }
  });
}

function seedGenerator(seed) {
  Math.random = function () {
    return Core.Prng.next();
  };
  Core.Prng.seed(seed);
}

// Make sure chunks exist for everything up to x (and a little beyond).
// Always advances in whole fixed steps, which keeps the output deterministic.
function generateTo(x) {
  var needed = Math.ceil((x + REACH_LEFT) / CHUNK) + 1;
  while (stepsDone < needed) {
    stepsDone += 1;
    Core.chunkloader(0, CHUNK * stepsDone);
  }
}

function buildTile(index) {
  var x0 = index * tileWidth;
  var x1 = x0 + tileWidth;
  generateTo(x1);
  var body = "";
  var chunks = MEM.chunks;
  for (var i = 0; i < chunks.length; i++) {
    var c = chunks[i];
    if (c.x > x0 - REACH_RIGHT && c.x < x1 + REACH_LEFT) body += c.canv;
  }
  return (
    "<svg xmlns='http://www.w3.org/2000/svg' width='" + tileWidth +
    "' height='" + viewHeight + "' viewBox='" + x0 + " 0 " + tileWidth + " " +
    viewHeight + "'>" + body + "</svg>"
  );
}

// One unit of work per turn of the event loop, so a new "want" list (the
// reader scrolled somewhere else) is noticed between tiles.
function work() {
  if (wanted.length) {
    var index = wanted.shift();
    self.postMessage({ t: "tile", index: index, svg: buildTile(index) });
    setTimeout(work, 0);
    return;
  }
  // Idle: quietly make scenery further along so later pages are instant.
  if (stepsDone * CHUNK < prefetchTo) {
    stepsDone += 1;
    Core.chunkloader(0, CHUNK * stepsDone);
    setTimeout(work, 0);
    return;
  }
  working = false;
}

function kick() {
  if (!working) {
    working = true;
    setTimeout(work, 0);
  }
}

self.onmessage = function (event) {
  var m = event.data;
  if (m.t === "init") {
    tileWidth = m.tileWidth || tileWidth;
    viewHeight = m.height || viewHeight;
    prefetchTo = m.prefetchTo || 0;
    if (m.structures === false) removeStructures();
    seedGenerator(m.seed);
    self.postMessage({ t: "ready" });
  } else if (m.t === "want") {
    wanted = m.tiles.slice(); // already in priority order
    kick();
  }
};
