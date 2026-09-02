/*
 * On2Cook Ambassador Network — app.js
 * Renders the interactive India map, drives state -> city drill-down,
 * free-text search, multi-select State/City filters, paginated roster,
 * and the ambassador detail modal.
 *
 * Data sources (in priority order):
 *   1. data/ambassadors.json   — fetched live (served over http/https)
 *   2. window.AMBASSADORS_FALLBACK — inlined copy from js/ambassadors-data.js,
 *      used automatically if fetch() fails (e.g. opened as file:// with no
 *      server). Both files are regenerated together by scripts/sync_sheet.py.
 */

(function () {
  "use strict";

  // =====================================================================
  // ⚙️ GOOGLE SHEET & FORM CONFIGURATION
  // =====================================================================
  // To change the Google Sheet, just replace the ID below:
  var GOOGLE_SHEET_ID = "1Wc5aZRhdHU7PAFXbVc1t6T0tMZ1oq-S7Z7BiEgfWAOk";
  var GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/" + GOOGLE_SHEET_ID + "/gviz/tq?tqx=out:json";

  // Google Form URL (for joining / applying as ambassador):
  var GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfYjXp04t4SG0Cd6Xc40GOHC919lkLdkkOXzC5dSBlHEo2rsw/viewform";
  // =====================================================================

  var PAGE_SIZE = 9;

  // ---------------------------------------------------------------------
  // State-name normalisation — maps sheet "State" text to the SVG map id.
  // ---------------------------------------------------------------------
  var STATE_ALIASES = {
    "andaman and nicobar islands": "an", "andaman & nicobar islands": "an", "andaman and nicobar": "an", "andaman & nicobar": "an", "andaman": "an",
    "andhra pradesh": "ap", "andhra": "ap", "ap": "ap",
    "arunachal pradesh": "ar", "arunachal": "ar",
    "assam": "as",
    "bihar": "br",
    "chandigarh": "ch",
    "chhattisgarh": "ct", "chattisgarh": "ct", "cg": "ct",
    "dadra and nagar haveli": "dn", "dadra & nagar haveli": "dn", "dadra": "dn",
    "daman and diu": "dd", "daman & diu": "dd", "daman": "dd", "diu": "dd",
    "dadra and nagar haveli and daman and diu": "dn", "dnh and dd": "dn",
    "delhi": "dl", "nct of delhi": "dl", "new delhi": "dl", "dl": "dl",
    "goa": "ga",
    "gujarat": "gj", "gujrat": "gj", "gj": "gj",
    "haryana": "hr",
    "himachal pradesh": "hp", "himachal": "hp", "hp": "hp",
    "jammu and kashmir": "jk", "jammu & kashmir": "jk", "j&k": "jk", "jammu": "jk", "kashmir": "jk",
    "jharkhand": "jh",
    "karnataka": "ka", "bangalore": "ka", "bengaluru": "ka",
    "kerala": "kl",
    "ladakh": "la",
    "lakshadweep": "ld",
    "madhya pradesh": "mp", "mp": "mp",
    "maharashtra": "mh", "maharastra": "mh", "mh": "mh", "mumbai": "mh", "pune": "mh",
    "manipur": "mn",
    "meghalaya": "ml",
    "mizoram": "mz",
    "nagaland": "nl",
    "odisha": "or", "orissa": "or",
    "puducherry": "py", "pondicherry": "py",
    "punjab": "pb",
    "rajasthan": "rj", "rajastan": "rj", "rj": "rj",
    "sikkim": "sk",
    "tamil nadu": "tn", "tamilnadu": "tn", "tn": "tn", "chennai": "tn",
    "telangana": "tg", "telengana": "tg", "ts": "tg", "hyderabad": "tg",
    "tripura": "tr",
    "uttar pradesh": "up", "up": "up",
    "uttarakhand": "ut", "uttaranchal": "ut", "uk": "ut",
    "west bengal": "wb", "bengal": "wb", "wb": "wb", "kolkata": "wb"
  };

  function normText(s) { return (s || "").toString().trim().toLowerCase().replace(/\s+/g, " "); }
  
  function stateIdFor(stateName) {
    var raw = normText(stateName);
    if (!raw) return null;
    if (STATE_ALIASES[raw]) return STATE_ALIASES[raw];
    
    // Fuzzy matching against aliases
    for (var alias in STATE_ALIASES) {
      if (raw.indexOf(alias) !== -1 || alias.indexOf(raw) !== -1) {
        return STATE_ALIASES[alias];
      }
    }
    return null;
  }
  function csvList(s) { return (s || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean); }

  // ---------------------------------------------------------------------
  // App state
  // ---------------------------------------------------------------------
  var ALL = [];
  var META = null;
  var selectedStateId = null;
  var selectedStateName = null;
  var selectedCity = null;
  var searchQuery = "";
  var filterStates = new Set();
  var filterCities = new Set();
  var stateFilterSearch = "";
  var cityFilterSearch = "";
  var visibleCount = PAGE_SIZE;

  var els = {};

  function filtersActive() {
    return !!searchQuery || filterStates.size > 0 || filterCities.size > 0;
  }

  // ---------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------

  function loadData() {
    return new Promise(function (resolve, reject) {
      // 1. Try JSONP via Script Tag (works everywhere: file://, http://, https:// without CORS restriction)
      var callbackName = "_gviz_callback_" + Date.now();
      var script = document.createElement("script");
      var timeout = setTimeout(function () {
        cleanup();
        fallbackFetch();
      }, 7000);

      function cleanup() {
        clearTimeout(timeout);
        delete window[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[callbackName] = function (json) {
        cleanup();
        try {
          var parsed = parseGoogleSheetData(json);
          resolve(parsed);
        } catch (e) {
          fallbackFetch();
        }
      };

      script.src = "https://docs.google.com/spreadsheets/d/" + GOOGLE_SHEET_ID + "/gviz/tq?tqx=responseHandler:" + callbackName + "&_t=" + Date.now();
      script.onerror = function () {
        cleanup();
        fallbackFetch();
      };
      document.head.appendChild(script);

      function fallbackFetch() {
        fetch("data/ambassadors.json", { cache: "no-store" })
          .then(function (res) {
            if (!res.ok) throw new Error("bad status " + res.status);
            return res.json();
          })
          .then(resolve)
          .catch(function () {
            if (window.AMBASSADORS_FALLBACK) resolve(window.AMBASSADORS_FALLBACK);
            else resolve({ _meta: { source: "none", syncedAt: null, count: 0 }, ambassadors: [] });
          });
      }
    });
  }

  function parseGoogleSheetData(json) {
    var rows = (json.table && json.table.rows) || [];
    var cols = (json.table && json.table.cols) || [];
    var ambassadors = [];

    // Build header map from cols or row 0
    var headerMap = {};
    cols.forEach(function (c, idx) {
      if (c.label) headerMap[idx] = normText(c.label);
    });

    var dataRows = rows;
    if (Object.keys(headerMap).length === 0 && rows.length > 0 && rows[0].c) {
      var firstRow = rows[0].c;
      var hasHeaderWords = false;
      firstRow.forEach(function (cell, idx) {
        if (cell && cell.v) {
          var t = normText(cell.v);
          headerMap[idx] = t;
          if (t.indexOf("name") !== -1 || t.indexOf("timestamp") !== -1 || t.indexOf("city") !== -1) {
            hasHeaderWords = true;
          }
        }
      });
      if (hasHeaderWords) {
        dataRows = rows.slice(1);
      }
    }

    function findColIdx(keywords, defaultIdx) {
      for (var idx in headerMap) {
        for (var k = 0; k < keywords.length; k++) {
          if (headerMap[idx].indexOf(keywords[k]) !== -1) return parseInt(idx, 10);
        }
      }
      return defaultIdx;
    }

    var colName = findColIdx(["full name", "name", "chef"], 1);
    var colBrand = findColIdx(["brand", "restaurant", "kitchen", "outlet"], 2);
    var colBilling = findColIdx(["billing", "legal entity"], 3);
    var colCity = findColIdx(["city", "location"], 4);
    var colState = findColIdx(["state", "region"], 5);
    var colPhone = findColIdx(["contact", "phone", "mobile", "number"], 6);
    var colWa = findColIdx(["whatsapp", "wa"], 7);
    var colEmail = findColIdx(["email", "mail"], 8);
    var colProfile = findColIdx(["profile", "designation", "role", "title"], 9);
    var colInsta = findColIdx(["instagram", "insta"], 10);
    var colSpecs = findColIdx(["special", "specialities", "cuisine"], 11);
    var colSince = findColIdx(["since", "operational", "established", "year"], 12);
    var colCode = findColIdx(["code", "ambassador code"], -1);

    dataRows.forEach(function (row, idx) {
      if (!row || !row.c) return;
      var c = row.c;
      function val(i) {
        if (i === -1 || !c[i]) return "";
        var v = c[i].f !== undefined ? c[i].f : c[i].v;
        if (v === null || v === undefined) return "";
        var s = String(v).trim();
        return (s === "—" || s === "-" || s.toUpperCase() === "NA" || s.toUpperCase() === "N/A" || s.toLowerCase() === "null") ? "" : s;
      }

      var name = val(colName);
      var brand = val(colBrand);
      var code = val(colCode);
      var city = val(colCity);
      var state = val(colState);

      if (!name && !brand && !city) return;
      if (normText(name) === "name" || normText(name) === "full name" || normText(name) === "timestamp") return;

      var srNo = idx + 1;
      var phone = val(colPhone);
      var email = val(colEmail);
      var profile = val(colProfile);
      var insta = val(colInsta);
      var wa = val(colWa) || phone;
      var specs = val(colSpecs);
      var since = val(colSince);

      if (!code && name) {
        var cleanCodeName = name.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase();
        code = "O2C" + (cleanCodeName || "AMB") + (srNo < 10 ? "0" + srNo : srNo);
      }

      var sid = stateIdFor(state);
      var canonicalState = state;
      if (sid && window.INDIA_MAP && window.INDIA_MAP.states) {
        var mapSt = window.INDIA_MAP.states.find(function (st) { return st.id === sid; });
        if (mapSt) canonicalState = mapSt.name;
      }

      function toTitleCase(str) {
        return (str || "").replace(/\b\w+/g, function (txt) {
          return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
      }

      ambassadors.push({
        srNo: srNo,
        name: toTitleCase(name) || "Unnamed",
        brandName: toTitleCase(brand),
        billingName: val(colBilling),
        code: code,
        city: toTitleCase(city) || "Unknown city",
        state: canonicalState || "Unknown state",
        phone: phone,
        email: email,
        profile: profile,
        instagram: insta,
        facebook: "",
        whatsapp: wa,
        specialties: specs,
        operationalSince: since,
        kitchenType: profile || "",
        servicesOffered: "",
        coverageAreas: "",
        happyCustomers: "",
        dishesServed: "",
        rating: "",
        profileUrl: "",
        photoUrl: "",
        stateId: sid
      });
    });

    return {
      _meta: {
        source: "Google Sheets (Live)",
        syncedAt: new Date().toISOString(),
        count: ambassadors.length
      },
      ambassadors: ambassadors
    };
  }

  function initFromPayload(payload) {
    META = payload._meta || {};
    ALL = (payload.ambassadors || []).map(function (a) {
      return {
        srNo: a.srNo,
        name: a.name || "Unnamed",
        brandName: a.brandName || "",
        billingName: a.billingName || "",
        code: a.code || "",
        city: a.city || "Unknown city",
        state: a.state || "Unknown state",
        phone: a.phone || "",
        email: a.email || "",
        profile: a.profile || "",
        instagram: a.instagram || "",
        facebook: a.facebook || "",
        whatsapp: a.whatsapp || a.phone || "",
        kitchenType: a.kitchenType || "",
        operationalSince: a.operationalSince || "",
        servicesOffered: a.servicesOffered || "",
        coverageAreas: a.coverageAreas || "",
        specialties: a.specialties || "",
        happyCustomers: a.happyCustomers || "",
        dishesServed: a.dishesServed || "",
        rating: a.rating || "",
        profileUrl: a.profileUrl || "",
        photoUrl: a.photoUrl || "",
        stateId: stateIdFor(a.state)
      };
    });
    renderSyncBadge();
    renderMap();
    renderHeroMap();
    renderStats();
    renderFilterChecklists();
    renderDrillView();
  }

  function renderSyncBadge() {
    if (!META || !META.syncedAt) {
      els.syncBadge.textContent = "";
      els.syncBadge.classList.remove("is-live");
      return;
    }
    var d = new Date(META.syncedAt);
    var stamp = isNaN(d.getTime()) ? META.syncedAt : d.toLocaleString();
    els.syncBadge.textContent = "Live data · synced " + stamp;
    els.syncBadge.classList.add("is-live");
  }

  // ---------------------------------------------------------------------
  // Derived groupings
  // ---------------------------------------------------------------------
  function groupByState() {
    var map = {};
    ALL.forEach(function (a) {
      var key = a.stateId || ("_unmapped_" + normText(a.state));
      if (!map[key]) map[key] = { id: a.stateId, name: a.state, items: [] };
      map[key].items.push(a);
    });
    return map;
  }

  function groupByCity(stateNameFilter) {
    var map = {};
    ALL.forEach(function (a) {
      if (stateNameFilter && stateNameFilter.size > 0 && !stateNameFilter.has(a.state)) return;
      var key = normText(a.city);
      if (!map[key]) map[key] = { name: a.city, items: [] };
      map[key].items.push(a);
    });
    return map;
  }

  function citiesForState(stateId, stateName) {
    var map = {};
    ALL.forEach(function (a) {
      var match = stateId ? a.stateId === stateId : normText(a.state) === normText(stateName);
      if (!match) return;
      var key = normText(a.city);
      if (!map[key]) map[key] = { name: a.city, items: [] };
      map[key].items.push(a);
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.items.length - a.items.length; });
  }

  // ---------------------------------------------------------------------
  // Hero decorative map (dotted India + a few connected pins)
  // ---------------------------------------------------------------------
  function renderHeroMap() {
    var svg = els.heroMap;
    if (!svg || !window.INDIA_MAP) return;
    svg.setAttribute("viewBox", window.INDIA_MAP.viewBox);
    svg.innerHTML = "";

    var svgNS = "http://www.w3.org/2000/svg";
    var defs = document.createElementNS(svgNS, "defs");
    defs.innerHTML =
      '<pattern id="heroDots" width="7" height="7" patternUnits="userSpaceOnUse">' +
      '<circle cx="1.2" cy="1.2" r="1.3" fill="rgba(255,255,255,.4)"/></pattern>';
    svg.appendChild(defs);

    var g = document.createElementNS(svgNS, "g");
    window.INDIA_MAP.states.forEach(function (s) {
      var path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", s.d);
      path.setAttribute("fill", "url(#heroDots)");
      g.appendChild(path);
    });
    svg.appendChild(g);

    // Approximate coordinates (within the 612x696 viewBox) for a handful
    // of well-known cities, purely decorative.
    var pins = [
      { x: 330, y: 430 },
      { x: 300, y: 395 },
      { x: 370, y: 460 },
      { x: 390, y: 330 },
      { x: 355, y: 560 }
    ];

    var linesG = document.createElementNS(svgNS, "g");
    for (var i = 1; i < pins.length; i++) {
      var p0 = pins[0], p1 = pins[i];
      var mx = (p0.x + p1.x) / 2, my = Math.min(p0.y, p1.y) - 40;
      var path2 = document.createElementNS(svgNS, "path");
      path2.setAttribute("d", "M" + p0.x + "," + p0.y + " Q" + mx + "," + my + " " + p1.x + "," + p1.y);
      path2.setAttribute("class", "hero-link");
      linesG.appendChild(path2);
    }
    svg.appendChild(linesG);

    pins.forEach(function (p, i) {
      var pin = document.createElementNS(svgNS, "circle");
      pin.setAttribute("cx", p.x);
      pin.setAttribute("cy", p.y);
      pin.setAttribute("r", i === 0 ? 7 : 5.5);
      pin.setAttribute("class", "hero-pin-outline");
      svg.appendChild(pin);
      var dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("cx", p.x);
      dot.setAttribute("cy", p.y);
      dot.setAttribute("r", i === 0 ? 3.2 : 2.4);
      dot.setAttribute("class", "hero-pin");
      svg.appendChild(dot);
    });
  }

  // ---------------------------------------------------------------------
  // Coverage map rendering
  // ---------------------------------------------------------------------
  function renderMap() {
    var svg = els.map;
    svg.setAttribute("viewBox", window.INDIA_MAP.viewBox);
    svg.innerHTML = "";

    var byState = groupByState();
    var counts = {};
    var maxCount = 0;
    Object.keys(byState).forEach(function (k) {
      var g = byState[k];
      if (!g.id) return;
      counts[g.id] = g.items.length;
      if (g.items.length > maxCount) maxCount = g.items.length;
    });

    var svgNS = "http://www.w3.org/2000/svg";
    var labels = [];

    window.INDIA_MAP.states.forEach(function (s) {
      var path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", s.d);
      path.setAttribute("data-id", s.id);
      path.setAttribute("data-name", s.name);
      path.classList.add("state-path");

      var count = counts[s.id] || 0;
      if (count > 0) {
        path.classList.add("has-data");
        var intensity = maxCount > 0 ? (0.16 + 0.84 * (count / maxCount)) : 0.3;
        path.style.fill = "rgba(255,0,0," + intensity.toFixed(2) + ")";
        path.addEventListener("click", function () { selectState(s.id, s.name); });
        path.addEventListener("mousemove", function (e) { showTooltip(e, s.name, count); });
        path.addEventListener("mouseleave", hideTooltip);
      }

      if (selectedStateId && s.id === selectedStateId) {
        path.classList.add("is-selected");
      } else if (selectedStateId) {
        path.classList.add("is-dimmed");
      }

      svg.appendChild(path);
      if (count > 0) labels.push({ path: path, id: s.id, name: s.name, count: count });
    });

    // Count badges, positioned at each state's bounding-box center. Read
    // after the paths are in the DOM so getBBox() has real geometry.
    labels.forEach(function (l) {
      var box;
      try { box = l.path.getBBox(); } catch (e) { return; }
      var cx = box.x + box.width / 2;
      var cy = box.y + box.height / 2;
      var r = String(l.count).length > 2 ? 11 : 9;

      var badge = document.createElementNS(svgNS, "g");
      badge.setAttribute("class", "state-badge");
      badge.style.pointerEvents = "none";

      var circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", cx);
      circle.setAttribute("cy", cy);
      circle.setAttribute("r", r);
      circle.setAttribute("class", "state-badge__circle" + (l.id === selectedStateId ? " is-selected" : ""));
      badge.appendChild(circle);

      var text = document.createElementNS(svgNS, "text");
      text.setAttribute("x", cx);
      text.setAttribute("y", cy);
      text.setAttribute("class", "state-badge__text");
      text.textContent = l.count;
      badge.appendChild(text);

      svg.appendChild(badge);
    });
  }

  function showTooltip(evt, name, count) {
    var wrap = els.mapWrap.getBoundingClientRect();
    els.tooltip.hidden = false;
    els.tooltip.style.left = (evt.clientX - wrap.left) + "px";
    els.tooltip.style.top = (evt.clientY - wrap.top) + "px";
    els.tooltip.innerHTML = "<strong>" + escapeHtml(name) + "</strong><br>" + count + " ambassador" + (count === 1 ? "" : "s");
  }
  function hideTooltip() { els.tooltip.hidden = true; }

  // ---------------------------------------------------------------------
  // Selection flow (map / state-pill drill-down)
  // ---------------------------------------------------------------------
  function selectState(id, name) {
    selectedStateId = id;
    selectedStateName = name;
    selectedCity = null;
    clearAllFilters(true);
    visibleCount = PAGE_SIZE;
    els.resetMapBtn.hidden = false;
    renderMap();
    renderDrillView();
    closeFilterPanel();
  }

  function resetMap() {
    selectedStateId = null;
    selectedStateName = null;
    selectedCity = null;
    visibleCount = PAGE_SIZE;
    els.resetMapBtn.hidden = true;
    renderMap();
    renderDrillView();
  }

  // ---------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------
  function renderStats() {
    var states = {}, cities = {};
    ALL.forEach(function (a) {
      states[normText(a.state)] = true;
      cities[normText(a.city) + "|" + normText(a.state)] = true;
    });
    els.statTotal.textContent = ALL.length;
    els.statStates.textContent = Object.keys(states).length;
    els.statCities.textContent = Object.keys(cities).length;
  }

  // ---------------------------------------------------------------------
  // Filter panel (multi-select State / City, with per-column search)
  // ---------------------------------------------------------------------
  function renderFilterChecklists() {
    var byState = groupByState();
    var stateRows = Object.keys(byState).map(function (k) { return byState[k]; })
      .filter(function (g) { return g.id; })
      .sort(function (a, b) { return b.items.length - a.items.length; });

    // City list is scoped to whichever states are currently checked, so
    // picking Maharashtra only shows Maharashtra's cities — not all 30.
    var byCity = groupByCity(filterStates);
    var cityRows = Object.keys(byCity).map(function (k) { return byCity[k]; })
      .sort(function (a, b) { return b.items.length - a.items.length; });

    var stateQ = normText(stateFilterSearch);
    var cityQ = normText(cityFilterSearch);
    var visibleStateRows = stateQ ? stateRows.filter(function (g) { return normText(g.name).indexOf(stateQ) > -1; }) : stateRows;
    var visibleCityRows = cityQ ? cityRows.filter(function (g) { return normText(g.name).indexOf(cityQ) > -1; }) : cityRows;

    els.stateChecklist.innerHTML = visibleStateRows.length ? visibleStateRows.map(function (g) {
      var checked = filterStates.has(g.name) ? " checked" : "";
      return '<label class="filter-check"><input type="checkbox" data-filter="state" value="' + escapeAttr(g.name) + '"' + checked + '>' +
        '<span class="filter-check__name">' + escapeHtml(g.name) + '</span>' +
        '<span class="filter-check__count">' + g.items.length + '</span></label>';
    }).join("") : '<p class="filter-checklist__empty">No states match</p>';

    els.cityGroupHint.hidden = filterStates.size === 0;
    els.cityGroupHint.textContent = filterStates.size === 1
      ? "Showing cities in " + Array.from(filterStates)[0]
      : "Showing cities in " + filterStates.size + " selected states";

    els.cityChecklist.innerHTML = visibleCityRows.length ? visibleCityRows.map(function (g) {
      var checked = filterCities.has(g.name) ? " checked" : "";
      return '<label class="filter-check"><input type="checkbox" data-filter="city" value="' + escapeAttr(g.name) + '"' + checked + '>' +
        '<span class="filter-check__name">' + escapeHtml(g.name) + '</span>' +
        '<span class="filter-check__count">' + g.items.length + '</span></label>';
    }).join("") : '<p class="filter-checklist__empty">' + (filterStates.size ? "No cities in the selected state(s)" : "No cities match") + '</p>';

    renderFilterChips();
    updateFilterBadge();
  }

  function renderFilterChips() {
    var chips = [];
    filterStates.forEach(function (name) { chips.push({ kind: "state", value: name }); });
    filterCities.forEach(function (name) { chips.push({ kind: "city", value: name }); });

    els.filterChips.hidden = chips.length === 0;
    els.filterChips.innerHTML = chips.map(function (c) {
      return '<button type="button" class="filter-chip" data-remove="' + c.kind + '" data-value="' + escapeAttr(c.value) + '">' +
        escapeHtml(c.value) + '<span data-icon="close"></span></button>';
    }).join("");
    applyIcons(els.filterChips);
  }

  function updateFilterBadge() {
    var count = filterStates.size + filterCities.size;
    els.filterBadge.hidden = count === 0;
    els.filterBadge.textContent = count;
    els.filterClear.hidden = count === 0;
  }

  function onFilterPanelClick(e) {
    var removeBtn = e.target.closest && e.target.closest("[data-remove]");
    if (!removeBtn) return;
    var kind = removeBtn.getAttribute("data-remove");
    var value = removeBtn.getAttribute("data-value");
    var set = kind === "state" ? filterStates : filterCities;
    set.delete(value);
    if (kind === "state") pruneCitiesToStates();
    applyFilterChange();
  }

  // Keep filterCities consistent with filterStates: if a state is
  // deselected, drop any city filter that only belonged to that state.
  function pruneCitiesToStates() {
    if (filterStates.size === 0) return;
    var validCities = {};
    ALL.forEach(function (a) { if (filterStates.has(a.state)) validCities[a.city] = true; });
    filterCities.forEach(function (c) { if (!validCities[c]) filterCities.delete(c); });
  }

  function onFilterCheckboxChange(e) {
    var input = e.target;
    if (!input.matches('input[data-filter]')) return;
    var kind = input.getAttribute("data-filter");
    var value = input.value;
    var set = kind === "state" ? filterStates : filterCities;
    if (input.checked) set.add(value); else set.delete(value);
    if (kind === "state") pruneCitiesToStates();
    applyFilterChange();
  }

  function applyFilterChange() {
    selectedStateId = null;
    selectedStateName = null;
    selectedCity = null;
    els.resetMapBtn.hidden = true;
    visibleCount = PAGE_SIZE;
    renderFilterChecklists();
    renderMap();
    renderDrillView();
  }

  function clearAllFilters(skipRender) {
    filterStates.clear();
    filterCities.clear();
    searchQuery = "";
    els.searchInput.value = "";
    els.filterSearchInput.value = "";
    els.searchClear.hidden = true;
    updateFilterBadge();
    if (els.stateChecklist) renderFilterChecklists();
    if (!skipRender) { renderMap(); renderDrillView(); }
  }

  function toggleFilterPanel() {
    var isOpen = !els.filterPanel.hidden;
    if (isOpen) closeFilterPanel(); else openFilterPanel();
  }
  function openFilterPanel() {
    els.filterPanel.hidden = false;
    els.filterToggle.setAttribute("aria-expanded", "true");
    els.filterSearchInput.value = searchQuery;
    if (window.innerWidth <= 640) {
      var rect = els.filterToggle.getBoundingClientRect();
      els.filterPanel.style.top = (rect.bottom + 8) + "px";
    } else {
      els.filterPanel.style.top = "";
    }
  }
  function closeFilterPanel() {
    els.filterPanel.hidden = true;
    els.filterToggle.setAttribute("aria-expanded", "false");
  }

  // ---------------------------------------------------------------------
  // Drill panel (title, chips, roster)
  // ---------------------------------------------------------------------
  function setFlowStep(n) {
    for (var i = 1; i <= 3; i++) {
      var el = document.querySelector('.flow-steps__step[data-step="' + i + '"]');
      el.classList.remove("is-active", "is-done");
      if (i === n) el.classList.add("is-active");
      else if (i < n) el.classList.add("is-done");
    }
  }

  function renderDrillView() {
    if (filtersActive()) {
      renderFilteredView();
      return;
    }

    els.viewFullRosterBtn.hidden = !!selectedStateId;

    if (!selectedStateId) {
      setFlowStep(1);
      els.drillTitle.textContent = "All Ambassadors";
      els.drillMeta.textContent = "Pick a state on the map, or browse everyone below.";
      els.cityChips.hidden = true;
      renderRoster(ALL);
      return;
    }

    var cities = citiesForState(selectedStateId, selectedStateName);
    var stateTotal = cities.reduce(function (n, c) { return n + c.items.length; }, 0);

    els.cityChips.hidden = false;
    els.cityChips.innerHTML = "";
    cities.forEach(function (c) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "city-chip" + (selectedCity === c.name ? " is-active" : "");
      chip.innerHTML = escapeHtml(c.name) + ' <span class="city-chip__count">' + c.items.length + '</span>';
      chip.addEventListener("click", function () {
        selectedCity = selectedCity === c.name ? null : c.name;
        visibleCount = PAGE_SIZE;
        renderDrillView();
      });
      els.cityChips.appendChild(chip);
    });

    if (selectedCity) {
      setFlowStep(3);
      var cityGroup = cities.filter(function (c) { return c.name === selectedCity; })[0];
      els.drillTitle.textContent = selectedCity;
      els.drillMeta.textContent = selectedStateName + " · " + (cityGroup ? cityGroup.items.length : 0) + " ambassador" + ((cityGroup && cityGroup.items.length === 1) ? "" : "s");
      renderRoster(cityGroup ? cityGroup.items : []);
    } else {
      setFlowStep(2);
      els.drillTitle.textContent = selectedStateName;
      els.drillMeta.textContent = stateTotal + " ambassador" + (stateTotal === 1 ? "" : "s") + " across " + cities.length + " " + (cities.length === 1 ? "city" : "cities") + " — select one below.";
      var combined = cities.reduce(function (arr, c) { return arr.concat(c.items); }, []);
      renderRoster(combined);
    }
  }

  function renderFilteredView() {
    setFlowStep(0);
    els.cityChips.hidden = true;
    els.viewFullRosterBtn.hidden = true;

    var q = normText(searchQuery);
    var results = ALL.filter(function (a) {
      var matchesText = !q ||
        normText(a.name).indexOf(q) > -1 ||
        normText(a.brandName).indexOf(q) > -1 ||
        normText(a.code).indexOf(q) > -1 ||
        normText(a.city).indexOf(q) > -1 ||
        normText(a.state).indexOf(q) > -1;
      var matchesState = filterStates.size === 0 || filterStates.has(a.state);
      var matchesCity = filterCities.size === 0 || filterCities.has(a.city);
      return matchesText && matchesState && matchesCity;
    });

    var parts = [];
    if (searchQuery) parts.push("\u201c" + searchQuery + "\u201d");
    if (filterStates.size) parts.push(filterStates.size + " state" + (filterStates.size === 1 ? "" : "s"));
    if (filterCities.size) parts.push(filterCities.size + " cit" + (filterCities.size === 1 ? "y" : "ies"));

    els.drillTitle.textContent = "Filtered results";
    els.drillMeta.textContent = results.length + " match" + (results.length === 1 ? "" : "es") + (parts.length ? " — " + parts.join(", ") : "");
    renderRoster(results);

    var matchedStateIds = {};
    results.forEach(function (a) { if (a.stateId) matchedStateIds[a.stateId] = true; });
    Array.prototype.forEach.call(els.map.querySelectorAll(".state-path"), function (p) {
      var id = p.getAttribute("data-id");
      p.classList.toggle("is-dimmed", p.classList.contains("has-data") && !matchedStateIds[id]);
    });
  }

  function renderRoster(list) {
    els.rosterGrid.innerHTML = "";
    els.emptyState.hidden = list.length > 0;
    if (!list.length) { els.loadMoreBtn.hidden = true; return; }

    var shown = list.slice(0, visibleCount);
    var frag = document.createDocumentFragment();
    shown.forEach(function (a) { frag.appendChild(buildIdCard(a)); });
    els.rosterGrid.appendChild(frag);
    applyIcons(els.rosterGrid);

    els.loadMoreBtn.hidden = visibleCount >= list.length;
    els.loadMoreBtn.onclick = function () {
      visibleCount += PAGE_SIZE;
      renderRoster(list);
    };
  }

  function initials(name) {
    var parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function buildIdCard(a) {
    var card = document.createElement("button");
    card.type = "button";
    card.className = "id-card";
    
    var badgeText = a.kitchenType || a.state || "AMBASSADOR";
    if (badgeText.length > 20) badgeText = badgeText.slice(0, 18) + "…";

    card.innerHTML =
      '<div class="id-card__top-bar">' +
        '<span class="id-card__badge">' + escapeHtml(badgeText) + '</span>' +
        '<span class="id-card__arrow">↗</span>' +
      '</div>' +
      '<div class="id-card__profile-row">' +
        '<div class="id-card__avatar">' + escapeHtml(initials(a.name)) + '</div>' +
        '<div class="id-card__user-info">' +
          '<h4 class="id-card__name">' + escapeHtml(a.name) + '</h4>' +
          '<p class="id-card__brand">' + escapeHtml(a.brandName || "On2Cook Partner") + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="id-card__bottom">' +
        (a.code ? '<span class="id-card__code">' + escapeHtml(a.code) + '</span>' : '<span></span>') +
        '<span class="id-card__city"><span data-icon="pin"></span>' + escapeHtml(a.city) + '</span>' +
      '</div>';
    card.addEventListener("click", function () { openModal(a); });
    return card;
  }

  // ---------------------------------------------------------------------
  // Modal
  // ---------------------------------------------------------------------
  function openModal(a) {
    els.modalAvatar.textContent = initials(a.name);
    els.modalName.innerHTML = escapeHtml(a.name) + ' <span class="verified-badge" data-icon="badgeCheck" title="Verified ambassador"></span>';
    els.modalBrand.textContent = a.brandName || "";
    els.modalBrand.hidden = !a.brandName;
    els.modalCode.textContent = a.code || "\u2014";
    els.modalLoc.innerHTML = '<span data-icon="pin"></span>' + escapeHtml([a.city, a.state].filter(Boolean).join(", "));

    els.modalAboutLabel.textContent = "About " + (a.name ? a.name.split(" ")[0] : "");
    els.modalProfile.textContent = a.profile || "No profile written yet.";
    els.modalAboutSection.hidden = false;

    var stats = [];
    if (a.happyCustomers) stats.push(["users", a.happyCustomers, "Happy Customers"]);
    if (a.dishesServed) stats.push(["chat", a.dishesServed, "Dishes Served"]);
    if (a.rating) stats.push(["star", a.rating, "Customer Rating"]);
    if (stats.length) {
      els.modalStats.hidden = false;
      els.modalStats.innerHTML = stats.map(function (s) {
        return '<div class="modal-stat"><span class="modal-stat__icon" data-icon="' + s[0] + '"></span>' +
          '<span class="modal-stat__value">' + escapeHtml(String(s[1])) + '</span>' +
          '<span class="modal-stat__label">' + escapeHtml(s[2]) + '</span></div>';
      }).join("");
    } else {
      els.modalStats.hidden = true;
      els.modalStats.innerHTML = "";
    }

    var specialties = csvList(a.specialties);
    if (specialties.length) {
      els.modalSpecialtiesSection.hidden = false;
      els.modalSpecialties.innerHTML = specialties.map(function (t) {
        return '<span class="modal-tag">' + escapeHtml(t) + '</span>';
      }).join("");
    } else {
      els.modalSpecialtiesSection.hidden = true;
    }

    if (els.modalViewProfile) {
      if (a.profileUrl) {
        els.modalViewProfile.hidden = false;
        els.modalViewProfile.href = a.profileUrl;
      } else {
        els.modalViewProfile.hidden = true;
      }
    }
    if (els.modalWhatsapp) {
      var waNumber = (a.whatsapp || a.phone || "").replace(/[^\d]/g, "");
      if (waNumber) {
        els.modalWhatsapp.hidden = false;
        els.modalWhatsapp.href = "https://wa.me/" + waNumber;
      } else {
        els.modalWhatsapp.hidden = true;
      }
    }

    if (a.photoUrl) {
      els.modalPhoto.innerHTML = '<img src="' + escapeAttr(a.photoUrl) + '" alt="' + escapeAttr(a.brandName || a.name) + '">';
    } else {
      els.modalPhoto.innerHTML = '<span data-icon="image"></span>';
    }

    var rows = [];
    if (a.phone) rows.push(["phone", "Phone", escapeHtml(a.phone)]);
    if (a.email) rows.push(["link", "Email", escapeHtml(a.email)]);
    if (a.kitchenType) rows.push(["home", "Kitchen Type", escapeHtml(a.kitchenType)]);
    if (a.operationalSince) rows.push(["clock", "Operational Since", escapeHtml(a.operationalSince)]);
    if (a.servicesOffered) rows.push(["truck", "Services Offered", escapeHtml(a.servicesOffered)]);
    if (a.coverageAreas) rows.push(["layers", "Coverage Areas", escapeHtml(a.coverageAreas)]);
    if (a.billingName) rows.push(["user", "Billing Name", escapeHtml(a.billingName)]);

    var connectLinks = [];
    if (a.instagram) connectLinks.push('<a class="connect-link" href="https://instagram.com/' + escapeAttr(a.instagram.replace(/^@/, "")) + '" target="_blank" rel="noopener"><span data-icon="link"></span>Instagram</a>');
    if (a.facebook) connectLinks.push('<a class="connect-link" href="https://facebook.com/' + escapeAttr(a.facebook.replace(/^@/, "")) + '" target="_blank" rel="noopener"><span data-icon="link"></span>Facebook</a>');

    var rowsHtml = rows.map(function (r) {
      return '<div class="detail-row"><span class="detail-row__icon" data-icon="' + r[0] + '"></span><div><dt>' + r[1] + '</dt><dd>' + r[2] + '</dd></div></div>';
    }).join("");
    if (connectLinks.length) {
      rowsHtml += '<div class="detail-row"><span class="detail-row__icon" data-icon="link"></span><div><dt>Connect</dt><dd><span class="detail-row__connect">' + connectLinks.join("") + '</span></dd></div></div>';
    }
    els.modalDetails.innerHTML = rowsHtml;
    els.modalRight.hidden = rows.length === 0 && connectLinks.length === 0 && !a.photoUrl;

    applyIcons(els.modalBackdrop);

    els.modalBackdrop.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    els.modalBackdrop.hidden = true;
    document.body.style.overflow = "";
  }

  // ---------------------------------------------------------------------
  // Utils
  // ---------------------------------------------------------------------
  function escapeHtml(s) {
    return (s || "").toString().replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }

  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  // ---------------------------------------------------------------------
  // Wire up
  // ---------------------------------------------------------------------
  function cacheEls() {
    els.map = document.getElementById("indiaMap");
    els.mapWrap = document.querySelector(".map-wrap");
    els.tooltip = document.getElementById("mapTooltip");
    els.resetMapBtn = document.getElementById("resetMapBtn");
    els.heroMap = document.getElementById("heroMap");
    els.statTotal = document.getElementById("statTotal");
    els.statStates = document.getElementById("statStates");
    els.statCities = document.getElementById("statCities");
    els.searchInput = document.getElementById("searchInput");
    els.searchClear = document.getElementById("searchClear");
    els.filterToggle = document.getElementById("filterToggle");
    els.filterPanel = document.getElementById("filterPanel");
    els.filterBadge = document.getElementById("filterBadge");
    els.filterClear = document.getElementById("filterClear");
    els.filterDone = document.getElementById("filterDone");
    els.filterSearchInput = document.getElementById("filterSearchInput");
    els.filterChips = document.getElementById("filterChips");
    els.stateFilterSearch = document.getElementById("stateFilterSearch");
    els.cityFilterSearch = document.getElementById("cityFilterSearch");
    els.stateChecklist = document.getElementById("stateChecklist");
    els.cityChecklist = document.getElementById("cityChecklist");
    els.cityGroupHint = document.getElementById("cityGroupHint");
    els.drillTitle = document.getElementById("drillTitle");
    els.drillMeta = document.getElementById("drillMeta");
    els.viewFullRosterBtn = document.getElementById("viewFullRosterBtn");
    els.cityChips = document.getElementById("cityChips");
    els.rosterGrid = document.getElementById("rosterGrid");
    els.loadMoreBtn = document.getElementById("loadMoreBtn");
    els.emptyState = document.getElementById("emptyState");
    els.syncBadge = document.getElementById("syncBadge");
    els.modalBackdrop = document.getElementById("modalBackdrop");
    els.modalClose = document.getElementById("modalClose");
    els.modalAvatar = document.getElementById("modalAvatar");
    els.modalName = document.getElementById("modalName");
    els.modalBrand = document.getElementById("modalBrand");
    els.modalCode = document.getElementById("modalCode");
    els.modalLoc = document.getElementById("modalLoc");
    els.modalAboutSection = document.getElementById("modalAboutSection");
    els.modalAboutLabel = document.getElementById("modalAboutLabel");
    els.modalProfile = document.getElementById("modalProfile");
    els.modalStats = document.getElementById("modalStats");
    els.modalSpecialtiesSection = document.getElementById("modalSpecialtiesSection");
    els.modalSpecialties = document.getElementById("modalSpecialties");
    els.modalViewProfile = document.getElementById("modalViewProfile");
    els.modalWhatsapp = document.getElementById("modalWhatsapp");
    els.modalRight = document.getElementById("modalRight");
    els.modalPhoto = document.getElementById("modalPhoto");
    els.modalDetails = document.getElementById("modalDetails");
  }

  function bindEvents() {
    els.resetMapBtn.addEventListener("click", resetMap);

    els.searchInput.addEventListener("input", debounce(function () {
      searchQuery = els.searchInput.value.trim();
      els.filterSearchInput.value = searchQuery;
      els.searchClear.hidden = !searchQuery;
      visibleCount = PAGE_SIZE;
      renderDrillView();
    }, 140));

    els.searchClear.addEventListener("click", function () {
      els.searchInput.value = "";
      els.filterSearchInput.value = "";
      searchQuery = "";
      els.searchClear.hidden = true;
      visibleCount = PAGE_SIZE;
      renderMap();
      renderDrillView();
    });

    els.filterToggle.addEventListener("click", toggleFilterPanel);
    els.filterDone.addEventListener("click", closeFilterPanel);
    els.filterClear.addEventListener("click", function () { clearAllFilters(false); });
    els.filterPanel.addEventListener("change", onFilterCheckboxChange);
    els.filterPanel.addEventListener("click", onFilterPanelClick);

    els.filterSearchInput.addEventListener("input", debounce(function () {
      searchQuery = els.filterSearchInput.value.trim();
      els.searchInput.value = searchQuery;
      els.searchClear.hidden = !searchQuery;
      visibleCount = PAGE_SIZE;
      renderDrillView();
    }, 140));

    els.stateFilterSearch.addEventListener("input", debounce(function () {
      stateFilterSearch = els.stateFilterSearch.value.trim();
      renderFilterChecklists();
    }, 100));
    els.cityFilterSearch.addEventListener("input", debounce(function () {
      cityFilterSearch = els.cityFilterSearch.value.trim();
      renderFilterChecklists();
    }, 100));

    document.addEventListener("mousedown", function (e) {
      if (els.filterPanel.hidden) return;
      if (els.filterPanel.contains(e.target) || els.filterToggle.contains(e.target)) return;
      closeFilterPanel();
    });

    els.viewFullRosterBtn.addEventListener("click", function () {
      visibleCount = ALL.length;
      renderRoster(ALL);
      window.scrollTo({ top: els.rosterGrid.getBoundingClientRect().top + window.scrollY - 100, behavior: "smooth" });
    });

    els.modalClose.addEventListener("click", closeModal);
    els.modalBackdrop.addEventListener("click", function (e) {
      if (e.target === els.modalBackdrop) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (!els.modalBackdrop.hidden) closeModal();
        else if (!els.filterPanel.hidden) closeFilterPanel();
      }
    });

    // Mobile Navigation Drawer Toggle
    var mobileMenuBtn = document.getElementById("mobileMenuBtn");
    var mobileNavDrawer = document.getElementById("mobileNavDrawer");
    if (mobileMenuBtn && mobileNavDrawer) {
      mobileMenuBtn.addEventListener("click", function () {
        var isOpen = !mobileNavDrawer.hidden;
        mobileNavDrawer.hidden = isOpen;
        mobileMenuBtn.setAttribute("aria-expanded", !isOpen);
      });

      var mobileLinks = mobileNavDrawer.querySelectorAll(".mobile-nav-link");
      mobileLinks.forEach(function (link) {
        link.addEventListener("click", function () {
          mobileNavDrawer.hidden = true;
          mobileMenuBtn.setAttribute("aria-expanded", "false");
        });
      });
    }

    // Category tabs
    var catTabs = document.querySelectorAll(".cat-tab");
    catTabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        catTabs.forEach(function (t) { t.classList.remove("is-active"); });
        tab.classList.add("is-active");
        var cat = tab.getAttribute("data-cat");
        if (cat === "all") {
          searchQuery = "";
        } else if (cat === "cloud") {
          searchQuery = "cloud";
        } else if (cat === "catering") {
          searchQuery = "catering";
        } else if (cat === "restaurant") {
          searchQuery = "restaurant";
        }
        applyFilterChange();
      });
    });

    // Sort control
    var sortSel = document.getElementById("sortSelect");
    if (sortSel) {
      sortSel.addEventListener("change", function () {
        var val = sortSel.value;
        if (val === "name_asc") {
          ALL.sort(function (a, b) { return a.name.localeCompare(b.name); });
        } else if (val === "name_desc") {
          ALL.sort(function (a, b) { return b.name.localeCompare(a.name); });
        } else if (val === "state") {
          ALL.sort(function (a, b) { return a.state.localeCompare(b.state); });
        }
        applyFilterChange();
      });
    }

    initRoiCalculator();
    window.addEventListener("resize", debounce(renderHeroMap, 200));
  }

  // ---------------------------------------------------------------------
  // Interactive In-App ROI Calculator
  // ---------------------------------------------------------------------
  function initRoiCalculator() {
    var inOrders = document.getElementById("inputOrders");
    var inTime = document.getElementById("inputTime");
    var inBill = document.getElementById("inputBill");
    var inStaff = document.getElementById("inputStaff");

    var vOrders = document.getElementById("valOrders");
    var vTime = document.getElementById("valTime");
    var vBill = document.getElementById("valBill");
    var vStaff = document.getElementById("valStaff");

    var resAnnual = document.getElementById("resAnnualSavings");
    var resPayback = document.getElementById("resPayback");
    var resEnergy = document.getElementById("resEnergySavings");
    var resTime = document.getElementById("resTimeSaved");
    var resNet = document.getElementById("resMonthlyNet");

    if (!inOrders || !inTime || !inBill || !inStaff) return;

    function formatINR(val) {
      return Math.round(val).toLocaleString("en-IN");
    }

    function calculate() {
      var orders = parseFloat(inOrders.value) || 150;
      var avgTime = parseFloat(inTime.value) || 20;
      var bill = parseFloat(inBill.value) || 25000;
      var staff = parseFloat(inStaff.value) || 3;

      if (vOrders) vOrders.textContent = orders;
      if (vTime) vTime.textContent = avgTime;
      if (vBill) vBill.textContent = formatINR(bill);
      if (vStaff) vStaff.textContent = staff;

      // On2Cook Saves:
      // 1. 70% Energy reduction
      var energySavingsMonthly = bill * 0.70;
      
      // 2. 50% Cooking time reduction
      // Total daily cooking mins saved = orders * avgTime * 0.50
      var dailyHoursSaved = (orders * avgTime * 0.50) / 60;
      
      // 3. Labor & throughput efficiency gain
      var laborGainMonthly = staff * 3500;
      
      var totalMonthlySavings = energySavingsMonthly + laborGainMonthly;
      var annualSavings = totalMonthlySavings * 12;
      
      // Typical On2Cook unit cost baseline = ₹1,25,000
      var paybackMonths = Math.max(1.8, Math.min(12, 125000 / totalMonthlySavings));

      if (resAnnual) resAnnual.textContent = formatINR(annualSavings);
      if (resPayback) resPayback.textContent = "~" + paybackMonths.toFixed(1) + " Months";
      if (resEnergy) resEnergy.textContent = "₹" + formatINR(energySavingsMonthly);
      if (resTime) resTime.textContent = Math.round(dailyHoursSaved) + " Hours";
      if (resNet) resNet.textContent = "₹" + formatINR(totalMonthlySavings);
    }

    [inOrders, inTime, inBill, inStaff].forEach(function (input) {
      input.addEventListener("input", calculate);
    });

    var presetBtns = document.querySelectorAll(".roi-preset-btn");
    presetBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        presetBtns.forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        inOrders.value = btn.getAttribute("data-orders");
        inTime.value = btn.getAttribute("data-time");
        inBill.value = btn.getAttribute("data-bill");
        inStaff.value = btn.getAttribute("data-staff");
        calculate();
      });
    });

    calculate();
  }

  document.addEventListener("DOMContentLoaded", function () {
    cacheEls();
    bindEvents();
    loadData().then(initFromPayload);
  });
})();
