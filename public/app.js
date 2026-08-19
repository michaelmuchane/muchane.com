// muchane.com — drawer menu and the cosmic-zoom navigation engine. Single
// file, no modules, no build step — this is the entire
// client-side enhancement layer. Every link it intercepts is a real <a href>
// that also works with JS disabled; this file only makes navigation zoom.

(function () {
    'use strict';

    var menuTrigger = document.querySelector('[data-testid="menu-trigger"]');
    var drawer = document.querySelector('[data-testid="overlay-menu"]');
    var workGroup = drawer ? drawer.querySelector('[data-testid="menu-group-work"]') : null;
    var workChildren = drawer ? drawer.querySelector('.drawer__children') : null;
    var contactBtn = drawer ? drawer.querySelector('[data-testid="menu-link-contact"]') : null;
    var headerEmail = document.querySelector('[data-testid="header-email"]');
    var headerContact = document.querySelector('.header__contact');
    var REDUCED = matchMedia('(prefers-reduced-motion: reduce)');

    /* DRAWER MENU */
    var isMenuOpen = false;

    function setMenu(open) {
        isMenuOpen = open;
        document.body.classList.toggle('drawer-open', open);
        if (menuTrigger) {
            menuTrigger.setAttribute('aria-expanded', String(open));
            menuTrigger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        }
        if (open && drawer) {
            var firstLink = drawer.querySelector('a');
            if (firstLink) firstLink.focus();
        }
    }

    if (menuTrigger) {
        menuTrigger.addEventListener('click', function () {
            setMenu(!isMenuOpen);
        });
    }
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isMenuOpen) {
            setMenu(false);
        }
    });

    /* WORK GROUP — collapsed on every load (state not persisted) */
    if (workGroup && workChildren) {
        workGroup.addEventListener('click', function () {
            var expanded = workGroup.getAttribute('aria-expanded') === 'true';
            workGroup.setAttribute('aria-expanded', String(!expanded));
            workChildren.hidden = expanded;
        });
    }

    /* CONTACT WAYFINDER — shared by the drawer's Contact item and the L0 hero's
       in-copy "get in touch" trigger (both are buttons; there is no /contact page):
       move focus to the first contact icon and pulse the group so the end state is
       never "nothing visible happened." A glow alone is useless to keyboard/screen-
       reader users — the focus move is the actual affordance. The header is
       position:sticky top:0, so it is always in the viewport; no scrolling needed. */
    function pulseContactLinks() {
        if (headerEmail) headerEmail.focus();
        if (!headerContact) return;

        if (REDUCED.matches) {
            headerContact.classList.add('is-pulse-static');
            var pulseMs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--contact-pulse')) || 2400;
            var cleared = false;
            var onFocusOut = function (e) {
                if (!headerContact.contains(e.relatedTarget)) clear();
            };
            function clear() {
                if (cleared) return;
                cleared = true;
                headerContact.classList.remove('is-pulse-static');
                headerContact.removeEventListener('focusout', onFocusOut);
            }
            headerContact.addEventListener('focusout', onFocusOut);
            setTimeout(clear, pulseMs);
        } else {
            headerContact.classList.remove('is-pulsing');
            void headerContact.offsetWidth; // restart the animation if re-triggered mid-pulse
            headerContact.classList.add('is-pulsing');
            headerContact.addEventListener('animationend', function handler() {
                headerContact.classList.remove('is-pulsing');
                headerContact.removeEventListener('animationend', handler);
            });
        }
    }

    if (contactBtn) {
        contactBtn.addEventListener('click', function () {
            setMenu(false);
            pulseContactLinks();
        });
    }

    /* HERO CONTACT TRIGGER — delegated on document (same pattern as the zoom
       engine's CLICK WIRING) because swapStage replaces #stage innerHTML on every
       client-side navigation; a per-element binding would die on the first zoom. */
    document.addEventListener('click', function (e) {
        if (e.target.closest('.hero__contact-trigger')) pulseContactLinks();
    });

    /* EMAIL COPY FALLBACK — a mailto silently no-ops for visitors with no OS
       mail client (most webmail users). Alongside the native mailto (never
       preventDefault'd — it must still fire for people who have a client),
       copy the address and confirm briefly with an "Address copied" note —
       but only if the page still has focus/visibility a moment later. If
       the mailto handoff to an external client succeeded, the OS moves
       focus away from this tab almost immediately; showing "Address
       copied" over an already-open compose window would read as a stray,
       unrelated action rather than the confirmation it's meant to be.
       Degrades silently to mailto-only when the Clipboard API is
       unavailable, permission is denied, or a client actually opened. */
    var EMAIL_COPY_FOCUS_CHECK_DELAY = 150;
    var EMAIL = 'michaelmuchane@gmail.com';
    if (headerEmail && headerContact) {
        var copyNote = null;
        var copyTimer = null;
        headerEmail.addEventListener('click', function () {
            if (!(navigator.clipboard && navigator.clipboard.writeText)) return;
            navigator.clipboard.writeText(EMAIL).then(function () {
                setTimeout(function () {
                    if (document.hidden || !document.hasFocus()) return; // a client opened; stay silent
                    if (!copyNote) {
                        copyNote = document.createElement('span');
                        copyNote.className = 'email-copied';
                        copyNote.setAttribute('data-testid', 'email-copied-note');
                        copyNote.setAttribute('role', 'status');
                        copyNote.textContent = 'Address copied';
                        headerContact.appendChild(copyNote);
                    }
                    clearTimeout(copyTimer);
                    copyNote.classList.add('is-visible');
                    var pulseMs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--copy-note')) || 900;
                    copyTimer = setTimeout(function () {
                        copyNote.classList.remove('is-visible');
                    }, pulseMs * 2);
                }, EMAIL_COPY_FOCUS_CHECK_DELAY);
            }).catch(function () { /* silent: the mailto already fired */ });
        });

        /* EMAIL UNFURL — persistent, selectable address; see DECISIONS.md.
           Unconditional on click: there is no way to detect a registered mail
           handler, so visitors WITH one see their client take focus over this. */
        var reveal = document.createElement('span');
        reveal.className = 'email-reveal';
        reveal.setAttribute('data-testid', 'header-email-reveal');
        reveal.setAttribute('aria-live', 'polite');
        reveal.tabIndex = 0;
        headerContact.insertBefore(reveal, headerEmail);
        var revealOpen = false;
        var revealClearTimer = null;
        function setReveal(open) {
            revealOpen = open;
            reveal.classList.toggle('is-open', open);
            clearTimeout(revealClearTimer);
            if (open) {
                reveal.textContent = EMAIL; // (re)assign AFTER opening: a mutation inside the now-visible polite region announces reliably
            } else {
                // visibility:hidden does not collapse the layout box while text
                // remains — clearing immediately would snap the clip-path
                // animation short, so wait for it to finish (0ms under reduced
                // motion, where there is no animation to protect). Guarded by
                // revealOpen in case a rapid re-open fires before this runs.
                var delay = REDUCED.matches ? 0 : (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--email-unfurl')) || 320);
                revealClearTimer = setTimeout(function () {
                    if (!revealOpen) reveal.textContent = '';
                }, delay);
            }
        }
        headerEmail.addEventListener('click', function () {
            if (!matchMedia('(min-width: 600px)').matches) return; // narrow treatment deferred to the mobile pass
            setReveal(!revealOpen); // second icon click toggles closed
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && revealOpen) setReveal(false);
        });
        document.addEventListener('click', function (e) {
            if (revealOpen && !headerContact.contains(e.target)) setReveal(false);
        });
    }

    /* ACTIVE SECTION — highlights the drawer link for the current top-level route.
       Exposed on window so the zoom engine (separate IIFE below) can call it from
       swapStage() after a client-side navigation. */
    function updateMenuActive(path) {
        if (!drawer) return;
        var section = '/' + (path.split('/').filter(Boolean)[0] || '');
        var links = drawer.querySelectorAll('a[data-testid^="menu-link-"]');
        links.forEach(function (link) {
            var href = link.getAttribute('href');
            if (href === section || (section === '/' && href === '/')) {
                link.setAttribute('aria-current', 'page');
            } else {
                link.removeAttribute('aria-current');
            }
        });
    }
    window.updateMenuActive = updateMenuActive;
    updateMenuActive(location.pathname);
})();

/* TELEMETRY STRIP — static placeholder now; a future n8n workflow will
   publish JSON this page fetches. Swapping the source touches only the
   renderTelemetry(TELEMETRY) call below — nothing else. */
var TELEMETRY = {
    left: 'MUCHANE CLOUD',
    metrics: '21 CONTAINERS \u00b7 47 COMMITS THIS MONTH \u00b7 LAST DEPLOY 6H AGO',
    right: 'AI PIPELINES',
};

function renderTelemetry(data) {
    Object.keys(data).forEach(function (key) {
        var el = document.querySelector('[data-telemetry="' + key + '"]');
        if (el) el.textContent = data[key];
    });
}

renderTelemetry(TELEMETRY);

/* ===================================================================
   COSMIC-ZOOM ENGINE
   Two absolutely-positioned layers, four WAAPI animations, validated
   parameters below — implemented exactly, not tuned.
   =================================================================== */
(function () {
    'use strict';

    var stage = document.getElementById('stage');
    if (!stage) return;

    var QUINT_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
    // Mathematical inverse of QUINT_OUT (ease-in: slow start, fast finish) —
    // used only for a chain's first push so it hands off to the second push
    // already at speed, instead of decelerating to a near-stop then
    // snapping back to full speed (the "stop-and-go" chain stutter).
    var QUINT_IN = 'cubic-bezier(0.64, 0, 0.78, 0)';
    var ZOOM = { scaleDur: 700, fadeDur: 434, delay: 196, scaleFar: 5, scaleNear: 0.86 };
    // second push = ZOOM x compress; gap ms between pushes; firstEase is a
    // literal CSS easing string applied ONLY to a chain's first push (scale
    // transforms only) — retune live via window.MOTION.CHAIN.firstEase.
    var CHAIN = { compress: 0.7, gap: 0, firstEase: QUINT_IN };
    window.MOTION = { ZOOM: ZOOM, CHAIN: CHAIN };     // devtools-live tuning; transitions read current values at start
    var REDUCED = matchMedia('(prefers-reduced-motion: reduce)');

    function scaledTiming(timing, factor) {
        return {
            scaleDur: Math.round(timing.scaleDur * factor),
            fadeDur: Math.round(timing.fadeDur * factor),
            delay: Math.round(timing.delay * factor),
            scaleFar: timing.scaleFar,
            scaleNear: timing.scaleNear,
        };
    }

    var pageCache = new Map();
    var changelogData = null;
    var changelogPromise = null;
    var inflight = false;
    var navGen = 0;        // bumped whenever a transition is superseded by popstate
    var activeAnims = [];  // WAAPI animations owned by the current transition only
    // Tracks the path currently rendered in #stage. Kept separate from
    // location.pathname because popstate fires AFTER the browser has
    // already updated location — by then location.pathname is the target,
    // not the page we're leaving, so it can't be used to find the outgoing
    // node on a fetched parent page's origin lookup.
    var currentPath = normalizePath(location.pathname);
    // Canonicalize the initial history entry — required, not cosmetic: nginx
    // serves a trailing-slash directory path (e.g. /daas-platform/) as a 200
    // with no redirect, so a hard load can leave the address bar and
    // history.state on a non-canonical URL. Authored hrefs are always
    // slash-less; without this, the up-link's one-entry back-shortcut
    // (history.state.from === href) and finalizeOut's origin lookups both
    // miss on a Back to this entry.
    if (currentPath !== location.pathname) {
        history.replaceState(history.state, '', currentPath + location.search + location.hash);
    }

    // Single normalization convention for a trailing-slash pathname (see the
    // currentPath comment above) — used at boot and by the popstate handler,
    // the only two sites that read location.pathname directly.
    function normalizePath(p) {
        return p.replace(/\/+$/, '') || '/';
    }

    function pathDepth(path) {
        return path.split('/').filter(Boolean).length;
    }

    async function loadPage(path) {
        path = path.split('#')[0];
        if (pageCache.has(path)) return pageCache.get(path);
        var res = await fetch(path);
        if (!res.ok) throw new Error('fetch failed: ' + res.status);
        var html = await res.text();
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var main = doc.querySelector('main#stage');
        if (!main) throw new Error('no #stage in fetched page');
        var data = {
            title: doc.title,
            mainHTML: main.innerHTML,
            depth: Number(main.dataset.depth || '0'),
            hasChangelog: main.querySelector('[data-changelog]') !== null,
        };
        pageCache.set(path, data);
        return data;
    }

    // CHANGELOG RENDERER — Muchane Cloud release entries. changelog.json is
    // fetched once per page load (cached promise) and rendered client-side
    // into every [data-changelog] container found in the current stage or
    // an about-to-animate-in zoom layer. `pages[key]` in the JSON is the
    // authoritative slug order for that container — never re-sorted here.
    function loadChangelog() {
        if (changelogData) return Promise.resolve(changelogData);
        if (!changelogPromise) {
            changelogPromise = fetch('/muchane-cloud/changelog.json?v=7')
                .then(function (res) {
                    if (!res.ok) throw new Error('changelog fetch failed: ' + res.status);
                    return res.json();
                })
                .then(function (data) {
                    changelogData = data;
                    return data;
                })
                .catch(function (e) {
                    changelogPromise = null;
                    throw e;
                });
        }
        return changelogPromise;
    }

    // Header height is read live rather than hardcoded — it lives in CSS
    // (--header-height) and this stays correct if that ever changes.
    function headerOffset() {
        var header = document.querySelector('.header');
        return (header ? header.offsetHeight : 80) + 16;
    }

    function hashScrollY(target) {
        return window.scrollY + target.getBoundingClientRect().top - headerOffset();
    }

    function buildEntryCard(entry, pageKey) {
        var isLink = entry.page !== pageKey;
        var root = document.createElement(isLink ? 'a' : 'article');
        root.className = 'entry' + (entry.compact ? ' entry--compact' : ' entry--interactive') + (isLink ? ' entry--link' : '');
        root.dataset.testid = isLink ? 'entry-link-' + entry.slug : 'entry-' + entry.slug;
        if (!isLink) root.id = entry.slug;
        if (isLink) {
            root.href = entry.page + '#' + entry.slug;
            root.setAttribute('data-zoom', 'in');
        }

        var head = document.createElement('span');
        head.className = 'entry__head';
        var title = document.createElement('span');
        title.className = 'entry__title';
        title.textContent = entry.title;
        var date = document.createElement('span');
        date.className = 'entry__date';
        date.dataset.testid = 'entry-date-' + entry.slug;
        date.textContent = entry.date_display;
        head.appendChild(title);
        head.appendChild(date);

        var summaryLine = document.createElement('span');
        summaryLine.className = 'entry__summary';
        summaryLine.textContent = entry.summary;

        var foot = document.createElement('span');
        foot.className = 'entry__foot';
        var tagsEl = document.createElement('span');
        tagsEl.className = 'entry__tags';
        tagsEl.dataset.testid = 'entry-tags-' + entry.slug;
        entry.tags.forEach(function (tag) {
            var tagEl = document.createElement('span');
            tagEl.className = 'entry__tag';
            tagEl.textContent = tag;
            tagsEl.appendChild(tagEl);
        });
        foot.appendChild(tagsEl);
        if (entry.metric) {
            var metricEl = document.createElement('span');
            metricEl.className = 'entry__metric';
            metricEl.dataset.testid = 'entry-metric-' + entry.slug;
            metricEl.textContent = entry.metric;
            foot.appendChild(metricEl);
        }

        if (isLink) {
            var faceLink = document.createElement('span');
            faceLink.className = 'entry__card';
            faceLink.appendChild(head);
            faceLink.appendChild(summaryLine);
            faceLink.appendChild(foot);
            var chevron = document.createElement('span');
            chevron.className = 'entry__more';
            chevron.setAttribute('aria-hidden', 'true');
            chevron.textContent = '\u203A';
            root.appendChild(faceLink);
            root.appendChild(chevron);
            return root;
        }

        if (entry.compact) {
            var faceDiv = document.createElement('div');
            faceDiv.className = 'entry__card';
            faceDiv.appendChild(head);
            faceDiv.appendChild(summaryLine);
            faceDiv.appendChild(foot);
            root.appendChild(faceDiv);
            return root;
        }

        var details = document.createElement('details');
        details.className = 'entry__details';
        details.dataset.testid = 'entry-details-' + entry.slug;

        var summaryEl = document.createElement('summary');
        summaryEl.className = 'entry__card';
        summaryEl.dataset.testid = 'entry-toggle-' + entry.slug;
        summaryEl.appendChild(head);
        summaryEl.appendChild(summaryLine);
        summaryEl.appendChild(foot);

        var body = document.createElement('div');
        body.className = 'entry__body';
        body.dataset.testid = 'entry-body-' + entry.slug;
        if (entry.sections.sequencing != null) {
            var seqLabel = document.createElement('h3');
            seqLabel.className = 'entry__label';
            seqLabel.textContent = 'Sequencing';
            var seqP = document.createElement('p');
            seqP.textContent = entry.sections.sequencing;
            body.appendChild(seqLabel);
            body.appendChild(seqP);
        }

        [['problem', 'Problem'], ['solution', 'Solution']].forEach(function (pair) {
            var label = document.createElement('h3');
            label.className = 'entry__label';
            label.textContent = pair[1];
            var p = document.createElement('p');
            p.textContent = entry.sections[pair[0]];
            body.appendChild(label);
            body.appendChild(p);
        });

        var implLabel = document.createElement('h3');
        implLabel.className = 'entry__label';
        implLabel.textContent = 'Implementation';
        var ul = document.createElement('ul');
        entry.sections.implementation.forEach(function (line) {
            var li = document.createElement('li');
            li.textContent = line;
            ul.appendChild(li);
        });
        body.appendChild(implLabel);
        body.appendChild(ul);

        var iterLabel = document.createElement('h3');
        iterLabel.className = 'entry__label';
        iterLabel.textContent = 'Iteration';
        var iterP = document.createElement('p');
        iterP.textContent = entry.sections.iteration;
        body.appendChild(iterLabel);
        body.appendChild(iterP);

        // A2: the screenshot embed ships now (testid present) but always
        // empty and hidden — zero visible output until captures exist.
        var shot = document.createElement('figure');
        shot.className = 'entry-shot is-hidden';
        shot.hidden = true;
        shot.setAttribute('aria-hidden', 'true');
        shot.dataset.testid = 'entry-shot-' + entry.slug;
        body.appendChild(shot);

        details.appendChild(summaryEl);
        details.appendChild(body);
        root.appendChild(details);
        return root;
    }

    function renderChangelogContainer(container, hash) {
        var pageKey = container.getAttribute('data-changelog');
        var listKey = container.getAttribute('data-changelog-list') || 'grid';
        var slugs = changelogData.pages[pageKey] && changelogData.pages[pageKey][listKey];
        if (!slugs) return;
        slugs.forEach(function (slug) {
            var entry = changelogData.entries[slug];
            if (!entry) return;
            container.appendChild(buildEntryCard(entry, pageKey));
        });
        if (hash) {
            var target = document.getElementById(hash);
            if (target && container.contains(target)) {
                var details = target.querySelector('.entry__details');
                if (details) details.open = true;
            }
        }
    }

    function renderChangelog(root, hash) {
        var containers = root.querySelectorAll('[data-changelog]');
        containers.forEach(function (container) {
            if (container.dataset.changelogRendered === 'true') return;
            container.dataset.changelogRendered = 'true';
            if (changelogData) {
                renderChangelogContainer(container, hash);
                return;
            }
            loadChangelog().then(function () {
                if (!container.isConnected) return;
                renderChangelogContainer(container, hash);
            }).catch(function () {
                var note = document.createElement('p');
                note.className = 'note';
                note.textContent = 'Release entries are unavailable right now.';
                container.appendChild(note);
            });
        });
    }

    function centerOrigin(el, relativeToEl) {
        var o = el.getBoundingClientRect();
        var s = relativeToEl.getBoundingClientRect();
        return (o.left + o.width / 2 - s.left) + 'px ' + (o.top + o.height / 2 - s.top) + 'px';
    }

    // html has global `scroll-behavior: smooth` (style.css), which makes a
    // plain window.scrollTo(x, y) animate — it does not apply synchronously,
    // and window.scrollY read right after calling it still reports the OLD
    // position. Toggling `documentElement.style.scrollBehavior` around the
    // call is NOT reliable: Chromium resolves scroll-behavior for an
    // in-flight scrollTo asynchronously (observed racing even a forced
    // layout flush placed between the call and reverting the override), so
    // an explicit `behavior: 'instant'` is used instead — per the WHATWG
    // CSSOM View spec, an explicit 'instant'/'smooth' behavior bypasses the
    // element's CSS scroll-behavior entirely; only unspecified/'auto'
    // consults it. This is the only call in this file that must be
    // synchronous; every other scroll on the page is free to stay smooth.
    function scrollToInstant(y) {
        window.scrollTo({ top: y, left: 0, behavior: 'instant' });
    }

    // Salvaged pattern 1 — char-split reveal (ported from the retired GSAP
    // ScrollTrigger version: rotateX -90, 0.02s stagger). One-shot per
    // heading (unobserve after firing, no reverse-on-scroll-up). Skipped
    // entirely under reduced motion — the heading renders as plain text.
    function bindRevealHeadings(root) {
        var headings = root.querySelectorAll('.reveal-heading:not([data-revealed])');
        headings.forEach(function (h) {
            h.dataset.revealed = 'true';
            if (REDUCED.matches) return;

            var text = h.textContent;
            h.setAttribute('aria-label', text);
            h.innerHTML = '';
            var chars = [];
            for (var i = 0; i < text.length; i++) {
                var span = document.createElement('span');
                span.className = 'char';
                span.setAttribute('aria-hidden', 'true');
                span.textContent = text[i] === ' ' ? '\u00A0' : text[i];
                span.style.opacity = '0';
                h.appendChild(span);
                chars.push(span);
            }

            var observer = new IntersectionObserver(function (entries, obs) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    chars.forEach(function (span, idx) {
                        span.animate(
                            [
                                { transform: 'translateY(50px) rotateX(-90deg)', opacity: 0 },
                                { transform: 'translateY(0) rotateX(0deg)', opacity: 1 },
                            ],
                            { duration: 800, easing: 'cubic-bezier(0.165, 0.84, 0.44, 1)', delay: idx * 20, fill: 'forwards' }
                        );
                    });
                    obs.unobserve(entry.target);
                });
            }, { threshold: 0.2 });
            observer.observe(h);
        });
    }

    // Salvaged pattern 2 — parallax hover (ported from the retired GSAP
    // mousemove version: 0.1 follow factor). Mouse-only, skipped under
    // reduced motion, applied to .node__inner (a CHILD of <a class="node__card">)
    // so the zoom-origin rect measured off the card link itself stays stable.
    function bindParallaxNodes(root) {
        if (!matchMedia('(hover: hover)').matches) return;
        var inners = root.querySelectorAll('.constellation .node__inner');
        inners.forEach(function (inner) {
            if (inner.dataset.parallaxBound === 'true') return;
            inner.dataset.parallaxBound = 'true';
            var node = inner.parentElement;
            node.addEventListener('mousemove', function (e) {
                if (REDUCED.matches) return;
                var rect = node.getBoundingClientRect();
                var dx = (e.clientX - (rect.left + rect.width / 2)) * 0.1;
                var dy = (e.clientY - (rect.top + rect.height / 2)) * 0.1;
                // 0.3s tracking ease vs 0.5s spring-back on leave — matches the
                // retired GSAP version's two durations (both power2.out), not a
                // single uniform duration for both directions.
                inner.style.transitionDuration = '0.3s';
                inner.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
            });
            node.addEventListener('mouseleave', function () {
                inner.style.transitionDuration = '0.5s';
                inner.style.transform = '';
            });
        });
    }

    // Side-flip binder for satellite hover teasers: every satellite orbits
    // through the bottom run of its rect, where an above-anchored teaser
    // would cover the parent card for roughly a third of each revolution.
    // Measured at reveal (mouseenter/focusin) rather than via a discrete
    // CSS keyframe swap — the orbit is paused while hovered/focused, so the
    // measurement can't go stale mid-hover, and it works identically under
    // reduced motion (measures the static rest position).
    function bindSatelliteTeasers(root) {
        var sats = root.querySelectorAll('.node__satellite');
        sats.forEach(function (sat) {
            if (sat.dataset.teaserBound === 'true') return;
            sat.dataset.teaserBound = 'true';
            var update = function () {
                var card = sat.closest('.node').querySelector('.node__card');
                var satRect = sat.getBoundingClientRect();
                var cardRect = card.getBoundingClientRect();
                var satCenterY = satRect.top + satRect.height / 2;
                var cardCenterY = cardRect.top + cardRect.height / 2;
                // ties within +/-2px keep the above anchor
                if (satCenterY - cardCenterY > 2) {
                    sat.classList.add('teaser-below');
                } else {
                    sat.classList.remove('teaser-below');
                }
                // Horizontal viewport clamp: the teaser is centered on the pill
                // (left: 50%, translateX(-50%)) inside a scaled transform context,
                // and the pill itself can sit near either viewport edge at some
                // orbit phases — edge-anchoring (a horizontal analog of
                // teaser-below) is insufficient here because some pills already
                // clip the viewport themselves (see DECISIONS.md), so a teaser
                // anchored to any pill edge would still overflow. Measured at
                // reveal, same rationale as the vertical flip above.
                var teaser = sat.querySelector('.satellite__teaser');
                if (teaser) {
                    teaser.style.transform = '';
                    var tr = teaser.getBoundingClientRect();
                    var cw = document.documentElement.clientWidth;
                    var dx = 0;
                    if (tr.left < 8) {
                        dx = 8 - tr.left;
                    } else if (tr.right > cw - 8) {
                        dx = (cw - 8) - tr.right;
                    }
                    if (dx) {
                        teaser.style.transform = 'translateX(calc(-50% + ' + dx.toFixed(2) +
                            'px)) scale(calc(1 / var(--constellation-scale)))';
                    }
                }
            };
            sat.addEventListener('mouseenter', update);
            sat.addEventListener('focusin', update);
        });
    }

    // Stop-card footer counts (narrow timeline layout): derived from the
    // satellite elements so the hidden satellites stay the single source of
    // truth. With JS off the count span stays empty and the footer reads as
    // just "OPEN ›" — the card is a real link either way.
    function bindStopFooters(root) {
        root.querySelectorAll('.constellation .node').forEach(function (node) {
            var slot = node.querySelector('.node__count');
            if (!slot) return;
            var count = node.querySelectorAll('.node__satellite').length;
            if (!count) return;
            slot.textContent = count + ' ' + (slot.dataset.noun || '') + (count === 1 ? '' : 'S');
        });
    }

    function swapStage(url, data, push) {
        stage.classList.remove('is-zooming');
        stage.style.minHeight = '';
        stage.innerHTML = data.mainHTML;
        stage.dataset.depth = String(data.depth);
        document.body.dataset.depth = String(data.depth);
        document.title = data.title;
        if (push) {
            history.pushState({ via: 'zoom', depth: data.depth, from: currentPath }, '', url);
        }
        stage.focus({ preventScroll: true });
        currentPath = url.split('#')[0];
        bindRevealHeadings(stage);
        bindParallaxNodes(stage);
        bindSatelliteTeasers(stage);
        bindStopFooters(stage);
        bindIndexedStars(stage);
        renderChangelog(stage, location.hash.slice(1));
        if (window.updateMenuActive) window.updateMenuActive(url);
    }

    function finalizeIn(url, data, push) {
        swapStage(url, data, push);
        var hashIdx = url.indexOf('#');
        var target = hashIdx >= 0 ? document.getElementById(url.slice(hashIdx + 1)) : null;
        if (target) {
            scrollToInstant(Math.max(0, hashScrollY(target)));
        } else {
            scrollToInstant(0);
        }
    }

    function finalizeOut(url, data, push) {
        var leavingPath = currentPath;
        swapStage(url, data, push);
        var liveOrigin = stage.querySelector('[href="' + leavingPath + '"], [href^="' + leavingPath + '#"]');
        if (liveOrigin) {
            var rect = liveOrigin.getBoundingClientRect();
            var y = window.scrollY + rect.top - window.innerHeight / 2 + rect.height / 2;
            scrollToInstant(Math.max(0, y));
        } else {
            scrollToInstant(0);
        }
    }

    function buildAnimations(outLayer, inLayer, direction, timing, easing) {
        // direction: 'in' mirrors the click-through zoom; 'out' reverses it.
        timing = timing || ZOOM;
        easing = easing || QUINT_OUT;
        var outFrom = direction === 'in' ? 1 : 1;
        var outTo = direction === 'in' ? timing.scaleFar : timing.scaleNear;
        var inFrom = direction === 'in' ? timing.scaleNear : timing.scaleFar;
        return [
            outLayer.animate(
                [{ transform: 'scale(' + outFrom + ')' }, { transform: 'scale(' + outTo + ')' }],
                { duration: timing.scaleDur, easing: easing, fill: 'forwards' }
            ),
            outLayer.animate(
                [{ opacity: 1 }, { opacity: 0 }],
                { duration: timing.fadeDur, easing: 'linear', fill: 'forwards' }
            ),
            inLayer.animate(
                [{ transform: 'scale(' + inFrom + ')' }, { transform: 'scale(1)' }],
                { duration: timing.scaleDur, easing: easing, delay: timing.delay, fill: 'forwards' }
            ),
            inLayer.animate(
                [{ opacity: 0 }, { opacity: 1 }],
                { duration: timing.fadeDur, easing: 'linear', delay: timing.delay, fill: 'forwards' }
            ),
        ];
    }

    async function zoomIn(url, originEl, push, timing, easing) {
        if (push === undefined) push = true;
        if (inflight) return;
        inflight = true;
        var gen = ++navGen;
        var path = url.split('#')[0];
        var hash = url.indexOf('#') >= 0 ? url.slice(url.indexOf('#') + 1) : '';

        try {
            var data;
            try {
                data = await loadPage(path);
            } catch (e) {
                if (gen === navGen) location.href = url;
                return;
            }
            if (gen !== navGen) return;
            if (data.hasChangelog) {
                try { await loadChangelog(); } catch (e) { /* renderer shows its own fallback note */ }
            }

            if (REDUCED.matches) {
                finalizeIn(url, data, push);
                return;
            }

            var origin = centerOrigin(originEl, stage);

            // Freeze the document height before pulling content out of
            // flow: moving children into the outgoing layer collapses
            // #stage to its base min-height, which can shrink the document
            // below the current scroll position and force the browser to
            // silently clamp scrollY — a jump indistinguishable from the
            // settle bug this pass already fixed, just at the other end of
            // the transition. swapStage (called by finalizeIn) clears this.
            stage.style.minHeight = stage.offsetHeight + 'px';

            var outLayer = document.createElement('div');
            outLayer.className = 'zoom-layer zoom-layer--out';
            outLayer.style.transformOrigin = origin;
            while (stage.firstChild) outLayer.appendChild(stage.firstChild);

            var inLayer = document.createElement('div');
            inLayer.className = 'zoom-layer zoom-layer--in';
            inLayer.style.transformOrigin = origin;
            inLayer.style.opacity = '0';
            inLayer.innerHTML = data.mainHTML;
            renderChangelog(inLayer, hash);

            stage.classList.add('is-zooming');
            stage.appendChild(outLayer);
            stage.appendChild(inLayer);

            activeAnims = buildAnimations(outLayer, inLayer, 'in', timing, easing);
            await Promise.allSettled(activeAnims.map(function (a) { return a.finished; }));
            if (gen !== navGen) return;
            activeAnims = [];

            finalizeIn(url, data, push);
        } finally {
            if (gen === navGen) inflight = false;
        }
    }

    async function zoomOut(url, push) {
        if (push === undefined) push = true;
        if (inflight) return;
        inflight = true;
        var gen = ++navGen;

        try {
            var data;
            try {
                data = await loadPage(url);
            } catch (e) {
                if (gen === navGen) location.href = url;
                return;
            }
            if (gen !== navGen) return;

            if (REDUCED.matches) {
                finalizeOut(url, data, push);   // hard swap + anchor scroll, unchanged
                return;
            }

            var leavingPath = currentPath;
            var outScroll = window.scrollY;

            // Capture the outgoing content before the swap.
            var outLayer = document.createElement('div');
            outLayer.className = 'zoom-layer zoom-layer--out';
            while (stage.firstChild) outLayer.appendChild(stage.firstChild);

            // Commit the incoming page AND its final scroll position now —
            // nothing scrolls after the animation, so there is no settle.
            swapStage(url, data, push);
            var liveOrigin = stage.querySelector('[href="' + leavingPath + '"], [href^="' + leavingPath + '#"]');
            if (liveOrigin) {
                var rect = liveOrigin.getBoundingClientRect();
                scrollToInstant(Math.max(0, window.scrollY + rect.top - window.innerHeight / 2 + rect.height / 2));
            } else {
                scrollToInstant(0);
            }

            // Freeze the document height before pulling content out of flow:
            // wrapping the children into absolute layers would otherwise collapse
            // the stage to min-height:100vh, shrink the document, and let the
            // browser clamp the scroll position we just committed.
            stage.style.minHeight = stage.offsetHeight + 'px';

            // Wrap the committed content in the incoming animation layer.
            var inLayer = document.createElement('div');
            inLayer.className = 'zoom-layer zoom-layer--in';
            while (stage.firstChild) inLayer.appendChild(stage.firstChild);
            inLayer.style.opacity = '0';

            stage.classList.add('is-zooming');
            stage.appendChild(outLayer);
            stage.appendChild(inLayer);

            // Keep the outgoing pixels where they were on screen despite the
            // scroll jump: shift the out layer by the scroll delta.
            outLayer.style.top = (window.scrollY - outScroll) + 'px';

            // Both origins name the SAME viewport point (the origin node's live
            // centre), each expressed in its own layer's coordinate space.
            inLayer.style.transformOrigin = liveOrigin ? centerOrigin(liveOrigin, inLayer) : '50% 50%';
            outLayer.style.transformOrigin = liveOrigin ? centerOrigin(liveOrigin, outLayer) : '50% 50%';

            activeAnims = buildAnimations(outLayer, inLayer, 'out');
            await Promise.allSettled(activeAnims.map(function (a) { return a.finished; }));
            if (gen !== navGen) return;
            activeAnims = [];

            // Unwrap in place — element identity preserved (reveal/parallax
            // bindings from swapStage stay live), scroll untouched.
            while (inLayer.firstChild) stage.appendChild(inLayer.firstChild);
            outLayer.remove();
            inLayer.remove();
            stage.classList.remove('is-zooming');
            stage.style.minHeight = '';
        } finally {
            if (gen === navGen) inflight = false;
        }
    }

    // Satellite click = two camera pushes (L0 -> parent node -> child page).
    // Both pages are prefetched before the first push starts (zero mid-chain
    // network stall, since zoomIn's own loadPage call then hits the cache).
    // The second push is compressed (CHAIN.compress) so the full chain reads
    // faster than two full-speed pushes back to back. Overlapping pushes are
    // rejected: the second push must measure its origin in the finalized L1
    // DOM, and nesting un-finalized zoom layers has no defined visual.
    // VELOCITY HANDOFF: the first push uses CHAIN.firstEase (default
    // QUINT_IN — slow start, fast finish) instead of QUINT_OUT so it hands
    // off to the second push already at speed, rather than decelerating to
    // a near-stop then snapping back to full speed at push 2's fast start —
    // that snap read as a full stop regardless of CHAIN.gap. The second
    // push stays QUINT_OUT so the chain still settles at the end.
    async function chainZoom(childUrl, satelliteEl) {
        if (inflight) return;
        var parentUrl = '/' + childUrl.split('/')[1];

        try {
            await Promise.all([loadPage(parentUrl), loadPage(childUrl)]);
        } catch (e) {
            console.warn('chainZoom: prefetch failed for "' + childUrl + '", falling back to hard navigation', e);
            location.href = childUrl;
            return;
        }

        var origin1 = satelliteEl.closest('.node').querySelector('.node__card');
        await zoomIn(parentUrl, origin1, true, undefined, CHAIN.firstEase);

        var gen = navGen;
        // popstate preempted between pushes — user's back wins
        if (location.pathname !== parentUrl) return;

        var origin2 = stage.querySelector('a[href="' + childUrl + '"], a[href^="' + childUrl + '#"]');
        if (!origin2) {
            console.warn('chainZoom: no origin anchor for "' + childUrl + '" on ' + parentUrl + ', falling back to hard navigation');
            location.href = childUrl;
            return;
        }

        if (CHAIN.gap) {
            await new Promise(function (r) { setTimeout(r, CHAIN.gap); });
            if (navGen !== gen) return;
        }

        await zoomIn(childUrl, origin2, true, scaledTiming(ZOOM, CHAIN.compress));
    }

    // INDEXED BACKGROUND STARS — state lives at module scope (not inside
    // bindIndexedStars) so repeat visits to L0 don't accumulate duplicate
    // document/window listeners, and every call resets stale DOM references
    // from whatever page was previously in #stage.
    var activeStar = null;
    var activeNode = null;
    var starsGloballyBound = false;

    function clearActiveStar() {
        if (activeStar) {
            activeStar.classList.remove('is-active');
            activeStar.setAttribute('aria-pressed', 'false');
        }
        if (activeNode) activeNode.classList.remove('node--flagged');
        var link = document.querySelector('[data-testid="indexed-star-link"]');
        if (link) link.classList.remove('is-visible');
        activeStar = null;
        activeNode = null;
    }

    function activateStar(star) {
        var node = stage.querySelector('[data-testid="' + star.dataset.starTarget + '"]');
        if (!node) return;
        if (activeStar === star) {
            clearActiveStar();
            return;
        }
        clearActiveStar();
        star.classList.add('is-active');
        star.setAttribute('aria-pressed', 'true');
        node.classList.add('node--flagged');
        activeStar = star;
        activeNode = node;

        var link = document.querySelector('[data-testid="indexed-star-link"]');
        var lineEl = link ? link.querySelector('line') : null;
        if (link && lineEl) {
            var stageRect = stage.getBoundingClientRect();
            var dotRect = star.querySelector('.istar__dot').getBoundingClientRect();
            var nodeRect = node.getBoundingClientRect();
            lineEl.setAttribute('x1', dotRect.x + dotRect.width / 2 - stageRect.x);
            lineEl.setAttribute('y1', dotRect.y + dotRect.height / 2 - stageRect.y);
            lineEl.setAttribute('x2', nodeRect.x + nodeRect.width / 2 - stageRect.x);
            lineEl.setAttribute('y2', nodeRect.y + nodeRect.height / 2 - stageRect.y);
            link.classList.add('is-visible');
        }
    }

    function bindIndexedStars(root) {
        activeStar = null;
        activeNode = null;
        var stars = root.querySelectorAll('.istar');
        stars.forEach(function (star) {
            star.addEventListener('click', function () { activateStar(star); });
        });

        if (!starsGloballyBound) {
            starsGloballyBound = true;
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && activeStar) clearActiveStar();
            });
            window.addEventListener('resize', function () {
                if (activeStar) clearActiveStar();
            });
        }
    }

    /* CLICK WIRING */
    document.addEventListener('click', function (e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var link = e.target.closest('a[data-zoom]');
        if (!link) return;
        e.preventDefault();
        var href = link.getAttribute('href');

        if (link.dataset.zoom === 'in') {
            zoomIn(href, link);
        } else if (link.dataset.zoom === 'out') {
            if (inflight) return;
            if (history.state && history.state.via === 'zoom' && history.state.from === href) {
                // One history entry per zoom level: back() lets popstate
                // animate and keeps the stack from growing on every click.
                // `from` must match this link's target — swapStage stamps it
                // on EVERY push (zoom-in and zoom-out alike), so without this
                // check a deep-load-then-zoom-out page's up-link would take
                // the back() shortcut into the child it just left instead of
                // its real parent.
                history.back();
            } else {
                zoomOut(href);
            }
        } else if (link.dataset.zoom === 'chain') {
            chainZoom(href, link);
        } else if (link.dataset.zoom === 'home') {
            if (location.pathname === '/') return;   // wordmark is display:none at L0; guard kept as defense against a stale or unset depth attribute
            if (inflight) return;
            if (history.state && history.state.via === 'zoom' && history.state.from === '/') {
                history.back();                       // same one-entry shortcut as the up-link above
            } else if (Number(stage.dataset.depth || '0') === 1) {
                zoomOut('/');                         // animated single-level return; zoomOut has its own REDUCED branch
            } else {
                loadPage('/').then(function (data) {  // depth >= 2: the popstate multi-level recipe below, plus push
                    finalizeIn('/', data, true);
                }).catch(function () { location.href = '/'; });
            }
        }
    });

    /* POPSTATE — back/forward */
    history.replaceState({ via: 'load', depth: Number(stage.dataset.depth || '0') }, '');

    window.addEventListener('popstate', function () {
        var path = normalizePath(location.pathname);
        var target = path + location.hash;
        var targetDepth = pathDepth(path);
        var currentDepth = Number(stage.dataset.depth || '0');

        if (inflight) {
            // Click-storm / rapid-popstate escape hatch: invalidate the
            // in-flight transition (bump navGen) so it can never finalize —
            // and therefore never pushState — behind the URL the browser
            // already committed to. Only the current transition's own
            // animations are cancelled, never every animation in the
            // document (that would also abort in-flight reveal-heading /
            // menu transitions elsewhere on the page).
            var gen = ++navGen;
            activeAnims.forEach(function (a) { a.cancel(); });
            activeAnims = [];
            loadPage(target).then(function (data) {
                if (gen !== navGen) return;
                swapStage(target, data, false);
                scrollToInstant(0);
                inflight = false;
            }).catch(function () {
                inflight = false;
                location.href = target;
            });
            return;
        }

        var delta = targetDepth - currentDepth;

        if (delta === -1) {
            zoomOut(target, false);
        } else if (delta === 1) {
            var originLink = stage.querySelector('a[href="' + target + '"]');
            if (originLink) {
                zoomIn(target, originLink, false);
            } else {
                loadPage(target).then(function (data) {
                    finalizeIn(target, data, false);
                }).catch(function () {
                    location.href = target;
                });
            }
        } else {
            // Multi-level jump (e.g. a long-press history gesture) — the
            // four-animation zoom is only defined for single-level moves.
            loadPage(target).then(function (data) {
                finalizeIn(target, data, false);
            }).catch(function () {
                location.href = target;
            });
        }
    });

    bindRevealHeadings(stage);
    bindParallaxNodes(stage);
    bindSatelliteTeasers(stage);
    bindStopFooters(stage);
    bindIndexedStars(stage);

    // Initial direct load of a changelog page: render immediately (fetch
    // kicks off inside renderChangelog if not cached yet) and, if the URL
    // carries a hash, chase the render to scroll once the target exists —
    // a native anchor-scroll can't reach content that isn't in the DOM yet.
    if (stage.querySelector('[data-changelog]')) {
        var initialHash = location.hash.slice(1);
        renderChangelog(stage, initialHash);
        if (initialHash) {
            loadChangelog().then(function () {
                var target = document.getElementById(initialHash);
                if (target) scrollToInstant(Math.max(0, hashScrollY(target)));
            }).catch(function () {});
        }
    }
})();
