// js/ui.js

const UI = {
  // --- TOAST ---
  toastContainer: null,
  showToast(msg, type = "info") {
    if (!this.toastContainer) {
      this.toastContainer = document.createElement("div");
      this.toastContainer.className = "c-toast-container";
      document.body.appendChild(this.toastContainer);
    }

    const toast = document.createElement("div");
    const icon =
      type === "success"
        ? "fa-check-circle text-green-500"
        : type === "error"
        ? "fa-times-circle text-red-500"
        : "fa-info-circle text-blue-500";

    toast.className = "c-toast";
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span class="flex-1 text-sm font-bold">${msg}</span>`;

    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
      toast.style.transition = "all 0.3s";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  // --- MODAL ---
  openModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove("hidden");
      void el.offsetWidth;
      el.classList.remove("opacity-0");
      document.body.style.overflow = "hidden";
    }
  },
  closeModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add("opacity-0");
      setTimeout(() => {
        el.classList.add("hidden");
        document.body.style.overflow = "";
      }, 200);
    }
  },
  showAlert(title, msg, type = "info") {
    const t = document.getElementById("alert-title");
    const m = document.getElementById("alert-msg");
    const i = document.getElementById("alert-icon");
    if (t) t.innerText = title;
    if (m) m.innerText = msg;
    if (i) {
      i.innerHTML =
        type === "error"
          ? '<i class="fa-solid fa-times-circle text-red-500"></i>'
          : type === "warning"
          ? '<i class="fa-solid fa-exclamation-triangle text-yellow-500"></i>'
          : '<i class="fa-solid fa-info-circle text-blue-500"></i>';
    }
    this.openModal("alert-modal");
  },

  // --- TABS ---
  initTabs(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const btns = container.querySelectorAll(".c-tab-btn");
    btns.forEach((btn) => {
      btn.addEventListener("click", () => {
        btns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        const target = btn.getAttribute("data-target");
        const group = btn.getAttribute("data-group");

        document
          .querySelectorAll(`[data-group="${group}"]`)
          .forEach((c) => c.classList.add("hidden"));
        document.getElementById(target)?.classList.remove("hidden");
      });
    });
  },

  // --- TOGGLE ---
  toggle(btn, callback) {
    const isActive = btn.getAttribute("data-active") === "true";
    btn.setAttribute("data-active", !isActive);
    if (callback) callback(!isActive);
  },

  setToggleState(id, isActive) {
    const btn = document.getElementById(id);
    if (btn) btn.setAttribute("data-active", isActive);
  },

  init() {
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("c-modal-backdrop")) {
        this.closeModal(e.target.id);
      }
    });
    // Alias for compatibility
    window.openModal = this.openModal.bind(this);
    window.closeModal = this.closeModal.bind(this);
  },
};

document.addEventListener("DOMContentLoaded", () => UI.init());
