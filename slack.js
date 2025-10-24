// ==UserScript==
// @name         Slack PM Auto-Responder (ultra minimal)
// @namespace    http://example.com/
// @version      1.0
// @description  Ultra minimal DM autoresponder
// @match        https://*.slack.com/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';
  const lastReply = new Map();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  
  new MutationObserver(async ([m]) => {
    try {
      if (!/\/messages\/@|\/messages\/D|\/client\/[^/]+\/D/.test(location.pathname)) return; // DM check
      const msg = m?.addedNodes[0]?.querySelector?.('[data-qa="message-text"]')?.innerText?.trim();
      if (!msg?.toLowerCase().includes('ping-me')) return;
      
      const now = Date.now(), last = lastReply.get(location.pathname) || 0;
      if (now - last < 300000) return; // 5min cooldown
      
      const composer = document.querySelector('div[role="textbox"]');
      if (!composer) return;
      
      composer.focus();
      composer.innerText = "Thanks — I'll take a look and get back to you.";
      composer.dispatchEvent(new Event('input', {bubbles: true}));
      composer.dispatchEvent(new KeyboardEvent('keydown', {bubbles: true, key: 'Enter'}));
      
      lastReply.set(location.pathname, now);
      await sleep(100);
    } catch (e) {
      console.error('PM autoresponder error:', e);
    }
  }).observe(document.body, {childList: true, subtree: true});
})();