document.addEventListener('DOMContentLoaded', () => {
    // Register ScrollTrigger
    gsap.registerPlugin(ScrollTrigger);

    /**
     * STATE MANAGEMENT & UTILS
     */
    const updateAria = (el, attr, val) => el.setAttribute(attr, val);

    /**
     * THEME TOGGLE
     */
    const themeToggle = document.querySelector('[data-testid="theme-toggle"]');
    const htmlRoot = document.documentElement;
    const currentTheme = localStorage.getItem('theme') || 'dark';

    if (currentTheme === 'light') {
        htmlRoot.classList.add('light-mode');
    }

    themeToggle.addEventListener('click', () => {
        htmlRoot.classList.toggle('light-mode');
        const theme = htmlRoot.classList.contains('light-mode') ? 'light' : 'dark';
        localStorage.setItem('theme', theme);
        // QA visibility
        console.log(`Theme switched to: ${theme}`);
    });

    /**
     * OVERLAY MENU
     */
    const menuTrigger = document.querySelector('[data-testid="global-menu-trigger"]');
    const overlayMenu = document.querySelector('[data-testid="global-overlay-menu"]');
    const menuLinks = document.querySelectorAll('.overlay-menu__link');

    let isMenuOpen = false;

    const toggleMenu = () => {
        isMenuOpen = !isMenuOpen;
        overlayMenu.classList.toggle('is-active', isMenuOpen);
        updateAria(menuTrigger, 'aria-expanded', isMenuOpen);

        if (isMenuOpen) {
            gsap.fromTo(overlayMenu,
                { y: '-100%', autoAlpha: 0 },
                { y: '0%', autoAlpha: 1, duration: 0.6, ease: 'power4.out' }
            );
            gsap.from('.overlay-menu__item', {
                y: 50,
                opacity: 0,
                stagger: 0.1,
                duration: 0.5,
                delay: 0.3,
                ease: 'back.out(1.7)'
            });
        } else {
            gsap.to(overlayMenu, {
                y: '-100%',
                autoAlpha: 0,
                duration: 0.5,
                ease: 'power4.in'
            });
        }
    };

    menuTrigger.addEventListener('click', toggleMenu);

    // Close menu when clicking links
    menuLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (isMenuOpen) toggleMenu();
        });
    });

    /**
     * 3D TEXT REVEAL (Achievements)
     */
    const achievements = document.querySelectorAll('[data-testid^="achievement-description-text"]');

    achievements.forEach(ach => {
        const text = ach.textContent;
        ach.innerHTML = '';

        // Split text into characters
        text.split('').forEach(char => {
            const span = document.createElement('span');
            span.textContent = char === ' ' ? '\u00A0' : char;
            span.classList.add('char');
            ach.appendChild(span);
        });

        const chars = ach.querySelectorAll('.char');

        gsap.from(chars, {
            scrollTrigger: {
                trigger: ach,
                start: 'top 80%',
                toggleActions: 'play none none reverse'
            },
            y: 50,
            opacity: 0,
            rotateX: -90,
            stagger: 0.02,
            duration: 0.8,
            ease: 'power3.out'
        });
    });

    /**
     * PROJECT HOVER (Mouse Tracking)
     */
    const projectCards = document.querySelectorAll('.project-card');

    projectCards.forEach(card => {
        const reveal = card.querySelector('.project-card__reveal');

        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Subtle movement of the reveal container or its contents
            gsap.to(reveal, {
                x: (x - rect.width / 2) * 0.1,
                y: (y - rect.height / 2) * 0.1,
                duration: 0.3,
                ease: 'power2.out'
            });
        });

        card.addEventListener('mouseleave', () => {
            gsap.to(reveal, {
                x: 0,
                y: 0,
                duration: 0.5,
                ease: 'power2.out'
            });
        });
    });

    /**
     * SCROLL REVEALS FOR SECTIONS
     */
    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
        gsap.from(section, {
            scrollTrigger: {
                trigger: section,
                start: 'top 90%',
            },
            opacity: 0,
            y: 30,
            duration: 1,
            ease: 'power2.out'
        });
    });

});
