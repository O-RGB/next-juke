// next-juke/js/remote.js

const urlParams = new URLSearchParams(window.location.search);
const hostId = urlParams.get("host");

let peer, conn, user;
let masterId = null;
let isHostFxInstalled = false;

const savedProfile = localStorage.getItem("nj_client_identity");
let clientProfile = savedProfile ? JSON.parse(savedProfile) : null;

window.onload = () => {
  if (!hostId) {
    updateLoadingStatus("ไม่พบ Host ID (กรุณาสแกน QR Code ใหม่)", true);
    return;
  }

  injectRemoteUI();

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
    // แจ้งเตือน Remote หาก Host Amp Error หรือหลุด
    if (isHostFxInstalled && !data.audioFx.isInstalled) {
      if (typeof Swal !== "undefined") {
        Swal.fire({
          icon: "error",
          title: "Amp Disconnected!",
          text: "Host PC lost connection to NextAmp Extension.",
          timer: 2000,
          showConfirmButton: false,
          background: "#1f2937",
          color: "#fff",
        });
      } else {
        showToast("⚠️ Host Amp Disconnected!");
      }
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

    const fxBtn = document.getElementById("fx-btn-container");
    if (fxBtn) fxBtn.classList.add("hidden");
  }

  document.getElementById("q-count-btn").innerText = data.queue.length;
  updateQueueUI(data.queue);
}

function updateQueueUI(queue) {
  const qList = document.getElementById("queue-list-modal");
  if (queue.length === 0) {
    qList.innerHTML =
      '<div class="text-center text-zinc-600 text-xs py-4">ยังไม่มีเพลงในคิว</div>';
  } else {
    qList.innerHTML = queue
      .map(
        (s, i) => `
            <div class="flex gap-3 items-center p-3 bg-zinc-800/30 rounded border border-white/5">
                <span class="text-zinc-500 font-mono text-xs w-4 text-center">${
                  i + 1
                }</span>
                <img src="${
                  s.thumbnail
                }" class="w-10 h-10 rounded object-cover opacity-80 bg-zinc-800">
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
    if (typeof Swal !== "undefined") {
      Swal.fire({
        icon: "warning",
        title: "Extension Required",
        text: "Host PC must have NextAmp Extension installed.",
        background: "#1f2937",
        color: "#fff",
        confirmButtonColor: "#3b82f6",
      });
    } else {
      alert(
        "Host PC must have NextAmp Extension installed to use this feature."
      );
    }
  }
}

function sendAction(type, data = {}) {
  if (conn && conn.open) conn.send({ type, user, ...data });
}

function addSong() {
  const url = document.getElementById("url-input").value;
  if (!url) return;
  conn.send({ type: "ADD_SONG", url, user });
  document.getElementById("url-input").value = "";
  document.getElementById("preview-box").classList.add("hidden");
  const btn = document.getElementById("add-btn");
  btn.disabled = true;
  btn.className =
    "w-12 flex items-center justify-center rounded-xl bg-zinc-800 border border-zinc-700 text-gray-500 transition-colors";
  showToast("ส่งเพลงแล้ว!");
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

function injectRemoteUI() {
  const style = document.createElement("style");
  style.innerHTML = `
      input[type=range]::-webkit-slider-thumb {
        -webkit-appearance: none; appearance: none;
        width: 18px; height: 18px;
        background: #ffffff; border-radius: 50%;
        cursor: pointer; opacity: 1 !important;
        box-shadow: 0 2px 5px rgba(0,0,0,0.5); margin-top: -7px;
      }
      input[type=range]::-webkit-slider-runnable-track {
        width: 100%; height: 4px;
        background: #444; border-radius: 2px;
      }
    `;
  document.head.appendChild(style);

  const body = document.body;
  body.className =
    "bg-black text-white font-sans h-[100dvh] w-full overflow-hidden flex flex-col";

  const footer = document
    .getElementById("remote-ui")
    .querySelector(".fixed.bottom-0");
  if (footer) {
    footer.className =
      "bg-zinc-900 border-t border-zinc-800 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shrink-0 z-20";
    document.getElementById("remote-ui").appendChild(footer);
    const main = document.getElementById("remote-ui").querySelector(".flex-1");
    if (main) main.classList.add("overflow-y-auto", "overscroll-contain");
    document.getElementById("remote-ui").className = "flex flex-col h-full";
  }

  const controls = document.getElementById("master-controls");
  const btnContainer = document.createElement("div");
  btnContainer.id = "fx-btn-container";

  btnContainer.className = "hidden mt-4 col-span-4 grid grid-cols-2 gap-3";

  btnContainer.innerHTML = `
        <button id="btn-open-fx" onclick="checkFxAvailability(() => document.getElementById('fx-modal').classList.remove('hidden'))" 
           class="bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95">
           <i class="fas fa-sliders-h text-pink-500"></i> FX
        </button>
        <button id="btn-open-eq" onclick="checkFxAvailability(() => document.getElementById('eq-modal').classList.remove('hidden'))" 
           class="bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95">
           <i class="fas fa-chart-bar text-green-500"></i> EQ
        </button>
    `;
  controls.appendChild(btnContainer);

  createFxModal();
  createEqModal();
}

function createFxModal() {
  const modal = document.createElement("div");
  modal.id = "fx-modal";
  modal.className =
    "hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fadeIn";
  modal.innerHTML = `
        <div class="bg-zinc-900 w-full sm:w-96 rounded-t-2xl sm:rounded-2xl p-6 border-t sm:border border-zinc-700 shadow-2xl pb-[calc(2rem+env(safe-area-inset-bottom))]">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-white"><i class="fas fa-sliders-h mr-2 text-pink-500"></i>Master FX</h3>
                <button onclick="document.getElementById('fx-modal').classList.add('hidden')" class="text-zinc-500 hover:text-white p-2"><i class="fas fa-times text-xl"></i></button>
            </div>
            <div class="space-y-6">
                <div>
                    <div class="text-sm mb-3 text-zinc-400 text-center uppercase tracking-wider font-bold">Pitch Shift</div>
                    <div class="flex items-center justify-between bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                        <button onclick="changePitch(-1)" class="w-12 h-12 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white active:scale-90 transition-transform">
                            <i class="fas fa-caret-left text-2xl"></i>
                        </button>
                        
                        <div class="text-center w-20">
                            <span id="pitch-val-text" class="text-3xl font-mono text-pink-500 font-bold">0</span>
                        </div>
                        
                        <button onclick="changePitch(1)" class="w-12 h-12 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white active:scale-90 transition-transform">
                            <i class="fas fa-caret-right text-2xl"></i>
                        </button>
                    </div>
                </div>

                <div>
                    <div class="flex justify-between text-sm mb-2"><span class="text-zinc-400">Reverb</span><span id="reverb-val-text" class="font-mono text-pink-400">0%</span></div>
                    <input type="range" id="fx-reverb" min="0" max="2" step="0.1" value="0" class="w-full" oninput="setFx('reverb', this.value)">
                </div>

                <div class="grid grid-cols-2 gap-3 pt-4">
                    <button onclick="resetFx()" class="bg-zinc-800 text-zinc-300 py-3 rounded-xl font-medium">Reset</button>
                    <button onclick="document.getElementById('fx-modal').classList.add('hidden')" class="bg-white text-black py-3 rounded-xl font-bold">Done</button>
                </div>
            </div>
        </div>
    `;
  document.body.appendChild(modal);
}

function createEqModal() {
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
  const modal = document.createElement("div");
  modal.id = "eq-modal";
  modal.className =
    "hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fadeIn";

  let slidersHtml = bands
    .map(
      (label, i) => `
            <div class="flex flex-col items-center gap-2 flex-1 min-w-[30px]">
                 <div class="relative h-32 w-full flex justify-center">
                    <input type="range" min="-12" max="12" step="1" value="0" 
                        oninput="setEq(${i}, this.value)"
                        class="absolute top-[50%] left-[50%] w-32 h-8 -translate-x-1/2 -translate-y-1/2 -rotate-90 origin-center bg-transparent appearance-none">
                 </div>
                 <span class="text-[9px] text-zinc-500 font-mono -mt-2">${label}</span>
            </div>
        `
    )
    .join("");

  modal.innerHTML = `
        <div class="bg-zinc-900 w-full sm:w-[500px] rounded-t-2xl sm:rounded-2xl p-6 border-t sm:border border-zinc-700 shadow-2xl pb-[calc(2rem+env(safe-area-inset-bottom))]">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold text-white"><i class="fas fa-chart-bar mr-2 text-green-500"></i>Equalizer</h3>
                <button onclick="document.getElementById('eq-modal').classList.add('hidden')" class="text-zinc-500 hover:text-white p-2"><i class="fas fa-times text-xl"></i></button>
            </div>
            <div class="flex justify-between gap-0 overflow-x-auto pb-4 no-scrollbar">
                ${slidersHtml}
            </div>
            <div class="grid grid-cols-2 gap-3 mt-2">
                <button onclick="resetEq()" class="bg-zinc-800 text-zinc-300 py-3 rounded-xl font-medium">Flat</button>
                <button onclick="document.getElementById('eq-modal').classList.add('hidden')" class="bg-white text-black py-3 rounded-xl font-bold">Done</button>
            </div>
        </div>
    `;
  document.body.appendChild(modal);
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
