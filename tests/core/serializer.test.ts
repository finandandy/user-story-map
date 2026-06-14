import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { parse } from "../../src/core/parser";
import { serialize } from "../../src/core/serializer";
import { isStoryMap } from "../../src/core/detect";
import {
  editCard,
  renameActivity,
  renameRelease,
  setReleaseSubtitle,
  createEmptyMap,
  addRelease,
  deleteRelease,
  reorderReleases,
  addActivity,
  deleteActivity,
  reorderActivities,
  addCard,
  deleteCard,
  reorderCard,
  moveCard,
} from "../../src/core/model";

const FIXTURE = readFileSync(
  fileURLToPath(new URL("../../fixtures/the-knight.md", import.meta.url)),
  "utf8",
);

/** Lines that differ between two serializations, as [index, before, after]. */
function changedLines(before: string, after: string): [number, string, string][] {
  const b = before.split("\n");
  const a = after.split("\n");
  const changed: [number, string, string][] = [];
  for (let i = 0; i < Math.max(b.length, a.length); i++) {
    if (b[i] !== a[i]) changed.push([i, b[i] ?? "", a[i] ?? ""]);
  }
  return changed;
}

describe("renameRelease — declaration + all refs rewritten together (FR-018)", () => {
  it("rewrites the # Releases line AND every ### group for that release, nothing else", () => {
    const map = parse(FIXTURE);
    const before = serialize(map);
    const after = serialize(renameRelease(map, "Core loop", "Core gameplay"));

    const changes = changedLines(before, after);
    // Every changed line must be the rename — the declaration plus its ### refs.
    expect(changes.length).toBeGreaterThan(1); // declaration + ≥1 band reference
    for (const [, was, now] of changes) {
      expect(was).toContain("Core loop");
      expect(now).toContain("Core gameplay");
      expect(now).toBe(was.replace("Core loop", "Core gameplay"));
    }
    // Declaration keeps its subtitle; every R-numbered ref is updated.
    expect(after).toContain("2. Core gameplay - makes it feel like a game");
    expect(after).toContain("### R2. Core gameplay");
    expect(after).not.toContain("Core loop");
  });

  it("is a pure function — the input map is not mutated", () => {
    const map = parse(FIXTURE);
    const before = serialize(map);
    renameRelease(map, "Core loop", "Core gameplay");
    expect(serialize(map)).toBe(before);
  });
});

describe("editCard / renameActivity — change only the targeted bytes (FR-004/FR-005)", () => {
  it("editCard rewrites only the addressed #### heading", () => {
    const map = parse(FIXTURE);
    const before = serialize(map);
    // Activity 0 "Enter & orient", "Walking skeleton" cell, order 1 = "See the goal".
    const after = serialize(
      editCard(
        map,
        { activityIndex: 0, releaseTitle: "Walking skeleton", order: 1 },
        { title: "Spot the objective" },
      ),
    );

    const changes = changedLines(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0][1]).toBe("#### 2. See the goal");
    expect(changes[0][2]).toBe("#### 2. Spot the objective");
  });

  it("editCard sets a body without disturbing surrounding blocks", () => {
    const map = parse(FIXTURE);
    const after = serialize(
      editCard(
        map,
        { activityIndex: 0, releaseTitle: "Walking skeleton", order: 0 },
        { body: "Press play to begin." },
      ),
    );
    expect(after).toContain("#### 1. Start the game\n\nPress play to begin.");
    // The edited map round-trips stably.
    expect(serialize(parse(after))).toBe(after);
  });

  it("renameActivity rewrites only the addressed ## heading", () => {
    const map = parse(FIXTURE);
    const before = serialize(map);
    const after = serialize(renameActivity(map, 0, "Begin the journey"));

    const changes = changedLines(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0][1]).toBe("## I. Enter & orient");
    expect(changes[0][2]).toBe("## I. Begin the journey");
  });

  it("preserved segments stay byte-identical after an edit (FR-005)", () => {
    const map = parse(FIXTURE);
    const edited = editCard(
      map,
      { activityIndex: 0, releaseTitle: "Walking skeleton", order: 1 },
      { title: "Spot the objective" },
    );
    const reparsed = parse(serialize(edited));
    expect(reparsed.frontmatter).toBe(map.frontmatter);
    expect(reparsed.preamble).toBe(map.preamble);
    expect(reparsed.trailing).toBe(map.trailing);
  });
});

describe("setReleaseSubtitle — edits only the declaration line (FR-004)", () => {
  it("updates the subtitle in the # Releases declaration and nowhere else", () => {
    const map = parse(FIXTURE);
    const before = serialize(map);
    const after = serialize(
      setReleaseSubtitle(map, "Walking skeleton", "the thinnest spine"),
    );
    const changes = changedLines(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0][2]).toBe("1. Walking skeleton - the thinnest spine");
  });

  it("clears the subtitle when given an empty value", () => {
    const map = parse(FIXTURE);
    const after = serialize(setReleaseSubtitle(map, "Walking skeleton", "  "));
    expect(after).toContain("1. Walking skeleton\n");
    expect(after).not.toContain("Walking skeleton - thinnest playable spine");
  });
});

// --- US3: create + structural mutation -------------------------------------

describe("createEmptyMap — marker skeleton (T027 / FR-011)", () => {
  it("serializes to marker frontmatter + empty # Releases/# Activities", () => {
    const text = serialize(createEmptyMap());
    expect(text).toBe(
      "---\nstory-map: true\n---\n\n# Releases\n\n# Activities\n",
    );
    // The marker is present so the file is recognized as a story map.
    expect(isStoryMap(text)).toBe(true);
  });

  it("renders as an empty map (no releases, no activities)", () => {
    const map = createEmptyMap();
    expect(map.releases).toHaveLength(0);
    expect(map.activities).toHaveLength(0);
  });

  it("round-trips: parse(serialize(empty)) re-serializes byte-identically", () => {
    const text = serialize(createEmptyMap());
    expect(serialize(parse(text))).toBe(text);
  });

  it("places an optional H1 title in the preamble", () => {
    const text = serialize(createEmptyMap({ title: "My roadmap" }));
    expect(text).toContain("---\n\n# My roadmap\n\n# Releases");
    expect(serialize(parse(text))).toBe(text); // still round-trips
  });
});

describe("structural mutation — renumber from position, identities intact (T028)", () => {
  describe("releases (FR-007/FR-008/FR-009/FR-021)", () => {
    it("addRelease appends a declaration with the next ordinal", () => {
      const map = parse(FIXTURE);
      const after = serialize(addRelease(map, "Polish", "the final 10%"));
      expect(after).toContain("4. Polish - the final 10%");
    });

    it("deleteRelease removes the declaration AND every ### group, then renumbers", () => {
      const map = parse(FIXTURE);
      const after = serialize(deleteRelease(map, "Core loop"));
      // The release and all its band references are gone everywhere.
      expect(after).not.toContain("Core loop");
      expect(after).not.toContain("### R2. Core loop");
      // "Depth & agency" was R3; with R2 removed it renumbers to R2.
      expect(after).toContain("2. Depth & agency - the vision you're protecting");
      expect(after).toContain("### R2. Depth & agency");
      expect(after).not.toContain("### R3. Depth & agency");
      // Walking skeleton stays R1.
      expect(after).toContain("### R1. Walking skeleton");
    });

    it("reorderReleases moves a release and recomputes R{n} everywhere", () => {
      const map = parse(FIXTURE);
      // Move "Walking skeleton" (index 0) to the end (index 2).
      const after = serialize(reorderReleases(map, 0, 2));
      expect(after).toContain("1. Core loop");
      expect(after).toContain("2. Depth & agency");
      expect(after).toContain("3. Walking skeleton");
      // Bands recompute: Core loop is now R1, Walking skeleton R3.
      expect(after).toContain("### R1. Core loop");
      expect(after).toContain("### R3. Walking skeleton");
    });
  });

  describe("activities (FR-007/FR-008/FR-009)", () => {
    it("addActivity appends a ## heading with the next Roman numeral", () => {
      const map = parse(FIXTURE);
      const after = serialize(addActivity(map, "Reflect & retire"));
      expect(after).toContain("## VII. Reflect & retire");
    });

    it("deleteActivity removes it and renumbers the Romans that follow", () => {
      const map = parse(FIXTURE);
      // Delete activity 0 "Enter & orient"; "Explore world" becomes I.
      const after = serialize(deleteActivity(map, 0));
      expect(after).not.toContain("Enter & orient");
      expect(after).toContain("## I. Explore world");
      expect(after).toContain("## V. Progress & save");
      expect(after).not.toContain("## VI."); // one fewer activity
    });

    it("reorderActivities moves a column and recomputes Roman numerals", () => {
      const map = parse(FIXTURE);
      // Move activity 0 "Enter & orient" to the end (index 5).
      const after = serialize(reorderActivities(map, 0, 5));
      expect(after).toContain("## I. Explore world");
      expect(after).toContain("## VI. Enter & orient");
    });
  });

  describe("cards (FR-007/FR-008/FR-009/FR-021)", () => {
    const cell = { activityIndex: 0, releaseTitle: "Walking skeleton" };

    it("addCard appends a card and numbers it per-cell", () => {
      const map = parse(FIXTURE);
      const after = serialize(addCard(map, 0, "Walking skeleton", "Quit the game"));
      // The cell had #### 1 and #### 2; the new card is #### 3.
      expect(after).toContain("#### 3. Quit the game");
    });

    it("deleteCard removes a card and renumbers the rest of the cell", () => {
      const map = parse(FIXTURE);
      const after = serialize(deleteCard(map, { ...cell, order: 0 }));
      expect(after).not.toContain("Start the game");
      // "See the goal" was #### 2, now becomes #### 1.
      expect(after).toContain("#### 1. See the goal");
    });

    it("reorderCard reorders within its cell and renumbers", () => {
      const map = parse(FIXTURE);
      // Move "Start the game" (order 0) to index 1.
      const after = serialize(reorderCard(map, { ...cell, order: 0 }, 1));
      expect(after).toContain("#### 1. See the goal");
      expect(after).toContain("#### 2. Start the game");
    });

    it("moveCard within a cell behaves like reorderCard", () => {
      const map = parse(FIXTURE);
      const a = serialize(reorderCard(map, { ...cell, order: 0 }, 1));
      const b = serialize(
        moveCard(map, { ...cell, order: 0 }, { ...cell, order: 1 }),
      );
      expect(b).toBe(a);
    });

    it("moveCard moves a card to another activity (left/right) and renumbers both cells", () => {
      const map = parse(FIXTURE);
      // "Start the game" (act 0 / Walking skeleton / 0) -> act 1 / Core loop, top.
      const after = serialize(
        moveCard(
          map,
          { activityIndex: 0, releaseTitle: "Walking skeleton", order: 0 },
          { activityIndex: 1, releaseTitle: "Core loop", order: 0 },
        ),
      );
      // Source cell loses it and renumbers ("See the goal" -> #### 1).
      const m2 = parse(after);
      const src = m2.activities[0].cells.get("Walking skeleton")!;
      expect(src.map((c) => c.title)).toEqual(["See the goal"]);
      // Destination cell gains it at the top, ahead of the existing cards.
      const dst = m2.activities[1].cells.get("Core loop")!;
      expect(dst.map((c) => c.title)).toEqual([
        "Start the game",
        "Discover POIs",
        "Reactive terrain",
      ]);
      // Its links now reflect the destination.
      const moved = dst[0];
      expect(moved.activityTitle).toBe("Explore world");
      expect(moved.releaseTitle).toBe("Core loop");
      // The edited map still round-trips.
      expect(serialize(parse(after))).toBe(after);
    });

    it("moveCard across release bands (up/down) re-links the card", () => {
      const map = parse(FIXTURE);
      // "Start the game" -> same activity, but Depth & agency band.
      const after = serialize(
        moveCard(
          map,
          { activityIndex: 0, releaseTitle: "Walking skeleton", order: 0 },
          { activityIndex: 0, releaseTitle: "Depth & agency", order: 0 },
        ),
      );
      const m2 = parse(after);
      const dst = m2.activities[0].cells.get("Depth & agency")!;
      expect(dst.map((c) => c.title)).toEqual([
        "Start the game",
        "Session recap",
      ]);
      expect(dst[0].releaseTitle).toBe("Depth & agency");
    });

    it("moveCard drops an emptied source cell so the map stays sparse", () => {
      const map = parse(FIXTURE);
      // Act 0 / Depth & agency holds only "Session recap"; move it away.
      const after = serialize(
        moveCard(
          map,
          { activityIndex: 0, releaseTitle: "Depth & agency", order: 0 },
          { activityIndex: 1, releaseTitle: "Depth & agency", order: 0 },
        ),
      );
      const m2 = parse(after);
      // The now-empty group is gone from activity 0 entirely.
      expect(m2.activities[0].cells.has("Depth & agency")).toBe(false);
    });
  });

  describe("identity & card↔release links survive mutation", () => {
    it("card↔release links are unchanged after reordering releases", () => {
      const map = parse(FIXTURE);
      const next = reorderReleases(map, 0, 2);
      for (const activity of next.activities) {
        for (const [releaseTitle, cards] of activity.cells) {
          for (const card of cards) {
            expect(card.releaseTitle).toBe(releaseTitle);
            expect(card.activityTitle).toBe(activity.title);
          }
        }
      }
    });

    it("structural mutations are pure — the input map is untouched", () => {
      const map = parse(FIXTURE);
      const before = serialize(map);
      addRelease(map, "Polish");
      deleteRelease(map, "Core loop");
      reorderActivities(map, 0, 5);
      addCard(map, 0, "Walking skeleton", "Quit");
      deleteCard(map, { activityIndex: 0, releaseTitle: "Walking skeleton", order: 0 });
      expect(serialize(map)).toBe(before);
    });
  });
});
