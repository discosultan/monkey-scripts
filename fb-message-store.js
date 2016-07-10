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

    var loggingEnabled = true;
    var initialSubscriptionTimeout = 1000;
    var resubscriptionInterval = 5000;
    var requestedStorageQuotaMB = 100;
    var sentMessagesStore = 'saadetud_sonumid.v6.html';
    var actionOnRecentMessagesStore = 'tegevused_viimaste_sonumitega.v6.html';

    // ******************* //
    // Event subscription. //
    // ******************* //

    var lastUrl;
    var toDispose = []; // { target, type, listener, useCapture }

    // Resubscribe to events each time url change is detected.
    // setInterval(function() {
    //     var currentUrl = location.href;
    //     if (currentUrl !== lastUrl) {
    //         resetSubscriptions();
    //     }
    //     lastUrl = currentUrl;
    // }, resubscriptionInterval);

    // Resubscribe to events at regular intervals.
    setInterval(resetSubscriptions, resubscriptionInterval);
    setTimeout(resetSubscriptions, initialSubscriptionTimeout);

    function resetSubscriptions() {
        unsubscribeFromEvents();
        subscribeToEvents();
    }

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

        log('Unsubscribed from events.');
    }

    function subscribeToEvents() {
        log('Subscribing to events...');

        var type = 'keydown';
        var listener = onSmallChatKeydown;
        var useCapture = false;
        var smallChatEl = getSmallChatEl();
        if (smallChatEl) {
            smallChatEl.addEventListener(type, listener, useCapture);
            toDispose.push({ target: smallChatEl, type: type, listener: listener, useCapture: useCapture });
            log('Subscribed to small chat keydown.');
        }

        type = 'keydown';
        listener = onLargeChatKeydown;
        useCapture = true;
        var largeChatEl = getLargeChatEl();
        if (largeChatEl) {
            largeChatEl.addEventListener(type, listener, useCapture);
            toDispose.push({ target: largeChatEl, type: type, listener: listener, useCapture: useCapture });
            log('Subscribed to large chat keydown.');
        }

        // type = 'click';
        // listener = onSmallChatHeaderClick;
        // var smallChatHeaderEl = document.querySelector('#ChatTabsPagelet a.fbNubButton');
        // log(smallChatHeaderEl);
        // if (smallChatHeaderEl) {
        //     smallChatHeaderEl.addEventListener(type, listener, useCapture);
        //     toDispose.push({ target: smallChatHeaderEl, type: type, listener: listener, useCapture: useCapture });
        //     log('Subscribed to small chat header click.');
        // }

        type = 'click';
        listener = onSmallChatActionsBtnClick;
        useCapture = false;
        var smallChatActionsBtnEl = getSmallChatActionsBtnEl();
        if (smallChatActionsBtnEl) {
            smallChatActionsBtnEl.addEventListener(type, listener, useCapture);
            toDispose.push({ target: smallChatActionsBtnEl, type: type, listener: listener, useCapture: useCapture });
            log('Subscribed to small chat actions button click.');
        }

        type = 'click';
        listener = onLargeChatActionsBtnClick;
        useCapture = false;
        var largeChatActionsBtnEl = getLargeChatActionsBtnEl();
        if (largeChatActionsBtnEl) {
            largeChatActionsBtnEl.addEventListener(type, listener, useCapture);
            toDispose.push({ target: largeChatActionsBtnEl, type: type, listener: listener, useCapture: useCapture });
            log('Subscribed to large chat actions button click.');
        }

        type = 'mousedown';
        listener = onLargeChatReplyBtnClick;
        useCapture = false;
        var largeCharReplyBtnEl = getLargeChatReplyBtnEl();
        if (largeCharReplyBtnEl) {
            largeCharReplyBtnEl.addEventListener(type, listener, useCapture);
            toDispose.push({ target: largeCharReplyBtnEl, type: type, listener: listener, useCapture: useCapture });
            log('Subscribed to large chat reply button click.');
        }

        log('Subscribed to events.');
    }

    function onSmallChatKeydown(e) {
        if (e.keyCode === 13) { // Enter.
            tryStoreSmallChatWindowMessage();
        }
    }

    function onLargeChatKeydown(e) {
        if (e.keyCode === 13) { // Enter.
            tryStoreLargeChatWindowMessage();
        }
    }

    function onSmallChatActionsBtnClick(e) {
        var parentEl = e.target.parentNode;
        if (parentEl.tagName === 'SPAN' || parentEl.classList.contains('openToggler')) {
            tryStoreVisibleSmallChatMessages();
        }
    }

    function onLargeChatActionsBtnClick(e) {
        var parentEl = e.target.tagName === 'BUTTON' ? e.target.parentNode : e.target.parentNode.parentNode;
        if (parentEl.classList.contains('openToggler')) {
            tryStoreVisibleLargeChatMessages();
        }
    }

    function onLargeChatReplyBtnClick(e) {
        tryStoreLargeChatWindowMessage();
    }

    // ******************* //
    // Message extractors. //
    // ******************* //

    function tryStoreVisibleSmallChatMessages() {
        log('Storing visible small chat messages...');

        var recentMessageEls = getSmallChatEl().querySelectorAll('div.opened div.direction_ltr > div');
        if (recentMessageEls.length) {
            var myName = getMyName();
            var otherNameEl = getSmallChatEl().querySelector('div.opened a.titlebarText > span');
            var otherName = '';
            if (otherNameEl) {
                otherName = otherNameEl.innerText;
            }

            for (var i = 0; i < recentMessageEls.length; i++) {
                var recentMessageEl = recentMessageEls[i];
                if (recentMessageEl.innerText) {
                    var computedStyle = getComputedStyle(recentMessageEl);
                    var isMe = computedStyle.float === 'right';

                    var textEl = recentMessageEl.querySelector('span > span');
                    var message = recentMessageEl.innerText;
                    var timestamp; // There's no way to get a timestamp for this one, so we pass undefined.
                    var name = isMe ? myName + ' -> ' + otherName : otherName + ' -> ' + myName;
                    storeMessage(actionOnRecentMessagesStore, timestamp, name, message);
                }
            }

            log('Stored visible small chat messages.');
        }
        return false;
    }

    function tryStoreVisibleLargeChatMessages() {
        log('Storing visible large chat messages...');
        var largeChatEl = getLargeChatEl();
        var recentMessageEls = largeChatEl && largeChatEl.querySelectorAll('#webMessengerRecentMessages li.webMessengerMessageGroup');
        if (recentMessageEls.length) {
            for (var i = 0; i < recentMessageEls.length; i++) {
                var childEl = recentMessageEls[i];

                var nameEl = childEl.querySelector('a[data-hovercard]');
                var name;
                if (nameEl) name = nameEl.innerText;
                var timestampEl = childEl.querySelector('abbr[data-utime]');
                var timestamp;
                if (timestampEl) timestamp = timestampEl.innerHTML;

                var messageEls = childEl.querySelectorAll('p');
                for (var j = 0; j < messageEls.length; j++) {
                    var messageEl = messageEls[j];
                    var message = messageEl.innerText;
                    storeMessage(actionOnRecentMessagesStore, timestamp, name, message);
                }
            }
            log('Stored visible large chat messages.');
            return true;
        }
        return false;
    }

    function tryStoreSmallChatWindowMessage() {
        log('Storing small chat window message...');
        var smallChatEl = getSmallChatEl();
        var smallChatTabEl = smallChatEl && smallChatEl.querySelector('div.opened.focusedTab');
        var chatEl = smallChatTabEl && smallChatTabEl.querySelector('span[data-text="true"]');
        if (chatEl && chatEl.innerText) {
            var timestamp = getTimestamp();
            var message = chatEl.innerText;
            var name = getMyName();
            var titlebarTextEl = smallChatTabEl.querySelector('a.titlebarText > span');
            if (titlebarTextEl) {
                var to = titlebarTextEl.innerText;
                name = name + ' -> ' + to;
            }
            storeMessage(sentMessagesStore, timestamp, name, message);
            log('Stored small chat window message.');
            return true;
        }
        return false;
    }

    function tryStoreLargeChatWindowMessage() {
        log('Storing large chat window message...');
        var largeChatEl = getLargeChatEl();
        var chatTextarea = largeChatEl && largeChatEl.querySelector('textarea.uiTextareaNoResize.uiTextareaAutogrow');
        if (chatTextarea && chatTextarea.value) {
            var timestamp = getTimestamp();
            var message = chatTextarea.value;
            var name = getMyName();
            var toEl = document.querySelector('#webMessengerHeaderName a[data-hovercard]');
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

    function getSmallChatEl() { return document.getElementById('ChatTabsPagelet'); }
    function getLargeChatEl() { return document.getElementById('pagelet_web_messenger'); }
    function getSmallChatActionsBtnEl() { return document.querySelector('#ChatTabsPagelet span.optionMenu a[role="button"]'); }
    function getLargeChatActionsBtnEl() { return document.querySelector('#pagelet_web_messenger div.uiPopover > button[type="submit"][value="1"]'); }
    function getLargeChatReplyBtnEl() { return document.querySelector('#pagelet_web_messenger label.uiButton.uiButtonConfirm > input[type="submit"]'); }

    function sanitizeKey(key) {
        return key.replace('.', '_');
    }

    function getMyName() {
        var profileAnchor = document.querySelector('[data-testid="blue_bar_profile_link"]');
        try {
            return profileAnchor.children[1].innerText;
        } catch(ex) {
            return undefined;
        }
    }

    function getTimestamp() {
        return new Date().toLocaleString();
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