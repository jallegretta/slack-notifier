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
    // Debug mode: enable by adding ?tmdebug=1 to the URL or set localStorage.tm_shorts_debug = '1'
    const DEBUG = (location.search && location.search.includes('tmdebug=1')) || localStorage.getItem('tm_shorts_debug') === '1';
    // Aggressive mode: temporarily highlight a wide set of candidates so you can see what the script is scanning
    // enable by adding ?tmaggr=1 or set localStorage.tm_shorts_aggressive = '1'
    const AGGRESSIVE = (location.search && location.search.includes('tmaggr=1')) || localStorage.getItem('tm_shorts_aggressive') === '1';

    function debugLog(...args) {
        if (DEBUG) console.log('[tm-shorts-debug]', ...args);
    }

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
            /* Badge styles */
            .tm-shorts-badge {
                position: absolute;
                top: 6px;
                left: 6px;
                background: rgba(204, 0, 0, 0.95);
                color: #fff;
                padding: 3px 6px;
                font-size: 11px;
                font-weight: 700;
                border-radius: 4px;
                z-index: 99999 !important;
                pointer-events: none;
                box-shadow: 0 2px 6px rgba(0,0,0,0.25);
                font-family: sans-serif;
                text-transform: uppercase;
                letter-spacing: 0.6px;
            }
            .tm-shorts-badge.player-badge {
                top: 10px;
                left: 10px;
                padding: 6px 8px;
                font-size: 13px;
                border-radius: 6px;
            }
            /* Ensure container is positioned so badge can be absolutely placed */
            .tm-shorts-highlight, .tm-shorts-player-highlight {
                position: relative !important;
            }
            /* Aggressive temporary outline for debugging */
            .tm-shorts-aggressive-temp {
                outline: 5px dashed rgba(255, 0, 0, 1) !important;
                box-shadow: 0 0 28px rgba(255,0,0,0.6) !important;
                transition: all 0.15s ease-in-out;
            }
        `;
        (document.head || document.documentElement).appendChild(s);
    }

    // Aggressive scan: mark a wide set of candidate elements for a short time so user can visually inspect
    function aggressiveScan(root = document, durationMs = 6000) {
        try {
            const selectors = [
                'ytd-thumbnail',
                'ytd-rich-grid-media',
                'ytd-video-renderer',
                'ytd-grid-video-renderer',
                'ytd-compact-video-renderer',
                'ytd-rich-item-renderer',
                'ytd-rich-section-renderer',
                'ytd-reel-shelf-renderer',
                'ytd-reel-player-renderer',
                'ytd-playlist-panel-renderer',
                '.yt-core-video-list-item',
                '.yt-lockup'
            ];

            const nodes = new Set();
            selectors.forEach(sel => {
                try {
                    const found = Array.from(root.querySelectorAll(sel));
                    found.forEach(n => nodes.add(n));
                } catch (e) {}
            });

            debugLog('aggressiveScan: candidates found', nodes.size);

            nodes.forEach(n => {
                try {
                    // add temporary aggressive class and a badge if none exists
                    if (!n.classList.contains('tm-shorts-aggressive-temp')) n.classList.add('tm-shorts-aggressive-temp');
                    addBadge(n, false);
                } catch (e) {}
            });

            // remove temporary markers after durationMs
            setTimeout(() => {
                nodes.forEach(n => {
                    try {
                        n.classList.remove('tm-shorts-aggressive-temp');
                        const badge = n.querySelector && n.querySelector('.tm-shorts-badge');
                        if (badge && badge.textContent === 'SHORT') badge.remove();
                        // if we added position style earlier and marked it, remove it
                        if (n.getAttribute && n.getAttribute('data-tm-shorts-pos-fixed')) {
                            n.style.position = '';
                            n.removeAttribute('data-tm-shorts-pos-fixed');
                        }
                    } catch (e) {}
                });
            }, durationMs);
        } catch (e) {
            console.error('Error during aggressiveScan', e);
        }
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

    function highlightShortAnchor(a, reason) {
        try {
            const container = findContainerForAnchor(a);
            if (!container) return;
            if (!container.classList.contains(HIGHLIGHT_CLASS)) {
                container.classList.add(HIGHLIGHT_CLASS);
                // Add a visible badge overlay to the container
                addBadge(container, false);
                debugLog('Highlighted anchor', { href: a && a.href, reason, container });
            } else {
                debugLog('Already highlighted', { href: a && a.href, reason, container });
            }
        } catch (e) {
            console.error('Shorts highlighter error', e);
        }
    }

    // Add a small 'SHORT' badge to a container (idempotent)
    function addBadge(container, isPlayer) {
        try {
            if (!container) return;
            // If badge already present, return
            if (container.querySelector && container.querySelector('.tm-shorts-badge')) return;

            const badge = document.createElement('div');
            badge.className = 'tm-shorts-badge' + (isPlayer ? ' player-badge' : '');
            badge.textContent = 'SHORT';

            // Ensure the container can position absolute children
            const prevPosition = window.getComputedStyle(container).position;
            if (!prevPosition || prevPosition === 'static') {
                // set a data attribute so we can avoid overwriting later
                container.style.position = 'relative';
                container.setAttribute('data-tm-shorts-pos-fixed', '1');
            }

            // Insert badge as first child for visibility
            if (container.firstChild) container.insertBefore(badge, container.firstChild);
            else container.appendChild(badge);
        } catch (e) {
            // don't let badge creation break other logic
            console.error('Error adding shorts badge', e);
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
            debugLog('scanForShortsOnPage: anchors with /shorts/ found', anchors.length);
            anchors.forEach(a => highlightShortAnchor(a, 'href'));

            // 2) thumbnail-like renderers where the overlay duration is <= 60s
            const candidateContainers = Array.from(root.querySelectorAll(
                'ytd-rich-grid-media, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-rich-item-renderer, ytd-rich-section-renderer, ytd-thumbnail'
            ));
            let durationMatches = 0;
            candidateContainers.forEach(c => {
                try {
                    if (isShortByDuration(c)) {
                        durationMatches++;
                        // try to find a link inside
                        const a = c.querySelector('a[href]') || c.querySelector('a');
                        if (a) highlightShortAnchor(a, 'duration');
                        else if (!c.classList.contains(HIGHLIGHT_CLASS)) c.classList.add(HIGHLIGHT_CLASS);
                    }
                } catch (e) {
                    // ignore per-item errors
                }
            });
            debugLog('scanForShortsOnPage: candidateContainers checked', candidateContainers.length, 'durationMatches', durationMatches);

            // 3) reel / shorts shelf components
            const reelSelectors = ['ytd-reel-shelf-renderer', 'ytd-reel-player-renderer', 'ytd-rich-shelf-renderer[title*="Shorts"]'];
            for (const sel of reelSelectors) {
                const nodes = Array.from(root.querySelectorAll(sel));
                debugLog('scanForShortsOnPage: reel selector', sel, 'found', nodes.length);
                nodes.forEach(n => {
                    if (!n.classList.contains(HIGHLIGHT_CLASS)) n.classList.add(HIGHLIGHT_CLASS);
                    addBadge(n, false);
                    debugLog('Highlighted reel node', sel, n);
                });
            }

            // 4) on-watch-player fallback: meta/player
            if (isShortByMetaOrPlayer()) {
                debugLog('scanForShortsOnPage: matched meta/player heuristics');
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
                        // add a player badge overlay
                        addBadge(el, true);
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
                                    if (anchors && anchors.length) anchors.forEach(a => highlightShortAnchor(a, 'mutation-href'));
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
                                                    if (a) highlightShortAnchor(a, 'mutation-duration');
                                        else if (!c.classList.contains(HIGHLIGHT_CLASS)) {
                                            c.classList.add(HIGHLIGHT_CLASS);
                                            addBadge(c, false);
                                        }
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
        // If debug or aggressive mode enabled, run an aggressive visual scan so user can see candidate elements
        if (DEBUG || AGGRESSIVE) {
            console.log('YouTube Shorts Highlighter: aggressive debug enabled');
            aggressiveScan(document, 7000);
        }
        console.log('YouTube Shorts Highlighter: active');
    }

    // Run
    try {
        init();
    } catch (e) {
        console.error('YouTube Shorts Highlighter failed to initialize', e);
    }

})();
