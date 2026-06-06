import React from "react";
import PageHeader from "./PageHeader";

// Backwards-compatible wrapper. The Freccos logo is no longer rendered on internal
// pages — only the title/subtitle, left-aligned, per the iOS design standard.
export default function HeaderBrand({ title, subtitle, children, right, left }) {
  return (
    <PageHeader title={title} subtitle={subtitle} left={left} right={right}>
      {children}
    </PageHeader>
  );
}
