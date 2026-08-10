// muchane.com — theme toggle + overlay menu.
// The zoom engine (Phase C) extends this file; the two pieces below are
// independent of it and load on every page.

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
