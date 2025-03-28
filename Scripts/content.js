// ==UserScript==
// @name         ニコニコ動画 PiPコントローラー
// @namespace    https://sp.nicovideo.jp/
// @version      1.0
// @description  ニコニコ動画でPiP(ピクチャーインピクチャー)機能を強化し、コメント表示の切り替えを可能にします
// @author       YourName
// @match        https://www.sp.nicovideo.jp/watch/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
  'use strict';

  const videoSelector = "#watchVideoContainer > video";
  const commentSelector = "#jsPlayerCanvasComment > canvas";
  const buttonContainerSelector = "body > div:nth-child(11) > div.watch-TopFixed_Container.commentInputSticky > div.watch-Player_Container.screen-playing.current-video-type-content.show-controllers > div > div.watch-PlayerControllerDock_Container";

  const FPS = 60;
  let isPiPActive = false;
  let pipCanvas = null;
  let pipContext = null;
  let pipVideo = null;
  let updateId = 0;
  let commentEnabled = true;
  let commentToggleButton = null;

  function resizeToFit(srcWidth, srcHeight, destWidth, destHeight) {
    const widthRatio = destWidth / srcWidth;
    const heightRatio = destHeight / srcHeight;
    const scale = Math.min(widthRatio, heightRatio);
    return { width: Math.floor(srcWidth * scale), height: Math.floor(srcHeight * scale) };
  }

  function updatePiP() {
    const currentId = ++updateId;
    const video = document.querySelector(videoSelector);
    const comment = document.querySelector(commentSelector);

    if (!video || !pipContext || currentId !== updateId) {
      if (video) video.style.visibility = "visible";
      return;
    }

    if (commentEnabled && (!comment || !comment.parentElement || comment.width === 0 || comment.height === 0)) {
      setTimeout(updatePiP, 100);
      return;
    }

    if (pipCanvas && video && video.videoWidth) {
      video.style.visibility = isPiPActive ? "hidden" : "visible";
      pipContext.fillStyle = "#000";
      pipContext.fillRect(0, 0, pipCanvas.width, pipCanvas.height);

      const videoSize = resizeToFit(video.videoWidth, video.videoHeight, pipCanvas.width, pipCanvas.height);
      pipContext.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, (pipCanvas.width - videoSize.width) / 2, (pipCanvas.height - videoSize.height) / 2, videoSize.width, videoSize.height);

      if (commentEnabled && comment) {
        const commentSize = resizeToFit(comment.width, comment.height, pipCanvas.width, pipCanvas.height);
        pipContext.drawImage(comment, 0, 0, comment.width, comment.height, (pipCanvas.width - commentSize.width) / 2, (pipCanvas.height - commentSize.height) / 2, commentSize.width, commentSize.height);
      }
    }

    if (isPiPActive && !pipVideo.paused) {
      requestAnimationFrame(updatePiP);
    }
  }

  function promiseWithTimeout(promise, timeoutMs) {
    return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs)]);
  }

  function togglePiP() {
    const video = document.querySelector(videoSelector);
    if (!video) return;

    if (!document.pictureInPictureElement) {
      if (video.hasAttribute("disablepictureinpicture")) {
        video.removeAttribute("disablepictureinpicture");
      }

      if (commentEnabled) {
        if (!pipCanvas) {
          pipCanvas = document.createElement("canvas");
          pipCanvas.width = 800;
          pipCanvas.height = 450;
          pipContext = pipCanvas.getContext("2d");

          pipVideo = document.createElement("video");
          pipVideo.autoplay = true;
          try {
            pipVideo.srcObject = pipCanvas.captureStream(FPS);
          } catch (err) {
            console.error("[NicoPiP] Failed to set canvas stream:", err);
            return;
          }
          pipVideo.addEventListener("leavepictureinpicture", () => {
            isPiPActive = false;
            updateId++;
          });
          pipVideo.addEventListener("play", () => {
            if (isPiPActive) {
              video.play().catch(err => console.error("[NicoPiP] Video play sync failed:", err));
              requestAnimationFrame(updatePiP);
            }
          });
          pipVideo.addEventListener("pause", (e) => {
            if (isPiPActive && pipVideo.paused) {
              video.pause();
            }
          });
          pipVideo.addEventListener("playing", () => {
            if (isPiPActive) requestAnimationFrame(updatePiP);
          });
        }

        const startPiP = async () => {
          isPiPActive = true;
          updatePiP();
          await new Promise(resolve => setTimeout(resolve, 100));

          try {
            if (pipVideo.paused) {
              await promiseWithTimeout(pipVideo.play(), 2000);
            }
            try {
              await promiseWithTimeout(pipVideo.requestPictureInPicture(), 2000);
            } catch (err) {
              await video.requestPictureInPicture();
            }
          } catch (err) {
            await video.requestPictureInPicture();
          }
        };

        if (video.paused && video.currentTime === 0) {
          video.play().then(startPiP).catch(err => console.error("[NicoPiP] Play failed:", err));
        } else {
          startPiP();
        }
      } else {
        const startPiP = async () => {
          isPiPActive = true;
          try {
            await promiseWithTimeout(video.requestPictureInPicture(), 2000);
          } catch (err) {
            console.error("[NicoPiP] PiP failed with video:", err);
          }
        };

        if (video.paused && video.currentTime === 0) {
          video.play().then(startPiP).catch(err => console.error("[NicoPiP] Play failed:", err));
        } else {
          startPiP();
        }
      }
    } else {
      document.exitPictureInPicture()
        .then(() => {
          isPiPActive = false;
        })
        .catch(err => console.error("[NicoPiP] Exit PiP failed:", err));
    }
  }

  function addPiPButton() {
    const container = document.querySelector(buttonContainerSelector);
    if (!container) {
      setTimeout(addPiPButton, 500);
      return;
    }

    if (container.querySelector(".pip-button")) return;

    const button = document.createElement("button");
    button.className = "pip-button";
    button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/></svg>`;
    button.title = "[非公式] PiP";
    button.style.cssText = `
      background: rgba(255, 255, 255, 0);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      padding: 5px;
      margin-left: 5px;
      display: inline-block;
      vertical-align: middle;
    `;
    button.addEventListener("click", togglePiP);

    commentToggleButton = document.createElement("button");
    commentToggleButton.className = "pip-comment-toggle";
    commentToggleButton.textContent = commentEnabled ? "コメOff" : "コメOn";
    commentToggleButton.style.cssText = `
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      padding: 2px 5px;
      margin-left: 5px;
      display: inline-block;
      vertical-align: middle;
      font-size: 12px;
    `;
    commentToggleButton.addEventListener("click", () => {
      commentEnabled = !commentEnabled;
      commentToggleButton.textContent = commentEnabled ? "コメOff" : "コメOn";
      if (isPiPActive) {
        document.exitPictureInPicture().then(() => {
          togglePiP();
        });
      }
    });

    const repeatButton = container.querySelector(".watch-PlayerUpperControllerDock_Repeat");
    if (repeatButton) {
      repeatButton.parentNode.insertBefore(button, repeatButton.nextSibling);
      repeatButton.parentNode.insertBefore(commentToggleButton, button.nextSibling);
    } else {
      container.appendChild(button);
      container.appendChild(commentToggleButton);
    }
  }

  // ページ読み込み完了後にボタンを追加
  if (document.readyState === "complete") {
    addPiPButton();
  } else {
    window.addEventListener("load", addPiPButton);
  }

  // DOM変更監視
  const observer = new MutationObserver(() => {
    if (!document.querySelector(".pip-button")) {
      addPiPButton();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();