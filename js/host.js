// js/host.js

let wakeLock = null;
let player, peer, peerId;
let connections = [];
let isAppStarted = false;
let searchLib;
let isScrubbing = false; // สถานะกำลังเลื่อน (ทั้งลากเอง และกดปุ่ม)
let seekTimeout; // [NEW] Timer สำหรับปลดล็อคหลังกดปุ่ม Seek

let state = {
  queue: [],
  currentSong: null,
  users: [],
  masterId: null,
  isTransitioning: false,
  settings: {
    reqInt: localStorage.getItem("nj_reqInt") !== "false",
    fit: localStorage.getItem("nj_fit") === "true",
    quality: localStorage.getItem("nj_quality") || "auto",
    extId: localStorage.getItem("nj_extId") || "",
    autoStartAmp: localStorage.getItem("nj_autoStartAmp") === "true",
    miniQr: localStorage.getItem("nj_miniQr") === "true",
    qrPos: localStorage.getItem("nj_qrPos") || "br",
  },
  audioFx: {
    isInstalled: false,
    isActive: false,
    pitch: 0,
    reverb: 0,
    pan: 0,
    eq: true,
  },
};

let isPlaying = false;
let isIOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
let hasInteracted = false;
let lastPlayedSongId = null;
let idleTimer;

async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {});
    }
  } catch (err) {}
}

function updateMediaSession(song) {
  if ("mediaSession" in navigator && song) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: `Requested by ${song.sender}`,
      artwork: [{ src: song.thumbnail }],
    });
    navigator.mediaSession.setActionHandler(
      "play",
      () => player && player.playVideo()
    );
    navigator.mediaSession.setActionHandler(
      "pause",
      () => player && player.pauseVideo()
    );
    navigator.mediaSession.setActionHandler("nexttrack", () => triggerNext());
  }
}
document.addEventListener("visibilitychange", async () => {
  if (wakeLock !== null && document.visibilityState === "visible")
    await requestWakeLock();
});

function saveExtensionId(val) {
  state.settings.extId = val.trim();
  localStorage.setItem("nj_extId", state.settings.extId);
  checkExtension(true);
}
function toggleAutoStartAmp() {
  state.settings.autoStartAmp = !state.settings.autoStartAmp;
  localStorage.setItem("nj_autoStartAmp", state.settings.autoStartAmp);
  updateSettingsUI();
  if (state.settings.autoStartAmp && state.audioFx.isInstalled)
    startAmpCapture();
}
function startAmpCapture() {
  if (!state.settings.extId) return;
  try {
    chrome.runtime.sendMessage(
      state.settings.extId,
      { type: "START_CAPTURE" },
      () => {}
    );
  } catch (e) {}
}
function checkExtension(shouldReset = false) {
  const inputEl = document.getElementById("input-ext-id");
  if (!state.settings.extId) {
    if (inputEl) inputEl.value = "";
    updateExtStatus(false, "No ID");
    state.audioFx.isInstalled = false;
    renderAmpStatus();
    broadcastState();
    return;
  }
  if (inputEl && inputEl.value === "") inputEl.value = state.settings.extId;
  if (!window.chrome || !chrome.runtime) {
    updateExtStatus(false, "No Runtime");
    renderAmpStatus();
    return;
  }
  updateExtStatus(false, "Pinging...", "text-yellow-500", "bg-yellow-500");

  try {
    chrome.runtime.sendMessage(
      state.settings.extId,
      { type: "PING" },
      (pong) => {
        if (chrome.runtime.lastError) {
          state.audioFx.isInstalled = false;
          updateExtStatus(false, "Connection Failed");
          return;
        }
        chrome.runtime.sendMessage(
          state.settings.extId,
          { type: "GET_STATE" },
          (response) => {
            if (response) {
              state.audioFx.isInstalled = true;
              state.audioFx.isActive = response.isAudioActive;
              state.audioFx.pitch = response.pitch || 0;
              state.audioFx.reverb = response.reverb || 0;
              updateExtStatus(true, "Connected");
              if (shouldReset) {
                chrome.runtime.sendMessage(state.settings.extId, {
                  type: "SET_PARAM",
                  key: "reset",
                  value: true,
                });
                if (state.settings.autoStartAmp) startAmpCapture();
              } else if (state.settings.autoStartAmp) startAmpCapture();
            }
            renderAmpStatus();
            broadcastState();
          }
        );
      }
    );
  } catch (e) {
    updateExtStatus(false, "Error");
    renderAmpStatus();
  }
}

function updateExtStatus(
  isOk,
  text,
  textColor = "text-zinc-400",
  dotColor = "bg-red-500"
) {
  const dot = document.getElementById("ext-status-dot");
  const txt = document.getElementById("ext-status-text");
  if (dot && txt) {
    dot.className = isOk
      ? "w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
      : text === "Pinging..."
      ? "w-2 h-2 rounded-full bg-yellow-500 animate-pulse"
      : "w-2 h-2 rounded-full bg-red-500";
    txt.className = isOk
      ? "text-green-400 font-mono text-xs font-bold"
      : text === "Pinging..."
      ? "text-yellow-500 font-mono text-xs"
      : "text-zinc-400 font-mono text-xs";
    txt.innerText = text;
  }
}
function renderAmpStatus() {
  const el = document.getElementById("header-amp-status");
  if (!el) return;
  if (state.audioFx.isInstalled) {
    el.innerHTML = `<div class="flex items-center gap-3"><span class="font-bold">P:${
      state.audioFx.pitch
    }</span><span class="font-bold">R:${Math.round(
      state.audioFx.reverb * 100
    )}</span></div>`;
    el.classList.remove("hidden");
    el.classList.add("flex");
  } else {
    el.classList.add("hidden");
    el.classList.remove("flex");
  }
}

function startApp() {
  isAppStarted = true;
  const landing = document.getElementById("landing-view");
  const playerView = document.getElementById("player-view");

  if (landing) landing.classList.add("opacity-0", "pointer-events-none");

  setTimeout(() => {
    if (landing) landing.style.display = "none";
    if (playerView) {
      playerView.classList.remove("hidden");
      setTimeout(() => playerView.classList.remove("opacity-0"), 100);
    }
    if (window.openModal) openModal("welcome-modal");
    checkExtension(false);
  }, 700);

  searchLib = new YouTubeSearch({
    onSelect: (songData) => {
      const song = {
        id: songData.id,
        title: songData.title,
        thumbnail: songData.thumbnail,
        sender: "Host (DJ)",
      };
      state.queue.push(song);
      if (window.showToast) showToast(`Added: ${song.title}`, "success");
      renderDashboard();
      broadcastState();
      if (!state.currentSong && state.queue.length === 1) triggerNext();
    },
  });

  initPlayer();
  initPeer();
  updateSettingsUI();
  checkFullscreenSupport();
  document.addEventListener("mousemove", resetIdle);
  document.addEventListener("click", resetIdle);
  resetIdle();

  // Slider Events
  const slider = document.getElementById("seek-slider");
  if (slider) {
    const startScrub = () => (isScrubbing = true);
    const endScrub = () => (isScrubbing = false);

    slider.addEventListener("mousedown", startScrub);
    slider.addEventListener("touchstart", startScrub, { passive: true });
    slider.addEventListener("mouseup", endScrub);
    slider.addEventListener("touchend", endScrub);
    slider.addEventListener("change", endScrub);
  }
}

function checkFullscreenSupport() {
  const btn = document.getElementById("btn-fullscreen");
  if (btn && document.documentElement.requestFullscreen)
    btn.classList.remove("hidden");
}

function initPeer() {
  peer = new Peer(PEER_CONFIG);
  peer.on("open", (id) => {
    peerId = id;
    const statusText = document.getElementById("status-text");
    const statusDot = document.getElementById("status-dot");
    if (statusText) {
      statusText.innerText = "ONLINE";
      statusText.classList.replace("text-gray-400", "text-green-500");
    }
    if (statusDot) statusDot.classList.replace("bg-red-500", "bg-green-500");

    const url = `${window.location.origin}/remote.html?host=${id}`;
    const linkEl = document.getElementById("join-url");
    if (linkEl) {
      linkEl.innerText = url;
      linkEl.href = url;
    }

    // Main QR
    const qrEl = document.getElementById("qrcode");
    if (qrEl) {
      qrEl.innerHTML = "";
      new QRCode(qrEl, {
        text: url,
        width: 512,
        height: 512,
        correctLevel: QRCode.CorrectLevel.L,
      });
    }

    // Mini QR
    const miniQrEl = document.getElementById("mini-qrcode");
    if (miniQrEl) {
      miniQrEl.innerHTML = "";
      new QRCode(miniQrEl, {
        text: url,
        width: 80,
        height: 80,
        correctLevel: QRCode.CorrectLevel.L,
      });
    }
  });

  peer.on("connection", (conn) => {
    conn.on("open", () => {
      connections.push(conn);
      broadcastState();
    });
    conn.on("data", (data) => handleCommand(data, conn));
    conn.on(
      "close",
      () => (connections = connections.filter((c) => c !== conn))
    );
  });
}

function initPlayer() {
  if (window.YT && window.YT.Player) createPlayer();
  else window.onYouTubeIframeAPIReady = () => createPlayer();
}
function createPlayer() {
  if (player) return;
  player = new YT.Player("youtube-player", {
    height: "100%",
    width: "100%",
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
    },
    events: { onReady: onPlayerReady, onStateChange: onPlayerStateChange },
  });
}
function onPlayerReady(event) {
  event.target.mute();
  if (state.settings.quality !== "auto")
    event.target.setPlaybackQuality(state.settings.quality);
  event.target.playVideo();
}
function onPlayerStateChange(event) {
  const playIcon = document.getElementById("play-btn-icon");
  const bufferIcon = document.getElementById("buffering-indicator");
  const qrScreen = document.getElementById("qr-screen");
  const placeholder = document.getElementById("video-placeholder");

  if (event.data === 1) {
    isPlaying = true;
    requestWakeLock();
    if (state.currentSong) updateMediaSession(state.currentSong);
    if (playIcon) playIcon.classList.replace("fa-play", "fa-pause");
    if (bufferIcon) bufferIcon.classList.add("hidden");
    if (qrScreen) qrScreen.classList.add("opacity-0", "pointer-events-none");
    if (placeholder) placeholder.classList.add("hidden");

    if (state.currentSong && state.currentSong.id !== lastPlayedSongId) {
      lastPlayedSongId = state.currentSong.id;
      showNowPlaying();
    }
    if (
      state.audioFx.isInstalled &&
      !state.audioFx.isActive &&
      state.settings.autoStartAmp
    )
      startAmpCapture();
    checkAudioContext();
  } else if (event.data === 2) {
    isPlaying = false;
    if (playIcon) playIcon.classList.replace("fa-pause", "fa-play");
  } else if (event.data === 3) {
    if (bufferIcon) bufferIcon.classList.remove("hidden");
  } else if (event.data === 0) {
    triggerNext();
  }
  broadcastState();
}
function showNowPlaying() {
  const np = document.getElementById("now-playing-overlay");
  if (np) {
    np.classList.remove("opacity-0");
    setTimeout(() => np.classList.add("opacity-0"), 5000);
  }
}
function checkAudioContext() {
  if (!state.settings.reqInt) {
    hideInteraction();
    player.unMute();
    return;
  }
  if (hasInteracted) {
    hideInteraction();
    return;
  }
  if (player.isMuted()) showInteraction();
  else hideInteraction();
}
function showInteraction(text = "แตะเพื่อเปิดเสียง") {
  const el = document.getElementById("interaction-overlay");
  if (el) {
    const h3 = el.querySelector("h3");
    if (h3) h3.innerText = text;
    el.classList.remove("hidden");
  }
}
function hideInteraction() {
  const el = document.getElementById("interaction-overlay");
  if (el) el.classList.add("hidden");
}
function handleUserInteraction(e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  if (hasInteracted) return;
  hasInteracted = true;
  if (player) {
    player.mute();
    player.playVideo();
    setTimeout(() => {
      player.unMute();
      player.setVolume(100);
    }, 500);
  }
  hideInteraction();
}

function handleCommand(cmd, conn) {
  switch (cmd.type) {
    case "JOIN":
      const u = cmd.user;
      if (state.masterId === null) {
        state.masterId = u.id;
        showToast(`${u.name} is now the DJ! 👑`, "success");
      } else if (state.masterId === u.id)
        showToast(`DJ ${u.name} reconnected`, "info");
      else showToast(`${u.name} joined`, "info");
      const exIdx = state.users.findIndex((x) => x.id === u.id);
      if (exIdx >= 0) state.users[exIdx] = u;
      else state.users.push(u);
      state.users.forEach(
        (user) => (user.isMaster = user.id === state.masterId)
      );
      renderDashboard();
      broadcastState();
      break;
    case "ADD_SONG":
      fetchVideoInfo(cmd.url).then((d) => {
        if (!d.title) return;
        const videoId = extractVideoID(cmd.url);
        const song = {
          id: videoId,
          title: d.title,
          thumbnail:
            d.thumbnail_url ||
            `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          sender: cmd.user.name,
        };
        if (cmd.playNext) {
          state.queue.unshift(song);
          showToast(`Next Track: ${song.title}`, "success");
        } else {
          state.queue.push(song);
          showToast(`Added: ${song.title}`, "success");
        }
        renderDashboard();
        broadcastState();
        if (!state.currentSong && state.queue.length === 1) triggerNext();
      });
      break;
    case "TOGGLE_PLAY":
      if (isMaster(cmd.user.id)) togglePlay();
      break;
    case "NEXT":
      if (isMaster(cmd.user.id) && !state.isTransitioning) triggerNext();
      break;

    // [MODIFIED] SEEK Logic - อัปเดต UI ทันทีและล็อค Loop ชั่วคราว
    case "SEEK":
      if (isMaster(cmd.user.id) && player && player.getDuration) {
        const d = player.getDuration();
        if (d > 0) {
          let newT = player.getCurrentTime() + (cmd.amount || 0);
          newT = Math.max(0, Math.min(d, newT)); // Clamp 0..Duration

          // 1. สั่ง Player
          player.seekTo(newT, true);

          // 2. อัปเดต UI ทันที (Optimistic Update)
          const pct = (newT / d) * 100;
          const pBar = document.getElementById("prog-bar");
          const sSlider = document.getElementById("seek-slider");
          const tCurr = document.getElementById("time-curr");
          const idleLine = document.getElementById("idle-progress-line");

          if (pBar) pBar.style.width = `${pct}%`;
          if (sSlider) sSlider.value = pct;
          if (tCurr) tCurr.innerText = formatTime(newT);
          if (idleLine) idleLine.style.width = `${pct}%`;

          // 3. ล็อค Loop การอัปเดตชั่วคราว (กัน UI เด้งกลับ)
          isScrubbing = true;
          if (seekTimeout) clearTimeout(seekTimeout);
          // ปลดล็อคหลังจาก 1 วินาที (ให้เวลา Player โหลด/Buffer)
          seekTimeout = setTimeout(() => {
            isScrubbing = false;
          }, 1000);
        }
      }
      break;

    case "SET_FX":
      if (
        isMaster(cmd.user.id) &&
        state.audioFx.isInstalled &&
        state.settings.extId
      ) {
        chrome.runtime.sendMessage(state.settings.extId, {
          type: "SET_PARAM",
          key: cmd.key,
          value: cmd.value,
          index: cmd.index,
        });
        if (cmd.key === "pitch") state.audioFx.pitch = cmd.value;
        if (cmd.key === "reverb") state.audioFx.reverb = cmd.value;
        if (cmd.key === "reset") {
          state.audioFx.pitch = 0;
          state.audioFx.reverb = 0;
          showToast("Audio FX Reset");
        }
        renderAmpStatus();
        broadcastState();
      }
      break;
    case "MOVE_QUEUE":
      if (isMaster(cmd.user.id)) {
        const { index, direction } = cmd;
        if (direction === -1 && index > 0)
          [state.queue[index], state.queue[index - 1]] = [
            state.queue[index - 1],
            state.queue[index],
          ];
        else if (direction === 1 && index < state.queue.length - 1)
          [state.queue[index], state.queue[index + 1]] = [
            state.queue[index + 1],
            state.queue[index],
          ];
        renderDashboard();
        broadcastState();
      }
      break;
    case "GET_STATE":
      broadcastState();
      break;
  }
}

function triggerNext() {
  const cd = document.getElementById("countdown-overlay");
  const qrScreen = document.getElementById("qr-screen");
  const songTitle = document.getElementById("header-song-title");

  if (state.queue.length > 0) {
    state.isTransitioning = true;
    broadcastState();
    const song = state.queue.shift();

    if (qrScreen) qrScreen.classList.add("opacity-0", "pointer-events-none");

    const cdTitle = document.getElementById("cd-title");
    const cdSender = document.getElementById("cd-sender");
    const cdBg = document.getElementById("cd-bg");
    const cdNum = document.getElementById("cd-number");

    if (cdTitle) cdTitle.innerText = song.title;
    if (cdSender) cdSender.innerText = song.sender;
    if (cdBg) cdBg.src = song.thumbnail;

    if (cd) cd.classList.remove("hidden");

    let count = 3;
    if (cdNum) cdNum.innerText = count;

    const timer = setInterval(() => {
      count--;
      if (cdNum) cdNum.innerText = count;
      if (count <= 0) {
        clearInterval(timer);
        if (cd) cd.classList.add("hidden");
        playSong(song);
      }
    }, 1000);
  } else {
    state.isTransitioning = false;
    state.currentSong = null;
    player.stopVideo();
    if (songTitle) songTitle.classList.add("hidden");
    if (qrScreen) qrScreen.classList.remove("opacity-0", "pointer-events-none");
    const placeholder = document.getElementById("video-placeholder");
    if (placeholder) placeholder.classList.remove("hidden");

    broadcastState();
  }
}
function playSong(song) {
  state.isTransitioning = false;
  state.currentSong = song;
  updateMediaSession(song);
  renderDashboard();
  const t = document.getElementById("header-song-title");
  if (t) {
    t.innerText = song.title;
    t.classList.remove("hidden");
  }

  const npTitle = document.getElementById("np-title");
  const npThumb = document.getElementById("np-thumb");
  const npSender = document.getElementById("np-sender");

  if (npTitle) npTitle.innerText = song.title;
  if (npThumb) npThumb.src = song.thumbnail;
  if (npSender) npSender.innerText = song.sender;

  player.loadVideoById({
    videoId: song.id,
    suggestedQuality:
      state.settings.quality !== "auto" ? state.settings.quality : "large",
  });
  broadcastState();
}
function isMaster(id) {
  return id === state.masterId;
}
function broadcastState() {
  connections.forEach((c) => {
    if (c.open)
      c.send({
        type: "UPDATE_STATE",
        queue: state.queue,
        users: state.users,
        masterId: state.masterId,
        currentId: state.currentSong?.id,
        audioFx: state.audioFx,
        isPlaying,
        isTransitioning: state.isTransitioning,
      });
  });
}

function renderDashboard() {
  const qList = document.getElementById("queue-list");
  if (qList) {
    document.getElementById("queue-count").innerText = state.queue.length;
    qList.innerHTML =
      state.queue.length === 0
        ? '<div class="text-zinc-600 text-xs italic text-center py-4">No songs</div>'
        : state.queue
            .map(
              (s, i) =>
                `<div class="flex justify-between p-2 bg-zinc-800/30 rounded border border-white/5 text-xs"><span class="truncate flex-1 text-gray-300">${
                  i + 1
                }. ${
                  s.title
                }</span><span class="text-[10px] text-gray-500 ml-2">${
                  s.sender
                }</span></div>`
            )
            .join("");
  }
  const uList = document.getElementById("user-list");
  if (uList) {
    document.getElementById("user-count").innerText = state.users.length;
    uList.innerHTML = state.users
      .map(
        (u) =>
          `<div class="flex justify-between p-2 bg-zinc-800/30 rounded border border-white/5 text-xs"><span class="${
            u.id === state.masterId ? "text-red-500 font-bold" : "text-gray-300"
          }">${u.name} ${u.id === state.masterId ? "👑" : ""}</span>${
            u.id !== state.masterId
              ? `<button onclick="promoteUser('${u.id}')" class="text-[10px] bg-zinc-700 px-2 rounded hover:bg-zinc-600 text-white">Make DJ</button>`
              : ""
          }</div>`
      )
      .join("");
  }
}
function promoteUser(id) {
  state.masterId = id;
  state.users.forEach((u) => (u.isMaster = u.id === id));
  renderDashboard();
  broadcastState();
  showToast("DJ Changed!", "info");
}

function togglePlay() {
  // [MODIFIED] Check actual player state (1 = Playing)
  // If stuck (Buffering/Unstarted) or Paused -> Force Play & Unmute
  if (player && typeof player.getPlayerState === "function") {
    const state = player.getPlayerState();
    if (state === 1) {
      player.pauseVideo();
    } else {
      player.unMute();
      player.setVolume(100);
      player.playVideo();
    }
  } else {
    // Fallback logic
    isPlaying ? player.pauseVideo() : player.playVideo();
  }
}

function handleSeek(val) {
  isScrubbing = true;

  const pBar = document.getElementById("prog-bar");
  const tCurr = document.getElementById("time-curr");

  if (pBar) pBar.style.width = `${val}%`;

  if (player && player.getDuration) {
    const d = player.getDuration();
    if (d > 0) {
      const seekTime = (val / 100) * d;
      if (tCurr) tCurr.innerText = formatTime(seekTime);
      player.seekTo(seekTime, true);
    }
  }
}

setInterval(() => {
  if (player && isPlaying) {
    const c = player.getCurrentTime(),
      d = player.getDuration();
    if (d > 0) {
      const tCurr = document.getElementById("time-curr");
      const tDur = document.getElementById("time-dur");
      const pBar = document.getElementById("prog-bar");
      const sSlider = document.getElementById("seek-slider");
      const idleLine = document.getElementById("idle-progress-line");

      if (tDur) tDur.innerText = formatTime(d);

      if (!isScrubbing) {
        const pct = (c / d) * 100;
        if (pBar) pBar.style.width = `${pct}%`;
        if (sSlider) sSlider.value = pct;
        if (tCurr) tCurr.innerText = formatTime(c);
        if (idleLine) idleLine.style.width = `${pct}%`;
      }
    }
  }
}, 500);

function toggleSetting(key) {
  state.settings[key] = !state.settings[key];
  localStorage.setItem(`nj_${key}`, state.settings[key]);
  updateSettingsUI();
}
function updateQuality(val) {
  state.settings.quality = val;
  localStorage.setItem("nj_quality", val);
}

function updateSettingsUI() {
  const setBtn = (id, active) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.className = `w-10 h-6 rounded-full relative transition-colors ${
        active ? "bg-green-600" : "bg-zinc-700"
      }`;
      if (btn.firstElementChild)
        btn.firstElementChild.className = `absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          active ? "translate-x-5" : "translate-x-1"
        }`;
    }
  };
  setBtn("btn-reqInt", state.settings.reqInt);
  setBtn("btn-fit", state.settings.fit);
  setBtn("btn-autoStartAmp", state.settings.autoStartAmp);
  setBtn("btn-miniQr", state.settings.miniQr);

  const vWrap = document.getElementById("video-wrapper");
  if (vWrap) {
    if (state.settings.fit)
      vWrap.className =
        "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100dvw] h-[56.25dvw] min-h-[100dvh] min-w-[177.78dvh] pointer-events-none transition-all duration-500 z-0 bg-black";
    else
      vWrap.className =
        "relative w-full h-full flex items-center justify-center transition-all duration-500";
  }

  const qSel = document.getElementById("sel-quality");
  if (qSel) qSel.value = state.settings.quality;

  const miniQrDiv = document.getElementById("mini-qr");
  const qrPosSel = document.getElementById("sel-qrPos");
  if (qrPosSel) qrPosSel.value = state.settings.qrPos;

  if (miniQrDiv) {
    if (state.settings.miniQr) miniQrDiv.classList.remove("hidden");
    else miniQrDiv.classList.add("hidden");

    miniQrDiv.classList.remove("top-20", "left-4", "right-4", "bottom-24");

    const p = state.settings.qrPos;
    if (p === "tl") miniQrDiv.classList.add("top-20", "left-4");
    else if (p === "tr") miniQrDiv.classList.add("top-20", "right-4");
    else if (p === "bl") miniQrDiv.classList.add("bottom-24", "left-4");
    else if (p === "br") miniQrDiv.classList.add("bottom-24", "right-4");
  }

  // [NEW] Trigger Server List Render when Settings UI Updates
  if (searchLib && typeof searchLib.renderServerList === "function") {
    searchLib.renderServerList();
  }
}

function updateQrPos(val) {
  state.settings.qrPos = val;
  localStorage.setItem("nj_qrPos", val);
  updateSettingsUI();
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
}
function resetIdle() {
  document.body.classList.remove("idle-mode");
  clearTimeout(idleTimer);
  const isModalOpen =
    !document.getElementById("settings-modal").classList.contains("hidden") ||
    !document.getElementById("search-modal").classList.contains("hidden");
  if (!isModalOpen && isAppStarted) {
    idleTimer = setTimeout(() => {
      document.body.classList.add("idle-mode");
    }, 3000);
  }
}
function copyJoinLink() {
  const link = document.getElementById("join-url");
  if (link)
    navigator.clipboard
      .writeText(link.href)
      .then(() => showToast("Link Copied!", "success"));
}
