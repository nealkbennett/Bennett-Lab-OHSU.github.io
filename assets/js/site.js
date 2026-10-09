/*
 * Site behaviour: the mobile menu and a small page router.
 *
 * Clicking an internal link fetches the next page, swaps the content inside
 * #page and updates the address bar, so the landscape behind it never reloads.
 * Instead the camera glides to wherever the new page begins. If anything goes
 * wrong (offline, a non-HTML file, an unusual response) the router steps aside
 * and the browser does a normal page load, so links always work.
 *
 * Pages should not rely on their own inline <script> tags: content swapped in
 * this way does not run them. Add a data-no-boost attribute to any link that
 * should always do a full page load.
 */
(function () {
  "use strict";

  var page = document.getElementById("page");
  var main = document.getElementById("main");
  var nav = document.getElementById("site-nav");
  var toggle = document.querySelector(".menu-toggle");
  var announcer = document.getElementById("announcer");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var navToken = 0;

  // ---- mobile menu -------------------------------------------------------
  function setMenu(open) {
    if (!toggle || !nav) return;
    nav.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }
  if (toggle) {
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setMenu(false);
    });
  }

  // ---- email addresses ---------------------------------------------------
  // Addresses are never written out in the page source. The page carries
  // <span class="email" data-user="name" data-domain="example.edu">; the mail
  // link is only put together here, in the visitor's browser.
  function upgradeEmails(root) {
    var spans = root.querySelectorAll(".email[data-user][data-domain]");
    for (var i = 0; i < spans.length; i++) {
      var span = spans[i];
      var user = span.getAttribute("data-user");
      var domain = span.getAttribute("data-domain");
      if (!/^[^\s<>"'@:,;]+$/.test(user) || !/^[A-Za-z0-9.-]+$/.test(domain)) continue;
      var a = document.createElement("a");
      a.className = span.className;
      a.href = "mailto:" + user + String.fromCharCode(64) + domain;
      a.textContent = span.textContent;
      span.parentNode.replaceChild(a, span);
    }
  }
  upgradeEmails(document);

  if (!page || !window.fetch || !window.history || !window.DOMParser) return;

  // ---- router ------------------------------------------------------------
  history.scrollRestoration = "manual";
  history.replaceState({ y: window.scrollY }, "");

  function eligible(a, event) {
    if (event.defaultPrevented || event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (a.target && a.target !== "_self") return false;
    if (a.hasAttribute("download") || a.hasAttribute("data-no-boost")) return false;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return false;
    if (/\.[a-z0-9]+$/i.test(url.pathname) && !/\.html?$/i.test(url.pathname)) return false;
    // A link to somewhere on the page you're already on: let the browser handle it.
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return false;
    return true;
  }

  document.addEventListener("click", function (event) {
    var a = event.target.closest && event.target.closest("a[href]");
    if (!a || !eligible(a, event)) return;
    event.preventDefault();
    setMenu(false);
    history.replaceState({ y: window.scrollY }, ""); // remember where we were
    go(a.href, { push: true });
  });

  window.addEventListener("popstate", function (event) {
    var y = event.state && typeof event.state.y === "number" ? event.state.y : 0;
    go(location.href, { push: false, y: y });
  });

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function go(href, opts) {
    var token = ++navToken;
    var url = new URL(href, location.href);
    page.classList.add("is-leaving");

    var request = fetch(url.href, { credentials: "same-origin" }).then(function (res) {
      var type = res.headers.get("content-type") || "";
      if (!res.ok || type.indexOf("text/html") === -1) throw new Error("not a page");
      // Only ever swap in pages that really came from this site.
      if (new URL(res.url, location.href).origin !== location.origin) throw new Error("other origin");
      return res.text();
    });

    Promise.all([request, delay(reduceMotion.matches ? 0 : 180)])
      .then(function (results) {
        if (token !== navToken) return; // a newer click won
        var doc = new DOMParser().parseFromString(results[0], "text/html");
        var next = doc.getElementById("page");
        if (!next) throw new Error("no #page");
        swap(doc, next, url, opts);
      })
      .catch(function () {
        if (token === navToken) location.href = url.href; // fall back to a normal load
      });
  }

  function swap(doc, next, url, opts) {
    document.title = doc.title;
    document.body.className = doc.body.className;
    var desc = doc.querySelector('meta[name="description"]');
    var here = document.querySelector('meta[name="description"]');
    if (desc && here) here.setAttribute("content", desc.getAttribute("content"));

    page.setAttribute("data-group", next.getAttribute("data-group") || "");
    page.setAttribute("data-landscape-x", next.getAttribute("data-landscape-x") || "0");
    page.setAttribute("data-title", next.getAttribute("data-title") || doc.title);
    page.innerHTML = next.innerHTML; // same-site HTML only; the CSP also blocks any inline script in it
    upgradeEmails(page);

    if (opts.push) history.pushState({ y: 0 }, "", url.href);

    // Menu highlight
    var group = page.getAttribute("data-group");
    var links = document.querySelectorAll(".site-nav a[data-group]");
    for (var i = 0; i < links.length; i++) {
      if (links[i].getAttribute("data-group") === group) links[i].setAttribute("aria-current", "page");
      else links[i].removeAttribute("aria-current");
    }

    // Scroll: top of the page, to a #hash target, or back to where the reader was
    var y = opts.y || 0;
    var target = null;
    if (url.hash && opts.push) {
      try {
        target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      } catch (e) {} // a malformed #hash is simply ignored
    }
    window.scrollTo(0, target ? target.getBoundingClientRect().top + window.scrollY - 90 : y);

    if (window.Landscape) window.Landscape.travel(parseFloat(page.getAttribute("data-landscape-x")) || 0);

    requestAnimationFrame(function () { page.classList.remove("is-leaving"); });

    // Tell assistive tech and keyboard users the page changed
    if (announcer) announcer.textContent = doc.title;
    main.focus({ preventScroll: true });
  }
})();
