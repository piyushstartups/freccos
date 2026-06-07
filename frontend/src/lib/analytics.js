// Thin wrapper around the PostHog snippet loaded in public/index.html.
// All functions are safe no-ops if PostHog hasn't loaded yet (e.g. blocked by
// an ad blocker, or during SSR/tests).

const ph = () => (typeof window !== "undefined" ? window.posthog : null);

export function track(event, properties) {
  try { ph()?.capture?.(event, properties || {}); }
  catch { /* swallow analytics errors */ }
}

export function identify(userId, traits) {
  if (!userId) return;
  try { ph()?.identify?.(userId, traits || {}); }
  catch { /* swallow */ }
}

export function resetIdentity() {
  try { ph()?.reset?.(); }
  catch { /* swallow */ }
}

// Convenience helpers — keep event names stable so dashboards don't break.
export const Events = {
  // Auth
  SIGNUP_STARTED: "signup_started",
  SIGNUP_COMPLETED: "signup_completed",
  LOGIN_COMPLETED: "login_completed",
  // Exploration
  PAGE_VIEWED: "page_viewed",
  CITY_EXPLORED: "city_explored",
  PLACE_CARD_OPENED: "place_card_opened",
  // Social
  FOLLOW_TAPPED: "follow_tapped",
  FOLLOW_REQUEST_SENT: "follow_request_sent",
  FOLLOW_REQUEST_ACCEPTED: "follow_request_accepted",
  INVITE_CODE_SHARED: "invite_code_shared",
  // Content
  RECOMMENDATION_ADDED: "recommendation_added",
  RECOMMENDATION_SAVED: "recommendation_saved",
  BUCKET_LIST_CITY_ADDED: "bucket_list_city_added",
  TRIP_PLAN_CREATED: "trip_plan_created",
};
