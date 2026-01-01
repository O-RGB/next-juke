// next-juke/js/remote.js

const urlParams = new URLSearchParams(window.location.search);
const hostId = urlParams.get("host");

let peer, conn, user;
let masterId = null;
let isHostFxInstalled = false;
let lastQueueData = []; // Cache Queue
let suggestTimeout; // Debounce for Autocomplete

// --- Smart Search System Configuration ---
const STORAGE_KEYS = {
  LIST: "nj_inv_list",
  ACTIVE: "nj_inv_active",
  TIMESTAMP: "nj_inv_time",
};
const CACHE_DURATION = 24 * 60 * 60 * 1000;

const INV_INSTANCES_FALLBACK = [
  "https://inv.perditum.com/api/v1",
  "https://vid.puffyan.us/api/v1",
  "https://inv.tux.pizza/api/v1",
  "https://yewtu.be/api/v1",
];

let currentApiUrl = localStorage.getItem(STORAGE_KEYS.ACTIVE) || null;
let instanceList = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIST) || "[]");

if (instanceList.length === 0) {
  instanceList = INV_INSTANCES_FALLBACK;
}

let searchCache = {
  query: "",
  results: [],
  scrollPos: 0,
  hasSearched: false,
};

const savedProfile = localStorage.getItem("nj_client_identity");
let clientProfile = savedProfile ? JSON.parse(savedProfile) : null;

window.onload = () => {
  if (!hostId) {
    updateLoadingStatus("ไม่พบ Host ID (กรุณาสแกน QR Code ใหม่)", true);
    return;
  }
  initSearchSystem();
  const main = document.getElementById("remote-ui").querySelector(".flex-1");
  if (main) main.classList.add("overflow-y-auto", "overscroll-contain");

  if (clientProfile && clientProfile.name) {
    document.getElementById("username-input").value = clientProfile.name;
    user = clientProfile;
    initPeer();
  } else {
    document.getElementById("connection-overlay").classList.add("hidden");
    document.getElementById("login-screen").classList.remove("hidden");
  }
};

// --- Smart Server Management ---

async function initSearchSystem() {
  const lastUpdate = parseInt(
    localStorage.getItem(STORAGE_KEYS.TIMESTAMP) || "0"
  );
  const now = Date.now();
  if (instanceList.length === 0 || now - lastUpdate > CACHE_DURATION) {
    console.log("Updating server list...");
    await fetchAndCacheInstanceList();
  } else {
    if (!currentApiUrl) updateActiveServer(instanceList[0]);
    else verifyCurrentServer();
  }
}

async function fetchAndCacheInstanceList(force = false) {
  const btn = document.querySelector(".fa-rotate")?.parentElement;
  if (force && btn) {
    btn.innerHTML =
      '<i class="fa-solid fa-circle-notch fa-spin"></i> Loading...';
    btn.disabled = true;
  }
  try {
    const res = await fetch(
      "https://api.invidious.io/instances.json?sort_by=health"
    );
    if (!res.ok) throw new Error("API Directory Error");
    const data = await res.json();
    const validServers = [];
    data.forEach((entry) => {
      const [domain, meta] = entry;
      if (meta.type === "https" && meta.api === true && meta.cors === true) {
        let uri = meta.uri;
        if (uri.endsWith("/")) uri = uri.slice(0, -1);
        validServers.push(`${uri}/api/v1`);
      }
    });
    if (validServers.length > 0) {
      instanceList = validServers.slice(0, 15);
      localStorage.setItem(STORAGE_KEYS.LIST, JSON.stringify(instanceList));
      localStorage.setItem(STORAGE_KEYS.TIMESTAMP, Date.now());
      if (!currentApiUrl || force) updateActiveServer(instanceList[0]);
      if (force) {
        renderServerStatusList();
        showToast("อัปเดตรายชื่อ Server แล้ว");
      }
    }
  } catch (e) {
    console.warn("Failed to update list:", e);
    if (force) showToast("ใช้รายการเดิม");
  } finally {
    if (force && btn) {
      btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Refresh List';
      btn.disabled = false;
    }
  }
}

async function verifyCurrentServer() {
  if (!currentApiUrl) return;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${currentApiUrl}/stats`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error("Bad Status");
  } catch (e) {
    findNextWorkingServer();
  }
}

function updateActiveServer(url) {
  currentApiUrl = url;
  localStorage.setItem(STORAGE_KEYS.ACTIVE, url);
}

async function findNextWorkingServer() {
  if (instanceList.length === 0) return null;
  let currentIndex = instanceList.indexOf(currentApiUrl);
  if (currentIndex === -1) currentIndex = 0;
  for (let i = 1; i < instanceList.length; i++) {
    const nextIndex = (currentIndex + i) % instanceList.length;
    const candidate = instanceList[nextIndex];
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${candidate}/stats`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        updateActiveServer(candidate);
        return candidate;
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

// --- Autocomplete / Suggestions ---

function handleSearchInput(query) {
  const container = document.getElementById("search-suggestions");
  if (suggestTimeout) clearTimeout(suggestTimeout);

  if (!query || query.length < 2) {
    container.classList.add("hidden");
    return;
  }

  suggestTimeout = setTimeout(async () => {
    if (!currentApiUrl) return;
    try {
      const res = await fetch(
        `${currentApiUrl}/search/suggestions?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) throw new Error("No suggestions");
      const data = await res.json();
      if (data.suggestions && data.suggestions.length > 0) {
        renderSuggestions(data.suggestions);
      } else {
        container.classList.add("hidden");
      }
    } catch (e) {
      container.classList.add("hidden");
    }
  }, 300);
}

function renderSuggestions(list) {
  const container = document.getElementById("search-suggestions");
  container.innerHTML = "";
  list.forEach((text) => {
    const div = document.createElement("div");
    div.className =
      "px-4 py-3 hover:bg-zinc-700 cursor-pointer text-sm text-zinc-300 hover:text-white border-b border-zinc-700/50 last:border-0 flex items-center gap-3";
    div.innerHTML = `<i class="fa-solid fa-magnifying-glass text-zinc-500 text-xs"></i> <span>${text}</span>`;
    div.onclick = () => {
      document.getElementById("inv-search-input").value = text;
      container.classList.add("hidden");
      runSearch();
    };
    container.appendChild(div);
  });
  container.classList.remove("hidden");
}

document.addEventListener("click", (e) => {
  const container = document.getElementById("search-suggestions");
  const input = document.getElementById("inv-search-input");
  if (!container.contains(e.target) && e.target !== input) {
    container.classList.add("hidden");
  }
});

// --- Server UI ---

function toggleServerView() {
  const searchContainer = document.getElementById("search-results-container");
  const serverContainer = document.getElementById("server-status-container");
  const searchHeader = document.getElementById("search-header-bar");
  const serverHeader = document.getElementById("server-header-bar");

  if (serverContainer.classList.contains("hidden")) {
    searchContainer.classList.add("hidden");
    serverContainer.classList.remove("hidden");
    searchHeader.classList.add("hidden");
    serverHeader.classList.remove("hidden");
    renderServerStatusList();
  } else {
    serverContainer.classList.add("hidden");
    searchContainer.classList.remove("hidden");
    serverHeader.classList.add("hidden");
    searchHeader.classList.remove("hidden");
    setTimeout(() => document.getElementById("inv-search-input").focus(), 100);
  }
}

async function renderServerStatusList() {
  const container = document.getElementById("server-list-content");
  container.innerHTML = "";
  if (instanceList.length === 0) {
    container.innerHTML =
      '<div class="text-center text-zinc-500 py-4">No servers available.</div>';
    return;
  }
  instanceList.forEach((url) => {
    const domain = url.replace("https://", "").replace("/api/v1", "");
    const isActive = url === currentApiUrl;
    const safeId = domain.replace(/[^a-zA-Z0-9]/g, "-");
    const div = document.createElement("div");
    div.className = `flex items-center justify-between p-3 rounded-xl border transition-all ${
      isActive
        ? "bg-green-500/10 border-green-500/50"
        : "bg-zinc-800 border-zinc-700"
    }`;
    div.innerHTML = `
            <div class="flex items-center gap-3 overflow-hidden">
                <div class="w-2 h-2 shrink-0 rounded-full ${
                  isActive ? "bg-green-500" : "bg-zinc-600"
                }" id="dot-${safeId}"></div>
                <div class="flex flex-col min-w-0">
                    <span class="text-sm font-mono text-white truncate ${
                      isActive ? "font-bold" : ""
                    }">${domain}</span>
                    <span class="text-[10px] text-zinc-500" id="ping-${safeId}">Checking...</span>
                </div>
            </div>
            ${
              isActive
                ? '<div class="px-2 py-1"><i class="fa-solid fa-check text-green-500"></i></div>'
                : `<button id="btn-use-${safeId}" onclick="setManualServer('${url}')" class="shrink-0 text-xs bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-1.5 rounded-lg transition-colors">Use</button>`
            }
        `;
    container.appendChild(div);
    checkServerPing(url, safeId);
  });
}

async function checkServerPing(url, safeId) {
  const pingEl = document.getElementById(`ping-${safeId}`);
  const dotEl = document.getElementById(`dot-${safeId}`);
  const btnEl = document.getElementById(`btn-use-${safeId}`);
  if (!pingEl) return;
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${url}/stats`, {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const latency = Date.now() - start;
    if (res.ok) {
      pingEl.innerHTML = `<span class="text-green-400">${latency}ms</span> • Ready`;
      if (dotEl && !dotEl.classList.contains("bg-green-500"))
        dotEl.className = "w-2 h-2 shrink-0 rounded-full bg-blue-400";
    } else {
      throw new Error(res.status);
    }
  } catch (e) {
    pingEl.innerHTML = `<span class="text-red-500">Unavailable</span>`;
    if (dotEl) dotEl.className = "w-2 h-2 shrink-0 rounded-full bg-red-500";
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.innerText = "Down";
      btnEl.className =
        "shrink-0 text-xs bg-transparent text-zinc-600 border border-zinc-700 px-3 py-1.5 rounded-lg cursor-not-allowed";
    }
  }
}

function setManualServer(url) {
  updateActiveServer(url);
  renderServerStatusList();
  showToast("เปลี่ยน Server แล้ว!");
}

// --- Search Logic ---

function openSearchModal() {
  openModal("search-modal");
  const input = document.getElementById("inv-search-input");
  // Reset View
  document.getElementById("server-status-container").classList.add("hidden");
  document
    .getElementById("search-results-container")
    .classList.remove("hidden");
  document.getElementById("server-header-bar").classList.add("hidden");
  document.getElementById("search-header-bar").classList.remove("hidden");
  document.getElementById("search-suggestions").classList.add("hidden");

  if (searchCache.hasSearched) {
    input.value = searchCache.query;
    if (searchCache.results.length > 0) {
      const list = document.getElementById("search-list");
      if (list.children.length === 0) renderSearchList(searchCache.results);
      document.getElementById("search-placeholder").classList.add("hidden");
    }
  } else {
    setTimeout(() => input.focus(), 100);
  }
}

function saveSearchState() {
  const input = document.getElementById("inv-search-input");
  if (input) searchCache.query = input.value;
}

async function runSearch(isRetry = false) {
  const input = document.getElementById("inv-search-input");
  const query = input.value.trim();
  if (!query) return;

  // Hide suggestions
  document.getElementById("search-suggestions").classList.add("hidden");

  if (!isRetry) {
    searchCache.query = query;
    document.getElementById("search-placeholder").classList.add("hidden");
    document.getElementById("search-list").innerHTML = "";
    document.getElementById("search-loader").classList.remove("hidden");
    input.blur();
  }

  if (!currentApiUrl) {
    await fetchAndCacheInstanceList();
    if (!currentApiUrl) {
      showSearchError("ไม่พบ Server ที่ใช้งานได้", true);
      return;
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `${currentApiUrl}/search?q=${encodeURIComponent(query)}&type=video`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    searchCache.results = data;
    searchCache.hasSearched = true;
    document.getElementById("search-loader").classList.add("hidden");
    renderSearchList(data);
  } catch (error) {
    console.warn(`Search failed on ${currentApiUrl}:`, error);
    const newServer = await findNextWorkingServer();
    if (newServer) {
      runSearch(true);
    } else {
      showSearchError("ไม่สามารถเชื่อมต่อ Server ได้", true);
    }
  }
}

function showSearchError(msg, suggestManual = false) {
  document.getElementById("search-loader").classList.add("hidden");
  let html = `
        <div class="text-center text-red-400 mt-10 p-6 border border-red-500/20 rounded-2xl bg-red-500/5">
            <i class="fa-solid fa-triangle-exclamation text-3xl mb-3"></i>
            <p class="font-bold text-sm">${msg}</p>
    `;
  if (suggestManual) {
    html += `
            <div class="mt-4 pt-4 border-t border-red-500/20">
                <p class="text-xs text-zinc-400 mb-2">คำแนะนำ:</p>
                <p class="text-xs text-white">ให้เข้าแอป <b>YouTube</b> <br>แล้วกด <b>Share -> Copy Link</b> มาวางแทนครับ</p>
                <a href="https://www.youtube.com/" target="_blank" class="mt-3 inline-block bg-zinc-800 text-white text-xs px-4 py-2 rounded-lg hover:bg-zinc-700">เปิด YouTube</a>
            </div>`;
  }
  html += `</div>`;
  document.getElementById("search-list").innerHTML = html;
}

function renderSearchList(data) {
  const list = document.getElementById("search-list");
  list.innerHTML = "";
  if (!data || data.length === 0) {
    list.innerHTML =
      '<div class="text-center text-zinc-500 mt-10">ไม่พบเพลงที่ค้นหา</div>';
    return;
  }
  data.forEach((item) => {
    if (item.type !== "video") return;
    const div = document.createElement("div");
    div.className =
      "flex gap-3 p-2 bg-zinc-800/40 rounded-xl border border-white/5 active:bg-zinc-700 transition cursor-pointer";
    div.onclick = () => selectSearchResult(item);
    const timeStr = formatTime(item.lengthSeconds);
    const thumb =
      item.videoThumbnails.find((t) => t.quality === "medium") ||
      item.videoThumbnails[0];
    div.innerHTML = `
            <div class="relative w-28 h-20 shrink-0 bg-black rounded-lg overflow-hidden group-hover:opacity-80 transition">
                <img src="${thumb?.url}" class="w-full h-full object-cover" loading="lazy">
                <div class="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">${timeStr}</div>
            </div>
            <div class="flex-1 min-w-0 flex flex-col justify-center py-1">
                <h4 class="text-sm font-bold text-white leading-snug line-clamp-2 mb-1">${item.title}</h4>
                <div class="text-[11px] text-zinc-400 truncate flex items-center gap-1">
                    <span>${item.author}</span>
                </div>
            </div>
            <div class="flex items-center justify-center pl-2 pr-1">
                <button class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-400"><i class="fa-solid fa-plus"></i></button>
            </div>
        `;
    list.appendChild(div);
  });
}

function selectSearchResult(item) {
  saveSearchState();
  const videoUrl = `https://www.youtube.com/watch?v=${item.videoId}`;
  const mainInput = document.getElementById("url-input");
  mainInput.value = videoUrl;
  closeModal("search-modal");
  mainInput.dispatchEvent(new Event("input", { bubbles: true }));
  showToast("เลือกเพลงแล้ว กด + เพื่อส่ง");
}

function formatViews(num) {
  if (!num) return "";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

// --- Standard Remote Logic ---

function handleJoin() {
  const name = document.getElementById("username-input").value.trim();
  if (!name) return;
  const uid = clientProfile ? clientProfile.id : crypto.randomUUID();
  user = { id: uid, name: name, isMaster: false };
  localStorage.setItem("nj_client_identity", JSON.stringify(user));
  document.getElementById("connection-overlay").classList.remove("hidden");
  document.getElementById("login-screen").classList.add("hidden");
  updateLoadingStatus("กำลังเริ่มการเชื่อมต่อ...");
  initPeer();
}

function updateLoadingStatus(text, isError = false) {
  const el = document.getElementById("conn-status-text");
  el.innerText = text;
  if (isError) el.classList.add("text-red-500");
  else el.classList.remove("text-red-500");
}

function initPeer() {
  if (peer) {
    peer.destroy();
    peer = null;
  }
  document.getElementById("user-name").innerText = user.name;
  document.getElementById("user-avatar").innerText = user.name[0].toUpperCase();
  peer = new Peer(PEER_CONFIG);
  peer.on("open", () => {
    updateLoadingStatus("พบเซิร์ฟเวอร์... กำลังเข้าห้อง");
    setStatus(
      "เชื่อมต่อ...",
      "text-yellow-500",
      "bg-yellow-500/10",
      "border-yellow-500"
    );
    conn = peer.connect(hostId);
    conn.on("open", () => {
      updateLoadingStatus("เชื่อมต่อสำเร็จ! กำลังดึงข้อมูล...");
      setStatus(
        "ออนไลน์",
        "text-green-500",
        "bg-green-500/10",
        "border-green-500"
      );
      conn.send({ type: "JOIN", user: user });
      conn.send({ type: "GET_STATE" });
    });
    conn.on("data", (data) => {
      if (data.type === "UPDATE_STATE") {
        document.getElementById("connection-overlay").classList.add("hidden");
        document.getElementById("remote-ui").classList.remove("hidden");
        updateState(data);
      }
    });
    conn.on("close", () => {
      document.getElementById("connection-overlay").classList.remove("hidden");
      updateLoadingStatus("หลุดการเชื่อมต่อ... กำลังต่อใหม่", true);
      setStatus(
        "หลุดการเชื่อมต่อ",
        "text-red-500",
        "bg-red-500/10",
        "border-red-500"
      );
      setTimeout(checkAndReconnect, 2000);
    });
  });
  peer.on("error", (err) => {
    updateLoadingStatus("เกิดข้อผิดพลาด: " + err.type, true);
    setTimeout(checkAndReconnect, 3000);
  });
}

function checkAndReconnect() {
  if (!peer || peer.disconnected || peer.destroyed || (conn && !conn.open)) {
    initPeer();
  }
}

function setStatus(text, textColor, bgColor, borderColor) {
  const b = document.getElementById("status-badge");
  b.innerText = text;
  b.className = `text-[10px] px-2 py-1 rounded-full border ${textColor} ${bgColor} ${borderColor}`;
}

function updateState(data) {
  masterId = data.masterId;
  const isMaster = user.id === masterId;
  if (data.audioFx) {
    if (isHostFxInstalled && !data.audioFx.isInstalled) {
      showAlert(
        "Amp Disconnected!",
        "Host PC lost connection to NextAmp Extension.",
        "error"
      );
    }
    isHostFxInstalled = data.audioFx.isInstalled;
    updateFxBtnAppearance();
  }
  if (isMaster) {
    document.getElementById("master-controls").classList.remove("hidden");
    document.getElementById("non-master-msg").classList.add("hidden");
    document.getElementById("stop-btn")?.classList.remove("hidden");
    document.getElementById("user-role").innerText = "👑 DJ MASTER";
    document.getElementById("user-role").classList.add("text-pink-500");
    document.getElementById("dj-add-options").classList.remove("hidden");
    if (data.audioFx) updateFxUI(data.audioFx);
  } else {
    document.getElementById("master-controls").classList.add("hidden");
    document.getElementById("non-master-msg").classList.remove("hidden");
    document.getElementById("stop-btn")?.classList.add("hidden");
    document.getElementById("user-role").innerText = "ผู้ร่วมงาน";
    document.getElementById("user-role").classList.remove("text-pink-500");
    document.getElementById("dj-add-options").classList.add("hidden");
  }

  // --- Queue Logic Fix ---
  lastQueueData = data.queue || [];
  document.getElementById("q-count-btn").innerText = lastQueueData.length;
  updateQueueUI(lastQueueData);
}

function updateQueueUI(queue) {
  const qList = document.getElementById("queue-list-modal");
  if (!qList) return;
  const isMaster = user && user.id === masterId;
  if (queue.length === 0) {
    qList.innerHTML =
      '<div class="flex flex-col items-center justify-center h-full text-zinc-500 space-y-2 py-10 opacity-50"><i class="fa-solid fa-music text-4xl"></i><p class="text-xs">ยังไม่มีเพลงในคิว</p></div>';
  } else {
    qList.innerHTML = queue
      .map(
        (s, i) => `
        <div class="flex gap-3 items-center p-3 bg-zinc-800/30 rounded-xl border border-white/5 hover:bg-zinc-800 transition">
            ${
              isMaster
                ? `<div class="flex flex-col gap-1 shrink-0 mr-1">
                      <button onclick="sendMoveQueue(${i}, -1)" class="w-8 h-8 bg-zinc-700/50 hover:bg-zinc-600 rounded-lg flex items-center justify-center text-zinc-300 ${
                    i === 0 ? "opacity-30 pointer-events-none" : ""
                  } active:scale-90"><i class="fa-solid fa-chevron-up text-xs"></i></button>
                      <button onclick="sendMoveQueue(${i}, 1)" class="w-8 h-8 bg-zinc-700/50 hover:bg-zinc-600 rounded-lg flex items-center justify-center text-zinc-300 ${
                    i === queue.length - 1
                      ? "opacity-30 pointer-events-none"
                      : ""
                  } active:scale-90"><i class="fa-solid fa-chevron-down text-xs"></i></button>
                  </div>`
                : `<div class="w-8 h-8 flex items-center justify-center bg-white/5 rounded-full text-zinc-500 font-mono text-xs font-bold">${
                    i + 1
                  }</div>`
            }
            <div class="relative w-16 h-12 shrink-0 bg-black rounded-lg overflow-hidden border border-white/10">
                <img src="${
                  s.thumbnail
                }" class="w-full h-full object-cover opacity-80" loading="lazy">
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-sm font-bold text-white truncate leading-tight mb-1">${
                  s.title
                }</div>
                <div class="text-[10px] text-zinc-400 flex items-center gap-1">
                    <i class="fa-solid fa-user-circle"></i> ${s.sender}
                </div>
            </div>
        </div>`
      )
      .join("");
  }
}

function updateFxBtnAppearance() {
  const btnFx = document.getElementById("btn-open-fx");
  const btnEq = document.getElementById("btn-open-eq");
  if (!btnFx || !btnEq) return;
  if (isHostFxInstalled) {
    btnFx.classList.remove("opacity-50", "grayscale");
    btnEq.classList.remove("opacity-50", "grayscale");
  } else {
    btnFx.classList.add("opacity-50", "grayscale");
    btnEq.classList.add("opacity-50", "grayscale");
  }
}

function checkFxAvailability(callback) {
  if (isHostFxInstalled) callback();
  else
    showAlert(
      "Extension Required",
      "Host PC must have NextAmp Extension installed.",
      "warning"
    );
}

function sendAction(type, data = {}) {
  if (conn && conn.open) conn.send({ type, user, ...data });
}

function sendMoveQueue(index, direction) {
  sendAction("MOVE_QUEUE", { index, direction });
}

function addSong() {
  const url = document.getElementById("url-input").value;
  if (!url) return;
  const chk = document.getElementById("chk-play-next");
  const playNext = chk && !chk.classList.contains("hidden") && chk.checked;
  conn.send({ type: "ADD_SONG", url, user, playNext: playNext });
  document.getElementById("url-input").value = "";
  document.getElementById("preview-box").classList.add("hidden");
  if (chk) chk.checked = false;
  const btn = document.getElementById("add-btn");
  btn.disabled = true;
  btn.className =
    "w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-zinc-800 border border-zinc-700 text-gray-500 transition-colors";
  if (playNext) showToast("แทรกเพลงคิวถัดไปเรียบร้อย!");
  else showToast("ส่งเพลงแล้ว!");
}

function updateFxUI(audioFx) {
  const pVal = audioFx.pitch || 0;
  const pText = document.getElementById("pitch-val-text");
  if (pText) pText.innerText = (pVal > 0 ? "+" : "") + pVal;
  const rVal = audioFx.reverb || 0;
  const rSlider = document.getElementById("fx-reverb");
  const rText = document.getElementById("reverb-val-text");
  if (rSlider) rSlider.value = rVal;
  if (rText) rText.innerText = Math.round(rVal * 100) + "%";
}

function setFx(key, value) {
  sendAction("SET_FX", { key, value: parseFloat(value) });
  if (key === "reverb")
    document.getElementById("reverb-val-text").innerText =
      Math.round(value * 100) + "%";
}

function changePitch(delta) {
  const txt = document.getElementById("pitch-val-text");
  let current = parseInt(txt.innerText) || 0;
  let next = current + delta;
  if (next > 12) next = 12;
  if (next < -12) next = -12;
  txt.innerText = (next > 0 ? "+" : "") + next;
  setFx("pitch", next);
}

function resetFx() {
  setFx("pitch", 0);
  setFx("reverb", 0);
  sendAction("SET_FX", { key: "reset" });
  document.getElementById("pitch-val-text").innerText = "0";
  document.getElementById("fx-reverb").value = 0;
  document.getElementById("reverb-val-text").innerText = "0%";
}

function setEq(index, value) {
  sendAction("SET_FX", {
    key: "eq",
    value: parseFloat(value),
    index: parseInt(index),
  });
}

function resetEq() {
  const inputs = document.querySelectorAll('#eq-modal input[type="range"]');
  inputs.forEach((inp, i) => {
    inp.value = 0;
    setEq(i, 0);
  });
}

const inp = document.getElementById("url-input");
inp.addEventListener("input", (e) => {
  const val = e.target.value;
  if (val.includes("youtu")) {
    fetchVideoInfo(val).then((d) => {
      if (d.title) {
        document.getElementById("preview-box").classList.remove("hidden");
        document.getElementById("prev-img").src = d.thumbnail_url;
        document.getElementById("prev-title").innerText = d.title;
        const btn = document.getElementById("add-btn");
        btn.disabled = false;
        btn.className =
          "w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-pink-600 text-white shadow-lg shadow-pink-600/20 transition-colors";
      }
    });
  } else {
    document.getElementById("preview-box").classList.add("hidden");
  }
});

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) {
      showToast("Clipboard ว่างเปล่า");
      return;
    }
    if (text.includes("youtube.com") || text.includes("youtu.be")) {
      const input = document.getElementById("url-input");
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      showToast("วางลิงก์แล้ว!");
    } else {
      showToast("ไม่ใช่ลิงก์ YouTube");
    }
  } catch (err) {
    showToast("ต้องอนุญาตเข้าถึง Clipboard");
  }
}

function showToast(msg) {
  const t = document.getElementById("toast");
  document.getElementById("toast-msg").innerText = msg;
  t.classList.remove("opacity-0");
  setTimeout(() => t.classList.add("opacity-0"), 2000);
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkAndReconnect();
});
