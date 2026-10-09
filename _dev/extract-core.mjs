// Rebuilds assets/js/shanshui/shanshui-core.js from upstream {Shan, Shui}* (MIT).
//   git clone https://github.com/LingDong-/shan-shui-inf /tmp/ssx
//   node _dev/extract-core.mjs /tmp/ssx/index.html assets/js/shanshui/shanshui-core.js
//
// What it keeps: the PRNG, Perlin noise, polygon tools and every mountain /
// tree / building / boat generator, plus the chunk planner (MEM, chunkloader).
// What it drops: all UI, scrolling, mouse handling, and the page that
// upstream draws around the generator. What it changes: Math.random is no
// longer replaced globally (the worker installs it itself), window.btoa becomes
// btoa so the core runs in a Web Worker, and console.log is silenced.
import { readFileSync, writeFileSync } from "node:fs";

const [src, out] = process.argv.slice(2);
const html = readFileSync(src, "utf8");

const bodyOf = (openTag) => {
  const start = html.indexOf(openTag);
  if (start < 0) throw new Error("missing " + openTag);
  const from = start + openTag.length;
  return html.slice(from, html.indexOf("</script>", from));
};

let prng = bodyOf('<script id="PRNG">');
prng = prng.replace(/Math\.random\s*=\s*function\s*\(\)\s*\{[\s\S]*?\};\s*Math\.seed\s*=\s*function\s*\(x\)\s*\{[\s\S]*?\};/, "");
if (/Math\.random\s*=/.test(prng)) throw new Error("failed to strip Math.random override");
prng = prng.replace("window.btoa(", "btoa("); // so the core also runs inside a Web Worker

const noise = bodyOf('<script id="PerlinNoise">');
const poly = bodyOf('<script id="PolyTools">');
const util = bodyOf('<script id="Util">');

// The generator itself is the first anonymous <script> after Util.
const afterUtil = html.indexOf('<script id="Util">');
const mainOpen = html.indexOf("<script>", afterUtil);
const mainFrom = mainOpen + "<script>".length;
let main = html.slice(mainFrom, html.indexOf("</script>", mainFrom));
const cut = main.indexOf('document.addEventListener("mousemove"');
if (cut < 0) throw new Error("could not find the UI cut point");
main = main.slice(0, cut);

const header = `/*!
 * Shan Shui Inf generator core
 * Procedural ink-wash landscape generator by Lingdong Huang (c) 2018, MIT License.
 * Upstream: https://github.com/LingDong-/shan-shui-inf
 *
 * Extracted from upstream index.html by _dev/extract-core.mjs. UI code removed;
 * Math.random is no longer overridden globally. Do not edit by hand.
 */
`;

const code = `${header}(function (root) {
  var console = { log: function () {} }; // upstream is chatty
  var MEM;
${prng}
${noise}
${poly}
${util}
${main}
  root.ShanShuiCore = {
    Prng: Prng,
    MEM: MEM,
    chunkloader: chunkloader,
    Arch: Arch, // buildings, boats and the people in them; the worker can switch these off
    chunkWidth: MEM.cwid,
    viewHeight: 700,
  };
})(typeof window !== "undefined" ? window : globalThis);
`;
writeFileSync(out, code);
console.log("wrote", out, (code.length / 1024).toFixed(0) + " KB");
