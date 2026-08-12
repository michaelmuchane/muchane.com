// muchane.com — canvas starfield backdrop. Purely additive: no dependency on
// app.js, no changes to routing/history/zoom. Renders behind all content on
// every route via #starfield (position:fixed, z-index:0, pointer-events:none
// — see style.css). Single file, no modules, no build step, no remote origin.

(function () {
    'use strict';

    var canvas = document.getElementById('starfield');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    // TUNING — retune here only; values chosen against a denser mock and WILL
    // change after Michael sees them against the real constellation. Do not
    // adjust unilaterally.
    var TUNING = {
        count: 1200,        // stars drawn
        maxSize: 3.5,       // px radius ceiling (before layer size multiplier)
        ceiling: 0.80,      // global alpha ceiling
        drift: 2.0,         // px/s base drift
        parallax: 1.00,     // mouse parallax strength
        twinkleRate: 1.05,  // twinkle oscillation speed
        twinkleDepth: 0.50, // how deep twinkle dims
        glow: 0.40          // sprite halo expansion
    };

    var LAYERS = [
        { depth: 0.26, size: 0.48, alpha: 0.32 },
        { depth: 0.58, size: 0.72, alpha: 0.58 },
        { depth: 1.00, size: 1.00, alpha: 1.00 }
    ];
    // Layer index per pool slot, repeating — any prefix of the pool keeps the
    // same depth distribution.
    var MIX = [0, 1, 0, 0, 2, 0, 1, 0, 0, 1, 0, 2, 0, 1, 0, 0, 1, 0, 2, 1];

    /* STAR POOL — built once at load */
    var stars = [];
    (function buildPool() {
        for (var i = 0; i < TUNING.count; i++) {
            var layer = LAYERS[MIX[i % MIX.length]];
            stars.push({
                fx: Math.random(),
                fy: Math.random(),
                r: 0.35 + Math.random() * 0.65,
                a: layer.alpha * (0.45 + Math.random() * 0.55),
                tw: Math.random() < 0.45,
                ph: Math.random() * Math.PI * 2,
                sp: 0.55 + Math.random() * 0.9,
                layer: layer
            });
        }
    })();

    /* GLOW SPRITES — pre-rendered once. Never shadowBlur per star in the draw
       loop; that is far more expensive than drawImage of a cached sprite. */
    function makeSprite(stops) {
        var s = document.createElement('canvas');
        s.width = 64;
        s.height = 64;
        var sctx = s.getContext('2d');
        var grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        for (var i = 0; i < stops.length; i++) {
            grad.addColorStop(stops[i][0], stops[i][1]);
        }
        sctx.fillStyle = grad;
        sctx.fillRect(0, 0, 64, 64);
        return s;
    }

    // Bright star: near-white, very slightly cool. Dark-only site — no
    // theme branching, single sprite.
    var sprite = makeSprite([
        [0, 'rgba(238,242,250,1)'],
        [0.16, 'rgba(238,242,250,0.92)'],
        [0.42, 'rgba(232,238,250,0.22)'],
        [0.72, 'rgba(228,236,250,0.05)'],
        [1, 'rgba(228,236,250,0)']
    ]);

    /* SIZING */
    var w = 0, h = 0, dpr = 1;

    function resize() {
        w = window.innerWidth;
        h = window.innerHeight;
        dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (REDUCED.matches) draw(t);
    }

    /* MOUSE PARALLAX — eased toward target, never applied raw. */
    var mouse = { x: 0, y: 0 };
    var target = { x: 0, y: 0 };

    window.addEventListener('mousemove', function (e) {
        target.x = (e.clientX / window.innerWidth) * 2 - 1;
        target.y = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });

    /* REDUCED MOTION — static render, still visible, no drift/twinkle/parallax. */
    var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

    /* DRAW */
    var t = 0;

    function draw(time) {
        ctx.clearRect(0, 0, w, h);
        var mx = REDUCED.matches ? 0 : mouse.x;
        var my = REDUCED.matches ? 0 : mouse.y;
        for (var i = 0; i < stars.length; i++) {
            var star = stars[i];
            var L = star.layer;
            var x = star.fx * w + time * TUNING.drift * 3.2 * L.depth + mx * -TUNING.parallax * 18 * L.depth;
            var y = star.fy * h + time * TUNING.drift * 1.1 * L.depth + my * -TUNING.parallax * 18 * L.depth;
            x = ((x % w) + w) % w;
            y = ((y % h) + h) % h;

            var a = star.a * TUNING.ceiling;
            if (star.tw && !REDUCED.matches) {
                var osc = 0.5 + 0.5 * Math.sin(time * TUNING.twinkleRate * star.sp + star.ph);
                a *= 1 - TUNING.twinkleDepth * (1 - osc);
            }
            if (a < 0.012) continue;

            var rad = star.r * TUNING.maxSize * L.size;
            var d = rad * (1 + TUNING.glow * 2.2) * 2;
            ctx.globalAlpha = Math.min(a, 1);
            ctx.drawImage(sprite, x - d / 2, y - d / 2, d, d);
        }
        ctx.globalAlpha = 1;
    }

    /* LOOP CONTROL — single rAF loop; static mode idles it entirely. */
    var rafId = null;
    var last = null;

    function frame(now) {
        if (last === null) last = now;
        var dt = (now - last) / 1000;
        if (dt > 0.1) dt = 0.1; // guard against a drift jump after a tab switch
        last = now;

        mouse.x += (target.x - mouse.x) * Math.min(1, dt * 4);
        mouse.y += (target.y - mouse.y) * Math.min(1, dt * 4);
        t += dt;

        draw(t);
        rafId = requestAnimationFrame(frame);
    }

    function startLoop() {
        if (rafId !== null) return;
        last = null;
        rafId = requestAnimationFrame(frame);
    }

    function stopLoop() {
        if (rafId === null) return;
        cancelAnimationFrame(rafId);
        rafId = null;
    }

    function syncMotionMode() {
        if (REDUCED.matches) {
            stopLoop();
            mouse.x = mouse.y = target.x = target.y = 0;
            draw(t);
        } else {
            startLoop();
        }
    }

    if (typeof REDUCED.addEventListener === 'function') {
        REDUCED.addEventListener('change', syncMotionMode);
    } else if (typeof REDUCED.addListener === 'function') {
        // Safari < 14 fallback.
        REDUCED.addListener(syncMotionMode);
    }

    window.addEventListener('resize', resize);

    resize();
    syncMotionMode();
})();
