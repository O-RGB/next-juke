// next-juke/js/utils.js

// --- Global Modal Logic (Component System) ---

// ทำงานทันทีเมื่อโหลดไฟล์ ฟัง Events คลิกทั้ง Document
document.addEventListener("click", (e) => {
  // ถ้าคลิกโดนตัว Backdrop (พื้นที่สีดำ)
  if (e.target.classList.contains("c-modal-backdrop")) {
    closeModal(e.target);
  }
});

// ฟังก์ชันเปิด Modal (เรียกด้วย ID string)
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove("hidden");
    // Force reflow เพื่อให้ Animation ทำงาน
    void el.offsetWidth;
    el.classList.remove("opacity-0");
    document.body.style.overflow = "hidden"; // ล็อค Scroll ของ Body หลัก
  }
}

// ฟังก์ชันปิด Modal (รับได้ทั้ง ID string หรือ Element Object)
function closeModal(target) {
  let el = target;
  if (typeof target === "string") {
    el = document.getElementById(target);
  }

  if (el) {
    el.classList.add("opacity-0");
    // รอ Animation จบแล้วค่อยซ่อน
    setTimeout(() => {
      el.classList.add("hidden");
      document.body.style.overflow = ""; // ปลดล็อค Scroll
    }, 300);
  }
}

// ฟังก์ชัน Alert กลาง (ใช้ Modal เดียวกันหมด)
function showAlert(title, msg, type = "info") {
  const titleEl = document.getElementById("alert-title");
  const msgEl = document.getElementById("alert-msg");
  const iconEl = document.getElementById("alert-icon");

  if (titleEl) titleEl.innerText = title;
  if (msgEl) msgEl.innerText = msg;

  if (iconEl) {
    let iconHtml = "";
    if (type === "error")
      iconHtml = '<i class="fas fa-times-circle text-red-500"></i>';
    else if (type === "warning")
      iconHtml = '<i class="fas fa-exclamation-triangle text-yellow-500"></i>';
    else iconHtml = '<i class="fas fa-info-circle text-blue-500"></i>';
    iconEl.innerHTML = iconHtml;
  }

  openModal("alert-modal");
}

// --- Helper Functions อื่นๆ คงเดิม ---

function extractVideoID(url) {
  const regExp =
    /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[7].length === 11 ? match[7] : null;
}

async function fetchVideoInfo(url) {
  // Note: ใช้ Noembed เป็นตัวอย่าง (ใน Production ควรใช้ API Key ตัวเอง)
  try {
    const id = extractVideoID(url);
    if (!id) return {};
    const res = await fetch(
      `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${id}`
    );
    const data = await res.json();
    return data;
  } catch (e) {
    console.error("Fetch info error", e);
    return {};
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}
