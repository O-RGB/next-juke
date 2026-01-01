// js/youtube-search.js

class YouTubeSearch {
  constructor(options = {}) {
    this.onSelect = options.onSelect || (() => {});
    this.apiList = [];
    this.currentApiUrl = localStorage.getItem("nj_inv_active") || null;
    this.STORAGE_KEYS = {
      LIST: "nj_inv_list",
      ACTIVE: "nj_inv_active",
      TIMESTAMP: "nj_inv_time",
    };
    this.CACHE_DURATION = 24 * 60 * 60 * 1000;
    this.searchCache = { query: "", results: [] };
    this.suggestTimeout = null;

    this.FALLBACK_SERVERS = [
      "https://inv.perditum.com/api/v1",
      "https://vid.puffyan.us/api/v1",
      "https://inv.tux.pizza/api/v1",
      "https://yewtu.be/api/v1",
    ];

    this.init();
  }

  async init() {
    // Setup UI Events
    const input = document.getElementById("inv-search-input");
    const btnSearch = document.getElementById("btn-trigger-search");
    const suggestionsBox = document.getElementById("search-suggestions");

    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          this.runSearch();
          if (suggestionsBox) suggestionsBox.classList.add("hidden");
        }
      });
      input.addEventListener("input", (e) =>
        this.handleSearchInput(e.target.value)
      );
    }

    if (btnSearch) {
      btnSearch.addEventListener("click", () => {
        this.runSearch();
        if (suggestionsBox) suggestionsBox.classList.add("hidden");
      });
    }

    // Close suggestions when clicking outside
    document.addEventListener("click", (e) => {
      if (suggestionsBox && input) {
        if (!suggestionsBox.contains(e.target) && e.target !== input) {
          suggestionsBox.classList.add("hidden");
        }
      }
    });

    // Initial Server Check
    const list = JSON.parse(
      localStorage.getItem(this.STORAGE_KEYS.LIST) || "[]"
    );
    const lastUpdate = parseInt(
      localStorage.getItem(this.STORAGE_KEYS.TIMESTAMP) || "0"
    );

    if (list.length === 0 || Date.now() - lastUpdate > this.CACHE_DURATION) {
      await this.fetchAndCacheInstanceList();
    } else {
      this.apiList = list;
      if (!this.currentApiUrl) this.currentApiUrl = list[0];
    }
  }

  open() {
    if (window.openModal) window.openModal("search-modal");

    const modalBody = document.querySelector("#search-modal .c-modal-body");
    if (modalBody) modalBody.scrollTop = 0;

    const input = document.getElementById("inv-search-input");
    if (input) {
      input.value = "";
      setTimeout(() => input.focus(), 100);
    }

    // Clear previous results/suggestions
    const list = document.getElementById("search-list");
    if (list) list.innerHTML = "";
    const placeholder = document.getElementById("search-placeholder");
    if (placeholder) placeholder.classList.remove("hidden");
    document.getElementById("search-suggestions")?.classList.add("hidden");
  }

  close() {
    if (window.closeModal) window.closeModal("search-modal");
  }

  async fetchAndCacheInstanceList() {
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
        this.apiList = validServers.slice(0, 15);
        localStorage.setItem(
          this.STORAGE_KEYS.LIST,
          JSON.stringify(this.apiList)
        );
        localStorage.setItem(this.STORAGE_KEYS.TIMESTAMP, Date.now());
        if (!this.currentApiUrl) {
          this.currentApiUrl = this.apiList[0];
          localStorage.setItem(this.STORAGE_KEYS.ACTIVE, this.currentApiUrl);
        }
      }
    } catch (e) {
      console.warn("Using fallback servers:", e);
      this.apiList = this.FALLBACK_SERVERS;
      if (!this.currentApiUrl) this.currentApiUrl = this.apiList[0];
    }
  }

  async findNextWorkingServer() {
    if (this.apiList.length === 0) return null;
    let currentIndex = this.apiList.indexOf(this.currentApiUrl);
    if (currentIndex === -1) currentIndex = 0;

    for (let i = 1; i < this.apiList.length; i++) {
      const nextIndex = (currentIndex + i) % this.apiList.length;
      const candidate = this.apiList[nextIndex];
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${candidate}/stats`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          this.currentApiUrl = candidate;
          localStorage.setItem(this.STORAGE_KEYS.ACTIVE, candidate);
          return candidate;
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  }

  handleSearchInput(query) {
    const container = document.getElementById("search-suggestions");
    if (!container) return;

    if (this.suggestTimeout) clearTimeout(this.suggestTimeout);

    if (!query || query.length < 2) {
      container.classList.add("hidden");
      return;
    }

    // [MODIFIED] Add checks to prevent ghosting
    this.suggestTimeout = setTimeout(async () => {
      // Check input focus and value again
      const currentInput = document.getElementById("inv-search-input");
      if (!currentInput || document.activeElement !== currentInput) {
        container.classList.add("hidden");
        return;
      }
      if (currentInput.value.trim() !== query.trim()) return;

      if (!this.currentApiUrl) return;

      try {
        const res = await fetch(
          `${this.currentApiUrl}/search/suggestions?q=${encodeURIComponent(
            query
          )}`
        );
        // Final check before render
        if (currentInput.value.trim() !== query.trim()) return;

        if (!res.ok) throw new Error("No suggestions");
        const data = await res.json();
        if (data.suggestions && data.suggestions.length > 0) {
          this.renderSuggestions(data.suggestions);
        } else {
          container.classList.add("hidden");
        }
      } catch (e) {
        container.classList.add("hidden");
      }
    }, 300);
  }

  renderSuggestions(list) {
    const container = document.getElementById("search-suggestions");
    const input = document.getElementById("inv-search-input");
    if (!container) return;

    container.scrollTop = 0;
    container.innerHTML = "";
    list.forEach((text) => {
      const div = document.createElement("div");
      div.className =
        "px-4 py-3 hover:bg-zinc-700 cursor-pointer text-sm text-zinc-300 hover:text-white border-b border-zinc-700/50 last:border-0 flex items-center gap-3";
      div.innerHTML = `<i class="fa-solid fa-magnifying-glass text-zinc-500 text-xs"></i> <span>${text}</span>`;

      // [MODIFIED] Logic to handle iOS taps properly
      const handleSelect = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (input) input.value = text;
        container.classList.add("hidden");
        if (this.suggestTimeout) clearTimeout(this.suggestTimeout);

        this.runSearch();
        if (input) input.blur();
      };

      div.addEventListener("mousedown", handleSelect);
      div.addEventListener("touchstart", handleSelect, { passive: false });

      container.appendChild(div);
    });
    container.classList.remove("hidden");
  }

  async runSearch(isRetry = false) {
    const input = document.getElementById("inv-search-input");
    const query = input ? input.value.trim() : "";
    if (!query) return;

    const loader = document.getElementById("search-loader");
    const listContainer = document.getElementById("search-list");
    const placeholder = document.getElementById("search-placeholder");
    const modalBody = document.querySelector("#search-modal .c-modal-body");

    document.getElementById("search-suggestions")?.classList.add("hidden");

    if (!isRetry) {
      if (loader) loader.classList.remove("hidden");
      if (listContainer) listContainer.innerHTML = "";
      if (placeholder) placeholder.classList.add("hidden");
      if (modalBody) modalBody.scrollTop = 0;
    }

    try {
      if (!this.currentApiUrl) await this.fetchAndCacheInstanceList();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(
        `${this.currentApiUrl}/search?q=${encodeURIComponent(
          query
        )}&type=video`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (loader) loader.classList.add("hidden");
      this.renderResults(data);
    } catch (error) {
      console.warn(`Search failed on ${this.currentApiUrl}:`, error);

      if (!isRetry) {
        const newServer = await this.findNextWorkingServer();
        if (newServer) {
          this.runSearch(true);
        } else {
          this.showError(
            loader,
            listContainer,
            "ไม่สามารถเชื่อมต่อ Server ได้"
          );
        }
      } else {
        this.showError(loader, listContainer, error.message);
      }
    }
  }

  showError(loader, container, msg) {
    if (loader) loader.classList.add("hidden");
    if (container) {
      container.innerHTML = `
            <div class="text-center text-red-400 mt-10 p-6 border border-red-500/20 rounded-2xl bg-red-500/5">
                <i class="fa-solid fa-triangle-exclamation text-3xl mb-3"></i>
                <p class="font-bold text-sm">${msg}</p>
                <button onclick="searchLib.runSearch()" class="mt-4 px-4 py-2 bg-zinc-800 rounded-lg text-xs hover:bg-zinc-700">ลองใหม่</button>
            </div>`;
    }
  }

  renderResults(data) {
    const list = document.getElementById("search-list");
    if (!list) return;

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
        "flex gap-3 p-2 bg-zinc-800/40 rounded-xl border border-white/5 active:bg-zinc-700 transition cursor-pointer hover:bg-zinc-800 group";

      let timeStr = "";
      if (typeof formatTime === "function") {
        timeStr = formatTime(item.lengthSeconds);
      } else {
        const m = Math.floor(item.lengthSeconds / 60);
        const s = Math.floor(item.lengthSeconds % 60);
        timeStr = `${m}:${s < 10 ? "0" : ""}${s}`;
      }

      const thumb =
        item.videoThumbnails.find((t) => t.quality === "medium") ||
        item.videoThumbnails[0];

      div.innerHTML = `
            <div class="relative w-32 h-20 shrink-0 bg-black rounded-lg overflow-hidden group-hover:opacity-80 transition">
                <img src="${thumb?.url}" class="w-full h-full object-cover" loading="lazy">
                <div class="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">${timeStr}</div>
            </div>
            <div class="flex-1 min-w-0 flex flex-col justify-center py-1">
                <h4 class="text-sm font-bold text-white leading-snug line-clamp-2 mb-1 group-hover:text-red-500 transition-colors">${item.title}</h4>
                <div class="text-[11px] text-zinc-400 truncate flex items-center gap-1">
                    <i class="fa-solid fa-user-circle text-[10px]"></i> ${item.author}
                </div>
            </div>
            <div class="flex items-center justify-center pl-2 pr-1">
                <button class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 group-hover:text-white group-hover:bg-red-600 transition shadow-lg"><i class="fa-solid fa-plus"></i></button>
            </div>
        `;

      div.onclick = () => {
        this.onSelect({
          id: item.videoId,
          title: item.title,
          thumbnail: thumb?.url,
        });
        this.close();
      };

      list.appendChild(div);
    });
  }
}
