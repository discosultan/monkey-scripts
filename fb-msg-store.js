// ==UserScript==
// @name         FB Msg Store
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Additional FB message store
// @author       Bill Murray
// @match        https://*.facebook.com/*
// @grant        none
// ==/UserScript==

// filesystem:https://www.facebook.com/persistent/

(function() {
    'use strict';

    var requestFileSystem = requestFileSystem || webkitRequestFileSystem;

    window.addEventListener('keydown', function(e) {
        if (e.keyCode === 13) { // Enter.
            var spans = [].slice.call(document.getElementsByTagName('span'));
            var chatSpans = spans.filter(function(element) { return element.hasAttribute('data-text'); });
            if (chatSpans.length) {
                for (var i = 0; i < chatSpans.length; i++) {
                    var chatSpan = chatSpans[i];
                    storeMessage(chatSpan.innerHTML);
                }
            }
        }
    }, true); // Capture is required in order to catch the msg before it is erased from the DOM.

    function storeMessage(msg) {
        var requestedStorageQuotaMB = 10;
        var requestedStorageQuotaBytes = requestedStorageQuotaMB * 1024 * 1024;
        navigator.webkitPersistentStorage.requestQuota(requestedStorageQuotaBytes, function(grantedBytes) {
            requestFileSystem(PERSISTENT, grantedBytes, function(fileSystem) {
                // console.log(fileSystem.root.toURL()); // Prints the filesystem path.
                fileSystem.root.getFile('messages.txt', { create: true, exclusive: false }, function(fileEntry) {
                    fileEntry.createWriter(function(fileWriter) {
                        var blob = new Blob([msg, '\n'], {type: 'text/plain'});
                        fileWriter.seek(fileWriter.length); // Start write position at EOF.
                        fileWriter.write(blob);
                    }, handleError);
                }, handleError);
            }, handleError);
        }, handleError);
    }

    function handleError(err) {
        console.error(err);
    }
})();