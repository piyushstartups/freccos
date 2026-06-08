/* OneSignal Web Push v16 wrapper.
 *
 * The SDK script is loaded from index.html. We use the `OneSignalDeferred`
 * queue documented at https://documentation.onesignal.com/docs/en/web-sdk-reference
 * so every helper is safe to call before the SDK has finished loading.
 */

const APP_ID = process.env.REACT_APP_ONESIGNAL_APP_ID || "";

// -------- Platform detection (for iOS PWA gating) --------

export function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}
export function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  // iOS Safari sets navigator.standalone; Android Chrome uses display-mode media query.
  if (window.navigator.standalone === true) return true;
  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
  return false;
}
// On iOS, web push only works once the PWA is installed to the home screen.
export function isIosWebPushBlocked() {
  return isIos() && !isStandalonePwa();
}
// Web push at all? Some browsers (eg. Safari macOS < 16.4) lack Notification API.
export function isWebPushSupported() {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;
  if (!("serviceWorker" in navigator)) return false;
  return true;
}

// -------- SDK queue helper --------

function withOneSignal(fn) {
  return new Promise((resolve, reject) => {
    if (!APP_ID) {
      // No app id configured — silently no-op so the app keeps working.
      resolve(undefined);
      return;
    }
    if (typeof window === "undefined") { resolve(undefined); return; }
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
      try { resolve(await fn(OneSignal)); }
      catch (err) { reject(err); }
    });
  });
}

// -------- Init (called once from App on mount) --------

let initStarted = false;
export function initOneSignal() {
  if (initStarted || !APP_ID || typeof window === "undefined") return;
  initStarted = true;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async function (OneSignal) {
    try {
      await OneSignal.init({
        appId: APP_ID,
        // Dedicated subdirectory scope avoids collision with CRA /sw.js root scope.
        serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
        serviceWorkerParam: { scope: "/push/onesignal/" },
        // We drive the permission UX entirely from React. Suppress native widgets.
        notifyButton: { enable: false },
        promptOptions: { slidedown: { enabled: false } },
        allowLocalhostAsSecureOrigin: true,
      });
    } catch (e) {
      // Don't crash the app if OneSignal can't initialise.
      console.warn("[OneSignal] init failed:", e); // eslint-disable-line no-console
    }
  });
}

// -------- Identity / Tagging --------

export function loginOneSignal(externalId) {
  return withOneSignal(async (OneSignal) => { await OneSignal.login(externalId); });
}
export function logoutOneSignal() {
  return withOneSignal(async (OneSignal) => { await OneSignal.logout(); });
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

// -------- Permission --------

async function _captureSubscription(OneSignal) {
  // Pull the subscription id (v16: OneSignal.User.PushSubscription.id) and POST
  // it to Freccos so the backend can target this device directly. Retries up to
  // 10 times because the id can be assigned asynchronously after `optIn()`.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      const sub = OneSignal.User?.PushSubscription;
      const id = sub?.id;
      const optedIn = !!sub?.optedIn;
      if (id) {
        try {
          const { default: api } = await import("./api");
          await api.post("/users/me/onesignal-token", { subscription_id: id, opted_in: optedIn });
        } catch (e) {
          // Best-effort; the backend can re-sync on next login. Log once.
          console.warn("[OneSignal] sub upload failed:", e); // eslint-disable-line no-console
        }
        return id;
      }
    } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 600));
  }
  return null;
}

async function _attachSubscriptionListener(OneSignal) {
  // Re-sync the backend whenever the subscription state changes (e.g. token
  // refresh, user toggling browser permission, multi-device login).
  try {
    if (OneSignal._freccosSubListenerAttached) return;
    OneSignal._freccosSubListenerAttached = true;
    OneSignal.User?.PushSubscription?.addEventListener?.("change", async () => {
      await _captureSubscription(OneSignal);
    });
  } catch { /* ignore */ }
}

export async function getPermissionStatus() {
  return withOneSignal(async (OneSignal) => {
    try { return await OneSignal.Notifications.permission ? "granted" : (Notification?.permission || "default"); }
    catch { return Notification?.permission || "default"; }
  });
}
export async function requestPushPermission() {
  return withOneSignal(async (OneSignal) => {
    try {
      await OneSignal.Notifications.requestPermission();
      const granted = OneSignal.Notifications.permission;
      if (granted) {
        // Ensure subscription is active, then push the id to Freccos.
        try { await OneSignal.User.PushSubscription.optIn(); } catch { /* may already be opted in */ }
        await _attachSubscriptionListener(OneSignal);
        await _captureSubscription(OneSignal);
      }
      return granted ? "granted" : (Notification?.permission || "default");
    } catch { return Notification?.permission || "default"; }
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
      await _captureSubscription(OneSignal);
    } catch (e) { console.warn("[OneSignal] optIn/Out failed:", e); } // eslint-disable-line no-console
  });
}

// Called after every successful Freccos login.
//
// Three responsibilities:
//  1. Attach a 'change' listener so future subscription updates auto-sync.
//  2. RECOVERY PATH — if the browser already has `Notification.permission`
//     granted but OneSignal never registered a subscription (this happens for
//     users who allowed notifications before the OneSignal SDK was deployed,
//     so the dashboard shows "Never Subscribed - No Push Token"), silently
//     call `PushSubscription.optIn()` to register the existing browser permission.
//     Zero user interaction — fully transparent.
//  3. POST the resulting subscription id to the Freccos backend.
//
// If the SDK is stuck on a 409 (OneSignal already has a record for this user
// but the SDK's local state has a conflicting onesignal_id), we recover by:
//  - calling `OneSignal.logout()` to drop the stale local identity,
//  - re-`login()`-ing with the Freccos user id,
//  - `optIn()`-ing again to force a fresh subscription registration,
//  - and as a final fallback, asking our backend to fetch existing
//    subscriptions from OneSignal's REST API by external_id.
export function syncSubscriptionWithBackend(externalId) {
  return withOneSignal(async (OneSignal) => {
    await _attachSubscriptionListener(OneSignal);

    // Silent recovery: browser is granted but OneSignal isn't opted-in yet
    try {
      const browserGranted = typeof Notification !== "undefined" && Notification.permission === "granted";
      const sub = OneSignal.User?.PushSubscription;
      const onesignalOptedIn = !!sub?.optedIn;
      const onesignalHasId = !!sub?.id;
      if (browserGranted && !onesignalOptedIn && !onesignalHasId) {
        try {
          await OneSignal.User.PushSubscription.optIn();
        } catch (e) {
          // optIn can throw if the SDK doesn't yet have a service-worker registration;
          // the 'change' listener will pick the id up moments later anyway.
          console.warn("[OneSignal] silent optIn failed:", e); // eslint-disable-line no-console
        }
      }
    } catch { /* ignore */ }

    // Try once with the current state. If we capture an id, great.
    let capturedId = await _captureSubscription(OneSignal);

    // 409 recovery — happens when OneSignal already has a user record but the
    // SDK's local anonymous onesignal_id conflicts with it. Symptom: after
    // optIn() + polling, no subscription id ever materializes locally.
    if (!capturedId && externalId) {
      try {
        await OneSignal.logout();
      } catch (e) {
        console.warn("[OneSignal] logout failed during recovery:", e); // eslint-disable-line no-console
      }
      try {
        await OneSignal.login(externalId);
      } catch (e) {
        console.warn("[OneSignal] re-login failed during recovery:", e); // eslint-disable-line no-console
      }
      try {
        await OneSignal.User.PushSubscription.optIn();
      } catch (e) {
        console.warn("[OneSignal] post-recovery optIn failed:", e); // eslint-disable-line no-console
      }
      capturedId = await _captureSubscription(OneSignal);
    }

    // Final fallback — ask the backend to fetch subscriptions from OneSignal
    // server-side via GET /apps/{appId}/users/by/external_id/{userId}. This
    // covers cases where the SDK is fundamentally unable to recover client-side
    // (eg. permission state is fine but onesignal_id is unrecoverable here).
    if (!capturedId) {
      try {
        const { default: api } = await import("./api");
        await api.post("/users/me/onesignal-recover");
      } catch (e) {
        // Silent — backend logs the underlying reason.
      }
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
