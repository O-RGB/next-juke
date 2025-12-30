// js/host.js - Full Code with iOS Fixes

let wakeLock = null;
let player, peer, peerId;
let connections = [];
let isAppStarted = false;

let state = {
  queue: [],
  currentSong: null,
  users: [],
  masterId: localStorage.getItem("nj_master_id") || null,
  settings: {
    reqInt: localStorage.getItem("nj_reqInt") !== "false",
    fit: localStorage.getItem("nj_fit") === "true",
    quality: localStorage.getItem("nj_quality") || "auto",
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
      width: 180,
      height: 180,
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
  // [iOS FIX] Force mute and play immediately
  event.target.mute();
  if (state.settings.quality !== "auto")
    event.target.setPlaybackQuality(state.settings.quality);
  event.target.playVideo();
}

function onPlayerStateChange(event) {
  if (event.data === 1) {
    // PLAYING
    isPlaying = true;
    requestWakeLock();
    if (state.currentSong) updateMediaSession(state.currentSong);

    document
      .getElementById("play-btn-icon")
      .classList.replace("fa-play", "fa-pause");
    document.getElementById("buffering-indicator").classList.add("hidden");

    // Fix QR hiding logic
    document
      .getElementById("qr-screen")
      .classList.add("opacity-0", "pointer-events-none");

    if (state.currentSong && state.currentSong.id !== lastPlayedSongId) {
      lastPlayedSongId = state.currentSong.id;
      showNowPlaying();
    }
    checkAudioContext();
  } else if (event.data === 2) {
    // PAUSED
    isPlaying = false;
    document
      .getElementById("play-btn-icon")
      .classList.replace("fa-pause", "fa-play");
  } else if (event.data === 3) {
    // BUFFERING
    document.getElementById("buffering-indicator").classList.remove("hidden");
  } else if (event.data === 0) {
    // ENDED
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

function showInteraction() {
  document.getElementById("interaction-overlay").classList.remove("hidden");
}
function hideInteraction() {
  document.getElementById("interaction-overlay").classList.add("hidden");
}

function handleUserInteraction() {
  hasInteracted = true;
  if (player) {
    player.unMute();
    player.setVolume(100);
    player.playVideo();
  }
  hideInteraction();
}

function handleCommand(cmd, conn) {
  switch (cmd.type) {
    case "JOIN":
      const u = cmd.user;
      if (state.masterId === u.id || !state.masterId) {
        u.isMaster = true;
        state.masterId = u.id;
        localStorage.setItem("nj_master_id", u.id);
      }
      if (!state.users.find((x) => x.id === u.id)) {
        state.users.push(u);
        showToast(`${u.name} joined!`, "info");
      }
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
        state.queue.push(song);
        showToast(`Added: ${song.title}`, "success");
        renderDashboard();
        broadcastState();
        if (!state.currentSong && state.queue.length === 1) triggerNext();
      });
      break;
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

    // Fix QR hiding logic
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
                <span class="text-[10px] text-gray-500 ml-2">${s.sender}</span>
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
  localStorage.setItem("nj_master_id", id);
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
    document.getElementById("time-curr").innerText = formatTime(c);
    document.getElementById("time-dur").innerText = formatTime(d);
    document.getElementById("prog-bar").style.width = `${(c / d) * 100}%`;
    document.getElementById("seek-slider").value = (c / d) * 100;
  }
}, 1000);

function openModal(id) {
  const el = document.getElementById(id);
  el.classList.remove("hidden");
  void el.offsetWidth;
  el.classList.remove("opacity-0");
}

function closeModal(id) {
  const el = document.getElementById(id);
  el.classList.add("opacity-0");
  setTimeout(() => el.classList.add("hidden"), 300);
}

function switchTab(tab) {
  ["dashboard", "settings"].forEach((t) => {
    document.getElementById(`view-${t}`).classList.add("hidden");
    const tabBtn = document.getElementById(`tab-${t}`);
    tabBtn.classList.replace("border-red-600", "border-transparent");
    tabBtn.classList.replace("text-white", "text-gray-500");
  });
  document.getElementById(`view-${tab}`).classList.remove("hidden");
  const activeBtn = document.getElementById(`tab-${tab}`);
  activeBtn.classList.replace("border-transparent", "border-red-600");
  activeBtn.classList.replace("text-gray-500", "text-white");
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
    btn.className = `w-10 h-6 rounded-full relative transition-colors ${
      isActive ? "bg-green-600" : "bg-zinc-700"
    }`;
    btn.firstElementChild.className = `absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
      isActive ? "translate-x-5" : "translate-x-1"
    }`;
  };

  setBtnState("btn-reqInt", state.settings.reqInt);
  setBtnState("btn-fit", state.settings.fit);

  const wrap = document.getElementById("video-wrapper");
  if (state.settings.fit) {
    wrap.className =
      "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[56.25vw] min-h-[100vh] min-w-[177.78vh] pointer-events-none transition-all duration-500";
  } else {
    wrap.className =
      "relative w-full h-full flex items-center justify-center transition-all duration-500";
  }
  document.getElementById("sel-quality").value = state.settings.quality;
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else if (document.exitFullscreen) document.exitFullscreen();
}

function resetIdle() {
  const header = document.getElementById("main-header");
  const footer = document.getElementById("main-footer");
  header.classList.remove("opacity-0-force");
  footer.classList.remove("opacity-0-force");

  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (
      document.getElementById("settings-modal").classList.contains("hidden") &&
      document.getElementById("welcome-modal").classList.contains("hidden") &&
      isAppStarted
    ) {
      header.classList.add("opacity-0-force");
      footer.classList.add("opacity-0-force");
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
