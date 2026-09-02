/**
 * On2Cook Ambassador Network — sheet-service.js
 * Real-time Dynamic Google Sheets Sync Service
 * 
 * Fetches and parses live data from Google Sheets API endpoint:
 * https://docs.google.com/spreadsheets/d/1-tC3jTDQ38pwmVBQUBLr0vJoqW2eRRcuIQUnZJvZhAg/gviz/tq?tqx=out:json
 */

(function () {
  "use strict";

  var GOOGLE_SHEET_ID = "1-tC3jTDQ38pwmVBQUBLr0vJoqW2eRRcuIQUnZJvZhAg";
  var GVIZ_URL = "https://docs.google.com/spreadsheets/d/" + GOOGLE_SHEET_ID + "/gviz/tq?tqx=out:json&headers=1";
  var CSV_FALLBACK_URL = "https://docs.google.com/spreadsheets/d/" + GOOGLE_SHEET_ID + "/export?format=csv&gid=0";
  var CACHE_KEY = "on2cook_ambassadors_cache_v2";
  var CACHE_TIME_KEY = "on2cook_ambassadors_cache_time_v2";
  var CACHE_TTL_MS = 60 * 1000; // 1 minute client-side cache

  // State Normalization Mapping (India States & UTs)
  var STATE_ALIASES = {
    "andaman and nicobar islands": "an", "andaman & nicobar islands": "an", "andaman and nicobar": "an", "andaman": "an",
    "andhra pradesh": "ap", "andhra": "ap",
    "arunachal pradesh": "ar", "arunachal": "ar",
    "assam": "as",
    "bihar": "br",
    "chandigarh": "ch",
    "chhattisgarh": "ct", "chattisgarh": "ct",
    "dadra and nagar haveli": "dn", "dadra & nagar haveli": "dn",
    "daman and diu": "dd", "daman & diu": "dd",
    "dadra and nagar haveli and daman and diu": "dn",
    "delhi": "dl", "nct of delhi": "dl", "new delhi": "dl", "delhi ncr": "dl",
    "goa": "ga",
    "gujarat": "gj", "gujrat": "gj",
    "haryana": "hr",
    "himachal pradesh": "hp", "himachal": "hp",
    "jammu and kashmir": "jk", "jammu & kashmir": "jk", "j&k": "jk", "kashmir": "jk",
    "jharkhand": "jh",
    "karnataka": "ka",
    "kerala": "kl",
    "ladakh": "la",
    "lakshadweep": "ld",
    "madhya pradesh": "mp", "mp": "mp",
    "maharashtra": "mh", "maharastra": "mh",
    "manipur": "mn",
    "meghalaya": "ml",
    "mizoram": "mz",
    "nagaland": "nl",
    "odisha": "or", "orissa": "or",
    "puducherry": "py", "pondicherry": "py",
    "punjab": "pb",
    "rajasthan": "rj",
    "sikkim": "sk",
    "tamil nadu": "tn", "tamilnadu": "tn", "tamil nadu ": "tn",
    "telangana": "tg", "hyderabad": "tg",
    "tripura": "tr",
    "uttar pradesh": "up", "up": "up",
    "uttarakhand": "ut", "uttaranchal": "ut",
    "west bengal": "wb", "bengal": "wb"
  };

  function normText(str) {
    return (str || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
  }

  function cleanVal(val) {
    if (val === null || val === undefined) return "";
    var s = String(val).trim();
    if (s === "—" || s === "-" || s.toUpperCase() === "NA" || s.toUpperCase() === "N/A" || s.toLowerCase() === "null") {
      return "";
    }
    return s;
  }

  function cleanPhone(phone) {
    if (!phone) return "";
    var raw = String(phone).replace(/[^\d+]/g, "");
    if (raw.length === 10 && !raw.startsWith("91")) {
      return "91" + raw;
    }
    if (raw.startsWith("+")) {
      return raw.replace("+", "");
    }
    return raw;
  }

  function stateIdFor(stateName) {
    if (!stateName) return null;
    return STATE_ALIASES[normText(stateName)] || null;
  }

  /**
   * Parse Google Visualization JSON response
   */
  function parseGvizResponse(rawText) {
    var jsonStr = rawText;
    var startIdx = rawText.indexOf("{");
    var endIdx = rawText.lastIndexOf("}");
    if (startIdx !== -1 && endIdx !== -1) {
      jsonStr = rawText.substring(startIdx, endIdx + 1);
    }
    var data = JSON.parse(jsonStr);
    if (!data.table || !data.table.rows) {
      throw new Error("Invalid Google Sheets table format");
    }

    var cols = (data.table.cols || []).map(function (c, idx) {
      return {
        idx: idx,
        id: c.id,
        label: normText(c.label || "")
      };
    });

    // Helper to find column index by keyword
    function findCol(keywords) {
      for (var i = 0; i < cols.length; i++) {
        for (var k = 0; k < keywords.length; k++) {
          if (cols[i].label.indexOf(keywords[k]) !== -1) return i;
        }
      }
      return -1;
    }

    var colSr = findCol(["sr", "no", "serial", "id"]);
    var colName = findCol(["name", "ambassador name", "chef", "contact person"]);
    var colBrand = findCol(["brand", "company", "outlet", "restaurant", "kitchen name"]);
    var colBilling = findCol(["billing", "legal name", "entity"]);
    var colCode = findCol(["code", "ambassador code", "referral"]);
    var colCity = findCol(["city", "location", "town"]);
    var colState = findCol(["state", "region", "province"]);
    var colPhone = findCol(["contact", "phone", "mobile", "number", "tel"]);
    var colEmail = findCol(["email", "e-mail", "mail"]);
    var colProfile = findCol(["profile", "designation", "role", "title", "about"]);
    var colInsta = findCol(["instagram", "insta", "ig"]);
    var colWa = findCol(["whatsapp", "wa"]);
    var colSpecs = findCol(["special", "specialities", "cuisine", "tags"]);
    var colSince = findCol(["since", "operational", "established", "year"]);
    var colOwner = findCol(["owner", "assigned", "lead"]);

    // If header row was treated as row[0], detect and shift
    var rows = data.table.rows;
    var ambassadors = [];

    rows.forEach(function (row, rowIdx) {
      if (!row || !row.c) return;
      var c = row.c;

      function getCell(idx) {
        if (idx === -1 || !c[idx]) return "";
        return cleanVal(c[idx].f !== undefined ? c[idx].f : c[idx].v);
      }

      var name = getCell(colName !== -1 ? colName : 1);
      var brand = getCell(colBrand !== -1 ? colBrand : 2);
      var code = getCell(colCode !== -1 ? colCode : 4);
      var city = getCell(colCity !== -1 ? colCity : 5);
      var state = getCell(colState !== -1 ? colState : 6);

      // Skip empty or header rows
      if (!name && !brand && !code) return;
      if (normText(name) === "name" && normText(brand) === "brand name") return;

      var srNo = parseInt(getCell(colSr !== -1 ? colSr : 0), 10) || (rowIdx + 1);
      var billing = getCell(colBilling !== -1 ? colBilling : 3);
      var phone = cleanPhone(getCell(colPhone !== -1 ? colPhone : 7));
      var email = getCell(colEmail !== -1 ? colEmail : 8);
      var profile = getCell(colProfile !== -1 ? colProfile : 9);
      var insta = getCell(colInsta !== -1 ? colInsta : 10);
      var wa = cleanPhone(getCell(colWa !== -1 ? colWa : 11)) || phone;
      var specs = getCell(colSpecs !== -1 ? colSpecs : 12);
      var since = getCell(colSince !== -1 ? colSince : 13);
      var owner = getCell(colOwner !== -1 ? colOwner : 14);

      // Generate a fallback clean code if absent
      if (!code && name) {
        var cleanCodeName = name.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase();
        code = "O2C" + (cleanCodeName || "AMB") + (srNo < 10 ? "0" + srNo : srNo);
      }

      ambassadors.push({
        srNo: srNo,
        name: name || "On2Cook Partner",
        brandName: brand,
        billingName: billing,
        code: code,
        city: city || "India",
        state: state || "India",
        phone: phone,
        email: email,
        profile: profile || (brand ? "Ambassador at " + brand : "Culinary Ambassador"),
        instagram: insta,
        whatsapp: wa,
        specialties: specs,
        operationalSince: since,
        ambassadorOwner: owner,
        stateId: stateIdFor(state)
      });
    });

    return {
      _meta: {
        syncedAt: new Date().toISOString(),
        source: "Google Sheets Live",
        count: ambassadors.length,
        isLive: true
      },
      ambassadors: ambassadors
    };
  }

  /**
   * Main sheet fetcher with timeout and fallback support
   */
  function fetchSheetData(forceRefresh) {
    // Check local storage cache if not force refreshed
    if (!forceRefresh) {
      try {
        var cachedTime = localStorage.getItem(CACHE_TIME_KEY);
        var cachedData = localStorage.getItem(CACHE_KEY);
        if (cachedTime && cachedData && (Date.now() - parseInt(cachedTime, 10) < CACHE_TTL_MS)) {
          var parsed = JSON.parse(cachedData);
          if (parsed && parsed.ambassadors && parsed.ambassadors.length > 0) {
            parsed._meta.isCached = true;
            return Promise.resolve(parsed);
          }
        }
      } catch (e) {
        console.warn("Storage cache read failed:", e);
      }
    }

    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timeoutId = controller ? setTimeout(function () { controller.abort(); }, 9000) : null;

    var fetchOpts = {
      cache: "no-store",
      signal: controller ? controller.signal : undefined
    };

    return fetch(GVIZ_URL + "&_t=" + Date.now(), fetchOpts)
      .then(function (res) {
        if (timeoutId) clearTimeout(timeoutId);
        if (!res.ok) throw new Error("HTTP error " + res.status);
        return res.text();
      })
      .then(function (text) {
        var payload = parseGvizResponse(text);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
          localStorage.setItem(CACHE_TIME_KEY, String(Date.now()));
        } catch (e) {}
        return payload;
      })
      .catch(function (err) {
        if (timeoutId) clearTimeout(timeoutId);
        console.warn("Live Google Sheets fetch failed, checking fallbacks:", err.message);

        // Try local storage cache even if expired
        try {
          var stale = localStorage.getItem(CACHE_KEY);
          if (stale) {
            var p = JSON.parse(stale);
            p._meta.source = "Local Offline Cache";
            p._meta.isLive = false;
            return p;
          }
        } catch (e) {}

        // Fallback to inlined dataset
        if (window.AMBASSADORS_FALLBACK) {
          var fallback = JSON.parse(JSON.stringify(window.AMBASSADORS_FALLBACK));
          fallback._meta.isLive = false;
          fallback._meta.source = "Bundled Dataset";
          return fallback;
        }

        throw err;
      });
  }

  window.On2CookSheetService = {
    fetchSheetData: fetchSheetData,
    stateIdFor: stateIdFor,
    normText: normText
  };
})();
