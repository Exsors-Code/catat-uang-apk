// CatatUang v1.4.0 - Entry Point
let initFailed = false;

async function safeInit() {
  try {
    await load();
    ensureStateDefaults();
    unlocked = false;
    pinInput = '';
    if (needsLock()) { unlocked = false; } else { unlocked = true; }
    render();
    if (typeof Capacitor !== 'undefined') {
      try {
        Capacitor.Plugins?.CatatUangNotification?.addListener('notificationReceived', (data) => {
          processCapturedNotification(data);
        });
      } catch (e) {
        ErrorLog.add('Notification listener registration failed', e);
      }
    }
  } catch (e) {
    initFailed = true;
    ErrorLog.add('Initialization failed', e, true);
    showError('Gagal memulai aplikasi. Coba tutup dan buka kembali.');
    // Fallback: render minimal UI so user can still access settings/import
    try {
      ensureStateDefaults();
      render();
    } catch (e2) {
      document.body.innerHTML = '<div style="padding:20px;color:var(--out)">Gagal memuat aplikasi. Silakan impor cadangan JSON.</div>';
    }
  }
}

function save() {
  try {
    ensureStateDefaults();
    DB.put('state', S);
  } catch (e) {
    ErrorLog.add('save failed', e, true);
    showError('Gagal menyimpan data');
  }
}

async function load() {
  try {
    const st = await DB.get('state');
    if (st) {
      S = migrateLegacyState(st);
      ensureStateDefaults();
    }
  } catch (e) {
    ErrorLog.add('load failed', e, true);
  }
  ensureStateDefaults();
  ensureWallets();
  applyRecurring();
  checkNotifListenerPermission();
  fetchCapturedNotifications();
  checkGithubUpdate(true);
}

function init() {
  safeInit().then(() => {
    if (!initFailed) {
      // initialization OK
    }
  });
}

window.addEventListener('DOMContentLoaded', init);
window.addEventListener('load', init);