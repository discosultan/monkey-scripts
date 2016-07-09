// ==UserScript==
// @name         FB Message Store
// @namespace    http://tampermonkey.net/
// @version      0.4
// @description  Additional FB message store
// @author       Bill Murray
// @match        https://*.facebook.com/*
// @grant        none
// ==/UserScript==

// filesystem:https://www.facebook.com/persistent/

(function() {
    'use strict';

    // ******* //
    // Config. //
    // ******* //

    var loggingEnabled = false;
    var urlCheckInterval = 1000;
    var requestedStorageQuotaMB = 100;
    var sentMessagesStore = 'saadetud_sonumid.v1.html';
    var actionOnRecentMessagesStore = 'tegevused_viimaste_sonumitega.v1.html';

    // ******************* //
    // Event subscription. //
    // ******************* //

    var lastUrl;
    var toDispose = []; // { target, type, listener, useCapture }

    // Resubscribe to events each time url change is detected.
    setInterval(function() {
        var currentUrl = location.href;
        if (currentUrl !== lastUrl) {
            unsubscribeFromEvents();
            subscribeToEvents();
        }
        lastUrl = currentUrl;
    }, urlCheckInterval);

    function unsubscribeFromEvents() {
        log('Unsubscribing from events...');

        for (var i = 0; i < toDispose.length; i++) {
            var disposable = toDispose[i];
            disposable.target.removeEventListener(
                disposable.type,
                disposable.listener,
                disposable.useCapture);
            log('Unsubscribed from ' + disposable.target + ' ' + disposable.type + '.');
        }
        toDispose.length = 0;
    }

    function subscribeToEvents() {
        log('Subscribing to events...');

        // Capture is required in order to catch the message before it is erased from the DOM.
        var useCapture = true;
        var type = 'keydown';
        var listener = onWindowKeydown;
        window.addEventListener(type, listener, useCapture);
        toDispose.push({ target: window, type: type, listener: listener, useCapture: useCapture });
        log('Subscribed to enter keydown.');

        type = 'click';
        listener = onActionsBtnClick;
        var largeChatActionsBtn = getActionsBtnForTranslations(['Actions', 'Tegevused']);
        if (largeChatActionsBtn) {
            largeChatActionsBtn.addEventListener(type, listener, useCapture);
            toDispose.push({ target: largeChatActionsBtn, type: type, listener: listener, useCapture: useCapture });
            log('Subscribed to actions button click.');
        }
    }

    function onWindowKeydown(e) {
        if (e.keyCode === 13) { // Enter.
            tryStoreSmallChatWindowMessage();
            tryStoreLargeChatWindowMessage();
        }
    }

    function onActionsBtnClick(e) {
        var parentEl = e.target.parentNode.parentNode;
        if (!parentEl.classList.contains('openToggler')) {
            tryStoreVisibleMessages();
        }
    }

    // ******************* //
    // Message extractors. //
    // ******************* //

    function tryStoreVisibleMessages() {
        log('Storing visible messages...');
        var recentMessagesEl = document.getElementById('webMessengerRecentMessages');
        if (recentMessagesEl) {
            for (var i = 0; i < recentMessagesEl.children.length; i++) {
                var childEl = recentMessagesEl.children[i];
                if (childEl.classList.contains('webMessengerMessageGroup')) {
                    var nameEl = childEl.querySelector('a[data-hovercard]');
                    var name;
                    if (nameEl) name = nameEl.innerText;
                    var timestampEl = childEl.querySelector('abbr[data-utime]');
                    var timestamp;
                    if (timestampEl) timestamp = timestampEl.innerHTML;

                    var messageEls = childEl.querySelectorAll('p');
                    if (messageEls) {
                        for (var j = 0; j < messageEls.length; j++) {
                            var messageEl = messageEls[j];
                            var message = messageEl.innerText;
                            storeMessage(actionOnRecentMessagesStore, timestamp, name, message);
                        }
                    }
                }
            }
            log('Stored visible messages.');
            return true;
        }
        return false;
    }

    function tryStoreSmallChatWindowMessage() {
        log('Storing small chat window message...');
        var chatTabsPageletEl = document.getElementById('ChatTabsPagelet') || document.body;
        var activeChatTabEl = chatTabsPageletEl.querySelector('div.opened.focusedTab');
        if (activeChatTabEl) {
            var chatSpanEl = activeChatTabEl.querySelector('span[data-text="true"]');
            if (chatSpanEl && chatSpanEl.innerText) {
                var timestamp = getTimestamp();
                var message = chatSpanEl.innerText;
                var name = getMyName();
                var titlebarTextEl = activeChatTabEl.querySelector('a.titlebarText > span');
                if (titlebarTextEl) {
                    var to = titlebarTextEl.innerText;
                    name = name + ' -> ' + to;
                }
                storeMessage(sentMessagesStore, timestamp, name, message);
                log('Stored small chat window message.');
                return true;
            }
        }
        return false;
    }

    function tryStoreLargeChatWindowMessage() {
        log('Storing large chat window message...');
        var chatTextarea = document.querySelector('textarea.uiTextareaNoResize.uiTextareaAutogrow');
        if (chatTextarea && chatTextarea.value) {
            var timestamp = getTimestamp();
            var message = chatTextarea.value;
            var name = getMyName();
            var webMessengerHeaderNameEl = document.getElementById('webMessengerHeaderName') || document.body;
            var toEl = webMessengerHeaderNameEl.querySelector('a[data-hovercard]');
            if (toEl) {
                name = name + ' -> ' + toEl.innerText;
            }
            storeMessage(sentMessagesStore, timestamp, name, message);
            log('Stored large chat window message.');
            return true;
        }
        return false;
    }

    // ******** //
    // Storage. //
    // ******** //

    var requestFileSystem = requestFileSystem || webkitRequestFileSystem;
    var isWritingToFile = false;
    var endMarker = '<div id="end"></div>\n';
    var entryQueues = {};
    var requestedStorageQuotaBytes = requestedStorageQuotaMB * 1024 * 1024;

    function storeMessage(store, timestamp, name, message) {
        // log('Storing message...');

        var entry = [];
        entry.push('<p>');
        if (timestamp) {
            entry.push('[');
            entry.push(timestamp);
            entry.push('] ');
        }
        if (name) {
            entry.push('[');
            entry.push(name);
            entry.push('] ');
        }
        entry.push(message);
        entry.push('</p>\n');
        entry.push(endMarker);

        // log(entry);

        if (isWritingToFile) {
            var key = sanitizeKey(store);
            var entryQueue = entryQueues[key];
            if (!entryQueue) {
                entryQueue = [];
                entryQueues[key] = entryQueue;
            }
            entryQueue.push(entry);
            // log('Queued message');
        } else {
            writeEntry(store, entry);
            // log('Stored message.');
        }
    }

    function writeEntry(store, entry) {
        isWritingToFile = true;
        navigator.webkitPersistentStorage.requestQuota(requestedStorageQuotaBytes, function(grantedBytes) {
            requestFileSystem(PERSISTENT, grantedBytes, function(fileSystem) {
                // log(fileSystem.root.toURL()); // Prints the filesystem path.
                fileSystem.root.getFile(store, { create: true, exclusive: false }, function(fileEntry) {
                    fileEntry.createWriter(function(fileWriter) {

                        fileWriter.onerror = handleError;
                        fileWriter.onwriteend = function(e) {
                            var key = sanitizeKey(store);
                            var entryQueue = entryQueues[key];
                            if (entryQueue && entryQueue.length > 0) {
                                writeEntry(store, entryQueue.shift());
                            } else {
                                isWritingToFile = false;
                            }
                        };

                        var blob = new Blob(entry, {type: 'text/plain'});

                        // Start write position at EOF. Overwrite endMarker.
                        fileWriter.seek(fileWriter.length - endMarker.length);
                        fileWriter.write(blob);
                    }, handleError);
                }, handleError);
            }, handleError);
        }, handleError);
    }

    // ********** //
    // Providers. //
    // ********** //

    function sanitizeKey(key) {
        return key.replace('.', '_');
    }

    function getMyName() {
        var profileAnchors = document.querySelectorAll('[data-testid="blue_bar_profile_link"]');
        try {
            return profileAnchors[0].children[1].innerText;
        } catch(ex) {
            return undefined;
        }
    }

    function getTimestamp() {
        return new Date().toLocaleString();
    }

    function getActionsBtnForTranslations(translations) {
        for (var i = 0; i < translations.length; i++) {
            var translation = translations[i];
            var largeChatActionsBtn = document.querySelector('button[data-tooltip-content="' + translation + '"]');
            if (largeChatActionsBtn) return largeChatActionsBtn;
        }
        return undefined;
    }

    // *************** //
    // Error handlers. //
    // *************** //

    function handleError(err) {
        console.error(err);
    }

    // ********** //
    // Utilities. //
    // ********** //

    function log(msg) {
        if (loggingEnabled) console.log(msg);
    }
})();