import React from "react";
import { CATEGORIES, CATEGORY_LABEL } from "../lib/utils-frec";

export function CategoryChip({ category, className = "" }) {
  if (!category) return null;
  const cat = CATEGORIES.find((c) => c.id === category);
  return (
    <span className={`chip ${cat ? cat.className : "chip-inactive"} ${className}`} style={{ fontSize: 11 }}>
      {CATEGORY_LABEL[category] || category}
    </span>
  );
}

export function CategoryTabs({ value, onChange, includeAll = true, testIdPrefix = "cat-tab" }) {
  const list = [includeAll && { id: "all", label: "All" }, ...CATEGORIES].filter(Boolean);
  return (
    <div
      className="flex gap-2 overflow-x-auto px-4 pb-2 pt-3"
      style={{ scrollbarWidth: "none" }}
      data-testid="category-tabs"
    >
      {list.map((c) => {
        const active = value === c.id;
        return (
          <button
            key={c.id}
            data-testid={`${testIdPrefix}-${c.id}`}
            onClick={() => onChange(c.id)}
            className={`chip ${active ? "chip-active" : "chip-inactive"} whitespace-nowrap`}
            style={{ padding: "8px 14px" }}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
