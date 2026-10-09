# Where the outside code and files came from

Nothing here is downloaded when the site is built or visited. Every outside file is
copied into this repository, listed below with its source, so it can be checked.
The finished site makes no requests to any other web address.

## Landscape generator (JavaScript)

- Project: {Shan, Shui}* by Lingdong Huang, MIT license
- Source: https://github.com/LingDong-/shan-shui-inf
- Commit used: `9f754d2b2e73495db7883d4d4055a7b0903b0454` (committed 2018-12-10)
- SHA-256 of the upstream `index.html` it was cut from: `858792db2659e7d4c6604606d4ff2175f137f07061f8af51644f06ab0788215f`
- Result: `assets/js/shanshui/shanshui-core.js`, SHA-256 `f3a063d69519a11db43ea28cb8bc0c32125ea691719b33b8ae40e37de44549d4`
- How it was made: `_dev/extract-core.mjs` copies the generator out of upstream's page and
  drops its user-interface code. To check it, clone the repo at that commit, run the script
  from the README, and compare the SHA-256. The generator contains no network calls, no
  `eval`, and no browser storage.

## Fonts

- Shippori Mincho 5.3.0 and Source Sans 3 5.3.0, SIL Open Font License 1.1
- Source: the `@fontsource/shippori-mincho` and `@fontsource/source-sans-3` packages
  on the npm registry (npmjs.com). Only the `.woff2` files for the Latin and Latin-extended
  ranges are kept, in `assets/fonts/`, with the license texts beside them.

## Site structure

- Adapted from https://github.com/fraser-lab/fraser-lab.github.io (MIT). No Fraser Lab
  code is loaded at run time, and the page templates were rewritten.

## Build tools (not shipped to visitors)

- Jekyll and its plugins from rubygems.org, as listed in `Gemfile`. GitHub Pages builds
  the site with its own pinned set of these.
