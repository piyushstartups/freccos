/* OneSignal Web Push v16 — strict-sequence wrapper.
 *
 * The strict ordering enforced everywhere:
 *   1. OneSignal.init()           ── completes
 *   2. OneSignal.login(userId)    ── completes and resolves
 *   3. OneSignal.User.PushSubscription.optIn()   ── only after login resolves
 *   4. Capture subscription id
 *   5. POST id to /api/users/me/onesignal-token  ── backend force-links external_id
 *
 * Anything that violates that sequence (eg. capturing a sub id before login()
 * has resolved) creates a "split identity" on OneSignal's side: the device gets
 * a real subscription but it's anchored to an anonymous OneSignal user rather
 * than to record(external_id=freccos.id). The backend transfer-subscription
 * endpoint can repair this, but enforcing the order client-side is faster.
 *
 * SDK script is loaded from index.html. We use the OneSignalDeferred queue
 * (FIFO sequential) — every helper is safe to call before SDK script loads.
 */

const APP_ID = process.env.REACT_APP_ONESIGNAL_APP_ID || "";

// -------- Platform detection (for iOS PWA gating) --------

export function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}
export function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  if (window.navigator.standalone === true) return true;
  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
  return false;
}
export function isIosWebPushBlocked() {
  return isIos() && !isStandalonePwa();
}
export function isWebPushSupported() {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;
  if (!("serviceWorker" in navigator)) return false;
  return true;
}

// -------- Internal: deferred-queue helper --------
//
// Every helper that needs the SDK schedules its work via `withOneSignal`. The
// SDK guarantees handlers run sequentially in the order they were pushed, so
// init → login → optIn → capture is guaranteed by call order alone.
function withOneSignal(fn) {
  return new Promise((resolve, reject) => {
    if (!APP_ID || typeof window === "undefined") { resolve(undefined); return; }
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
      try { resolve(await fn(OneSignal)); }
      catch (err) { reject(err); }
    });
  });
}

const log = (...args) => console.log("[OneSignal]", ...args); // eslint-disable-line no-console
const warn = (...args) => console.warn("[OneSignal]", ...args); // eslint-disable-line no-console

// -------- Step 1: init (called once from App on mount) --------

let initStarted = false;
let initDone = false;
const initWaiters = [];
function _signalInitDone() {
  initDone = true;
  while (initWaiters.length) { try { initWaiters.shift()(); } catch { /* ignore */ } }
}
function _awaitInit() {
  if (initDone) return Promise.resolve();
  return new Promise((res) => initWaiters.push(res));
}

export function initOneSignal() {
  if (initStarted || !APP_ID || typeof window === "undefined") return;
  initStarted = true;
  log("step 1/4 init: enqueuing init…");
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async function (OneSignal) {
    try {
      await OneSignal.init({
        appId: APP_ID,
        serviceWorkerPath: "/OneSignalSDKWorker.js",
        serviceWorkerParam: { scope: "/" },
        notifyButton: { enable: false },
        promptOptions: { slidedown: { enabled: false } },
        allowLocalhostAsSecureOrigin: true,
      });
      log("step 1/4 init: complete");
    } catch (e) {
      warn("init failed:", e);
    } finally {
      _signalInitDone();
    }
  });
}

// -------- Step 2: login --------

export function loginOneSignal(externalId) {
  return withOneSignal(async (OneSignal) => {
    if (!externalId) return;
    log("step 2/4 login: calling OneSignal.login(", externalId, ")");
    try {
      await OneSignal.login(String(externalId));
      log("step 2/4 login: resolved");
    } catch (e) {
      warn("login failed:", e);
    }
  });
}

export function logoutOneSignal() {
  return withOneSignal(async (OneSignal) => {
    try { await OneSignal.logout(); log("logout: complete"); }
    catch (e) { warn("logout failed:", e); }
  });
}

export function setOneSignalTags(tags) {
  return withOneSignal(async (OneSignal) => {
    const flat = {};
    Object.entries(tags || {}).forEach(([k, v]) => {
      if (v === null || v === undefined) return;
      flat[k] = Array.isArray(v) ? v.join(",") : String(v);
    });
    if (Object.keys(flat).length) await OneSignal.User.addTags(flat);
  });
}

// -------- Step 3 + 4 + 5: optIn → capture → POST --------

async function _captureAndStore(OneSignal) {
  // Poll for the subscription id (assigned asynchronously by the SDK).
  let id = null;
  let optedIn = false;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    try {
      const sub = OneSignal.User?.PushSubscription;
      id = sub?.id || null;
      optedIn = !!sub?.optedIn;
      if (id) break;
    } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!id) { warn("step 4/4 capture: no subscription id after 15 attempts"); return null; }
  log("step 4/4 capture: id =", id, "optedIn =", optedIn);
  try {
    const { default: api } = await import("./api");
    const { data } = await api.post("/users/me/onesignal-token", {
      subscription_id: id, opted_in: optedIn,
    });
    log("step 5/5 POST /api/users/me/onesignal-token →", data);
  } catch (e) {
    warn("POST onesignal-token failed:", e?.message || e);
  }
  return id;
}

async function _attachListener(OneSignal) {
  try {
    if (OneSignal._freccosSubListener) return;
    OneSignal._freccosSubListener = true;
    OneSignal.User?.PushSubscription?.addEventListener?.("change", async () => {
      log("PushSubscription change — re-capturing…");
      await _captureAndStore(OneSignal);
    });
  } catch { /* ignore */ }
}

export async function getPermissionStatus() {
  return withOneSignal(async (OneSignal) => {
    try { return (await OneSignal.Notifications.permission) ? "granted" : (Notification?.permission || "default"); }
    catch { return Notification?.permission || "default"; }
  });
}

// User-initiated prompt path (NotificationsBanner / settings).
export async function requestPushPermission() {
  return withOneSignal(async (OneSignal) => {
    try {
      await OneSignal.Notifications.requestPermission();
      const granted = OneSignal.Notifications.permission;
      log("requestPermission →", granted ? "granted" : "denied");
      if (granted) {
        try {
          log("step 3/5 optIn: calling…");
          await OneSignal.User.PushSubscription.optIn();
          log("step 3/5 optIn: resolved");
        } catch (e) { warn("optIn failed:", e); }
        await _attachListener(OneSignal);
        await _captureAndStore(OneSignal);
      }
      return granted ? "granted" : (Notification?.permission || "default");
    } catch (e) { warn("requestPushPermission failed:", e); return Notification?.permission || "default"; }
  });
}

export async function isOptedIn() {
  return withOneSignal(async (OneSignal) => {
    try { return !!OneSignal.User?.PushSubscription?.optedIn; }
    catch { return false; }
  });
}

export async function setOptIn(value) {
  return withOneSignal(async (OneSignal) => {
    try {
      if (value) await OneSignal.User.PushSubscription.optIn();
      else await OneSignal.User.PushSubscription.optOut();
      await _captureAndStore(OneSignal);
    } catch (e) { warn("setOptIn failed:", e); }
  });
}

// -------- Master flow — called on every successful Freccos login --------
//
// Strict sequence: wait for init, then login(externalId) resolves, THEN if the
// browser already granted permission, optIn + capture + POST. Anything that
// requires user interaction (first-time permission grant) goes through
// requestPushPermission() instead.
export function bindUserToOneSignal(externalId) {
  return withOneSignal(async (OneSignal) => {
    if (!externalId) return;
    // OneSignalDeferred handlers run sequentially; init was enqueued first, so by
    // the time this handler runs init is done. We still gate explicitly to be safe.
    await _awaitInit();
    log("bind: starting strict sequence for user", externalId);
    try {
      await OneSignal.login(String(externalId));
      log("bind: login resolved");
    } catch (e) {
      warn("bind: login failed:", e);
    }
    await _attachListener(OneSignal);

    // If the browser permission is already granted, silently re-engage the
    // SDK (covers refresh-after-permission, existing-user-after-deploy, etc.)
    const browserGranted = typeof Notification !== "undefined" && Notification.permission === "granted";
    const sub = OneSignal.User?.PushSubscription;
    const onesignalOptedIn = !!sub?.optedIn;
    if (browserGranted && !onesignalOptedIn) {
      try {
        log("bind: silent optIn (browser already granted)…");
        await OneSignal.User.PushSubscription.optIn();
        log("bind: silent optIn resolved");
      } catch (e) {
        warn("bind: silent optIn failed:", e);
      }
    }
    if (browserGranted) {
      await _captureAndStore(OneSignal);
    } else {
      log("bind: skipping capture (browser permission not granted yet)");
    }
  });
}

// Best-effort current state for UI
export async function getPushState() {
  if (!isWebPushSupported() || !APP_ID) {
    return { supported: false, permission: "unsupported", optedIn: false, iosBlocked: isIosWebPushBlocked() };
  }
  const permission = (typeof Notification !== "undefined" ? Notification.permission : "default");
  const optedIn = await isOptedIn();
  return { supported: true, permission, optedIn, iosBlocked: isIosWebPushBlocked() };
}

// Backwards-compat shim — callers used to call syncSubscriptionWithBackend.
// Route them through the new strict-sequence bind so existing call sites work.
export const syncSubscriptionWithBackend = bindUserToOneSignal;
