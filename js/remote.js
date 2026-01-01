// next-juke/js/remote.js

const urlParams = new URLSearchParams(window.location.search);

// --- [ส่วนที่เพิ่ม 1] ระบบกู้คืน Host ID ---
// ตรวจสอบว่ามี Host ID ใน URL หรือไม่ ถ้าไม่มีให้ลองหาจากความจำเครื่อง (กรณีเปิดผ่านการ Share)
let hostId = urlParams.get("host");

if (!hostId) {
  hostId = localStorage.getItem("nj_last_host_id");
} else {
  // ถ้ามี Host ID ให้บันทึกไว้ใช้ครั้งหน้า
  localStorage.setItem("nj_last_host_id", hostId);
}
// ----------------------------------------

let peer, conn, user;
let masterId = null;
let isHostFxInstalled = false;

// ตัวแปรเก็บลิงก์ที่ถูกแชร์มา (รอส่งเมื่อเชื่อมต่อสำเร็จ)
let pendingShareLink = null;

const savedProfile = localStorage.getItem("nj_client_identity");
let clientProfile = savedProfile ? JSON.parse(savedProfile) : null;

// --- [ส่วนที่เพิ่ม 2] ฟังก์ชันช่วยแกะลิงก์จากข้อความ ---
function extractUrlFromText(text) {
  if (!text) return null;
  // Regex หา http หรือ https
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const match = text.match(urlRegex);
  return match ? match[0] : null;
}
// ------------------------------------------------

window.onload = () => {
  // ตรวจสอบ Host ID ก่อนเริ่มทำงาน
  if (!hostId) {
    updateLoadingStatus(
      "ไม่พบ Host ID (กรุณาสแกน QR Code เพื่อเข้าห้องก่อน 1 ครั้ง)",
      true
    );
    document.getElementById("connection-overlay").classList.remove("hidden");
    // ซ่อนหน้า Login ไม่ให้กดเข้าได้ถ้าไม่มี Host
    document.getElementById("login-screen").classList.add("hidden");
    return;
  }

  // --- [ส่วนที่เพิ่ม 3] ตรวจสอบ Share Target Params ---
  const sharedUrl = urlParams.get("url");
  const sharedText = urlParams.get("text");
  const sharedTitle = urlParams.get("title");

  // YouTube Android มักส่งลิงก์มาใน 'text' ส่วน iOS อาจมาใน 'url'
  const foundLink = sharedUrl || extractUrlFromText(sharedText);

  if (
    foundLink &&
    (foundLink.includes("youtube.com") || foundLink.includes("youtu.be"))
  ) {
    pendingShareLink = foundLink;
    showToast(`ได้รับลิงก์: ${sharedTitle || "YouTube Video"}`);

    // ใส่ลิงก์รอไว้ในช่อง input เผื่อผู้ใช้กดส่งเองหรือดู Preview
    const inputEl = document.getElementById("url-input");
    if (inputEl) inputEl.value = pendingShareLink;
  }
  // -------------------------------------------------

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

      // --- [ส่วนที่เพิ่ม 4] ส่งเพลงอัตโนมัติถ้ามี Pending Link ---
      if (pendingShareLink) {
        console.log("Auto sending shared link:", pendingShareLink);

        // set value ให้ input เพื่อให้ addSong() ทำงานได้
        const inputEl = document.getElementById("url-input");
        if (inputEl) inputEl.value = pendingShareLink;

        // หน่วงเวลานิดนึงเพื่อให้สถานะ User อัปเดตฝั่ง Host ก่อนส่งเพลง
        setTimeout(() => {
          addSong();
          pendingShareLink = null; // เคลียร์ค่าทิ้ง
        }, 800);
      }
      // ----------------------------------------------------
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
    console.log("Detecting disconnection... Reconnecting...");
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
    document.getElementById("stop-btn").classList.remove("hidden");
    document.getElementById("user-role").innerText = "👑 DJ MASTER";
    document.getElementById("user-role").classList.add("text-pink-500");

    // Show DJ Add Options (Checkbox)
    document.getElementById("dj-add-options").classList.remove("hidden");

    const fxBtn = document.getElementById("fx-btn-container");
    if (fxBtn) fxBtn.classList.remove("hidden");

    if (data.audioFx) {
      updateFxUI(data.audioFx);
    }
  } else {
    document.getElementById("master-controls").classList.add("hidden");
    document.getElementById("non-master-msg").classList.remove("hidden");
    document.getElementById("stop-btn").classList.add("hidden");
    document.getElementById("user-role").innerText = "ผู้ร่วมงาน";
    document.getElementById("user-role").classList.remove("text-pink-500");

    // Hide DJ Add Options
    document.getElementById("dj-add-options").classList.add("hidden");

    const fxBtn = document.getElementById("fx-btn-container");
    if (fxBtn) fxBtn.classList.add("hidden");
  }

  document.getElementById("q-count-btn").innerText = data.queue.length;
  updateQueueUI(data.queue);
}

function updateQueueUI(queue) {
  const qList = document.getElementById("queue-list-modal");
  const isMaster = user && user.id === masterId;

  if (queue.length === 0) {
    qList.innerHTML =
      '<div class="text-center text-zinc-600 text-xs py-4">ยังไม่มีเพลงในคิว</div>';
  } else {
    qList.innerHTML = queue
      .map(
        (s, i) => `
            <div class="flex gap-3 items-center p-3 bg-zinc-800/30 rounded border border-white/5">
                ${
                  isMaster
                    ? `<div class="flex flex-col gap-1 shrink-0 mr-1">
                          <button onclick="sendMoveQueue(${i}, -1)" class="w-8 h-6 bg-zinc-700/50 hover:bg-zinc-700 rounded flex items-center justify-center text-zinc-300 ${
                        i === 0 ? "opacity-30 pointer-events-none" : ""
                      }">
                              <i class="fa-solid fa-chevron-up text-xs"></i>
                          </button>
                          <button onclick="sendMoveQueue(${i}, 1)" class="w-8 h-6 bg-zinc-700/50 hover:bg-zinc-700 rounded flex items-center justify-center text-zinc-300 ${
                        i === queue.length - 1
                          ? "opacity-30 pointer-events-none"
                          : ""
                      }">
                              <i class="fa-solid fa-chevron-down text-xs"></i>
                          </button>
                      </div>`
                    : `<span class="text-zinc-500 font-mono text-xs w-4 text-center">${
                        i + 1
                      }</span>`
                }
                
                <img src="${
                  s.thumbnail
                }" class="w-10 h-10 rounded object-cover opacity-80 bg-zinc-800 shrink-0">
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-white truncate">${
                      s.title
                    }</div>
                    <div class="text-xs text-zinc-500">โดย ${s.sender}</div>
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
  if (isHostFxInstalled) {
    callback();
  } else {
    showAlert(
      "Extension Required",
      "Host PC must have NextAmp Extension installed to use this feature.",
      "warning"
    );
  }
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

  // ตรวจสอบสถานะ Checkbox แทรกคิว
  const chk = document.getElementById("chk-play-next");
  const playNext = chk && !chk.classList.contains("hidden") && chk.checked;

  conn.send({ type: "ADD_SONG", url, user, playNext: playNext });

  document.getElementById("url-input").value = "";
  document.getElementById("preview-box").classList.add("hidden");

  // Reset ค่า Checkbox ทันที
  if (chk) chk.checked = false;

  const btn = document.getElementById("add-btn");
  btn.disabled = true;
  btn.className =
    "w-12 flex items-center justify-center rounded-xl bg-zinc-800 border border-zinc-700 text-gray-500 transition-colors";

  if (playNext) {
    showToast("แทรกเพลงคิวถัดไปเรียบร้อย!");
  } else {
    showToast("ส่งเพลงแล้ว!");
  }
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
          "w-12 flex items-center justify-center rounded-xl bg-pink-600 text-white shadow-lg shadow-pink-600/20 transition-colors";
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
  if (document.visibilityState === "visible") {
    checkAndReconnect();
  }
});
