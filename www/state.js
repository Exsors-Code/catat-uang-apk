// CatatUang State
const DEFAULT_CATS = {
  Makan: /makan|resto|cafe|kopi|warung|bakso|nasi|ayam|mie|bakery|coffee|food|minum|geprek|pizza|burger|snack|jajan|kenangan|starbucks|kfc|mcd|chatime|mixue/i,
  Transport: /bensin|pertamina|shell|parkir|tol|grab|gojek|ojek|kereta|transport|kai|mrt|transjakarta|spbu|bluebird|maxim/i,
  Belanja: /indomaret|alfamart|supermarket|mart|toko|market|shop|hypermart|carrefour|shopee|tokopedia|lazada|tiktok|lottemart|transmart/i,
  Tagihan: /listrik|pln|pulsa|internet|wifi|pdam|telkom|token|tagihan|bpjs|asuransi|pajak|pbb/i,
  Kesehatan: /apotek|klinik|dokter|rumah sakit|obat|kimia farma|halodok|alodokter|rsud|lab/i,
  Hiburan: /bioskop|cinema|xxi|game|netflix|spotify|wisata|steam|playstation|cgv|disney|youtube/i,
  Lainnya: /.*/,
};

const ALLOWED_PKGS = /gojek|gopay|ovo|dana|shopee|bca|seabank|jago|mandiri|bri|bni|jenius|blu\.|digibank|neo\.|sakuku|linkaja|doku|midtrans|flip\.id|oy\.id/i;
const DEFAULT_WALLETS = ['Tunai', 'BCA', 'Mandiri', 'BRI', 'BNI', 'SeaBank', 'Bank Jago', 'Jenius', 'GoPay', 'OVO', 'DANA', 'ShopeePay'];

let S = {
  tx: [],
  inc: [],
  detected: [],
  transfers: [],
  wallets: DEFAULT_WALLETS.map((n) => ({ name: n, start: 0 })),
  recurring: [],
  customCats: [],
  catLearn: {},
  set: {
    budget: 0,
    budgets: {},
    remindMidday: true,
    timeMidday: '11:45',
    remindNight: true,
    timeNight: '21:00',
    autoSave: false,
    githubRepo: 'Exsors-Code/catat-uang-apk',
    lastBackupAt: null,
    pinHash: '',
    pinSalt: '',
    pinAlgo: 'pbkdf2',
    pinAttempts: 0,
    pinLockedUntil: 0,
    autoLockMinutes: 5,
    biometricEnabled: false,
    screenProtection: true,
    onboardingDone: false,
  },
};

let tab = 'home';
let draft = { img: null, amt: '', note: '', cat: 'Makan', wallet: 'Tunai', d: today() };
let ocrMsg = '';
let viewMonth = today().slice(0, 7);
let notifListenerGranted = false;
let updateInfo = null;
let unlocked = false;
let pinInput = '';
let undoItem = null;
let undoTimer = null;
let filterQ = { q: '', cat: '', wallet: '' };
let incomeDraft = null;

function ensureStateDefaults() {
  if (!Array.isArray(S.tx)) S.tx = [];
  if (!Array.isArray(S.inc)) S.inc = [];
  if (!Array.isArray(S.detected)) S.detected = [];
  if (!Array.isArray(S.transfers)) S.transfers = [];
  if (!Array.isArray(S.recurring)) S.recurring = [];
  if (!Array.isArray(S.customCats)) S.customCats = [];
  if (!S.catLearn || typeof S.catLearn !== 'object') S.catLearn = {};
  if (!Array.isArray(S.wallets)) S.wallets = DEFAULT_WALLETS.map((n) => ({ name: n, start: 0 }));
  if (!S.set || typeof S.set !== 'object') S.set = {};
  S.set.budgets = S.set.budgets && typeof S.set.budgets === 'object' ? S.set.budgets : {};
  if (typeof S.set.budget !== 'number') S.set.budget = +S.set.budget || 0;
  if (typeof S.set.pinAttempts !== 'number') S.set.pinAttempts = 0;
  if (typeof S.set.pinLockedUntil !== 'number') S.set.pinLockedUntil = 0;
  if (typeof S.set.autoLockMinutes !== 'number') S.set.autoLockMinutes = 5;
  if (typeof S.set.githubRepo !== 'string' || !S.set.githubRepo.trim()) S.set.githubRepo = 'Exsors-Code/catat-uang-apk';
  if (typeof S.set.biometricEnabled !== 'boolean') S.set.biometricEnabled = false;
  if (typeof S.set.screenProtection !== 'boolean') S.set.screenProtection = true;
}

function migrateLegacyState(loaded) {
  if (!loaded) return loaded;
  const out = { ...loaded };
  if (out.goals && !out.recurring) out.recurring = out.goals;
  if (out.set && typeof out.set.budgets !== 'object') out.set.budgets = {};
  return out;
}

let undoStack = [];
function pushUndo(type, item) {
  undoStack.push({ type, item, time: Date.now() });
  if (undoStack.length > 10) undoStack.shift();
}
function popUndo() {
  return undoStack.pop();
}
