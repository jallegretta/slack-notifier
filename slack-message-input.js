// ==UserScript==
// @name         Slack Message Input Notifier
// @namespace    http://example.com/
// @version      1.0
// @description  Shows popup notifications for Slack DMs
// @match        https://*.slack.com/*
// @match        https://gist.github.com/*
// @match        https://raw.githubusercontent.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// @updateURL    https://raw.githubusercontent.com/jallegretta/slack-notifier/main/slack-message-input.js
// @downloadURL  https://raw.githubusercontent.com/jallegretta/slack-notifier/main/slack-message-input.js
// ==/UserScript==

(function() {
    'use strict';
    
    // Keep track of messages we've already notified about
    const notifiedMessages = new Set();
    
    // Watch for new messages
    new MutationObserver(mutations => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (!(node instanceof HTMLElement)) continue;
                
                // Check if we're in a DM by URL pattern
                if (!/\/messages\/@|\/messages\/D|\/client\/[^/]+\/D/.test(location.pathname)) continue;
                
                // Look for new message content
                const messageEl = node.querySelector('[data-qa="message-text"]');
                if (!messageEl) continue;
                
                const messageId = messageEl.closest('[data-message-id]')?.getAttribute('data-message-id');
                if (!messageId || notifiedMessages.has(messageId)) continue;
                
                // Get sender's name if available
                const senderEl = node.querySelector('[data-qa="message_sender_name"]');
                const sender = senderEl?.textContent?.trim() || 'Someone';
                
                // Get message preview
                const text = messageEl.textContent.trim();
                const preview = text.length > 50 ? text.substring(0, 47) + '...' : text;
                
                // Show notification
                const notification = document.createElement('div');
                notification.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: #1a1d21;
                    color: white;
                    padding: 20px 25px;
                    border-radius: 12px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
                    z-index: 9999;
                    max-width: 400px;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    animation: fadeInScale 0.3s ease-out;
                `;
                
                // Add animation keyframes
                if (!document.querySelector('#slack-notifier-styles')) {
                    const styleSheet = document.createElement('style');
                    styleSheet.id = 'slack-notifier-styles';
                    styleSheet.textContent = `
                        @keyframes fadeInScale {
                            from {
                                opacity: 0;
                                transform: translate(-50%, -50%) scale(0.95);
                            }
                            to {
                                opacity: 1;
                                transform: translate(-50%, -50%) scale(1);
                            }
                        }
                    `;
                    document.head.appendChild(styleSheet);
                }
                
                notification.innerHTML = `
                    <div style="font-weight: bold; margin-bottom: 5px;">${sender} sent a DM:</div>
                    <div style="opacity: 0.9;">${preview}</div>
                `;
                
                document.body.appendChild(notification);
                notifiedMessages.add(messageId);
                
                // Remove notification after 5 seconds
                setTimeout(() => {
                    notification.style.transition = 'all 0.3s ease-out';
                    notification.style.opacity = '0';
                    notification.style.transform = 'translate(-50%, -50%) scale(0.95)';
                    setTimeout(() => notification.remove(), 300);
                }, 5000);
            }
        }
    }).observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('[Slack DM Notifier] Initializing...');
    try {
        // Test DOM manipulation
        const testDiv = document.createElement('div');
        document.body.appendChild(testDiv);
        testDiv.remove();
        console.log('[Slack DM Notifier] Successfully initialized and watching for messages');
    } catch (error) {
        console.error('[Slack DM Notifier] Error during initialization:', error);
    }
})();