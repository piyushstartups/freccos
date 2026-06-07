// Tiny shared utilities used across Freccos UI

export const CATEGORIES = [
  { id: "food", label: "Food", className: "cat-food" },
  { id: "experience", label: "Experience", className: "cat-experience" },
  { id: "stay", label: "Stay", className: "cat-stay" },
  { id: "getting_around", label: "Getting around", className: "cat-getting_around" },
];

export const CATEGORY_LABEL = {
  food: "Food",
  experience: "Experience",
  stay: "Stay",
  getting_around: "Getting around",
};

export const AVATAR_TINTS = [
  { bg: "#FFE0B2", color: "#7A4500" },
  { bg: "#D1C4FF", color: "#3F2A8C" },
  { bg: "#BFE6FF", color: "#0A4D7A" },
  { bg: "#FFD0D0", color: "#8A2222" },
  { bg: "#CDEFD2", color: "#1F6B33" },
  { bg: "#FFEAD9", color: "#7A3A00" },
  { bg: "#E2D9F7", color: "#46258A" },
];

export function tintForId(id = "") {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % AVATAR_TINTS.length;
  return AVATAR_TINTS[idx];
}

export function initials(name = "") {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatMonthYear(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

export function formatRelativeTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) { const m = Math.floor(diff / 60); return `${m} min${m === 1 ? "" : "s"} ago`; }
  if (diff < 86400) { const h = Math.floor(diff / 3600); return `${h} hour${h === 1 ? "" : "s"} ago`; }
  if (diff < 86400 * 2) return "Yesterday";
  if (diff < 86400 * 7) { const dys = Math.floor(diff / 86400); return `${dys} days ago`; }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}


export function photoUrl(pathOrUrl) {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  if (pathOrUrl.startsWith("/api/")) {
    return (process.env.REACT_APP_BACKEND_URL || "") + pathOrUrl;
  }
  return pathOrUrl;
}
