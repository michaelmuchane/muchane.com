// muchane.com — cursor trail (WEB-1, Claude Design option 2e "Tether").
// Draws a comet tail that follows the pointer, on starfield.js's own rAF
// loop via window.starfieldLoop.onFrame (see starfield.js, LOOP CONTROL).
// Never a second loop. Colors come from the :root tokens every frame, so a
// future theme change needs no re-init here. Single file, no modules, no
// build step, no remote origin.

(function () {
    'use strict';

    if (!window.starfieldLoop) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    var starCanvas = document.getElementById('starfield');
    if (!starCanvas) return;

    // TUNING - from the Tether mockup; do not adjust unilaterally.
    var LIFE = 400;
    var MAX_LEN = 110;
    var W_MIN = 0.3;
    var W_MAX = 2;
    var W_SPEED = 1;
    var TAPER = 1.4;
    var ALPHA = 0.9;
    var ALPHA_EXP = 1.6;
    var LERP = 0.5;
    var R0 = 12;
    var RK = 8;
    var HALO_A = 1;
    var REST = 0.55;
    var WHITE_HEAD = 0.75;
    var SPEED_NORM = 1800;
    var CAP = 128;
    var MIX_STEPS = 32;

    /* STATE — all preallocated; nothing below is created again per frame. */
    var px = new Float32Array(CAP);
    var py = new Float32Array(CAP);
    var pt = new Float64Array(CAP);
    var start = 0, count = 0;

    var x = 0, y = 0, fx = 0, fy = 0, vx = 0, vy = 0;
    var inside = false;
    var hx = 0, hy = 0, hasHead = false;
    var g = 0;
    var last = 0;

    var MIX = new Array(MIX_STEPS + 1);
    var HEAD = 'rgb(237,237,237)';
    var halo = null;
    var lastAccent = '', lastText = '';
    // Defaults = current tokens; used only if a token fails to parse.
    var accentRGB = [176, 127, 255];
    var textRGB = [237, 237, 237];
    var rootStyle = getComputedStyle(document.documentElement);

    function parseHex(str, into) {
        if (typeof str !== 'string') return;
        var s = str.trim();
        var r, g2, b;
        if (s.length === 4 && s[0] === '#') {
            r = parseInt(s[1] + s[1], 16);
            g2 = parseInt(s[2] + s[2], 16);
            b = parseInt(s[3] + s[3], 16);
        } else if (s.length === 7 && s[0] === '#') {
            r = parseInt(s.slice(1, 3), 16);
            g2 = parseInt(s.slice(3, 5), 16);
            b = parseInt(s.slice(5, 7), 16);
        } else {
            return;
        }
        if (isNaN(r) || isNaN(g2) || isNaN(b)) return;
        into[0] = r; into[1] = g2; into[2] = b;
    }

    function rebuildPalette() {
        parseHex(lastAccent, accentRGB);
        parseHex(lastText, textRGB);
        for (var i = 0; i <= MIX_STEPS; i++) {
            var f = i / MIX_STEPS;
            var r = Math.round(accentRGB[0] + (textRGB[0] - accentRGB[0]) * f);
            var gg = Math.round(accentRGB[1] + (textRGB[1] - accentRGB[1]) * f);
            var b = Math.round(accentRGB[2] + (textRGB[2] - accentRGB[2]) * f);
            MIX[i] = 'rgb(' + r + ',' + gg + ',' + b + ')';
        }
        HEAD = 'rgb(' + textRGB[0] + ',' + textRGB[1] + ',' + textRGB[2] + ')';
        // Halo sprite: same technique as starfield's makeSprite, duplicated
        // locally because that helper is IIFE-private and the shared surface
        // stays loop-only.
        halo = document.createElement('canvas');
        halo.width = 64;
        halo.height = 64;
        var hctx = halo.getContext('2d');
        var grad = hctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(' + textRGB[0] + ',' + textRGB[1] + ',' + textRGB[2] + ',0.8)');
        grad.addColorStop(0.2, 'rgba(' + accentRGB[0] + ',' + accentRGB[1] + ',' + accentRGB[2] + ',0.38)');
        grad.addColorStop(1, 'rgba(' + accentRGB[0] + ',' + accentRGB[1] + ',' + accentRGB[2] + ',0)');
        hctx.fillStyle = grad;
        hctx.fillRect(0, 0, 64, 64);
    }

    // The two string reads below are the only per-frame allocation;
    // everything drawn comes from the prebuilt palette and sprite, so a
    // token change (any future theme) needs no re-init.
    function readTheme() {
        var a = rootStyle.getPropertyValue('--accent-color');
        var t = rootStyle.getPropertyValue('--text-color');
        if (a !== lastAccent || t !== lastText) {
            lastAccent = a;
            lastText = t;
            rebuildPalette();
        }
    }

    function push(px0, py0, now) {
        if (count === CAP) {
            start = (start + 1) % CAP;
            count--;
        }
        var idx = (start + count) % CAP;
        px[idx] = px0;
        py[idx] = py0;
        pt[idx] = now;
        count++;
    }

    function trim(now) {
        while (count > 0 && now - pt[start] > LIFE) {
            start = (start + 1) % CAP;
            count--;
        }
        var len = 0;
        var i = count - 1;
        for (; i > 0; i--) {
            var i1 = (start + i) % CAP;
            var i0 = (start + i - 1) % CAP;
            var dx = px[i1] - px[i0];
            var dy = py[i1] - py[i0];
            len += Math.sqrt(dx * dx + dy * dy);
            if (len > MAX_LEN) break;
        }
        if (i > 0) {
            start = (start + i) % CAP;
            count -= i;
        }
    }

    function tick(now) {
        var dt = Math.min(50, now - last) || 16;
        last = now;
        ctx.clearRect(0, 0, w, h);
        if (inside) {
            var dx = x - fx, dy = y - fy;
            var k = 1000 / dt;
            vx = vx * 0.6 + dx * k * 0.4;
            vy = vy * 0.6 + dy * k * 0.4;
        } else {
            vx *= 0.8;
            vy *= 0.8;
        }
        var sn = Math.min(1, Math.sqrt(vx * vx + vy * vy) / SPEED_NORM);
        if (inside) {
            if (!hasHead) { hx = x; hy = y; hasHead = true; }
            hx += (x - hx) * LERP;
            hy += (y - hy) * LERP;
            push(hx, hy, now);
            var tgt = REST + (1 - REST) * sn;
            g += (tgt - g) * Math.min(1, dt / 120);
        } else {
            g = Math.max(0, g - dt / 320);
            if (g === 0) hasHead = false;
        }
        trim(now);
        readTheme();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (var k2 = 1; k2 < count; k2++) {
            var f = k2 / (count - 1);
            var m = (f - WHITE_HEAD) / (1 - WHITE_HEAD);
            if (m < 0) m = 0;
            var i1 = (start + k2) % CAP;
            var i0 = (start + k2 - 1) % CAP;
            ctx.strokeStyle = MIX[Math.round(m * MIX_STEPS)];
            ctx.globalAlpha = Math.pow(f, ALPHA_EXP) * ALPHA;
            ctx.lineWidth = W_MIN + Math.pow(f, TAPER) * (W_MAX + sn * W_SPEED);
            ctx.beginPath();
            ctx.moveTo(px[i0], py[i0]);
            ctx.lineTo(px[i1], py[i1]);
            ctx.stroke();
        }
        if (g > 0 && hasHead) {
            var r = R0 + sn * RK;
            ctx.globalAlpha = Math.min(1, g * HALO_A);
            ctx.drawImage(halo, hx - r, hy - r, 2 * r, 2 * r);
            ctx.fillStyle = HEAD;
            ctx.globalAlpha = Math.min(1, 0.9 * g);
            ctx.beginPath();
            ctx.arc(hx, hy, 1.4, 0, 6.2832);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        fx = x; fy = y;
    }

    function onMove(e) {
        if (e.pointerType === 'touch') return;
        if (!inside) {
            inside = true;
            fx = e.clientX;
            fy = e.clientY;
        }
        x = e.clientX;
        y = e.clientY;
    }

    function onLeave() {
        inside = false;
    }

    var w = 0, h = 0, dpr = 1;

    function resize() {
        w = window.innerWidth;
        h = window.innerHeight;
        dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    var canvas = null, ctx = null, mounted = false;

    function mount() {
        canvas = document.createElement('canvas');
        canvas.id = 'cursor-trail';
        canvas.dataset.testid = 'cursor-trail';
        canvas.setAttribute('aria-hidden', 'true');
        starCanvas.insertAdjacentElement('afterend', canvas);
        ctx = canvas.getContext('2d');
        if (!ctx) {
            canvas.remove();
            canvas = null;
            return;
        }
        resize();
        window.addEventListener('pointermove', onMove, { passive: true });
        document.documentElement.addEventListener('pointerleave', onLeave);
        window.addEventListener('blur', onLeave);
        window.addEventListener('resize', resize);
        last = performance.now();
        window.starfieldLoop.onFrame(tick);
        mounted = true;
    }

    function unmount() {
        window.starfieldLoop.onFrame(null);
        window.removeEventListener('pointermove', onMove);
        document.documentElement.removeEventListener('pointerleave', onLeave);
        window.removeEventListener('blur', onLeave);
        window.removeEventListener('resize', resize);
        if (canvas) canvas.remove();
        canvas = null;
        ctx = null;
        count = start = 0;
        inside = false;
        hasHead = false;
        g = 0;
        vx = vy = 0;
        mounted = false;
    }

    var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

    function sync() {
        if (REDUCED.matches) {
            if (mounted) unmount();
        } else if (!mounted) {
            mount();
        }
    }

    if (typeof REDUCED.addEventListener === 'function') {
        REDUCED.addEventListener('change', sync);
    } else if (typeof REDUCED.addListener === 'function') {
        // Safari < 14 fallback.
        REDUCED.addListener(sync);
    }

    sync();
})();
