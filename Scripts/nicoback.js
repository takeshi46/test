// ==UserScript==
// @name         Video Background Play Fix
// @namespace    https://greasyfork.org/en/users/50-couchy
// @version      20250328
// @description  Prevents YouTube, Vimeo, and NicoNico from pausing videos when minimizing or switching tabs.
// @author       Couchy
// @match        *://*.youtube.com/*
// @match        *://*.vimeo.com/*
// @match        *://sp.nicovideo.jp/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
  'use strict';
  
  const IS_YOUTUBE = window.location.hostname.search(/(?:^|.+\.)youtube\.com/) > -1 ||
                     window.location.hostname.search(/(?:^|.+\.)youtube-nocookie\.com/) > -1;
  const IS_MOBILE_YOUTUBE = window.location.hostname == 'm.youtube.com';
  const IS_DESKTOP_YOUTUBE = IS_YOUTUBE && !IS_MOBILE_YOUTUBE;
  const IS_VIMEO = window.location.hostname.search(/(?:^|.+\.)vimeo\.com/) > -1;
  const IS_NICONICO = window.location.hostname === 'sp.nicovideo.jp';
  
  const IS_ANDROID = window.navigator.userAgent.indexOf('Android') > -1;
  
  // デバッグ用ログ
  function log(msg) {
    console.log(`[Video Background Play Fix] ${msg}`);
  }
  
  // Page Visibility APIを偽装
  if (IS_ANDROID || !IS_DESKTOP_YOUTUBE || IS_NICONICO) {
    Object.defineProperties(document, {
      'hidden': { value: false, writable: false },
      'visibilityState': { value: 'visible', writable: false }
    });
    log("Page Visibility APIを偽装しました");
  }
  
  // 関連イベントをブロック
  const eventsToBlock = ['visibilitychange', 'pagehide', 'blur', 'focusout'];
  eventsToBlock.forEach(event => {
    window.addEventListener(event, evt => {
      evt.stopImmediatePropagation();
      log(`イベントをブロック: ${event}`);
    }, true);
  });
  
  // Fullscreen APIをブロック
  if (IS_VIMEO || IS_NICONICO) {
    window.addEventListener('fullscreenchange', evt => {
      evt.stopImmediatePropagation();
      log("フルスクリーン変更イベントをブロック");
    }, true);
  }
  
  // ユーザーアクティビティをシミュレート
  if (IS_YOUTUBE || IS_NICONICO) {
    loop(pressKey, 30 * 1000, 5 * 1000); // 30秒ごとに実行（調整）
    log("ユーザーアクティビティのシミュレーションを開始");
  }
  
  // ニコニコ動画のプレーヤーを強制再生（仮実装）
  if (IS_NICONICO) {
    loop(() => {
      const video = document.querySelector('video');
      if (video && video.paused) {
        video.play().catch(err => log(`再生エラー: ${err}`));
        log("ビデオを強制再生");
      }
    }, 1000, 500); // 1秒ごとにチェック
  }
  
  function pressKey() {
    const key = 18; // Altキー
    sendKeyEvent("keydown", key);
    sendKeyEvent("keyup", key);
    log("キーイベントを送信");
  }
  
  function sendKeyEvent(aEvent, aKey) {
    document.dispatchEvent(new KeyboardEvent(aEvent, {
      bubbles: true,
      cancelable: true,
      keyCode: aKey,
      which: aKey,
    }));
  }
  
  function loop(aCallback, aDelay, aJitter) {
    let jitter = getRandomInt(-aJitter/2, aJitter/2);
    let delay = Math.max(aDelay + jitter, 0);
  
    window.setTimeout(() => {
      aCallback();
      loop(aCallback, aDelay, aJitter);
    }, delay);
  }
  
  function getRandomInt(aMin, aMax) {
    let min = Math.ceil(aMin);
    let max = Math.floor(aMax);
    return Math.floor(Math.random() * (max - min)) + min;
  }
  
  })();