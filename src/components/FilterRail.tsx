"use client";

import type { ReactNode } from "react";
import { useState } from "react";

export function FilterRail({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <aside className={`filterBar marketFilterRail ${isOpen ? "isOpen" : ""}`} aria-label="Collection filters">
      <button
        type="button"
        className="mobileFilterToggle"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>Filters</span>
        <span className="mobileFilterToggleIcon" aria-hidden="true">{isOpen ? "−" : "+"}</span>
      </button>
      <div className="filterRailBody">{children}</div>
    </aside>
  );
}
