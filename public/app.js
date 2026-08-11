// muchane.com — theme toggle, overlay menu, and the cosmic-zoom navigation
// engine. Single file, no modules, no build step — this is the entire
// client-side enhancement layer. Every link it intercepts is a real <a href>
// that also works with JS disabled; this file only makes navigation zoom.

(function () {
    'use strict';

    var htmlRoot = document.documentElement;
    var themeToggle = document.querySelector('[data-testid="theme-toggle"]');
    var menuTrigger = document.querySelector('[data-testid="menu-trigger"]');
    var overlayMenu = document.querySelector('[data-testid="overlay-menu"]');
    var menuClose = overlayMenu ? overlayMenu.querySelector('[data-testid="overlay-menu-close"]') : null;

    /* THEME TOGGLE */
    if (themeToggle) {
        themeToggle.addEventListener('click', function () {
            htmlRoot.classList.toggle('light-mode');
            var theme = htmlRoot.classList.contains('light-mode') ? 'light' : 'dark';
            try {
                localStorage.setItem('theme', theme);
            } catch (e) {
                /* localStorage unavailable (private mode) — theme just won't persist */
            }
        });
    }

    /* OVERLAY MENU */
    var isMenuOpen = false;

    function setMenu(open) {
        isMenuOpen = open;
        if (overlayMenu) {
            overlayMenu.classList.toggle('is-open', open);
        }
        if (menuTrigger) {
            menuTrigger.setAttribute('aria-expanded', String(open));
        }
        if (open && overlayMenu) {
            var firstLink = overlayMenu.querySelector('a');
            if (firstLink) firstLink.focus();
        }
    }

    if (menuTrigger) {
        menuTrigger.addEventListener('click', function () {
            setMenu(!isMenuOpen);
        });
    }
    if (menuClose) {
        menuClose.addEventListener('click', function () {
            setMenu(false);
        });
    }
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isMenuOpen) {
            setMenu(false);
        }
    });
})();

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
    var ZOOM = { scaleDur: 700, fadeDur: 434, delay: 196, scaleFar: 5, scaleNear: 0.86 };
    var REDUCED = matchMedia('(prefers-reduced-motion: reduce)');

    var pageCache = new Map();
    var inflight = false;
    var navGen = 0;        // bumped whenever a transition is superseded by popstate
    var activeAnims = [];  // WAAPI animations owned by the current transition only
    // Tracks the path currently rendered in #stage. Kept separate from
    // location.pathname because popstate fires AFTER the browser has
    // already updated location — by then location.pathname is the target,
    // not the page we're leaving, so it can't be used to find the outgoing
    // node on a fetched parent page's origin lookup.
    var currentPath = location.pathname;

    function pathDepth(path) {
        return path.split('/').filter(Boolean).length;
    }

    async function loadPage(path) {
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
        };
        pageCache.set(path, data);
        return data;
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
    // reduced motion, applied to .node__inner (a CHILD of the <a class="node">)
    // so the zoom-origin rect measured off the <a> itself stays stable.
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

    function swapStage(url, data, push) {
        stage.classList.remove('is-zooming');
        stage.style.minHeight = '';
        stage.innerHTML = data.mainHTML;
        stage.dataset.depth = String(data.depth);
        document.title = data.title;
        if (push) {
            history.pushState({ via: 'zoom', depth: data.depth, from: currentPath }, '', url);
        }
        stage.focus({ preventScroll: true });
        currentPath = url;
        bindRevealHeadings(stage);
        bindParallaxNodes(stage);
    }

    function finalizeIn(url, data, push) {
        swapStage(url, data, push);
        scrollToInstant(0);
    }

    function finalizeOut(url, data, push) {
        var leavingPath = currentPath;
        swapStage(url, data, push);
        var liveOrigin = stage.querySelector('[href="' + leavingPath + '"]');
        if (liveOrigin) {
            var rect = liveOrigin.getBoundingClientRect();
            var y = window.scrollY + rect.top - window.innerHeight / 2 + rect.height / 2;
            scrollToInstant(Math.max(0, y));
        } else {
            scrollToInstant(0);
        }
    }

    function buildAnimations(outLayer, inLayer, direction) {
        // direction: 'in' mirrors the click-through zoom; 'out' reverses it.
        var outFrom = direction === 'in' ? 1 : 1;
        var outTo = direction === 'in' ? ZOOM.scaleFar : ZOOM.scaleNear;
        var inFrom = direction === 'in' ? ZOOM.scaleNear : ZOOM.scaleFar;
        return [
            outLayer.animate(
                [{ transform: 'scale(' + outFrom + ')' }, { transform: 'scale(' + outTo + ')' }],
                { duration: ZOOM.scaleDur, easing: QUINT_OUT, fill: 'forwards' }
            ),
            outLayer.animate(
                [{ opacity: 1 }, { opacity: 0 }],
                { duration: ZOOM.fadeDur, easing: 'linear', fill: 'forwards' }
            ),
            inLayer.animate(
                [{ transform: 'scale(' + inFrom + ')' }, { transform: 'scale(1)' }],
                { duration: ZOOM.scaleDur, easing: QUINT_OUT, delay: ZOOM.delay, fill: 'forwards' }
            ),
            inLayer.animate(
                [{ opacity: 0 }, { opacity: 1 }],
                { duration: ZOOM.fadeDur, easing: 'linear', delay: ZOOM.delay, fill: 'forwards' }
            ),
        ];
    }

    async function zoomIn(url, originEl, push) {
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

            stage.classList.add('is-zooming');
            stage.appendChild(outLayer);
            stage.appendChild(inLayer);

            activeAnims = buildAnimations(outLayer, inLayer, 'in');
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
            var liveOrigin = stage.querySelector('[href="' + leavingPath + '"]');
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
        }
    });

    /* POPSTATE — back/forward */
    history.replaceState({ via: 'load', depth: Number(stage.dataset.depth || '0') }, '');

    window.addEventListener('popstate', function () {
        var target = location.pathname;
        var targetDepth = pathDepth(target);
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
})();
