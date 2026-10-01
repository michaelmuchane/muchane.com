// muchane.com: resume-link attribution. Strips ?r=<code> from the address bar on
// every load and, for a valid code, sends ONE same-origin beacon on the first real
// (trusted) interaction so the backend can tell a person from a link scanner. No
// cookies, no storage, nothing fingerprinted, nothing sent anywhere but
// /r/<code>/engaged. Honors Global Privacy Control and Do Not Track. Single file.
(function () {
    'use strict';

    var CODE_RE = /^[a-hjkmnp-z2-9]{8}$/;
    var search = location.search;
    var raw = null;
    var found = false;
    var kept = [];
    var parts = search.replace(/^\?/, '').split('&');
    for (var i = 0; i < parts.length; i++) {
        var seg = parts[i];
        if (seg === '') continue;
        var eq = seg.indexOf('=');
        var key = eq === -1 ? seg : seg.slice(0, eq);
        if (key === 'r') {
            found = true;
            if (raw === null && eq !== -1) raw = seg.slice(eq + 1);
            continue;
        }
        kept.push(seg);            // other params stay byte-exact (no URLSearchParams re-encoding)
    }
    if (!found) return;            // no r key: leave the URL and history untouched
    var clean = location.pathname + (kept.length ? '?' + kept.join('&') : '') + location.hash;
    // Pass history.state through: app.js already stamped { via: 'load', depth } and
    // its popstate/back-shortcut logic reads it. Replacing with null would break them.
    history.replaceState(history.state, '', clean);

    var code = null;
    try { code = decodeURIComponent(raw || ''); } catch (e) { return; }
    if (!CODE_RE.test(code)) return;
    if (navigator.globalPrivacyControl === true || navigator.doNotTrack === '1') return;

    var url = '/r/' + code + '/engaged';
    var sent = false;
    var OPTS = { passive: true, capture: true };   // capture: element scrolls don't bubble
    function send(e) {
        if (sent || !e.isTrusted) return;          // synthetic dispatchEvent() must not count
        sent = true;
        window.removeEventListener('pointerdown', send, OPTS);
        window.removeEventListener('scroll', send, OPTS);
        window.removeEventListener('keydown', send, OPTS);
        var ok = false;
        if (navigator.sendBeacon) {
            try { ok = navigator.sendBeacon(url); } catch (err) { ok = false; }
        }
        if (!ok && window.fetch) {
            fetch(url, { method: 'POST', keepalive: true }).catch(function () {});
        }
    }
    window.addEventListener('pointerdown', send, OPTS);
    window.addEventListener('scroll', send, OPTS);
    window.addEventListener('keydown', send, OPTS);
})();
