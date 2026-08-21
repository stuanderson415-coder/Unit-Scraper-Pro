---
name: Wide workspace scrolling
description: Constraint for responsive wide boards nested in the RPL workspace.
---

When a wide, horizontally scrollable workspace is nested in the shared Radix vertical scroll wrapper, use a regular vertical overflow container for that page instead.

**Why:** The Radix wrapper’s internal table-sized content element can expand to the wide child’s intrinsic width. That hides the intended inner horizontal scroller and clips the board on mobile.

**How to apply:** For pages with a wide mapping or matrix board, keep the page’s vertical scroller width-constrained and give the board its own explicit horizontal scroll viewport. Verify both the page width and the board’s `clientWidth`/`scrollWidth` at a mobile viewport.