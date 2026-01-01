// ==UserScript==
// @name         YouTube Shorts Highlighter
// @namespace    http://example.com/
// @version      1.0
// @description  Highlights YouTube Shorts with a red outline on pages and thumbnail lists
// @match        https://www.youtube.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const STYLE_ID = 'tm-shorts-highlighter-style';
    const HIGHLIGHT_CLASS = 'tm-shorts-highlight';
    const PLAYER_CLASS = 'tm-shorts-player-highlight';

    // Inject styles (safe and idempotent)
    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const s = document.createElement('style');
        s.id = STYLE_ID;
        s.textContent = `
            .${HIGHLIGHT_CLASS} {
                outline: 3px solid rgba(255,0,0,0.95) !important;
                box-shadow: 0 0 12px rgba(255,0,0,0.35) !important;
                transition: box-shadow 0.15s ease-in-out, outline 0.15s ease-in-out;
            }
            .${PLAYER_CLASS} {
                outline: 4px solid rgba(255,0,0,0.95) !important;
                box-shadow: 0 0 18px rgba(255,0,0,0.45) !important;
            }
        `;
        (document.head || document.documentElement).appendChild(s);
    }

    // Given an <a> that links to a shorts URL, find the best container to highlight
    function findContainerForAnchor(a) {
        if (!a) return null;
        // Many YouTube thumbnails live inside these renderer elements
        const candidateSelectors = [
            'ytd-rich-grid-media',
            'ytd-video-renderer',
            'ytd-grid-video-renderer',
            'ytd-compact-video-renderer',
            'ytd-rich-item-renderer',
            'ytd-rich-section-renderer'
        ];

        for (const sel of candidateSelectors) {
            const el = a.closest(sel);
            if (el) return el;
        }

        // fallback to the thumbnail or the anchor's parent
        const thumb = a.closest('ytd-thumbnail, .ytd-thumbnail, .thumb, .yt-lockup')
            || a.parentElement || a;
        return thumb;
    }

    function highlightShortAnchor(a) {
        try {
            const container = findContainerForAnchor(a);
            if (!container) return;
            if (!container.classList.contains(HIGHLIGHT_CLASS)) {
                container.classList.add(HIGHLIGHT_CLASS);
            }
        } catch (e) {
            console.error('Shorts highlighter error', e);
        }
    }

    // Scan existing page for anchor links that point to /shorts/
    function scanForShortsOnPage(root = document) {
        try {
            const anchors = Array.from(root.querySelectorAll('a[href*="/shorts/"]'));
            anchors.forEach(a => highlightShortAnchor(a));
        } catch (e) {
            console.error('Error scanning for shorts anchors', e);
        }
    }

    // Highlight the player area when on a shorts watch page (/shorts/VIDEO_ID)
    function highlightIfOnShortsPage() {
        try {
            if (location.pathname && location.pathname.startsWith('/shorts/')) {
                // Player container selectors
                const playerCandidates = ['#player', 'ytd-player', '.html5-video-player'];
                for (const sel of playerCandidates) {
                    const el = document.querySelector(sel);
                    if (el && !el.classList.contains(PLAYER_CLASS)) {
                        el.classList.add(PLAYER_CLASS);
                        break;
                    }
                }
            }
        } catch (e) {
            console.error('Error highlighting player for shorts', e);
        }
    }

    // Observe mutations and highlight new anchors that link to /shorts/
    function observeMutations() {
        const mo = new MutationObserver(mutations => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (!(node instanceof HTMLElement)) continue;
                    // Quick localized scan for anchors inside the added node
                    try {
                        const anchors = node.querySelectorAll ? node.querySelectorAll('a[href*="/shorts/"]') : [];
                        if (anchors && anchors.length) {
                            anchors.forEach(a => highlightShortAnchor(a));
                        }
                    } catch (e) {
                        // ignore
                    }
                }
            }
        });
        mo.observe(document.body, { childList: true, subtree: true });
    }

    // SPA navigation helper — dispatch a custom event when history changes
    function enableLocationChangeEvent() {
        const _wr = function (type) {
            const orig = history[type];
            return function () {
                const rv = orig.apply(this, arguments);
                window.dispatchEvent(new Event('locationchange'));
                return rv;
            };
        };
        history.pushState = _wr('pushState');
        history.replaceState = _wr('replaceState');
        window.addEventListener('popstate', () => window.dispatchEvent(new Event('locationchange')));
    }

    function onLocationChange() {
        // small delay to let new content render
        setTimeout(() => {
            scanForShortsOnPage();
            highlightIfOnShortsPage();
        }, 300);
    }

    // Initialize
    function init() {
        injectStyles();
        scanForShortsOnPage(document);
        highlightIfOnShortsPage();
        observeMutations();
        enableLocationChangeEvent();
        window.addEventListener('locationchange', onLocationChange);
        console.log('YouTube Shorts Highlighter: active');
    }

    // Run
    try {
        init();
    } catch (e) {
        console.error('YouTube Shorts Highlighter failed to initialize', e);
    }

})();
