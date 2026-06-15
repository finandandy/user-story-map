/*
 * Activity icons (US5 / FR-013/FR-014/FR-015/FR-017).
 *
 * Renders an ActivityIcon — a bundled Lucide icon (via Obsidian's `setIcon`) or
 * a custom SVG — and provides the picker used by the activity edit modal. Custom
 * SVG is the one place this feature renders arbitrary user markup, so it is
 * DOM-sanitized here before it is ever stored or rendered (research R15). The
 * pure `isLikelyUnsafeSvg` guard in `src/core` is a second, testable backstop.
 */

import { getIconIds, setIcon } from "obsidian";
import { ActivityIcon, isLikelyUnsafeSvg } from "../core/model";
import { LUCIDE_CATEGORIES } from "./lucide-categories";

/** Neutral placeholder shown when a stored Lucide name is unknown (Edge Cases). */
const FALLBACK_LUCIDE = "shapes";

/** Lucide ids Obsidian ships, with the `lucide-` prefix stripped, sorted. */
function lucideNames(): string[] {
  return getIconIds()
    .filter((id) => id.startsWith("lucide-"))
    .map((id) => id.slice("lucide-".length))
    .sort();
}

function isKnownLucide(name: string): boolean {
  return getIconIds().includes(`lucide-${name}`);
}

/**
 * DOM-sanitize a custom SVG string: require a single root `<svg>`, strip
 * `<script>`/`<foreignObject>`, every `on*` handler, and any `javascript:` or
 * external `href`/`xlink:href`. Returns the cleaned single-root SVG, or null when
 * the input is malformed or cannot be made safe (FR-017/F18).
 */
export function sanitizeSvg(svg: string): string | null {
  if (svg.trim().length === 0) return null;
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  } catch {
    return null;
  }
  if (doc.getElementsByTagName("parsererror").length > 0) return null;
  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== "svg") return null;

  const FORBIDDEN_TAGS = new Set(["script", "foreignobject"]);
  const walk = (el: Element): boolean => {
    if (FORBIDDEN_TAGS.has(el.tagName.toLowerCase())) return false;
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (name === "href" || name === "xlink:href") {
        if (
          value.startsWith("javascript:") ||
          value.startsWith("http://") ||
          value.startsWith("https://") ||
          value.startsWith("//")
        ) {
          el.removeAttribute(attr.name);
        }
      }
    }
    for (const child of Array.from(el.children)) {
      if (!walk(child)) child.remove();
    }
    return true;
  };
  if (!walk(root)) return null;
  return root.outerHTML;
}

/** Collapse a (sanitized) SVG to a single line so it occupies one `icon:` line. */
export function svgToSingleLine(svg: string): string {
  return svg.replace(/\r?\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
}

/**
 * Render `icon` into `el` (cleared first). Lucide names go through `setIcon`
 * (unknown names fall back to a neutral glyph); a custom SVG is DOM-sanitized
 * before it is injected. A null icon leaves `el` empty (no placeholder, FR-015).
 */
export function renderActivityIcon(
  el: HTMLElement,
  icon: ActivityIcon | null,
): void {
  el.empty();
  if (!icon) return;
  if (icon.type === "lucide") {
    setIcon(el, isKnownLucide(icon.name) ? icon.name : FALLBACK_LUCIDE);
    return;
  }
  const safe = sanitizeSvg(icon.svg);
  if (safe) {
    el.innerHTML = safe;
  } else {
    setIcon(el, FALLBACK_LUCIDE);
  }
}

/**
 * Mount the icon picker into `container`: a live preview, a searchable Lucide
 * grid (`getIconIds`, FR-014), a custom-SVG input, and a Clear button. Every
 * choice is reported through `onChange` (a custom SVG is sanitized + collapsed to
 * one line first, or rejected). The current selection is seeded from `initial`.
 */
export function mountIconPicker(
  container: HTMLElement,
  initial: ActivityIcon | null,
  onChange: (icon: ActivityIcon | null) => void,
): void {
  let current: ActivityIcon | null = initial;
  const wrap = container.createDiv({ cls: "usm-icon-picker" });

  const previewRow = wrap.createDiv({ cls: "usm-icon-preview-row" });
  previewRow.createSpan({ cls: "usm-icon-preview-label", text: "Icon:" });
  const preview = previewRow.createSpan({ cls: "usm-icon-preview" });
  const clearBtn = previewRow.createEl("button", {
    cls: "usm-add-btn",
    text: "Clear",
    attr: { "aria-label": "Remove icon" },
  });

  const refresh = (): void => {
    renderActivityIcon(preview, current);
    onChange(current);
  };
  clearBtn.addEventListener("click", (e) => {
    e.preventDefault();
    current = null;
    refresh();
  });

  const allNames = lucideNames();
  const available = new Set(allNames);

  // Category filter — only show categories that have at least one icon in this
  // Obsidian build's bundled Lucide set (intersect membership with `available`),
  // so a metadata/version mismatch never surfaces a dead category.
  const filterRow = wrap.createDiv({ cls: "usm-icon-filter-row" });
  const categorySelect = filterRow.createEl("select", {
    cls: "usm-icon-category dropdown",
  });
  const categoryNames = new Map<string, string[]>();
  for (const [cat, names] of Object.entries(LUCIDE_CATEGORIES)) {
    const present = names.filter((n) => available.has(n));
    if (present.length > 0) categoryNames.set(cat, present);
  }
  categorySelect.createEl("option", {
    value: "",
    text: `All icons (${allNames.length})`,
  });
  for (const [cat, names] of categoryNames) {
    categorySelect.createEl("option", {
      value: cat,
      text: `${titleCase(cat)} (${names.length})`,
    });
  }

  const search = filterRow.createEl("input", {
    cls: "usm-icon-search",
    attr: { type: "text", placeholder: "Search…" },
  });
  const grid = wrap.createDiv({ cls: "usm-icon-grid" });
  const count = wrap.createDiv({ cls: "usm-icon-count" });

  // Cap how many tiles render at once so a modal open stays snappy — the rest of
  // a category/the full set is reachable by typing, which filters before the cap.
  const RENDER_LIMIT = 300;
  const renderGrid = (): void => {
    grid.empty();
    const cat = categorySelect.value;
    const source = cat ? categoryNames.get(cat) ?? [] : allNames;
    const q = search.value.trim().toLowerCase();
    const all = q ? source.filter((n) => n.includes(q)) : source;
    const shown = all.slice(0, RENDER_LIMIT);
    for (const name of shown) {
      const btn = grid.createEl("button", {
        cls: "usm-icon-option",
        attr: { "aria-label": name, title: name },
      });
      setIcon(btn, name);
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        current = { type: "lucide", name };
        refresh();
      });
    }
    if (all.length === 0) {
      grid.createSpan({ cls: "usm-icon-empty", text: "No matches." });
      count.setText("");
    } else if (all.length > shown.length) {
      count.setText(
        `Showing ${shown.length} of ${all.length} icons — type to narrow.`,
      );
    } else {
      count.setText(`${all.length} icon${all.length === 1 ? "" : "s"}.`);
    }
  };
  search.addEventListener("input", () => renderGrid());
  categorySelect.addEventListener("change", () => renderGrid());

  // Custom SVG input.
  const svgLabel = wrap.createEl("label", {
    cls: "usm-icon-svg-label",
    text: "Or paste a custom SVG:",
  });
  const svgInput = svgLabel.createEl("textarea", {
    cls: "usm-icon-svg-input",
    attr: { placeholder: "<svg …>…</svg>" },
  });
  if (initial?.type === "custom-svg") svgInput.value = initial.svg;
  const svgError = svgLabel.createSpan({ cls: "usm-icon-svg-error" });
  const applySvg = svgInput.parentElement!.createEl("button", {
    cls: "usm-add-btn",
    text: "Use SVG",
  });
  applySvg.addEventListener("click", (e) => {
    e.preventDefault();
    svgError.setText("");
    const raw = svgInput.value.trim();
    if (raw.length === 0) return;
    const safe = sanitizeSvg(raw);
    if (!safe || isLikelyUnsafeSvg(safe)) {
      svgError.setText("That SVG was rejected as unsafe or malformed.");
      return;
    }
    current = { type: "custom-svg", svg: svgToSingleLine(safe) };
    refresh();
  });

  renderActivityIcon(preview, current);
  renderGrid();
}

/** "food-beverage" -> "Food beverage" for category option labels. */
function titleCase(s: string): string {
  const spaced = s.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
