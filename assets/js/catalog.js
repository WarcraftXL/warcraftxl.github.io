/* WarcraftXL catalog - discover modules & scripts across GitHub by topic.
   Any public repo tagged with one of TOPICS shows up, wherever it lives. */
(function () {
  "use strict";

  // The tags a repo must carry to appear here. Edit this list to add more.
  var TOPICS = ["wxl-modules", "wxl-scripts", "warcraftxl-modules", "warcraftxl-scripts"];

  var SEARCH = "https://api.github.com/search/repositories";
  var CACHE_KEY = "wxl-catalog-cache-v2";
  var CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  // Never list these, even if tagged.
  var DENY = ["warcraftxl.github.io", ".github"];

  var LANG_COLORS = {
    "C++": "#f34b7d", "C": "#888888", CMake: "#da3434", PowerShell: "#3b6fb6",
    Shell: "#89e051", Python: "#3572A5", JavaScript: "#e3c54a", HTML: "#e34c26",
    CSS: "#9a76d8", Lua: "#7a7ad8", "C#": "#3aa856"
  };

  var els = {};
  var state = { repos: [], topics: [], activeTopics: [], query: "" };

  document.addEventListener("DOMContentLoaded", function () {
    els.grid = document.getElementById("catalog-grid");
    els.chips = document.getElementById("catalog-chips");
    els.search = document.getElementById("catalog-search");
    els.status = document.getElementById("catalog-status");
    els.count = document.getElementById("catalog-count");

    if (els.search) {
      els.search.addEventListener("input", function () {
        state.query = els.search.value.trim().toLowerCase();
        render();
      });
    }

    load();
  });

  /* ---------- data ---------- */

  function topicUrl(t) {
    return SEARCH + "?q=" + encodeURIComponent("topic:" + t) + "&per_page=100&sort=updated";
  }

  function fetchTopic(t) {
    return fetch(topicUrl(t), { headers: { Accept: "application/vnd.github+json" } })
      .then(function (res) {
        if (!res.ok) {
          var remaining = res.headers.get("X-RateLimit-Remaining");
          if (res.status === 403 && remaining === "0") {
            throw new RateError(Number(res.headers.get("X-RateLimit-Reset")) * 1000);
          }
          throw new Error("GitHub API returned " + res.status);
        }
        return res.json();
      })
      .then(function (data) { return (data && data.items) || []; });
  }

  function load() {
    showSkeletons();

    var cached = readCache();
    if (cached) { ingest(cached); return; }

    // One search per topic, then merge - GitHub search has no OR across topics.
    Promise.allSettled(TOPICS.map(fetchTopic)).then(function (results) {
      var ok = results.filter(function (r) { return r.status === "fulfilled"; });

      if (!ok.length) {
        var rate = results
          .map(function (r) { return r.reason; })
          .filter(function (e) { return e instanceof RateError; })[0];
        showError(rate || (results[0] && results[0].reason) || new Error("Network error"));
        return;
      }

      var merged = mergeItems(ok.map(function (r) { return r.value; }));
      writeCache(merged);
      ingest(merged);
    });
  }

  function mergeItems(lists) {
    var byId = {};
    lists.forEach(function (items) {
      items.forEach(function (r) {
        if (DENY.indexOf(r.name) !== -1) return;
        if (!byId[r.id]) byId[r.id] = r;
      });
    });
    return Object.keys(byId).map(function (k) { return byId[k]; });
  }

  function wxlTopicsOf(r) {
    return (r.topics || []).filter(function (t) { return TOPICS.indexOf(t) !== -1; });
  }

  function ingest(data) {
    var repos = (Array.isArray(data) ? data : []).filter(function (r) {
      return DENY.indexOf(r.name) === -1;
    });

    repos.forEach(function (r) { r._wxl = wxlTopicsOf(r); });

    repos.sort(function (a, b) {
      if (b.stargazers_count !== a.stargazers_count) return b.stargazers_count - a.stargazers_count;
      return new Date(b.pushed_at) - new Date(a.pushed_at);
    });

    var topicSet = {};
    repos.forEach(function (r) {
      r._wxl.forEach(function (t) { topicSet[t] = (topicSet[t] || 0) + 1; });
    });

    state.repos = repos;
    state.topics = TOPICS.filter(function (t) { return topicSet[t]; });
    renderChips(topicSet);
    render();
  }

  function visibleRepos() {
    return state.repos.filter(function (r) {
      if (state.activeTopics.length) {
        var hit = state.activeTopics.some(function (a) { return r._wxl.indexOf(a) !== -1; });
        if (!hit) return false;
      }
      if (state.query) {
        var hay = (r.full_name + " " + (r.description || "") + " " + (r.topics || []).join(" ")).toLowerCase();
        if (hay.indexOf(state.query) === -1) return false;
      }
      return true;
    });
  }

  /* ---------- rendering ---------- */

  function renderChips(topicSet) {
    if (!els.chips) return;
    els.chips.innerHTML = "";

    var all = chip("All", state.activeTopics.length === 0);
    all.addEventListener("click", function () { state.activeTopics = []; syncChips(); render(); });
    els.chips.appendChild(all);

    state.topics.forEach(function (t) {
      var c = chip(t + " (" + topicSet[t] + ")", false);
      c.dataset.topic = t;
      c.addEventListener("click", function () {
        var i = state.activeTopics.indexOf(t);
        if (i === -1) state.activeTopics.push(t); else state.activeTopics.splice(i, 1);
        syncChips();
        render();
      });
      els.chips.appendChild(c);
    });
  }

  function syncChips() {
    if (!els.chips) return;
    Array.prototype.forEach.call(els.chips.children, function (c) {
      var t = c.dataset.topic;
      var on = t ? state.activeTopics.indexOf(t) !== -1 : state.activeTopics.length === 0;
      c.classList.toggle("active", on);
    });
  }

  function chip(label, active) {
    var b = document.createElement("button");
    b.className = "chip" + (active ? " active" : "");
    b.textContent = label;
    return b;
  }

  function render() {
    if (!els.grid) return;
    var list = visibleRepos();

    if (els.count) {
      els.count.textContent = list.length + (list.length === 1 ? " result" : " results");
    }

    if (!state.repos.length) { clearStatusOnly(); return; }

    if (!list.length) {
      els.grid.innerHTML = "";
      setStatus(
        '<i data-lucide="search-x" class="w-8 h-8 text-bronze mx-auto"></i>' +
        '<p class="mt-3">Nothing matches your filters.</p>'
      );
      icons();
      return;
    }

    clearStatus();
    els.grid.innerHTML = list.map(card).join("");
    icons();
  }

  function card(r) {
    var lang = r.language
      ? '<span class="inline-flex items-center gap-1.5"><span class="lang-dot" style="background:' +
        (LANG_COLORS[r.language] || "#d6a258") + '"></span>' + esc(r.language) + "</span>"
      : "";

    var topics = (r._wxl || [])
      .slice(0, 4)
      .map(function (t) { return '<span class="chip chip-static !text-[0.62rem] !py-1 !px-2">' + esc(t) + "</span>"; })
      .join("");

    var home = r.homepage
      ? '<a href="' + esc(r.homepage) + '" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-gold hover:text-goldbright text-sm"><i data-lucide="external-link" class="w-4 h-4"></i> Site</a>'
      : "";

    return (
      '<div class="panel panel-hover p-6 flex flex-col">' +
        '<div class="flex items-start justify-between gap-3">' +
          '<div class="min-w-0">' +
            '<h3 class="font-display text-md text-strong font-semibold break-words">' + esc(r.name) + "</h3>" +
            '<p class="text-xs font-mono mt-0.5" style="color:var(--muted-2)">' + esc(r.owner ? r.owner.login : "") + "</p>" +
          "</div>" +
          '<span class="inline-flex items-center gap-1 text-bronze text-sm shrink-0"><i data-lucide="star" class="w-4 h-4"></i>' + r.stargazers_count + "</span>" +
        "</div>" +
        '<p class="text-muted text-base mt-2.5 grow">' + esc(r.description || "No description provided.") + "</p>" +
        (topics ? '<div class="flex flex-wrap gap-1.5 mt-4">' + topics + "</div>" : "") +
        '<div class="flex items-center justify-between mt-5 pt-4 border-t border-[var(--line)] text-sm text-muted">' +
          "<span>" + lang + "</span>" +
          '<span>updated ' + relTime(r.pushed_at) + "</span>" +
        "</div>" +
        '<div class="flex items-center gap-4 mt-4">' +
          '<a href="' + esc(r.html_url) + '" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-gold hover:text-goldbright text-sm">Repository</a>' +
          home +
        "</div>" +
      "</div>"
    );
  }

  /* ---------- status panels ---------- */

  function showSkeletons() {
    if (!els.grid) return;
    clearStatus();
    var s = "";
    for (var i = 0; i < 6; i++) {
      s +=
        '<div class="panel p-6">' +
          '<div class="skeleton h-5 w-1/2 rounded mb-4"></div>' +
          '<div class="skeleton h-3 w-full rounded mb-2"></div>' +
          '<div class="skeleton h-3 w-4/5 rounded mb-6"></div>' +
          '<div class="skeleton h-3 w-1/3 rounded"></div>' +
        "</div>";
    }
    els.grid.innerHTML = s;
  }

  function showError(err) {
    if (els.grid) els.grid.innerHTML = "";
    var msg, sub;
    if (err instanceof RateError) {
      msg = "GitHub rate limit reached.";
      sub = "The public search API allows a limited number of requests per minute. Try again " + relTime(new Date(err.reset).toISOString()) + ", or browse the tags directly.";
    } else {
      msg = "Could not load the catalog.";
      sub = esc(err && err.message ? err.message : "Network error") + ".";
    }
    setStatus(
      '<i data-lucide="triangle-alert" class="w-8 h-8 text-bronze mx-auto"></i>' +
      '<p class="mt-3 text-gold-bright font-display">' + msg + "</p>" +
      '<p class="mt-2 text-sm text-muted max-w-md mx-auto">' + sub + "</p>" +
      '<div class="flex items-center justify-center gap-3 mt-5">' +
        '<button id="catalog-retry" class="btn btn-ghost !py-2 !px-4"><i data-lucide="refresh-cw" class="w-4 h-4"></i> Retry</button>' +
        '<a href="https://github.com/topics/' + TOPICS[0] + '" target="_blank" rel="noopener" class="btn btn-ghost !py-2 !px-4">Browse on GitHub</a>' +
      "</div>"
    );
    var retry = document.getElementById("catalog-retry");
    if (retry) retry.addEventListener("click", function () { clearCache(); load(); });
    icons();
  }

  function setStatus(html) {
    if (!els.status) return;
    els.status.innerHTML = '<div class="panel py-14 px-6 text-center">' + html + "</div>";
    els.status.classList.remove("hidden");
  }
  function clearStatus() { if (els.status) { els.status.innerHTML = ""; els.status.classList.add("hidden"); } }
  function clearStatusOnly() { clearStatus(); if (els.grid) els.grid.innerHTML = ""; }

  function icons() { if (window.lucide) window.lucide.createIcons(); }

  /* ---------- cache ---------- */

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || (Date.now() - obj.t) > CACHE_TTL) return null;
      return obj.data;
    } catch (e) { return null; }
  }
  function writeCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data: data })); } catch (e) {}
  }
  function clearCache() { try { localStorage.removeItem(CACHE_KEY); } catch (e) {} }

  /* ---------- helpers ---------- */

  function RateError(reset) { this.reset = reset; }
  RateError.prototype = Object.create(Error.prototype);

  function relTime(iso) {
    var then = new Date(iso).getTime();
    var diff = Date.now() - then;
    var future = diff < 0;
    var s = Math.abs(diff) / 1000;
    var units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
    for (var i = 0; i < units.length; i++) {
      var n = Math.floor(s / units[i][1]);
      if (n >= 1) {
        var label = n + " " + units[i][0] + (n > 1 ? "s" : "");
        return future ? "in " + label : label + " ago";
      }
    }
    return future ? "shortly" : "just now";
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
