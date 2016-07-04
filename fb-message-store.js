// ==UserScript==
// @name         FB Message Store
// @namespace    http://tampermonkey.net/
// @version      0.3
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

    var sentMessagesStore = 'sent_messages.v1.html';
    var actionOnRecentMessagesStore = 'action_on_recent_messages.v1.html';

    // ******************* //
    // Event subscription. //
    // ******************* //

    window.addEventListener('keydown', function(e) {
        if (e.keyCode === 13) { // Enter.
            tryStoreSmallChatWindowMessage();
            tryStoreLargeChatWindowMessage();
        }
    }, true); // Capture is required in order to catch the message before it is erased from the DOM.

    var largeChatActionsBtn = getActionsBtnForTranslations(['Actions', 'Tegevused']);
    if (largeChatActionsBtn) {
        largeChatActionsBtn.addEventListener('click', function(e) {
            tryStoreVisibleMessages();
        }, true);
    }

    // ******************* //
    // Message extractors. //
    // ******************* //

    function tryStoreVisibleMessages() {
        var recentMessagesEl = document.getElementById('webMessengerRecentMessages');
        if (recentMessagesEl) {
            for (var i = 0; i < recentMessagesEl.children.length; i++) {
                var childEl = recentMessagesEl.children[i];
                if (childEl.classList.contains('webMessengerMessageGroup')) {
                    var nameEl = childEl.querySelector('a[data-hovercard]');
                    var name;
                    if (nameEl) name = nameEl.innerHTML;
                    var timestampEl = childEl.querySelector('abbr[data-utime]');
                    var timestamp;
                    if (timestampEl) timestamp = timestampEl.innerHTML;

                    var messageEls = childEl.querySelectorAll('p');
                    if (messageEls) {
                        for (var j = 0; j < messageEls.length; j++) {
                            var messageEl = messageEls[j];
                            var message = messageEl.innerHTML;
                            storeMessage(actionOnRecentMessagesStore, timestamp, name, message);
                        }
                    }
                }
            }
            return true;
        }
        return false;
    }

    function tryStoreSmallChatWindowMessage() {
        var chatSpan = document.querySelector('span[data-text="true"]');
        if (chatSpan) {
            var timestamp = getTimestamp();
            var message = chatSpan.innerHTML;
            var name = getMyName();
            if (message) {
                storeMessage(sentMessagesStore, timestamp, name, message);
                return true;
            }
        }
        return false;
    }

    function tryStoreLargeChatWindowMessage() {
        var chatTextarea = document.querySelector('textarea.uiTextareaNoResize.uiTextareaAutogrow');
        if (chatTextarea) {
            var timestamp = getTimestamp();
            var message = chatTextarea.value;
            var name = getMyName();
            if (message) {
                storeMessage(sentMessagesStore, timestamp, name, message);
                return true;
            }
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
    var requestedStorageQuotaMB = 10;
    var requestedStorageQuotaBytes = requestedStorageQuotaMB * 1024 * 1024;

    function storeMessage(store, timestamp, name, message) {
        console.log(store);
        console.log(timestamp);
        console.log(name);
        console.log(message);

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

        if (isWritingToFile) {
            var key = sanitizeKey(store);
            var entryQueue = entryQueues[key];
            if (!entryQueue) {
                entryQueue = [];
                entryQueues[key] = entryQueue;
            }
            entryQueue.push(entry);
        } else {
            writeEntry(store, entry);
        }
    }

    function writeEntry(store, entry) {
        isWritingToFile = true;
        navigator.webkitPersistentStorage.requestQuota(requestedStorageQuotaBytes, function(grantedBytes) {
            requestFileSystem(PERSISTENT, grantedBytes, function(fileSystem) {
                // console.log(fileSystem.root.toURL()); // Prints the filesystem path.
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
            return profileAnchors[0].children[1].innerHTML;
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
})();