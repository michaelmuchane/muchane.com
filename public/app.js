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

    // Populated during content transcription: currently no-ops. Called
    // after every stage swap (initial load included via the bottom-of-file
    // call) so fetched pages get the same enhancements as a hard load.
    function bindRevealHeadings(root) {}
    function bindParallaxNodes(root) {}

    function swapStage(url, data, push) {
        stage.classList.remove('is-zooming');
        stage.innerHTML = data.mainHTML;
        stage.dataset.depth = String(data.depth);
        document.title = data.title;
        if (push) {
            history.pushState({ via: 'zoom', depth: data.depth }, '', url);
        }
        stage.focus({ preventScroll: true });
        currentPath = url;
        bindRevealHeadings(stage);
        bindParallaxNodes(stage);
    }

    function finalizeIn(url, data, push) {
        swapStage(url, data, push);
        window.scrollTo(0, 0);
    }

    function finalizeOut(url, data, push) {
        var leavingPath = currentPath;
        swapStage(url, data, push);
        var liveOrigin = stage.querySelector('[href="' + leavingPath + '"]');
        if (liveOrigin) {
            var rect = liveOrigin.getBoundingClientRect();
            var y = window.scrollY + rect.top - window.innerHeight / 2 + rect.height / 2;
            window.scrollTo(0, Math.max(0, y));
        } else {
            window.scrollTo(0, 0);
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

        var data;
        try {
            data = await loadPage(url);
        } catch (e) {
            inflight = false;
            location.href = url;
            return;
        }

        if (REDUCED.matches) {
            finalizeIn(url, data, push);
            inflight = false;
            return;
        }

        var origin = centerOrigin(originEl, stage);

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

        var anims = buildAnimations(outLayer, inLayer, 'in');
        await Promise.allSettled(anims.map(function (a) { return a.finished; }));

        finalizeIn(url, data, push);
        inflight = false;
    }

    async function zoomOut(url, push) {
        if (push === undefined) push = true;
        if (inflight) return;
        inflight = true;

        var data;
        try {
            data = await loadPage(url);
        } catch (e) {
            inflight = false;
            location.href = url;
            return;
        }

        if (REDUCED.matches) {
            finalizeOut(url, data, push);
            inflight = false;
            return;
        }

        var outLayer = document.createElement('div');
        outLayer.className = 'zoom-layer zoom-layer--out';
        while (stage.firstChild) outLayer.appendChild(stage.firstChild);

        var inLayer = document.createElement('div');
        inLayer.className = 'zoom-layer zoom-layer--in';
        inLayer.style.visibility = 'hidden';
        inLayer.style.height = '100vh';
        inLayer.style.overflow = 'hidden';
        inLayer.innerHTML = data.mainHTML;

        stage.classList.add('is-zooming');
        stage.appendChild(outLayer);
        stage.appendChild(inLayer);

        // Origin lookup is scoped to the incoming LAYER, never `document` —
        // the overlay menu (in <header>, before <main> in DOM order) links
        // to the same five L1 routes, and a document-scoped query would
        // match that hidden offscreen menu link instead of the real node.
        var originNode = inLayer.querySelector('[href="' + currentPath + '"]');

        if (data.depth === 0 && originNode) {
            var layerRect = inLayer.getBoundingClientRect();
            var nodeRect = originNode.getBoundingClientRect();
            var nodeTopInLayer = nodeRect.top - layerRect.top + inLayer.scrollTop;
            inLayer.scrollTop = Math.max(0, nodeTopInLayer - inLayer.clientHeight / 2 + nodeRect.height / 2);
        }

        var origin = originNode ? centerOrigin(originNode, inLayer) : '50% 50%';
        outLayer.style.transformOrigin = origin;
        inLayer.style.transformOrigin = origin;
        inLayer.style.visibility = '';
        inLayer.style.opacity = '0';

        var anims = buildAnimations(outLayer, inLayer, 'out');
        await Promise.allSettled(anims.map(function (a) { return a.finished; }));

        finalizeOut(url, data, push);
        inflight = false;
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
            if (history.state && history.state.via === 'zoom') {
                // One history entry per zoom level: back() lets popstate
                // animate and keeps the stack from growing on every click.
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
            // Click-storm / rapid-popstate escape hatch: cancel whatever is
            // running and hard-swap straight to the URL the browser already
            // committed to, rather than layering a second transition.
            document.getAnimations().forEach(function (a) { a.cancel(); });
            inflight = false;
            loadPage(target).then(function (data) {
                swapStage(target, data, false);
                window.scrollTo(0, 0);
            }).catch(function () {
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
