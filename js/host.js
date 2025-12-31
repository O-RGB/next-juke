// next-juke/js/host.js

let wakeLock = null;
let player, peer, peerId;
let connections = [];
let isAppStarted = false;

let state = {
  queue: [],
  currentSong: null,
  users: [],
  masterId: null,
  settings: {
    reqInt: localStorage.getItem("nj_reqInt") !== "false",
    fit: localStorage.getItem("nj_fit") === "true",
    quality: localStorage.getItem("nj_quality") || "auto",
    extId: localStorage.getItem("nj_extId") || "",
    autoStartAmp: localStorage.getItem("nj_autoStartAmp") === "true", // Setting ใหม่
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
let isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
let hasInteracted = false;
let lastPlayedSongId = null;
let idleTimer;

async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
      console.log("Screen Wake Lock active");
      wakeLock.addEventListener("release", () => {
        console.log("Screen Wake Lock released");
      });
    }
  } catch (err) {
    console.error(`Wake Lock Error: ${err.name}, ${err.message}`);
  }
}

function updateMediaSession(song) {
  if ("mediaSession" in navigator && song) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: `Requested by ${song.sender}`,
      album: "NextCast Party",
      artwork: [
        { src: song.thumbnail, sizes: "96x96", type: "image/jpeg" },
        { src: song.thumbnail, sizes: "128x128", type: "image/jpeg" },
        { src: song.thumbnail, sizes: "192x192", type: "image/jpeg" },
        { src: song.thumbnail, sizes: "512x512", type: "image/jpeg" },
      ],
    });
    navigator.mediaSession.setActionHandler("play", () => {
      if (player) player.playVideo();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      if (player) player.pauseVideo();
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => triggerNext());
    navigator.mediaSession.setActionHandler("stop", () => {
      if (player) player.stopVideo();
    });
  }
}

document.addEventListener("visibilitychange", async () => {
  if (wakeLock !== null && document.visibilityState === "visible") {
    await requestWakeLock();
  }
});

// --- Extension Logic ---

function saveExtensionId(val) {
  const cleanVal = val.trim();
  state.settings.extId = cleanVal;
  localStorage.setItem("nj_extId", cleanVal);
  checkExtension(true);
}

function toggleAutoStartAmp() {
  state.settings.autoStartAmp = !state.settings.autoStartAmp;
  localStorage.setItem("nj_autoStartAmp", state.settings.autoStartAmp);
  updateSettingsUI();

  if (state.settings.autoStartAmp && state.audioFx.isInstalled) {
    // ถ้าเปิดแล้วต่ออยู่ ให้เริ่มเลย
    startAmpCapture();
  }
}

function startAmpCapture() {
  if (!state.settings.extId) return;
  console.log("Starting Amp Capture...");
  try {
    chrome.runtime.sendMessage(
      state.settings.extId,
      {
        type: "START_CAPTURE",
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Start Capture Error:", chrome.runtime.lastError);
        } else {
          console.log("Capture Started:", response);
        }
      }
    );
  } catch (e) {
    console.error(e);
  }
}

function checkExtension(shouldReset = false) {
  const inputEl = document.getElementById("input-ext-id");

  if (!state.settings.extId) {
    if (inputEl && !inputEl.value) inputEl.value = "";
    updateExtStatus(false, "No ID");
    state.audioFx.isInstalled = false;
    renderAmpStatus();
    broadcastState();
    return;
  }

  if (inputEl && inputEl.value === "") inputEl.value = state.settings.extId;

  if (!window.chrome || !chrome.runtime) {
    updateExtStatus(false, "Runtime Not Found");
    renderAmpStatus();
    return;
  }

  // แสดงสถานะว่ากำลัง PING
  updateExtStatus(false, "Pinging...", "text-yellow-500", "bg-yellow-500");

  try {
    // 1. ลอง PING ก่อนเพื่อดูว่า Extension ตื่นไหม
    chrome.runtime.sendMessage(
      state.settings.extId,
      { type: "PING" },
      (pong) => {
        if (chrome.runtime.lastError) {
          // ติดต่อไม่ได้
          state.audioFx.isInstalled = false;
          updateExtStatus(false, "Connection Failed");
          return;
        }

        // 2. ถ้า Ping ผ่าน ให้ดึง State
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

              // 3. Logic: Auto Start หรือ Reset
              if (shouldReset) {
                chrome.runtime.sendMessage(state.settings.extId, {
                  type: "SET_PARAM",
                  key: "reset",
                  value: true,
                });
                // ถ้า Reset และ AutoStart เปิดอยู่ -> เริ่มใหม่ด้วย
                if (state.settings.autoStartAmp) startAmpCapture();
              } else if (state.settings.autoStartAmp) {
                // ถ้า AutoStart เปิดอยู่ และยังไม่ได้ Capture หรืออยาก Force Capture Tab นี้
                // เราสั่ง startAmpCapture() เลย ระบบที่แก้ใน background.js จะจัดการตัด Tab เก่าให้เอง
                startAmpCapture();
              }
            }
            renderAmpStatus();
            broadcastState();
          }
        );
      }
    );
  } catch (e) {
    console.error(e);
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
    if (isOk) {
      dot.className =
        "w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]";
      txt.className = "text-green-400 font-mono text-xs font-bold";
      txt.innerText = text;
    } else {
      // Custom colors for states like Pinging
      if (text === "Pinging...") {
        dot.className = `w-2 h-2 rounded-full bg-yellow-500 animate-pulse`;
        txt.className = "text-yellow-500 font-mono text-xs";
      } else {
        dot.className = `w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]`;
        txt.className = "text-zinc-400 font-mono text-xs";
      }
      txt.innerText = text;
    }
  }
}

function renderAmpStatus() {
  const el = document.getElementById("header-amp-status");
  if (!el) return;

  if (state.audioFx.isInstalled) {
    const p =
      state.audioFx.pitch > 0 ? `+${state.audioFx.pitch}` : state.audioFx.pitch;
    const r = Math.round(state.audioFx.reverb * 100);

    el.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="flex items-center gap-1.5">
                <i class="fa-solid fa-music text-[10px] opacity-70"></i>
                <span class="hidden sm:inline opacity-70 text-[10px] uppercase tracking-wider">Pitch</span>
                <span class="font-bold">${p}</span>
            </div>
            <div class="w-px h-3 bg-green-500/30"></div>
            <div class="flex items-center gap-1.5">
                <i class="fa-solid fa-city text-[10px] opacity-70"></i>
                <span class="hidden sm:inline opacity-70 text-[10px] uppercase tracking-wider">Rev</span>
                <span class="font-bold">${r}</span>
            </div>
        </div>
    `;

    el.classList.remove("hidden");
    el.classList.add("flex");
  } else {
    el.classList.add("hidden");
    el.classList.remove("flex");
  }
}

window.showAmpSetupModal = function () {};

function startApp() {
  isAppStarted = true;
  const landing = document.getElementById("landing-view");
  landing.classList.add("opacity-0", "pointer-events-none");

  setTimeout(() => {
    landing.style.display = "none";
    const playerView = document.getElementById("player-view");
    playerView.classList.remove("hidden");
    setTimeout(() => playerView.classList.remove("opacity-0"), 100);
    openModal("welcome-modal");

    checkExtension(false); // เรียกครั้งแรกตอนเริ่ม App
  }, 700);

  initPlayer();
  initPeer();
  updateSettingsUI();
  checkFullscreenSupport();

  document.addEventListener("mousemove", resetIdle);
  document.addEventListener("touchstart", resetIdle);
  document.addEventListener("click", resetIdle);
  resetIdle();
}

function checkFullscreenSupport() {
  if (document.fullscreenEnabled || document.webkitFullscreenEnabled) {
    document.getElementById("btn-fullscreen").classList.remove("hidden");
  }
}

function initPeer() {
  peer = new Peer(PEER_CONFIG);
  peer.on("open", (id) => {
    peerId = id;
    const statusText = document.getElementById("status-text");
    const statusDot = document.getElementById("status-dot");

    statusText.innerText = "ONLINE";
    statusText.classList.replace("text-gray-400", "text-green-500");
    statusDot.classList.replace("bg-red-500", "bg-green-500");

    const url = `${window.location.origin}/remote.html?host=${id}`;
    const linkEl = document.getElementById("join-url");
    linkEl.innerText = url;
    linkEl.href = url;

    new QRCode(document.getElementById("qrcode"), {
      text: url,
      width: 160,
      height: 160,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.L,
    });
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
  if (window.YT && window.YT.Player) {
    createPlayer();
  } else {
    window.onYouTubeIframeAPIReady = () => createPlayer();
  }
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
      vq: "small",
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
    },
  });
}

function onPlayerReady(event) {
  event.target.mute();
  if (state.settings.quality !== "auto")
    event.target.setPlaybackQuality(state.settings.quality);
  event.target.playVideo();
}

function onPlayerStateChange(event) {
  if (event.data === 1) {
    isPlaying = true;
    requestWakeLock();
    if (state.currentSong) updateMediaSession(state.currentSong);

    document
      .getElementById("play-btn-icon")
      .classList.replace("fa-play", "fa-pause");
    document.getElementById("buffering-indicator").classList.add("hidden");

    document
      .getElementById("qr-screen")
      .classList.add("opacity-0", "pointer-events-none");

    if (state.currentSong && state.currentSong.id !== lastPlayedSongId) {
      lastPlayedSongId = state.currentSong.id;
      showNowPlaying();
    }

    // Auto start logic ย้ายไปอยู่ที่ checkExtension แล้ว แต่ถ้าเริ่มเล่นแล้วยังไม่ Active ก็ลองกระตุ้นอีกที
    if (
      state.audioFx.isInstalled &&
      !state.audioFx.isActive &&
      state.settings.autoStartAmp
    ) {
      startAmpCapture();
    }

    checkAudioContext();
  } else if (event.data === 2) {
    isPlaying = false;
    document
      .getElementById("play-btn-icon")
      .classList.replace("fa-pause", "fa-play");
  } else if (event.data === 3) {
    document.getElementById("buffering-indicator").classList.remove("hidden");
  } else if (event.data === 0) {
    triggerNext();
  }
}

function showNowPlaying() {
  const np = document.getElementById("now-playing-overlay");
  np.classList.remove("opacity-0");
  setTimeout(() => np.classList.add("opacity-0"), 5000);
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
  const isMuted = player.isMuted();
  if (isIOS) {
    if (isMuted) showInteraction();
    else hideInteraction();
  } else {
    if (!hasInteracted && isMuted) showInteraction();
    else {
      hideInteraction();
      if (isMuted) player.unMute();
    }
  }
}

function showInteraction(text = "แตะเพื่อเปิดเสียง") {
  const overlay = document.getElementById("interaction-overlay");

  const textEl = overlay.querySelector("h3");
  if (textEl) textEl.innerText = text;

  overlay.classList.remove("hidden");
}
function hideInteraction() {
  document.getElementById("interaction-overlay").classList.add("hidden");
}

function handleUserInteraction(event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
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
      } else if (state.masterId === u.id) {
        showToast(`DJ ${u.name} reconnected`, "info");
      } else {
        showToast(`${u.name} joined`, "info");
      }

      const existingIdx = state.users.findIndex((x) => x.id === u.id);
      if (existingIdx >= 0) {
        state.users[existingIdx] = u;
      } else {
        state.users.push(u);
      }

      state.users.forEach((user) => {
        user.isMaster = user.id === state.masterId;
      });

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

        // --- ส่วนที่แก้ไข: รองรับ playNext ---
        if (cmd.playNext) {
          state.queue.unshift(song);
          showToast(`Next Track: ${song.title}`, "success");
        } else {
          state.queue.push(song);
          showToast(`Added: ${song.title}`, "success");
        }
        // ---------------------------------

        renderDashboard();
        broadcastState();
        if (!state.currentSong && state.queue.length === 1) triggerNext();
      });
      break;
    // --- ส่วนที่แก้ไข: เพิ่มคำสั่งเลื่อนคิว ---
    case "MOVE_QUEUE":
      if (isMaster(cmd.user.id)) {
        const { index, direction } = cmd;
        if (direction === -1 && index > 0) {
          // Swap ขึ้น
          [state.queue[index], state.queue[index - 1]] = [
            state.queue[index - 1],
            state.queue[index],
          ];
        } else if (direction === 1 && index < state.queue.length - 1) {
          // Swap ลง
          [state.queue[index], state.queue[index + 1]] = [
            state.queue[index + 1],
            state.queue[index],
          ];
        }
        renderDashboard();
        broadcastState();
      }
      break;
    // -------------------------------------
    case "PLAY":
      if (isMaster(cmd.user.id)) player.playVideo();
      break;
    case "PAUSE":
      if (isMaster(cmd.user.id)) player.pauseVideo();
      break;
    case "NEXT":
      if (isMaster(cmd.user.id)) triggerNext();
      break;
    case "STOP":
      if (isMaster(cmd.user.id)) {
        state.queue = [];
        triggerNext();
      }
      break;
    case "SEEK":
      if (isMaster(cmd.user.id) && player) {
        const ct = player.getCurrentTime();
        const newTime = ct + (cmd.amount || 0);
        player.seekTo(newTime, true);
      }
      break;
    case "SET_FX":
      if (isMaster(cmd.user.id)) {
        if (state.audioFx.isInstalled && state.settings.extId) {
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
          }

          if (cmd.key === "reset") {
            showToast("Audio FX Reset", "info");
          }

          renderAmpStatus();
          broadcastState();
        } else {
          showToast("Amp Extension Error", "info");
          state.audioFx.isInstalled = false;
          broadcastState();
        }
      }
      break;
    case "GET_STATE":
      broadcastState();
      break;
  }
}

function triggerNext() {
  if (state.queue.length > 0) {
    const song = state.queue.shift();
    const cdOverlay = document.getElementById("countdown-overlay");
    const cdNum = document.getElementById("cd-number");

    document
      .getElementById("qr-screen")
      .classList.add("opacity-0", "pointer-events-none");

    document.getElementById("cd-title").innerText = song.title;
    document.getElementById("cd-sender").innerText = song.sender;
    document.getElementById("cd-bg").src = song.thumbnail;

    cdOverlay.classList.remove("hidden");
    let count = 3;
    cdNum.innerText = count;

    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        cdNum.innerText = count;
      } else {
        clearInterval(timer);
        cdOverlay.classList.add("hidden");
        playSong(song);
      }
    }, 1000);
  } else {
    state.currentSong = null;
    player.stopVideo();

    const headerTitle = document.getElementById("header-song-title");
    if (headerTitle) headerTitle.classList.add("hidden");

    document
      .getElementById("qr-screen")
      .classList.remove("opacity-0", "pointer-events-none");
    broadcastState();
  }
}
function playSong(song) {
  state.currentSong = song;
  updateMediaSession(song);
  renderDashboard();

  const headerTitle = document.getElementById("header-song-title");
  if (headerTitle) {
    headerTitle.innerText = song.title;
    headerTitle.classList.remove("hidden");
  }

  document.getElementById("np-title").innerText = song.title;
  document.getElementById("np-thumb").src = song.thumbnail;
  document.getElementById("np-sender").innerText = song.sender;

  player.loadVideoById({
    videoId: song.id,
    suggestedQuality:
      state.settings.quality !== "auto" ? state.settings.quality : "large",
  });

  if (isIOS) {
    setTimeout(() => {
      const pState = player.getPlayerState();
      if (
        !hasInteracted &&
        !isPlaying &&
        (pState === -1 || pState === 5 || pState === 2)
      ) {
        showInteraction("แตะเพื่อเริ่มปาร์ตี้");
      }
    }, 1500);
  }

  broadcastState();
}

function isMaster(id) {
  return id === state.masterId;
}

function broadcastState() {
  const payload = {
    type: "UPDATE_STATE",
    queue: state.queue,
    users: state.users,
    masterId: state.masterId,
    currentId: state.currentSong ? state.currentSong.id : null,
    audioFx: state.audioFx,
  };
  connections.forEach((c) => {
    if (c.open) c.send(payload);
  });
}

function showToast(msg, type = "info") {
  const t = document.createElement("div");
  const color = type === "success" ? "text-green-400" : "text-blue-400";
  t.className = `bg-zinc-900 border border-zinc-700 text-white px-4 py-3 rounded-xl shadow-xl animate-[fadeIn_0.3s] text-sm font-bold flex items-center gap-2 w-full`;
  t.innerHTML = `
    <i class="fa-solid fa-${
      type === "success" ? "check" : "info-circle"
    } ${color} shrink-0"></i>
    <span class="break-words leading-tight flex-1 text-left">${msg}</span>
  `;
  document.getElementById("toast-container").appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function renderDashboard() {
  const qList = document.getElementById("queue-list");
  document.getElementById("queue-count").innerText = state.queue.length;

  if (state.queue.length === 0) {
    qList.innerHTML =
      '<div class="text-zinc-600 text-xs italic text-center py-4">No songs in queue</div>';
  } else {
    qList.innerHTML = state.queue
      .map(
        (s, i) => `
                <div class="flex justify-between items-center p-2 bg-zinc-800/30 rounded border border-white/5 text-xs">
                    <span class="truncate flex-1 text-gray-300">${i + 1}. ${
          s.title
        }</span>
                    <span class="text-[10px] text-gray-500 ml-2">${
                      s.sender
                    }</span>
                </div>`
      )
      .join("");
  }

  const uList = document.getElementById("user-list");
  document.getElementById("user-count").innerText = state.users.length;
  uList.innerHTML = state.users
    .map(
      (u) => `
            <div class="flex justify-between items-center p-2 bg-zinc-800/30 rounded border border-white/5 text-xs">
                <span class="${
                  u.id === state.masterId
                    ? "text-red-500 font-bold"
                    : "text-gray-300"
                }">
                    ${u.name} ${u.id === state.masterId ? "👑" : ""}
                </span>
                ${
                  u.id !== state.masterId
                    ? `<button onclick="promoteUser('${u.id}')" class="text-[10px] bg-zinc-700 px-2 py-0.5 rounded hover:bg-zinc-600 text-white">Make DJ</button>`
                    : ""
                }
            </div>`
    )
    .join("");
}

function promoteUser(id) {
  state.masterId = id;
  state.users.forEach((u) => (u.isMaster = u.id === id));
  renderDashboard();
  broadcastState();
  showToast("DJ Changed!", "info");
}

function togglePlay() {
  if (isPlaying) player.pauseVideo();
  else player.playVideo();
}

function handleSeek(val) {
  if (player) {
    const dur = player.getDuration();
    player.seekTo((val / 100) * dur, true);
  }
}

setInterval(() => {
  if (player && isPlaying) {
    const c = player.getCurrentTime();
    const d = player.getDuration();

    if (d > 0) {
      document.getElementById("time-curr").innerText = formatTime(c);
      document.getElementById("time-dur").innerText = formatTime(d);

      const pct = (c / d) * 100;
      document.getElementById("prog-bar").style.width = `${pct}%`;
      document.getElementById("seek-slider").value = pct;

      const idleLine = document.getElementById("idle-progress-line");
      if (idleLine) idleLine.style.width = `${pct}%`;
    }
  }
}, 1000);

function switchTab(tab) {
  ["dashboard", "settings", "nextamp"].forEach((t) => {
    const view = document.getElementById(`view-${t}`);
    const btn = document.getElementById(`tab-${t}`);

    if (view && btn) {
      if (t === tab) {
        view.classList.remove("hidden");
        btn.classList.remove("border-transparent", "text-gray-500");
        btn.classList.add("border-red-600", "text-white");
      } else {
        view.classList.add("hidden");
        btn.classList.remove("border-red-600", "text-white");
        btn.classList.add("border-transparent", "text-gray-500");
      }
    }
  });
}

function toggleSetting(key) {
  state.settings[key] = !state.settings[key];
  localStorage.setItem(`nj_${key}`, state.settings[key]);
  updateSettingsUI();
}

function updateQuality(val) {
  state.settings.quality = val;
  localStorage.setItem("nj_quality", val);
  if (player && state.currentSong) {
    const currentTime = player.getCurrentTime();
    player.loadVideoById({
      videoId: state.currentSong.id,
      startSeconds: currentTime,
      suggestedQuality: val,
    });
  }
}

function updateSettingsUI() {
  const setBtnState = (id, isActive) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.className = `w-10 h-6 rounded-full relative transition-colors ${
        isActive ? "bg-green-600" : "bg-zinc-700"
      }`;
      btn.firstElementChild.className = `absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
        isActive ? "translate-x-5" : "translate-x-1"
      }`;
    }
  };

  setBtnState("btn-reqInt", state.settings.reqInt);
  setBtnState("btn-fit", state.settings.fit);
  setBtnState("btn-autoStartAmp", state.settings.autoStartAmp); // UI สำหรับ Auto Start

  const wrap = document.getElementById("video-wrapper");
  if (state.settings.fit) {
    wrap.className =
      "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100dvw] h-[56.25dvw] min-h-[100dvh] min-w-[177.78dvh] pointer-events-none transition-all duration-500 z-0 bg-black";
  } else {
    wrap.className =
      "relative w-full h-full flex items-center justify-center transition-all duration-500";
  }
  const qSel = document.getElementById("sel-quality");
  if (qSel) qSel.value = state.settings.quality;
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else if (document.exitFullscreen) document.exitFullscreen();
}

function resetIdle() {
  document.body.classList.remove("idle-mode");

  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const settingsHidden = document
      .getElementById("settings-modal")
      .classList.contains("hidden");
    const welcomeHidden = document
      .getElementById("welcome-modal")
      .classList.contains("hidden");

    if (settingsHidden && welcomeHidden && isAppStarted) {
      document.body.classList.add("idle-mode");
    }
  }, 3000);
}

function copyJoinLink() {
  const link = document.getElementById("join-url").href;
  if (link && link !== "#") {
    navigator.clipboard.writeText(link).then(() => {
      showToast("Link Copied!", "success");
    });
  }
}
