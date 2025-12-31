// next-juke/js/remote.js
const urlParams = new URLSearchParams(window.location.search);
const hostId = urlParams.get("host");

let peer, conn, user;
let masterId = null;

// โหลด profile เดิมที่เคยสร้างไว้ (ถ้ามี) เพื่อใช้ ID เดิมตลอด
const savedProfile = localStorage.getItem("nj_client_identity");
let clientProfile = savedProfile ? JSON.parse(savedProfile) : null;

window.onload = () => {
  if (!hostId) {
    updateLoadingStatus("ไม่พบ Host ID (กรุณาสแกน QR Code ใหม่)", true);
    return;
  }

  // ถ้าเคยมีชื่อแล้ว ให้ Login อัตโนมัติด้วย ID เดิม
  if (clientProfile && clientProfile.name) {
    document.getElementById("username-input").value = clientProfile.name;
    user = clientProfile;
    // ข้ามหน้า Login ไปเริ่ม connect เลย
    initPeer();
  } else {
    // ถ้ายังไม่มีชื่อ ให้ซ่อน Loading ชั่วคราวเพื่อให้กรอกชื่อ
    document.getElementById("connection-overlay").classList.add("hidden");
    document.getElementById("login-screen").classList.remove("hidden");
  }
};

function handleJoin() {
  const name = document.getElementById("username-input").value.trim();
  if (!name) return;

  // สร้าง ID ใหม่แค่ครั้งแรก หรือใช้ ID เดิมถ้ามี
  const uid = clientProfile ? clientProfile.id : crypto.randomUUID();

  user = { id: uid, name: name, isMaster: false };

  // จำ ID นี้ไว้ใช้ตลอดชีพ (ไม่ผูกกับ Host ID แล้ว)
  localStorage.setItem("nj_client_identity", JSON.stringify(user));

  // เปิด Loading กลับมา
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

  // UI Setup
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

      // ส่งข้อมูล User (พร้อม ID เดิม) ไปให้ Host ตัดสินใจ
      conn.send({ type: "JOIN", user: user });
      conn.send({ type: "GET_STATE" });
    });

    conn.on("data", (data) => {
      if (data.type === "UPDATE_STATE") {
        // *** สำคัญ: ซ่อน Loading เมื่อได้รับข้อมูลครั้งแรกเท่านั้น ***
        document.getElementById("connection-overlay").classList.add("hidden");
        document.getElementById("remote-ui").classList.remove("hidden");
        updateState(data);
      }
    });

    conn.on("close", () => {
      // ถ้าหลุด ให้เด้ง Loading ขึ้นมาบังทันที
      document.getElementById("connection-overlay").classList.remove("hidden");
      updateLoadingStatus("หลุดการเชื่อมต่อ... กำลังต่อใหม่", true);
      setStatus(
        "หลุดการเชื่อมต่อ",
        "text-red-500",
        "bg-red-500/10",
        "border-red-500"
      );

      // พยายามต่อใหม่
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

  if (isMaster) {
    document.getElementById("master-controls").classList.remove("hidden");
    document.getElementById("non-master-msg").classList.add("hidden");
    document.getElementById("stop-btn").classList.remove("hidden");
    document.getElementById("user-role").innerText = "👑 DJ MASTER";
    document.getElementById("user-role").classList.add("text-pink-500");
  } else {
    document.getElementById("master-controls").classList.add("hidden");
    document.getElementById("non-master-msg").classList.remove("hidden");
    document.getElementById("stop-btn").classList.add("hidden");
    document.getElementById("user-role").innerText = "ผู้ร่วมงาน";
    document.getElementById("user-role").classList.remove("text-pink-500");
  }

  document.getElementById("q-count-btn").innerText = data.queue.length;
  const qList = document.getElementById("queue-list-modal");
  if (data.queue.length === 0) {
    qList.innerHTML =
      '<div class="text-center text-zinc-600 text-xs py-4">ยังไม่มีเพลงในคิว</div>';
  } else {
    qList.innerHTML = data.queue
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
      showToast("ไม่พบข้อความใน Clipboard");
      return;
    }
    if (text.includes("youtube.com") || text.includes("youtu.be")) {
      const input = document.getElementById("url-input");
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      showToast("วางลิงก์เรียบร้อย!");
    } else {
      showToast("ลิงก์ไม่ถูกต้อง (ต้องเป็น YouTube)");
    }
  } catch (err) {
    console.error("Failed to read clipboard: ", err);
    showToast("ต้องอนุญาตให้เข้าถึง Clipboard ก่อน");
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
