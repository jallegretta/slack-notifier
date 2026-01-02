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

    // --- Helpers for richer detection ---
    function parseDurationString(timeStr) {
        // Accepts formats like "SS", "M:SS", "H:MM:SS"
        if (!timeStr) return null;
        const parts = timeStr.trim().split(':').map(p => parseInt(p, 10));
        if (parts.some(isNaN)) return null;
        let seconds = 0;
        if (parts.length === 1) seconds = parts[0];
        else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
        else if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        return seconds;
    }

    function parseISODuration(iso) {
        // Very small ISO 8601 duration parser for PT#M#S etc.
        try {
            if (!iso || !iso.startsWith('P')) return null;
            // Example: PT1M23S
            const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            if (!m) return null;
            const h = parseInt(m[1] || 0, 10);
            const mm = parseInt(m[2] || 0, 10);
            const s = parseInt(m[3] || 0, 10);
            return h * 3600 + mm * 60 + s;
        } catch (e) {
            return null;
        }
    }

    function findDurationText(container) {
        // Common overlay selector used by YouTube thumbnails
        const selectors = [
            'ytd-thumbnail-overlay-time-status-renderer',
            '.ytd-thumbnail-overlay-time-status-renderer',
            '.thumbnail-overlay-time-status-renderer',
            '.ytd-thumbnail .ytd-thumbnail-overlay-time-status-renderer',
            '.ytp-time-duration'
        ];
        for (const sel of selectors) {
            const el = container.querySelector(sel) || container.closest(sel);
            if (el) {
                const txt = el.textContent || el.innerText || '';
                const cleaned = txt.trim().replace(/[^0-9:\s]/g, '');
                if (cleaned) return cleaned;
            }
        }
        return null;
    }

    function isShortByDuration(container) {
        const txt = findDurationText(container);
        if (!txt) return false;
        const secs = parseDurationString(txt) || parseISODuration(txt);
        if (secs === null) return false;
        return secs > 0 && secs <= 60; // treat <= 60s as short
    }

    function isShortsHref(a) {
        try {
            return !!(a && a.href && a.href.includes('/shorts/'));
        } catch (e) {
            return false;
        }
    }

    function isShortByMetaOrPlayer() {
        try {
            // 1) URL path
            if (location.pathname && location.pathname.startsWith('/shorts/')) return true;

            // 2) meta itemprop duration (ISO 8601)
            const meta = document.querySelector('meta[itemprop="duration"]');
            if (meta && meta.content) {
                const secs = parseISODuration(meta.content);
                if (secs !== null) return secs > 0 && secs <= 60;
            }

            // 3) HTML5 video duration (if available)
            const vid = document.querySelector('video');
            if (vid && typeof vid.duration === 'number' && isFinite(vid.duration) && vid.duration > 0) {
                return vid.duration <= 60;
            }
        } catch (e) {
            // ignore
        }
        return false;
    }

    // Scan existing page for shorts using multiple heuristics
    function scanForShortsOnPage(root = document) {
        try {
            // 1) anchors that explicitly link to /shorts/
            const anchors = Array.from(root.querySelectorAll('a[href*="/shorts/"]'));
            anchors.forEach(a => highlightShortAnchor(a));

            // 2) thumbnail-like renderers where the overlay duration is <= 60s
            const candidateContainers = Array.from(root.querySelectorAll(
                'ytd-rich-grid-media, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-rich-item-renderer, ytd-rich-section-renderer, ytd-thumbnail'
            ));
            candidateContainers.forEach(c => {
                try {
                    if (isShortByDuration(c)) {
                        // try to find a link inside
                        const a = c.querySelector('a[href]') || c.querySelector('a');
                        if (a) highlightShortAnchor(a);
                        else if (!c.classList.contains(HIGHLIGHT_CLASS)) c.classList.add(HIGHLIGHT_CLASS);
                    }
                } catch (e) {
                    // ignore per-item errors
                }
            });

            // 3) reel / shorts shelf components
            const reelSelectors = ['ytd-reel-shelf-renderer', 'ytd-reel-player-renderer', 'ytd-rich-shelf-renderer[title*="Shorts"]'];
            for (const sel of reelSelectors) {
                const nodes = Array.from(root.querySelectorAll(sel));
                nodes.forEach(n => n.classList.add(HIGHLIGHT_CLASS));
            }

            // 4) on-watch-player fallback: meta/player
            if (isShortByMetaOrPlayer()) {
                highlightIfOnShortsPage();
            }
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

    // Observe mutations and highlight new anchors or thumbnail nodes that look like shorts
    function observeMutations() {
        const mo = new MutationObserver(mutations => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (!(node instanceof HTMLElement)) continue;

                    // 1) Direct anchors linking to /shorts/
                    try {
                        const anchors = node.querySelectorAll ? node.querySelectorAll('a[href*="/shorts/"]') : [];
                        if (anchors && anchors.length) anchors.forEach(a => highlightShortAnchor(a));
                    } catch (e) {
                        // ignore
                    }

                    // 2) Newly added thumbnail/renderers -> check duration overlay
                    try {
                        const candidates = node.querySelectorAll ? node.querySelectorAll(
                            'ytd-rich-grid-media, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-thumbnail'
                        ) : [];
                        if (candidates && candidates.length) {
                            candidates.forEach(c => {
                                try {
                                    if (isShortByDuration(c)) {
                                        const a = c.querySelector('a[href]') || c.querySelector('a');
                                        if (a) highlightShortAnchor(a);
                                        else if (!c.classList.contains(HIGHLIGHT_CLASS)) c.classList.add(HIGHLIGHT_CLASS);
                                    }
                                } catch (e) {}
                            });
                        }
                    } catch (e) {}
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
