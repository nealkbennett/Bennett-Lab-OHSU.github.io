# Lab website with a live ink-wash landscape

A static Jekyll site for GitHub Pages. A procedurally generated Chinese-style
landscape ({Shan, Shui}* by Lingdong Huang) sits behind the pages and slides
sideways as you scroll. Content lives in plain files, in the style of the
[Fraser Lab site](https://github.com/fraser-lab/fraser-lab.github.io).

## Put it online

1. Create a GitHub repo named `<your-user>.github.io` and push these files.
2. In the repo, go to Settings, then Pages, and publish from the main branch.
3. For a project site (`you.github.io/some-repo`), set `baseurl: "/some-repo"` in `_config.yml`.

## Preview on your computer

```
bundle install
bundle exec jekyll serve      # http://localhost:4000
```

## Change things

| To do this | Edit this |
|---|---|
| Lab name, red seal letters, tagline, contact details | `_config.yml` |
| A different landscape | `landscape.seed` in `_config.yml` (any word). Try one live with `?seed=word` on the URL |
| Trees and mountains only, or with pagodas, houses, boats and people | `landscape.structures` in `_config.yml` (`false` is trees only) |
| How fast it slides, idle drift, how far apart pages start | `landscape:` block in `_config.yml` |
| The About text on the home page | `index.md` |
| Menu items | `_data/navigation.yml` |
| Group names on the People page | `_data/people.yml` |
| Email addresses | Write them as `name [at] domain` in `_config.yml` and member files. Never type a real `@` |
| Add a person | copy `_members/rivera.md` to a new file and edit it |
| Move someone to alumni | set `status: alumni` and add `enddate` (and optionally `subsequent`) |
| Add a paper | copy a file in `_publications/` |
| Add news | new file in `_posts/` named `YYYY-MM-DD-short-title.md` |
| Colors and fonts | the tokens at the top of `assets/css/site.css` |
| Research, Join, Contact text | `research/index.md`, `join/index.md`, `contact/index.md` |

Member photos: put a square image in `static/img/` and set `image: /static/img/name.jpg`.
Without one, the person gets a red seal with their initials.

## How the landscape works

- `assets/js/shanshui/shanshui-core.js` is the upstream generator with its UI removed.
  `_dev/extract-core.mjs` rebuilds it from upstream.
- `assets/js/shanshui/landscape-worker.js` generates scenery off the main thread and
  returns SVG tiles. The same seed always gives the same painting.
- `assets/js/landscape.js` draws each tile once onto a canvas and pans them with one
  CSS transform, so scrolling stays cheap.
- `assets/js/site.js` swaps pages without reloading, so the painting never restarts.
  It glides to where the next page begins. Links always fall back to normal loads.
  Don't put inline `<script>` tags in pages: swapped-in content doesn't run them.
- Reduced-motion visitors get a still painting. The landscape needs JavaScript; without
  it the site is plain paper and text.

## Known limits

- First visit spends a few seconds generating scenery in the background, mostly on
  low-end phones. It skips the background pre-drawing on low-memory or data-saver devices.
- Fonts are included in `assets/fonts/`, so there are no requests to Google or anyone else.
- Not included from the Fraser template: tag pages, an RSS feed, course pages.

## Security

This is a static site: no database, no logins, no forms, no cookies, nothing stored in
visitors' browsers. What is in place:

- **Content Security Policy** (in `_layouts/default.html`): only this site's own files can
  load or run. Third-party scripts, fonts, images and connections are blocked, and so are
  inline scripts and inline event handlers. If you add something that loads from another
  site (an analytics script, an embedded video), you must add that address to the policy on
  purpose.
- **No outside resources.** Fonts and the generator are copied into the repo.
  `PROVENANCE.md` records exactly where each came from, with a commit and file hashes.
- **Email addresses are never printed in page source.** They appear as `name [at] domain`
  and become a mail link only in the visitor's browser. This stops most address-harvesting
  robots, not a determined person.
- **Everything typed into data files is escaped** before it is shown, and outside links
  (member websites, paper links) are only drawn if they start with `https://` or `http://`.
  A `javascript:` link in a member file simply doesn't appear.
- **Outside links** open with `rel="noopener noreferrer"`.
- **Dependabot** (`.github/dependabot.yml`) opens a pull request when the Ruby build tools
  need a security update.

What a static site on GitHub Pages cannot do: send security headers such as
`X-Frame-Options` or `Strict-Transport-Security`, so a CSP written as a page tag cannot
stop other sites from putting yours in a frame (GitHub Pages already serves HTTPS; turn on
"Enforce HTTPS" in Settings, Pages). Raw HTML that someone writes inside a Markdown page or
news post is trusted, which is why only people you trust should be able to commit.

**Settings to turn on in your GitHub organization** (these are not files in this repo):
two-factor authentication required for all members; branch protection on `main` requiring
a reviewed pull request; Dependabot alerts and secret scanning; keep the number of
people with write access small.

## Licenses

Three parts, explained in `LICENSE`: the website code is MIT; the lab's own text, photos
and publication lists are "all rights reserved" unless you decide otherwise; and the
third-party pieces ({Shan, Shui}* generator, the Fraser Lab site structure, the fonts) keep
their own licenses, whose notices must stay. Before publishing, open `LICENSE` and replace
the two `[FILL IN]` lines with your lab or institution.
