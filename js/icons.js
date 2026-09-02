/*
 * On2Cook Ambassador Network — icons.js
 * A small hand-drawn, generic-shape icon set (not traced from any icon
 * library) so the whole portal works fully offline with no external font
 * or CDN dependency. Icons are plain stroke-based SVGs themed via
 * `currentColor`, injected into any element carrying a data-icon attribute.
 */

(function () {
  "use strict";

  var S = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';

  var ICONS = {
    search: '<svg viewBox="0 0 20 20" ' + S + '><circle cx="9" cy="9" r="6.2"/><line x1="13.6" y1="13.6" x2="18" y2="18"/></svg>',

    close: '<svg viewBox="0 0 20 20" ' + S + '><line x1="5" y1="5" x2="15" y2="15"/><line x1="15" y1="5" x2="5" y2="15"/></svg>',

    sliders: '<svg viewBox="0 0 20 20" ' + S + '><line x1="3" y1="6" x2="17" y2="6"/><line x1="3" y1="10" x2="17" y2="10"/><line x1="3" y1="14" x2="17" y2="14"/><circle cx="7" cy="6" r="1.6" fill="currentColor" stroke="none"/><circle cx="13" cy="10" r="1.6" fill="currentColor" stroke="none"/><circle cx="9" cy="14" r="1.6" fill="currentColor" stroke="none"/></svg>',

    users: '<svg viewBox="0 0 20 20" ' + S + '><circle cx="7.2" cy="6.5" r="2.8"/><path d="M2.2 16.5c0-3 2.2-5 5-5s5 2 5 5"/><circle cx="14.2" cy="7.2" r="2.2"/><path d="M12.7 11.8c2.1.2 3.8 1.9 4 4.2"/></svg>',

    usersCircle: '<svg viewBox="0 0 20 20" ' + S + '><circle cx="7.2" cy="6.5" r="2.8"/><path d="M2.2 16.5c0-3 2.2-5 5-5s5 2 5 5"/><circle cx="14.2" cy="7.2" r="2.2"/><path d="M12.7 11.8c2.1.2 3.8 1.9 4 4.2"/></svg>',

    pin: '<svg viewBox="0 0 20 20" ' + S + '><path d="M10 18s6-5.7 6-10.2A6 6 0 0 0 4 7.8C4 12.3 10 18 10 18z"/><circle cx="10" cy="7.6" r="2.1"/></svg>',

    building: '<svg viewBox="0 0 20 20" ' + S + '><rect x="4" y="3" width="8" height="15" rx="0.6"/><rect x="12" y="8" width="4.5" height="10" rx="0.6"/><line x1="6.3" y1="6" x2="6.3" y2="6"/><line x1="9.3" y1="6" x2="9.3" y2="6"/><line x1="6.3" y1="9" x2="6.3" y2="9"/><line x1="9.3" y1="9" x2="9.3" y2="9"/><line x1="6.3" y1="12" x2="6.3" y2="12"/><line x1="9.3" y1="12" x2="9.3" y2="12"/></svg>',

    arrowRight: '<svg viewBox="0 0 20 20" ' + S + '><line x1="3" y1="10" x2="16" y2="10"/><polyline points="11,5 16,10 11,15"/></svg>',

    chevronDown: '<svg viewBox="0 0 20 20" ' + S + '><polyline points="5,7.5 10,12.5 15,7.5"/></svg>',

    externalLink: '<svg viewBox="0 0 20 20" ' + S + '><path d="M8 4H4.8A1.8 1.8 0 0 0 3 5.8v9.4A1.8 1.8 0 0 0 4.8 17h9.4A1.8 1.8 0 0 0 16 15.2V12"/><path d="M11 3h6v6"/><line x1="9.3" y1="10.7" x2="17" y2="3"/></svg>',

    info: '<svg viewBox="0 0 20 20" ' + S + '><circle cx="10" cy="10" r="7.2"/><line x1="10" y1="9" x2="10" y2="14"/><line x1="10" y1="6.3" x2="10" y2="6.3"/></svg>',

    user: '<svg viewBox="0 0 20 20" ' + S + '><circle cx="10" cy="6.8" r="3.3"/><path d="M3.5 17c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/></svg>',

    chat: '<svg viewBox="0 0 20 20" ' + S + '><path d="M3 9.8a6.8 6.8 0 1 1 3 5.6L3 17l1.4-3.2A6.7 6.7 0 0 1 3 9.8z"/></svg>',

    phone: '<svg viewBox="0 0 20 20" ' + S + '><path d="M4.5 3.2h2.6l1.1 3.4-1.7 1.3a10.4 10.4 0 0 0 4.6 4.6l1.3-1.7 3.4 1.1v2.6c0 1-.8 1.7-1.7 1.6A14.6 14.6 0 0 1 2.9 4.9c-.1-.9.6-1.7 1.6-1.7z"/></svg>',

    image: '<svg viewBox="0 0 20 20" ' + S + '><rect x="2.5" y="4" width="15" height="12" rx="1"/><circle cx="7" cy="8.3" r="1.4"/><path d="M17.5 13.5l-4.3-4.3a1.5 1.5 0 0 0-2.1 0L2.5 16.5"/></svg>',

    star: '<svg viewBox="0 0 20 20" fill="currentColor" stroke="none"><path d="M10 1.8l2.5 5.3 5.7.6-4.3 3.9 1.2 5.6L10 14.4l-5.1 2.8 1.2-5.6-4.3-3.9 5.7-.6z"/></svg>',

    home: '<svg viewBox="0 0 20 20" ' + S + '><path d="M3 9.5L10 3l7 6.5"/><path d="M5 8v8.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8"/></svg>',

    clock: '<svg viewBox="0 0 20 20" ' + S + '><circle cx="10" cy="10" r="7.3"/><polyline points="10,5.8 10,10 13.2,12"/></svg>',

    truck: '<svg viewBox="0 0 20 20" ' + S + '><rect x="1.8" y="6" width="9.5" height="8" rx="0.6"/><path d="M11.3 9h3.6l2.3 2.6V14h-5.9"/><circle cx="5.2" cy="15.3" r="1.6"/><circle cx="13.8" cy="15.3" r="1.6"/></svg>',

    layers: '<svg viewBox="0 0 20 20" ' + S + '><polygon points="10,2.5 18,7 10,11.5 2,7"/><polyline points="2,11 10,15.5 18,11"/><polyline points="2,15 10,19.5 18,15"/></svg>',

    link: '<svg viewBox="0 0 20 20" ' + S + '><path d="M8.3 11.7a3 3 0 0 0 4.3.2l2.3-2.3a3 3 0 0 0-4.2-4.2l-1.3 1.2"/><path d="M11.7 8.3a3 3 0 0 0-4.3-.2L5.1 10.4a3 3 0 0 0 4.2 4.2l1.3-1.2"/></svg>',

    badgeCheck: '<svg viewBox="0 0 20 20" fill="currentColor" stroke="none"><circle cx="10" cy="10" r="8.5"/><path d="M6.3 10.2l2.3 2.3 4.6-4.9" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  function applyIcons(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll("[data-icon]");
    Array.prototype.forEach.call(nodes, function (el) {
      var name = el.getAttribute("data-icon");
      if (ICONS[name] && !el.dataset.iconApplied) {
        el.innerHTML = ICONS[name];
        el.dataset.iconApplied = "1";
      }
    });
  }

  window.ON2COOK_ICONS = ICONS;
  window.applyIcons = applyIcons;

  document.addEventListener("DOMContentLoaded", function () { applyIcons(document); });
})();
