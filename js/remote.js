// next-juke/js/remote.js

const urlParams = new URLSearchParams(window.location.search);
const hostId = urlParams.get("host");

let peer, conn, user;
let masterId = null;
let isHostFxInstalled = false;
let lastQueueData = [];

// ประกาศตัวแปรสำหรับ Library ค้นหาใหม่
let searchLib;

const savedProfile = localStorage.getItem("nj_client_identity");
let clientProfile = savedProfile ? JSON.parse(savedProfile) : null;

window.onload = () => {
  if (!hostId) {
    updateLoadingStatus("ไม่พบ Host ID (กรุณาสแกน QR Code ใหม่)", true);
    return;
  }

  // --- Initialize Search Library ---
  // เรียกใช้ Class จาก youtube-search.js
  searchLib = new YouTubeSearch({
    onSelect: (item) => {
      // เมื่อเลือกเพลงจากผลการค้นหา
      const mainInput = document.getElementById("url-input");
      if (mainInput) {
        // สร้าง Link YouTube แล้วใส่ในช่อง Input
        mainInput.value = `https://www.youtube.com/watch?v=${item.id}`;

        // Trigger Event เพื่อให้โค้ดส่วน Preview ทำงาน (ดึงปก, ชื่อเพลง)
        mainInput.dispatchEvent(new Event("input", { bubbles: true }));

        showToast("เลือกเพลงแล้ว กด + เพื่อส่ง");
      }
    },
  });
  // --------------------------------

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

// --- Connection & PeerJS Logic ---

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
    document.getElementById("user-role").innerText = "👑 DJ MASTER";
    document.getElementById("user-role").classList.add("text-pink-500");
    document.getElementById("dj-add-options").classList.remove("hidden");
    if (data.audioFx) updateFxUI(data.audioFx);
  } else {
    document.getElementById("master-controls").classList.add("hidden");
    document.getElementById("non-master-msg").classList.remove("hidden");
    document.getElementById("user-role").innerText = "ผู้ร่วมงาน";
    document.getElementById("user-role").classList.remove("text-pink-500");
    document.getElementById("dj-add-options").classList.add("hidden");
  }

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

// --- FX & Controls Logic ---

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

  // ส่งคำสั่ง ADD_SONG ไปที่ Host (Host จะดึง Info เองถ้ายังไม่มี)
  // แต่ปกติเราจะ Fetch Info ให้เสร็จที่ Client ก่อนส่งเพื่อความชัวร์
  // (ในที่นี้ Host.js มี logic fetchVideoInfo อยู่แล้ว)
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

// --- Event Listeners ---

const inp = document.getElementById("url-input");
inp.addEventListener("input", (e) => {
  const val = e.target.value;
  // เช็คเบื้องต้นว่าเป็น URL YouTube
  if (val.includes("youtu")) {
    // ใช้ fetchVideoInfo จาก utils.js (หรือที่โหลดมาแล้ว)
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
