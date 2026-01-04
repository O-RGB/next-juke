// js/remote.js

const urlParams = new URLSearchParams(window.location.search);
const hostId = urlParams.get("host");
let peer,
  conn,
  user,
  masterId = null,
  isHostFxInstalled = false,
  searchLib,
  clientProfile = JSON.parse(
    localStorage.getItem("nj_client_identity") || "null"
  );

window.onload = () => {
  // Inject EQ Logic (เพราะย้าย HTML ไป js/components.js)
  const eqCont = document.getElementById("eq-sliders-container");
  if (eqCont) {
    const bands = [
      "60",
      "170",
      "310",
      "600",
      "1k",
      "3k",
      "6k",
      "12k",
      "14k",
      "16k",
    ];
    eqCont.innerHTML = bands
      .map(
        (l, i) =>
          `<div class="flex flex-col items-center gap-2 flex-1 min-w-[30px]"><div class="h-24 flex items-center"><input type="range" min="-12" max="12" step="1" value="0" oninput="setEq(${i}, this.value)" class="c-slider -rotate-90 w-24" /></div><span class="text-[9px] text-zinc-500 font-mono">${l}</span></div>`
      )
      .join("");
  }

  if (!hostId) {
    updateLoadingStatus("ไม่พบ Host ID", true);
    return;
  }
  searchLib = new YouTubeSearch({
    onSelect: (item) => {
      const input = document.getElementById("url-input");
      if (input) {
        input.value = `https://www.youtube.com/watch?v=${item.id}`;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        showToast("เลือกเพลงแล้ว กด + เพื่อส่ง");
      }
    },
  });

  if (clientProfile && clientProfile.name) {
    // [FIX] เช็คก่อน Set ค่า (แก้ Error: Cannot set properties of null at line 54)
    const usernameInput = document.getElementById("username-input");
    if (usernameInput) {
      usernameInput.value = clientProfile.name;
    }
    user = clientProfile;
    initPeer();
  } else {
    document.getElementById("connection-overlay").classList.add("hidden");
    const loginScreen = document.getElementById("login-screen");
    if (loginScreen) loginScreen.classList.remove("hidden");
  }
};

function handleJoin() {
  const input = document.getElementById("username-input");
  if (!input) return;
  const name = input.value.trim();
  if (!name) return;
  user = {
    id: clientProfile ? clientProfile.id : crypto.randomUUID(),
    name,
    isMaster: false,
  };
  localStorage.setItem("nj_client_identity", JSON.stringify(user));
  document.getElementById("connection-overlay").classList.remove("hidden");
  document.getElementById("login-screen").classList.add("hidden");
  updateLoadingStatus("กำลังเริ่มการเชื่อมต่อ...");
  initPeer();
}

function updateLoadingStatus(text, isError = false) {
  const el = document.getElementById("conn-status-text");
  if (el) {
    el.innerText = text;
    el.className = isError ? "text-red-500 text-sm" : "text-zinc-400 text-sm";
  }
}

function initPeer() {
  if (peer) {
    peer.destroy();
    peer = null;
  }
  const nameEl = document.getElementById("user-name");
  const avatarEl = document.getElementById("user-avatar");
  if (nameEl) nameEl.innerText = user.name;
  if (avatarEl) avatarEl.innerText = user.name[0].toUpperCase();

  peer = new Peer(PEER_CONFIG);
  peer.on("open", (id) => {
    updateLoadingStatus("พบเซิร์ฟเวอร์... กำลังเข้าห้อง");
    setStatus(
      "เชื่อมต่อ...",
      "text-yellow-500",
      "bg-yellow-500/10",
      "border-yellow-500"
    );
    conn = peer.connect(hostId);
    conn.on("open", () => {
      updateLoadingStatus("เชื่อมต่อสำเร็จ!");
      setStatus(
        "ออนไลน์",
        "text-green-500",
        "bg-green-500/10",
        "border-green-500"
      );
      conn.send({ type: "JOIN", user });
      conn.send({ type: "GET_STATE" });
    });
    conn.on("data", (data) => {
      if (data.type === "UPDATE_STATE") {
        document.getElementById("connection-overlay").classList.add("hidden");
        const remoteUI = document.getElementById("remote-ui");
        if (remoteUI) remoteUI.classList.remove("hidden");
        updateState(data);
      }
    });
    conn.on("close", () => {
      document.getElementById("connection-overlay").classList.remove("hidden");
      updateLoadingStatus("หลุดการเชื่อมต่อ...", true);
      setStatus("หลุด", "text-red-500", "bg-red-500/10", "border-red-500");
      setTimeout(checkAndReconnect, 2000);
    });
  });
  peer.on("error", (err) => {
    updateLoadingStatus("Error: " + err.type, true);
    setTimeout(checkAndReconnect, 3000);
  });
}
function checkAndReconnect() {
  if (!peer || peer.disconnected || peer.destroyed || (conn && !conn.open))
    initPeer();
}
function setStatus(text, tc, bc, boc) {
  const b = document.getElementById("status-badge");
  if (b) {
    b.innerText = text;
    b.className = `text-[10px] px-2 py-1 rounded-full border ${tc} ${bc} ${boc}`;
  }
}

function updateState(data) {
  masterId = data.masterId;
  const isMaster = user.id === masterId;
  if (data.audioFx) {
    if (isHostFxInstalled && !data.audioFx.isInstalled)
      showAlert("Amp Disconnected!", "Host lost connection.", "error");
    isHostFxInstalled = data.audioFx.isInstalled;
  }

  const masterControls = document.getElementById("master-controls");
  const nonMasterMsg = document.getElementById("non-master-msg");
  const userRole = document.getElementById("user-role");
  const djAddOptions = document.getElementById("dj-add-options");

  if (isMaster) {
    if (masterControls) masterControls.classList.remove("hidden");
    if (nonMasterMsg) nonMasterMsg.classList.add("hidden");
    if (userRole) {
      userRole.innerText = "👑 DJ MASTER";
      userRole.className = "text-[10px] text-pink-500 font-mono uppercase";
    }
    if (djAddOptions) djAddOptions.classList.remove("hidden");
    if (data.audioFx) updateFxUI(data.audioFx);

    const icon = document.getElementById("icon-toggle-play"),
      btn = document.getElementById("btn-toggle-play");

    if (icon && btn) {
      if (data.isPlaying) {
        icon.className = "fa-solid fa-pause text-lg";
        btn.classList.replace("bg-red-600", "bg-yellow-500");
      } else {
        icon.className = "fa-solid fa-play text-2xl pl-1";
        btn.classList.replace("bg-yellow-500", "bg-red-600");
      }
    }

    const nextBtn = document.getElementById("btn-next");
    if (nextBtn) {
      if (data.isTransitioning) {
        nextBtn.disabled = true;
        nextBtn.classList.add("opacity-50");
      } else {
        nextBtn.disabled = false;
        nextBtn.classList.remove("opacity-50");
      }
    }
  } else {
    if (masterControls) masterControls.classList.add("hidden");
    if (nonMasterMsg) nonMasterMsg.classList.remove("hidden");
    if (userRole) {
      userRole.innerText = "ผู้ร่วมงาน";
      userRole.className = "text-[10px] text-gray-500 font-mono uppercase";
    }
    if (djAddOptions) djAddOptions.classList.add("hidden");
  }
  const qCountBtn = document.getElementById("q-count-btn");
  if (qCountBtn) qCountBtn.innerText = (data.queue || []).length;
  updateQueueUI(data.queue || []);
}

function updateQueueUI(queue) {
  const list = document.getElementById("queue-list-modal");
  if (!list) return;
  const isMaster = user.id === masterId;
  list.innerHTML =
    queue.length === 0
      ? '<div class="flex flex-col items-center justify-center h-full text-zinc-500 space-y-2 py-10 opacity-50"><i class="fa-solid fa-music text-4xl"></i><p class="text-xs">ไม่มีเพลง</p></div>'
      : queue
          .map(
            (s, i) => `
      <div class="flex gap-3 items-center p-3 bg-zinc-800/30 rounded-xl border border-white/5">
         ${
           isMaster
             ? `<div class="flex flex-col gap-1 shrink-0 mr-1"><button onclick="sendMoveQueue(${i}, -1)" class="w-8 h-8 bg-zinc-700/50 rounded-lg flex items-center justify-center text-zinc-300 ${
                 i === 0 ? "opacity-30" : ""
               }"><i class="fa-solid fa-chevron-up text-xs"></i></button><button onclick="sendMoveQueue(${i}, 1)" class="w-8 h-8 bg-zinc-700/50 rounded-lg flex items-center justify-center text-zinc-300 ${
                 i === queue.length - 1 ? "opacity-30" : ""
               }"><i class="fa-solid fa-chevron-down text-xs"></i></button></div>`
             : `<div class="w-8 h-8 flex items-center justify-center bg-white/5 rounded-full text-zinc-500 text-xs font-bold">${
                 i + 1
               }</div>`
         }
         <img src="${
           s.thumbnail
         }" class="w-16 h-12 bg-black rounded-lg object-cover opacity-80" />
         <div class="flex-1 min-w-0"><div class="text-sm font-bold text-white truncate">${
           s.title
         }</div><div class="text-[10px] text-zinc-400">${s.sender}</div></div>
      </div>`
          )
          .join("");
}

// [FIX] เรียก openModal โดยตรง (ไม่ผ่าน UI)
function checkFxAvailability(cb) {
  if (isHostFxInstalled) cb();
  else showAlert("Required", "Host need NextAmp.", "warning");
}
function sendAction(type, data = {}) {
  if (conn && conn.open) conn.send({ type, user, ...data });
}
function sendTogglePlay() {
  sendAction("TOGGLE_PLAY");
}
function sendMoveQueue(idx, dir) {
  sendAction("MOVE_QUEUE", { index: idx, direction: dir });
}

function addSong() {
  const input = document.getElementById("url-input");
  if (!input) return;
  const url = input.value;
  if (!url) return;
  const chk = document.getElementById("chk-play-next");
  conn.send({ type: "ADD_SONG", url, user, playNext: chk && chk.checked });
  input.value = "";
  document.getElementById("preview-box").classList.add("hidden");
  if (chk) chk.checked = false;
  document.getElementById("add-btn").disabled = true;
  showToast("ส่งเพลงแล้ว!");
}

function updateFxUI(fx) {
  const pText = document.getElementById("pitch-val-text");
  if (pText) pText.innerText = (fx.pitch > 0 ? "+" : "") + fx.pitch;
  const rSlider = document.getElementById("fx-reverb");
  if (rSlider) rSlider.value = fx.reverb;
  const rText = document.getElementById("reverb-val-text");
  if (rText) rText.innerText = Math.round(fx.reverb * 100) + "%";
}
function setFx(k, v) {
  sendAction("SET_FX", { key: k, value: parseFloat(v) });
  if (k === "reverb") {
    const el = document.getElementById("reverb-val-text");
    if (el) el.innerText = Math.round(v * 100) + "%";
  }
}
function changePitch(d) {
  const t = document.getElementById("pitch-val-text");
  if (!t) return;
  let n = (parseInt(t.innerText) || 0) + d;
  if (n > 12) n = 12;
  if (n < -12) n = -12;
  t.innerText = (n > 0 ? "+" : "") + n;
  setFx("pitch", n);
}
function resetFx() {
  setFx("reset");
}
function setEq(i, v) {
  sendAction("SET_FX", { key: "eq", value: parseFloat(v), index: parseInt(i) });
}
function resetEq() {
  document.querySelectorAll("#eq-modal input").forEach((inp, i) => {
    inp.value = 0;
    setEq(i, 0);
  });
}

// Event Listeners
// [FIX] เพิ่มการเช็คว่ามี element url-input จริงไหมก่อนใส่ Event Listener (แก้ Error: Cannot read properties of null at line 287)
const urlInput = document.getElementById("url-input");
if (urlInput) {
  urlInput.addEventListener("input", (e) => {
    if (e.target.value.includes("youtu"))
      fetchVideoInfo(e.target.value).then((d) => {
        if (d.title) {
          document.getElementById("preview-box").classList.remove("hidden");
          document.getElementById("prev-img").src = d.thumbnail_url;
          document.getElementById("prev-title").innerText = d.title;
          document.getElementById("add-btn").disabled = false;
        }
      });
    else document.getElementById("preview-box").classList.add("hidden");
  });
}

async function pasteFromClipboard() {
  try {
    const t = await navigator.clipboard.readText();
    if (t) {
      const input = document.getElementById("url-input");
      if (input) {
        input.value = t;
        input.dispatchEvent(new Event("input"));
        showToast("วางลิงก์แล้ว!");
      }
    }
  } catch (e) {
    showToast("Clipboard Error");
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkAndReconnect();
});
