import assert from "node:assert/strict";

// Read real border/text boxes after the caller settles fonts and transitions.
// These checks supplement the bounded local fixtures; they never fetch or write.
export async function checkEntryControlLayout(page, label) {
  const measured = await page.evaluate(() => {
    const visible = (element) => element.getClientRects().length > 0;
    const rect = (element) => {
      const { left, right, top, bottom, width, height } = element.getBoundingClientRect();
      return { left, right, top, bottom, width, height };
    };
    const cards = Array.from(document.querySelectorAll(".ledger-entry-types .btn"))
      .filter(visible)
      .map((element) => {
        const bounds = rect(element);
        const style = getComputedStyle(element);
        const title = element.querySelector("strong");
        const caption = element.querySelector("span");
        const inset = (side) =>
          Number.parseFloat(style[`padding${side}`]) +
          Number.parseFloat(style[`border${side}Width`]);
        return {
          bounds,
          title: rect(title),
          caption: rect(caption),
          padding: {
            top: Number.parseFloat(style.paddingTop),
            bottom: Number.parseFloat(style.paddingBottom),
            left: Number.parseFloat(style.paddingLeft),
            right: Number.parseFloat(style.paddingRight),
          },
          content: {
            left: bounds.left + inset("Left"),
            right: bounds.right - inset("Right"),
            top: bounds.top + inset("Top"),
            bottom: bounds.bottom - inset("Bottom"),
          },
        };
      });
    const controls = Array.from(
      document.querySelectorAll(
        ".workspace-picker select, .topbar-actions > .btn, .app-frame[data-console='true'] .preferences-toggle"
      )
    )
      .filter(visible)
      .map((element) => ({
        bounds: rect(element),
        tag: element.tagName,
        className: element.className,
      }));
    return {
      width: innerWidth,
      coarse: matchMedia("(pointer: coarse)").matches,
      anyCoarse: matchMedia("(any-pointer: coarse)").matches,
      consolePreferences: Array.from(
        document.querySelectorAll(".app-frame[data-console='true'] .preferences-toggle")
      )
        .filter(visible)
        .map((element) => ({
          inTopbar: Boolean(element.closest(".topbar-actions .topbar-preferences-slot")),
          position: getComputedStyle(element.closest(".preferences")).position,
        })),
      cards,
      controls,
    };
  });
  const tolerance = 1;
  const details = `${label}: ${JSON.stringify(measured)}`;
  const controlSize = measured.width <= 760 ? 48 : measured.anyCoarse ? 44 : 32;
  if (measured.width <= 760) {
    for (const preferences of measured.consolePreferences)
      assert(
        preferences.inTopbar && preferences.position === "relative",
        `Phone display options float outside the actual topbar: ${details}`
      );
  }
  if (measured.controls.length) {
    const first = measured.controls[0].bounds;
    for (const control of measured.controls) {
      assert(
        Math.abs(control.bounds.height - controlSize) <= tolerance,
        `Topbar control has a different height: ${details}`
      );
      assert(
        Math.abs(control.bounds.top - first.top) <= tolerance &&
          Math.abs(control.bounds.bottom - first.bottom) <= tolerance,
        `Topbar border boxes are misaligned: ${details}`
      );
      if (measured.width <= 760 && control.tag === "BUTTON")
        assert(
          Math.abs(control.bounds.width - controlSize) <= tolerance,
          `Phone icon control is not square: ${details}`
        );
    }
  }
  if (measured.cards.length) {
    assert.equal(measured.cards.length, 2, `Expense type choices missing: ${details}`);
    const first = measured.cards[0].bounds;
    for (const card of measured.cards) {
      assert(
        Math.abs(card.bounds.height - first.height) <= tolerance,
        `Expense type choices have unequal heights: ${details}`
      );
      assert(
        card.padding.top >= 12 &&
          card.padding.bottom >= 12 &&
          card.padding.left >= 16 &&
          card.padding.right >= 16,
        `Expense type text lacks inner spacing: ${details}`
      );
      assert(
        Math.abs(card.caption.top - card.title.bottom - 6) <= tolerance,
        `Expense type title and caption spacing differs: ${details}`
      );
      for (const text of [card.title, card.caption])
        assert(
          text.left >= card.content.left - tolerance &&
            text.right <= card.content.right + tolerance &&
            text.top >= card.content.top - tolerance &&
            text.bottom <= card.content.bottom + tolerance,
          `Expense type text is clipped or outside its padding: ${details}`
        );
      assert(
        Math.abs(card.title.left - card.content.left) <= tolerance &&
          Math.abs(card.caption.left - card.content.left) <= tolerance,
        `Expense type title and caption starts are misaligned: ${details}`
      );
    }
  }
  return measured;
}
