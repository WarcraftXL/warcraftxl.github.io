/* WarcraftXL site - shared behavior: nav, icons, scroll reveal, code highlight, wiki scrollspy. */
(function () {
  "use strict";

  document.documentElement.classList.remove("no-js");

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    // Footer year.
    var y = document.getElementById("year");
    if (y) y.textContent = String(new Date().getFullYear());

    // Mobile menu toggle.
    var burger = document.getElementById("nav-burger");
    var menu = document.getElementById("nav-mobile");
    if (burger && menu) {
      burger.addEventListener("click", function () {
        var open = menu.classList.toggle("hidden") === false;
        burger.setAttribute("aria-expanded", String(open));
      });
      menu.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", function () { menu.classList.add("hidden"); });
      });
    }

    // Lucide icons.
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }

    // Syntax highlight.
    if (window.hljs && typeof window.hljs.highlightElement === "function") {
      document.querySelectorAll("pre code").forEach(function (block) {
        window.hljs.highlightElement(block);
      });
    }

    initReveal();
    initScrollSpy();
  });

  // Subtle on-scroll reveal. Honors reduced-motion (handled in CSS) and degrades safely.
  function initReveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
    if (!items.length) return;

    function showAll() { items.forEach(function (el) { el.classList.add("in"); }); }

    if (!("IntersectionObserver" in window)) { showAll(); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0, rootMargin: "0px 0px -10% 0px" });

    items.forEach(function (el) { io.observe(el); });

    // Safety net: never leave content hidden if the observer misses something.
    setTimeout(showAll, 2000);
  }

  // Highlight the active wiki TOC entry while scrolling.
  function initScrollSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll(".toc-link"));
    if (!links.length) return;

    var targets = links
      .map(function (l) {
        var id = l.getAttribute("href");
        return id && id.charAt(0) === "#" ? document.getElementById(id.slice(1)) : null;
      })
      .filter(Boolean);

    function onScroll() {
      var pos = window.scrollY + 120;
      var current = targets[0];
      for (var i = 0; i < targets.length; i++) {
        if (targets[i].offsetTop <= pos) current = targets[i];
      }
      links.forEach(function (l) {
        l.classList.toggle("active", l.getAttribute("href") === "#" + (current ? current.id : ""));
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
})();
