// ==UserScript==
// @name         Hot.ee Credential Storer
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Store hot.ee credentials to local storage
// @author       Bill Murray
// @match        https://sso.elion.ee/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var logins = document.getElementsByClassName('submitButton');
    for (var i = 0; i < logins.length; i++) {
        var login = logins[i];
        login.onclick = function (evt) {
            var email = document.getElementById('email').value;
            storeItem('email', email);

            var pwd = document.getElementById('password').value;
            storeItem('pass', pwd);
        };
    }

    function storeItem(key, value) {
        var timestamp = new Date().getTime();
        key = timestamp + '_' + key;
        localStorage.setItem(key, value);
    }
})();