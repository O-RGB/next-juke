// js/ui-core.js

// --- 1. Modal System ---
window.openModal = function (id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove("hidden");
    // Force Reflow เพื่อให้ Animation ทำงาน
    void el.offsetWidth;
    el.classList.remove("opacity-0");
    document.body.style.overflow = "hidden"; // ล็อค Scroll
  }
};

window.closeModal = function (id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add("opacity-0");
    // รอ Animation จบ (300ms) แล้วค่อยซ่อน
    setTimeout(() => {
      el.classList.add("hidden");
      document.body.style.overflow = "";
    }, 300);
  }
};

// --- 2. Tab System ---
window.switchTab = function (tabName) {
  const tabs = ["dashboard", "nextamp", "settings"];
  tabs.forEach((t) => {
    const btn = document.getElementById(`tab-${t}`);
    const view = document.getElementById(`view-${t}`);
    if (view && btn) {
      if (t === tabName) {
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
};

// --- 3. Toast System ---
window.showToast = function (msg, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className =
      "fixed top-24 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none pt-safe-plus-2 items-center w-full max-w-sm px-4";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  const icon = type === "success" ? "fa-check" : "fa-info-circle";
  const color = type === "success" ? "text-green-400" : "text-blue-400";

  toast.className = `bg-zinc-900 border border-zinc-700 text-white px-4 py-3 rounded-xl shadow-xl animate-[fadeIn_0.3s] text-sm font-bold flex items-center gap-2 w-full transition-all duration-300`;
  toast.innerHTML = `<i class="fa-solid ${icon} ${color} shrink-0"></i><span class="break-words leading-tight flex-1 text-left">${msg}</span>`;

  container.appendChild(toast);

  // Animation In
  requestAnimationFrame(() => {
    toast.style.transform = "translateY(0)";
    toast.style.opacity = "1";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-10px)";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

// --- 4. Alert Helper ---
window.showAlert = function (title, msg, type = "info") {
  const t = document.getElementById("alert-title");
  const m = document.getElementById("alert-msg");
  const i = document.getElementById("alert-icon");
  if (t) t.innerText = title;
  if (m) m.innerText = msg;
  if (i) {
    i.innerHTML =
      type === "error"
        ? '<i class="fa-solid fa-circle-xmark text-red-500"></i>'
        : type === "success"
        ? '<i class="fa-solid fa-circle-check text-green-500"></i>'
        : '<i class="fa-solid fa-circle-info text-blue-500"></i>';
  }
  openModal("alert-modal");
};

// --- [UPDATED] Click Listener รองรับทั้ง Index และ Remote ---
document.addEventListener("DOMContentLoaded", () => {
  document.addEventListener("click", (e) => {
    // เช็คว่ากดโดนพื้นหลัง (ทั้งแบบเก่า c-modal-backdrop และแบบใหม่ modal-overlay)
    if (
      e.target.classList.contains("c-modal-backdrop") ||
      e.target.classList.contains("modal-overlay")
    ) {
      // หา ID ของ Modal แม่ (ไล่ขึ้นไปหา ID ที่ใกล้ที่สุด หรือใช้ ID ของ target ถ้ามันคือตัวแม่)
      // ใน Remote (modal-overlay) ตัว overlay เป็นลูกของ main modal ดังนั้นต้องหา closest
      // ใน Index (c-modal-backdrop) ตัวมันเองคือ main modal

      let modalId = e.target.id;
      if (!modalId || !modalId.includes("-modal")) {
        const parent = e.target.closest('[id$="-modal"]'); // หา element ที่ id ลงท้ายด้วย -modal
        if (parent) modalId = parent.id;
      }

      if (modalId) closeModal(modalId);
    }
  });
});
