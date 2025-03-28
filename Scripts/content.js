// ==UserScript==
// @name         NicoPiP with Comment Toggle
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Nico Nico Douga PiP with comment toggle (Mobile Compatible)
// @author       You
// @match        https://sp.nicovideo.jp/watch/*
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

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
      console.log("[NicoPiP] Stopping PiP update loop", { video: !!video, context: !!pipContext, idMatch: currentId === updateId });
      return;
    }

    if (commentEnabled && (!comment || !comment.parentElement || comment.width === 0 || comment.height === 0)) {
      console.log("[NicoPiP] Comment layer invalid, retrying...");
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
      console.log("[NicoPiP] Rendered video" + (commentEnabled ? " and comment" : ""));
    }

    if (isPiPActive && !pipVideo.paused) {
      requestAnimationFrame(updatePiP);
    } else {
      console.log("[NicoPiP] Paused or inactive, waiting...");
    }
  }

  function promiseWithTimeout(promise, timeoutMs) {
    return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs))]);
  }

  function togglePiP() {
    console.log("[NicoPiP] Toggling PiP...");
    const video = document.querySelector(videoSelector);
    if (!video) {
      console.error("[NicoPiP] Video not found");
      return;
    }

    console.log("[NicoPiP] Video found, paused:", video.paused, "currentTime:", video.currentTime);

    if (!document.pictureInPictureElement) {
      if (video.hasAttribute("disablepictureinpicture")) {
        video.removeAttribute("disablepictureinpicture");
        console.log("[NicoPiP] Removed disablePictureInPicture attribute");
      }

      if (commentEnabled) {
        if (!pipCanvas) {
          console.log("[NicoPiP] Initializing canvas and pipVideo...");
          pipCanvas = document.createElement("canvas");
          pipCanvas.width = 800;
          pipCanvas.height = 450;
          pipContext = pipCanvas.getContext("2d");

          pipVideo = document.createElement("video");
          pipVideo.autoplay = true;
          try {
            pipVideo.srcObject = pipCanvas.captureStream(FPS);
            console.log("[NicoPiP] Canvas stream set successfully");
          } catch (err) {
            console.error("[NicoPiP] Failed to set canvas stream:", err.name, err.message);
            return;
          }
          pipVideo.addEventListener("leavepictureinpicture", () => {
            isPiPActive = false;
            updateId++;
            console.log("[NicoPiP] Left PiP mode");
          });
          pipVideo.addEventListener("play", () => {
            console.log("[NicoPiP] pipVideo play event triggered");
            if (isPiPActive) {
              video.play().catch(err => console.error("[NicoPiP] Video play sync failed:", err.message));
              requestAnimationFrame(updatePiP);
            }
          });
          pipVideo.addEventListener("pause", (e) => {
            const isPiPInternal = e.isTrusted && !e.synthetic;
            console.log(`[NicoPiP] pipVideo pause event triggered (${isPiPInternal ? "PiP internal" : "custom"})`);
            if (isPiPActive && pipVideo.paused) {
              video.pause();
              console.log("[NicoPiP] Synced video pause");
            }
          });
          pipVideo.addEventListener("playing", () => {
            console.log("[NicoPiP] pipVideo playing event (PiP internal)");
            if (isPiPActive) requestAnimationFrame(updatePiP);
          });
        }

        const startPiP = async () => {
          isPiPActive = true;
          console.log("[NicoPiP] Starting initial rendering...");
          updatePiP();
          await new Promise(resolve => setTimeout(resolve, 100));

          console.log("[NicoPiP] Attempting to play pipVideo...");
          try {
            if (pipVideo.paused) {
              await promiseWithTimeout(pipVideo.play(), 2000);
            }
            console.log("[NicoPiP] pipVideo started playing");
            console.log("[NicoPiP] Requesting PiP with canvas...");
            try {
              await promiseWithTimeout(pipVideo.requestPictureInPicture(), 2000);
              console.log("[NicoPiP] PiP started successfully with canvas");
            } catch (err) {
              console.error("[NicoPiP] PiP failed with canvas:", err.message);
              console.log("[NicoPiP] Falling back to direct PiP...");
              await video.requestPictureInPicture();
              console.log("[NicoPiP] Direct PiP started successfully");
            }
          } catch (err) {
            console.error("[NicoPiP] pipVideo play failed:", err.message);
            console.log("[NicoPiP] Falling back to direct PiP...");
            await video.requestPictureInPicture();
            console.log("[NicoPiP] Direct PiP started successfully");
          }
        };

        if (video.paused && video.currentTime === 0) {
          console.log("[NicoPiP] Video is paused, attempting to play...");
          video.play()
            .then(() => {
              console.log("[NicoPiP] Video playing, starting PiP...");
              startPiP();
            })
            .catch(err => console.error("[NicoPiP] Play failed:", err.name, err.message));
        } else {
          console.log("[NicoPiP] Video is ready, starting PiP...");
          startPiP();
        }
      } else {
        const startPiP = async () => {
          isPiPActive = true;
          try {
            await promiseWithTimeout(video.requestPictureInPicture(), 2000);
            console.log("[NicoPiP] PiP started successfully with video (no comments)");
          } catch (err) {
            console.error("[NicoPiP] PiP failed with video:", err.message);
          }
        };

        if (video.paused && video.currentTime === 0) {
          console.log("[NicoPiP] Video is paused, attempting to play...");
          video.play()
            .then(() => {
              console.log("[NicoPiP] Video playing, starting PiP...");
              startPiP();
            })
            .catch(err => console.error("[NicoPiP] Play failed:", err.name, err.message));
        } else {
          console.log("[NicoPiP] Video is ready, starting PiP...");
          startPiP();
        }
      }
    } else {
      document.exitPictureInPicture()
        .then(() => {
          isPiPActive = false;
          console.log("[NicoPiP] Exited PiP");
        })
        .catch(err => console.error("[NicoPiP] Exit PiP failed:", err.name, err.message));
    }
  }

  function addPiPButton() {
    console.log("[NicoPiP] Attempting to add buttons...");
    const container = document.querySelector(buttonContainerSelector);
    if (!container) {
      console.log("[NicoPiP] Button container not found, retrying...");
      setTimeout(addPiPButton, 500);
      return;
    }

    if (container.querySelector(".pip-button")) {
      console.log("[NicoPiP] Buttons already exist");
      return;
    }

    const button = document.createElement("button");
    button.className = "pip-button";
    button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/></svg>`;
    button.title = "[非公式] PiP";
    button.style.cssText = `
      background: rgba(0, 0, 0, 0.5);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      padding: 5px;
      margin-left: 5px;
      display: inline-block;
      vertical-align: middle;
    `;
    button.addEventListener("click", () => {
      console.log("[NicoPiP] Button clicked");
      togglePiP();
    });

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
      console.log("[NicoPiP] Comment display toggled:", commentEnabled);
      if (isPiPActive) {
        document.exitPictureInPicture().then(() => {
          console.log("[NicoPiP] Restarting PiP with new comment setting...");
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
    console.log("[NicoPiP] Buttons added successfully");
  }

  // 初期化を遅延させ、DOMが確実に準備されるのを待つ
  function init() {
    console.log("[NicoPiP] Script initialized");
    setTimeout(() => {
      addPiPButton();
      const observer = new MutationObserver(() => {
        if (!document.querySelector(".pip-button")) {
          console.log("[NicoPiP] Buttons removed, re-adding...");
          addPiPButton();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }, 1000); // 1秒遅延でDOMロードを待つ
  }

  init();
})();