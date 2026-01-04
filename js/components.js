// js/components.js

const COMP_SEARCH_MODAL = `
<div id="search-modal" class="fixed inset-0 z-[100] hidden opacity-0 transition-opacity duration-300" aria-labelledby="modal-title" role="dialog" aria-modal="true">
  <div class="fixed inset-0 bg-black/90 transition-opacity"></div>
  <div class="fixed inset-0 z-10 w-screen overflow-y-auto modal-overlay">
    <div class="flex min-h-full items-center justify-center p-4 text-center sm:p-0 modal-overlay">
      <div class="relative transform overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-md w-full">
        <div class="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex items-center gap-3">
          <div class="relative flex-1 group">
            <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"></i>
            <input id="inv-search-input" type="text" class="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 text-sm rounded-xl focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none pl-10 pr-4 py-2 transition-all" placeholder="ค้นหาเพลง YouTube..." autocomplete="off">
            <div id="search-suggestions" class="absolute top-full left-0 right-0 mt-2 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden hidden z-50 max-h-60 overflow-y-auto custom-scrollbar"></div>
          </div>
          <button id="btn-trigger-search" class="w-10 h-10 flex items-center justify-center bg-zinc-800 hover:bg-red-600 border border-zinc-700 hover:border-red-500 text-zinc-400 hover:text-white rounded-xl transition-colors shrink-0"><i class="fa-solid fa-magnifying-glass"></i></button>
          <button onclick="closeModal('search-modal')" class="w-10 h-10 flex items-center justify-center text-zinc-500 hover:text-white transition-colors rounded-full hover:bg-white/10"><i class="fa-solid fa-times text-xl"></i></button>
        </div>
        <div class="bg-black/50 px-4 py-4 min-h-[300px] max-h-[60vh] overflow-y-auto custom-scrollbar relative">
             <div id="search-placeholder" class="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 space-y-4 opacity-50 pointer-events-none"><i class="fa-brands fa-youtube text-6xl"></i><span class="text-sm">พิมพ์ชื่อเพลงเพื่อค้นหา</span></div>
             <div id="search-loader" class="hidden absolute inset-0 flex items-center justify-center z-20 bg-black/50"><div class="flex flex-col items-center gap-2"><i class="fa-solid fa-circle-notch fa-spin text-red-500 text-2xl"></i><span class="text-xs text-zinc-500">Searching...</span></div></div>
             <div id="search-list" class="space-y-3 pb-safe"></div>
        </div>
      </div>
    </div>
  </div>
</div>
`;

const COMP_WELCOME_MODAL = `
<div id="welcome-modal" class="fixed inset-0 z-[100] hidden opacity-0 transition-opacity duration-300" aria-labelledby="modal-title" role="dialog" aria-modal="true">
  <div class="fixed inset-0 bg-black/90 transition-opacity"></div>
  <div class="fixed inset-0 z-10 w-screen overflow-y-auto modal-overlay">
    <div class="flex min-h-full items-center justify-center p-4 text-center modal-overlay">
      <div class="relative transform overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 text-left shadow-2xl transition-all sm:w-full sm:max-w-2xl w-full">
        <div class="flex justify-between items-center p-4 border-b border-zinc-800 bg-zinc-900/50">
            <h3 class="font-bold text-lg text-white">ยินดีต้อนรับสู่ NextCast</h3>
            <button onclick="closeModal('welcome-modal')" class="text-zinc-500 hover:text-white"><i class="fa-solid fa-times text-xl"></i></button>
        </div>
        <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-zinc-800/50 p-6 rounded-2xl border border-green-500/20 text-center space-y-3">
                <i class="fa-brands fa-android text-5xl text-green-500 mx-auto block"></i>
                <div><h3 class="font-bold text-green-400">Android</h3><p class="text-xs text-gray-400 mt-1">เล่นเพลงอัตโนมัติ</p></div>
            </div>
            <div class="bg-zinc-800/50 p-6 rounded-2xl border border-white/20 text-center space-y-3">
                <i class="fa-brands fa-apple text-5xl text-white mx-auto block"></i>
                <div><h3 class="font-bold text-white">iOS</h3><p class="text-xs text-gray-400 mt-1">ต้องกด <strong class="text-red-400">"เปิดเสียง"</strong> หากเพลงเงียบ</p></div>
            </div>
        </div>
        <div class="p-4 border-t border-zinc-800 bg-zinc-900/50">
            <button onclick="closeModal('welcome-modal')" class="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl">รับทราบ</button>
        </div>
      </div>
    </div>
  </div>
</div>
`;

/* [UPDATED] Settings Modal with New NextAmp UI */
const COMP_SETTINGS_MODAL = `
<div id="settings-modal" class="fixed inset-0 z-[100] hidden opacity-0 transition-opacity duration-300" aria-labelledby="modal-title" role="dialog" aria-modal="true">
  <div class="fixed inset-0 bg-black/90 transition-opacity"></div>
  <div class="fixed inset-0 z-10 w-screen overflow-y-auto modal-overlay">
    <div class="flex min-h-full items-center justify-center p-4 modal-overlay">
      <div class="relative transform overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 text-left shadow-2xl transition-all sm:w-full sm:max-w-2xl w-full flex flex-col max-h-[85vh]">
        <div class="flex justify-between items-center p-4 border-b border-zinc-800 shrink-0">
            <h3 class="font-bold text-white text-lg">Menu</h3>
            <button onclick="closeModal('settings-modal')" class="text-zinc-500 hover:text-white"><i class="fa-solid fa-times text-xl"></i></button>
        </div>
        <div class="flex border-b border-zinc-800 bg-black/20 shrink-0">
            <button onclick="switchTab('dashboard')" id="tab-dashboard" class="flex-1 py-3 text-sm font-bold border-b-2 border-red-600 text-white">Dashboard</button>
            <button id="tab-nextamp" onclick="switchTab('nextamp')" class="flex-1 py-3 text-sm font-bold text-gray-500 border-b-2 border-transparent hover:text-white transition-colors"><span class="text-pink-500 mr-1">●</span> NextAmp</button>
            <button onclick="switchTab('settings')" id="tab-settings" class="flex-1 py-3 text-sm font-bold text-gray-500 border-b-2 border-transparent hover:text-white transition-colors">Settings</button>
        </div>
        <div class="p-6 overflow-y-auto flex-1 custom-scrollbar bg-zinc-900/50">
            <div id="view-dashboard" class="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                <div class="bg-zinc-800/30 rounded-xl p-4 min-h-[200px] flex flex-col border border-white/5"><h3 class="font-bold text-red-500 mb-3 text-xs uppercase tracking-wider">Queue (<span id="queue-count">0</span>)</h3><div id="queue-list" class="overflow-y-auto flex-1 space-y-1 custom-scrollbar"></div></div>
                <div class="bg-zinc-800/30 rounded-xl p-4 min-h-[200px] flex flex-col border border-white/5"><h3 class="font-bold text-blue-500 mb-3 text-xs uppercase tracking-wider">Users (<span id="user-count">0</span>)</h3><div id="user-list" class="overflow-y-auto flex-1 space-y-1 custom-scrollbar"></div></div>
            </div>
            
            <div id="view-nextamp" class="hidden">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                <div class="flex flex-col gap-4">
                  <div
                    class="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 flex flex-col gap-3"
                  >
                    <div class="flex items-center gap-3">
                      <div
                        class="w-10 h-10 bg-zinc-950 rounded-lg flex items-center justify-center border border-zinc-800 text-pink-500"
                      >
                        <i class="fas fa-plug text-lg"></i>
                      </div>
                      <div>
                        <h2 class="text-lg font-bold text-white leading-none">
                          Integration
                        </h2>
                        <div
                          id="ext-status-indicator"
                          class="flex items-center gap-2 mt-1"
                        >
                          <div
                            id="ext-status-dot"
                            class="w-2 h-2 rounded-full bg-red-500"
                          ></div>
                          <span
                            id="ext-status-text"
                            class="text-xs font-mono text-zinc-400"
                            >Disconnected</span
                          >
                        </div>
                      </div>
                    </div>

                    <div class="space-y-2 pt-2 border-t border-white/5">
                      <label
                        class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider"
                        >Extension ID</label
                      >
                      <div class="flex gap-2">
                        <input
                          type="text"
                          id="input-ext-id"
                          placeholder="Paste ID here..."
                          class="flex-1 min-w-0 bg-black border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-pink-500 outline-none"
                          onchange="saveExtensionId(this.value)"
                        />
                        <button
                          onclick="checkExtension()"
                          class="bg-pink-600 hover:bg-pink-500 text-white px-4 rounded-lg text-xs font-bold transition-all"
                        >
                          CONNECT
                        </button>
                      </div>
                    </div>

                    <div
                      class="flex items-center justify-between pt-2 border-t border-white/5"
                    >
                      <div>
                        <h4 class="font-bold text-xs text-white">Auto Start</h4>
                        <p class="text-[10px] text-zinc-500">
                          เริ่มจับเสียงทันทีเมื่อเปิดเว็บ
                        </p>
                      </div>
                      <button
                        onclick="toggleAutoStartAmp()"
                        id="btn-autoStartAmp"
                        class="w-10 h-6 rounded-full bg-zinc-700 relative transition-colors"
                      >
                        <div
                          class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform"
                        ></div>
                      </button>
                    </div>
                  </div>

                  <div
                    class="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 flex flex-col justify-center items-center text-center space-y-3"
                  >
                    <p class="text-zinc-400 text-xs">
                      หากติดตั้งแล้วยังใช้ไม่ได้ กดปุ่มนี้เพื่อ Reset
                    </p>
                    <button
                      onclick="checkExtension(true)"
                      class="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-xs font-bold border border-zinc-600"
                    >
                      <i class="fas fa-sync-alt mr-1"></i> Force Reconnect
                    </button>
                  </div>
                </div>
                <div
                  class="bg-zinc-900/80 border border-zinc-800 rounded-xl p-0 relative overflow-hidden group flex flex-col"
                >
                  <div
                    class="absolute inset-0 border-4 border-dashed border-zinc-800/50 m-4 rounded-lg flex flex-col items-center justify-center text-zinc-700 pointer-events-none z-0"
                  >
                    <div class="p-6">
                      <img
                        src="assets/next-amp.png"
                        class="object-cover opacity-50"
                        alt=""
                      />
                    </div>
                  </div>
                  <div
                    class="relative z-10 flex flex-col justify-end h-full p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent"
                  >
                    <h3 class="text-xl font-bold text-white mb-1">
                      NextAmp Extension
                    </h3>
                    <p class="text-xs text-gray-300 mb-4 line-clamp-2">
                      (PC Only) ปลดล็อกฟีเจอร์ Pitch Shift, Reverb และ EQ
                      สำหรับปาร์ตี้ของคุณ
                    </p>

                    <div class="flex gap-2">
                      <a
                        href="https://next-amp-player.vercel.app/install-extension.html"
                        target="_blank"
                        class="flex-1 bg-white text-black py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-200 transition"
                      >
                        <i class="fas fa-external-link-alt"></i>
                        เปิดหน้าดาวน์โหลด
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div id="view-settings" class="hidden space-y-4">
                <div class="space-y-4">
                    <h3 class="text-xs font-bold text-zinc-500 uppercase tracking-wider">Display</h3>
                    <div class="bg-zinc-800/30 p-4 rounded-xl border border-white/5 flex items-center justify-between"><div><h4 class="font-bold text-sm text-white">Crop to Fill</h4></div><button onclick="toggleSetting('fit')" id="btn-fit" class="w-10 h-6 rounded-full bg-zinc-700 relative transition-colors"><div class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform"></div></button></div>
                    <div class="bg-zinc-800/30 p-4 rounded-xl border border-white/5 flex items-center justify-between"><div><h4 class="font-bold text-sm text-white">Video Quality</h4></div><select onchange="updateQuality(this.value)" id="sel-quality" class="bg-zinc-900 border border-zinc-700 rounded px-3 py-1 text-xs text-white outline-none"><option value="auto">Auto</option><option value="hd720">HD</option><option value="medium">Medium</option></select></div>
                </div>
                
                <div class="space-y-4 pt-4 border-t border-white/5">
                    <h3 class="text-xs font-bold text-zinc-500 uppercase tracking-wider">Mini QR Code</h3>
                    <div class="bg-zinc-800/30 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                        <div><h4 class="font-bold text-sm text-white">Show Mini QR</h4><p class="text-xs text-zinc-500">แสดง QR Code เล็กตลอดเวลา</p></div>
                        <button onclick="toggleSetting('miniQr')" id="btn-miniQr" class="w-10 h-6 rounded-full bg-zinc-700 relative transition-colors"><div class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform"></div></button>
                    </div>
                    <div class="bg-zinc-800/30 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                        <div><h4 class="font-bold text-sm text-white">Position</h4></div>
                        <select onchange="updateQrPos(this.value)" id="sel-qrPos" class="bg-zinc-900 border border-zinc-700 rounded px-3 py-1 text-xs text-white outline-none">
                            <option value="br">Bottom Right</option>
                            <option value="bl">Bottom Left</option>
                            <option value="tr">Top Right</option>
                            <option value="tl">Top Left</option>
                        </select>
                    </div>
                </div>

                <div class="space-y-4 pt-4 border-t border-white/5">
                    <h3 class="text-xs font-bold text-zinc-500 uppercase tracking-wider">System</h3>
                    <div class="bg-zinc-800/30 p-4 rounded-xl border border-white/5 flex items-center justify-between"><div><h4 class="font-bold text-sm text-white">Safe Mode (iOS)</h4></div><button onclick="toggleSetting('reqInt')" id="btn-reqInt" class="w-10 h-6 rounded-full bg-zinc-700 relative transition-colors"><div class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform"></div></button></div>
                </div>
            </div>
        </div>
      </div>
    </div>
  </div>
</div>
`;

const COMP_ALERT_MODAL = `
<div id="alert-modal" class="fixed inset-0 z-[110] hidden opacity-0 transition-opacity duration-300" aria-labelledby="modal-title" role="dialog" aria-modal="true">
  <div class="fixed inset-0 bg-black/80 transition-opacity"></div>
  <div class="fixed inset-0 z-10 w-screen overflow-y-auto modal-overlay">
    <div class="flex min-h-full items-center justify-center p-4 text-center modal-overlay">
      <div class="relative transform overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-700 text-center shadow-2xl transition-all sm:w-full sm:max-w-sm p-6">
        <div id="alert-icon" class="mb-4 text-4xl"></div>
        <h3 id="alert-title" class="text-lg font-bold text-white mb-2">Alert</h3>
        <p id="alert-msg" class="text-sm text-zinc-400 mb-6 leading-relaxed"></p>
        <button onclick="closeModal('alert-modal')" class="w-full rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition-all">ตกลง</button>
      </div>
    </div>
  </div>
</div>
`;
const COMP_QUEUE_MODAL = `
<div id="queue-modal" class="fixed inset-0 z-[100] hidden opacity-0 transition-opacity duration-300" aria-labelledby="modal-title" role="dialog" aria-modal="true">
  <div class="fixed inset-0 bg-black/90 transition-opacity"></div>
  <div class="fixed inset-0 z-10 w-screen overflow-y-auto modal-overlay">
    <div class="flex min-h-full items-center justify-center p-4 modal-overlay">
      <div class="relative transform overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 text-left shadow-2xl transition-all w-full sm:max-w-md h-auto max-h-[85vh] flex flex-col">
        <div class="flex justify-between items-center p-4 border-b border-zinc-800 bg-zinc-900 shrink-0">
            <h3 class="font-bold text-white">รายการคิวเพลง</h3>
            <button onclick="closeModal('queue-modal')" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition"><i class="fa-solid fa-times"></i></button>
        </div>
        <div id="queue-list-modal" class="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-900/50 custom-scrollbar"></div>
      </div>
    </div>
  </div>
</div>
`;

/* [UPDATED] Fix Reverb Slider to look like EQ */
const COMP_FX_MODAL = `
<div id="fx-modal" class="fixed inset-0 z-[100] hidden opacity-0 transition-opacity duration-300" aria-labelledby="modal-title" role="dialog" aria-modal="true">
  <div class="fixed inset-0 bg-black/90 transition-opacity"></div>
  <div class="fixed inset-0 z-10 w-screen overflow-y-auto modal-overlay">
    <div class="flex min-h-full items-center justify-center p-4 modal-overlay">
      <div class="relative transform overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 text-left shadow-2xl transition-all w-full max-w-sm">
        <div class="flex justify-between items-center p-4 border-b border-zinc-800">
            <h3 class="font-bold text-white text-lg"><i class="fas fa-sliders-h mr-2 text-pink-500"></i>Master FX</h3>
            <button onclick="closeModal('fx-modal')" class="text-zinc-500 hover:text-white"><i class="fas fa-times text-xl"></i></button>
        </div>
        <div class="p-6 space-y-6">
            <div>
                <div class="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 text-center">Pitch Shift</div>
                <div class="flex items-center justify-between bg-black/50 p-3 rounded-xl border border-zinc-800">
                    <button onclick="changePitch(-1)" class="w-12 h-12 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white active:scale-95 transition"><i class="fas fa-caret-left text-2xl"></i></button>
                    <div class="text-center w-20"><span id="pitch-val-text" class="text-3xl font-mono text-pink-500 font-bold">0</span></div>
                    <button onclick="changePitch(1)" class="w-12 h-12 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white active:scale-95 transition"><i class="fas fa-caret-right text-2xl"></i></button>
                </div>
            </div>
            <div>
                <div class="flex justify-between text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3"><span>Reverb</span><span id="reverb-val-text" class="text-pink-500">0%</span></div>
                <div class="h-8 flex items-center w-full">
                    <input type="range" id="fx-reverb" min="0" max="2" step="0.1" value="0" oninput="setFx('reverb', this.value)" class="c-slider w-full cursor-pointer appearance-none bg-transparent" />
                </div>
            </div>
        </div>
        <div class="p-4 bg-black/20 flex gap-3">
            <button onclick="resetFx()" class="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold text-sm transition">Reset</button>
            <button onclick="closeModal('fx-modal')" class="flex-1 py-3 bg-white hover:bg-gray-200 text-black rounded-xl font-bold text-sm transition">Done</button>
        </div>
      </div>
    </div>
  </div>
</div>
`;

const COMP_EQ_MODAL = `
<div id="eq-modal" class="fixed inset-0 z-[100] hidden opacity-0 transition-opacity duration-300" aria-labelledby="modal-title" role="dialog" aria-modal="true">
  <div class="fixed inset-0 bg-black/90 transition-opacity"></div>
  <div class="fixed inset-0 z-10 w-screen overflow-y-auto modal-overlay">
    <div class="flex min-h-full items-center justify-center p-4 modal-overlay">
      <div class="relative transform overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 text-left shadow-2xl transition-all w-full max-w-lg">
        <div class="flex justify-between items-center p-4 border-b border-zinc-800">
            <h3 class="font-bold text-white text-lg"><i class="fas fa-chart-bar mr-2 text-green-500"></i>Equalizer</h3>
            <button onclick="closeModal('eq-modal')" class="text-zinc-500 hover:text-white"><i class="fas fa-times text-xl"></i></button>
        </div>
        <div class="p-6 overflow-x-auto">
            <div id="eq-sliders-container" class="flex justify-between gap-1 min-w-[320px]"></div>
        </div>
        <div class="p-4 bg-black/20 flex gap-3">
            <button onclick="resetEq()" class="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold text-sm transition">Flat</button>
            <button onclick="closeModal('eq-modal')" class="flex-1 py-3 bg-white hover:bg-gray-200 text-black rounded-xl font-bold text-sm transition">Done</button>
        </div>
      </div>
    </div>
  </div>
</div>
`;

function renderComponents(...components) {
  components.forEach((html) => {
    document.body.insertAdjacentHTML("beforeend", html);
  });
}

window.COMP_SEARCH_MODAL = COMP_SEARCH_MODAL;
window.COMP_WELCOME_MODAL = COMP_WELCOME_MODAL;
window.COMP_SETTINGS_MODAL = COMP_SETTINGS_MODAL;
window.COMP_ALERT_MODAL = COMP_ALERT_MODAL;
window.COMP_QUEUE_MODAL = COMP_QUEUE_MODAL;
window.COMP_FX_MODAL = COMP_FX_MODAL;
window.COMP_EQ_MODAL = COMP_EQ_MODAL;
