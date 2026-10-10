import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useModalBackdrop } from "./modal-backdrop.js";

function Fixture({ busy = false, onClose }) {
  const backdropProps = useModalBackdrop({ onClose, busy });
  return (
    <div data-testid="backdrop" {...backdropProps}>
      <div role="dialog">
        <p>Selectable billing details</p>
      </div>
    </div>
  );
}

afterEach(() => vi.restoreAllMocks());

describe("Modal backdrop dismissal", () => {
  it.each(["inside-outside", "outside-inside"])(
    "keeps a %s text-selection gesture open and still permits the next backdrop click",
    async (direction) => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      render(<Fixture onClose={onClose} />);
      const backdrop = screen.getByTestId("backdrop");
      const details = screen.getByText("Selectable billing details");
      const [start, end] =
        direction === "inside-outside" ? [details, backdrop] : [backdrop, details];
      await user.pointer([
        { keys: "[MouseLeft>]", target: start },
        { target: end },
        { keys: "[/MouseLeft]", target: end },
      ]);
      expect(onClose).not.toHaveBeenCalled();
      await user.click(backdrop);
      expect(onClose).toHaveBeenCalledOnce();
    }
  );

  it("rejects click-only, secondary-button and cancelled gestures", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Fixture onClose={onClose} />);
    const backdrop = screen.getByTestId("backdrop");
    fireEvent.click(backdrop);
    await user.pointer({ keys: "[MouseRight]", target: backdrop });
    await user.pointer({ keys: "[MouseLeft>]", target: backdrop });
    fireEvent.pointerCancel(backdrop);
    await user.pointer({ keys: "[/MouseLeft]", target: backdrop });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("checks the physical release position when a touch pointer is captured by the backdrop", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Fixture onClose={onClose} />);
    const backdrop = screen.getByTestId("backdrop");
    // Model implicit capture retargeting pointerup to the start, while the finger
    // has actually moved over readable dialog content.
    const hitTest = vi.fn().mockReturnValue(screen.getByText("Selectable billing details"));
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: hitTest,
    });
    try {
      await user.pointer([
        { keys: "[TouchA>]", target: backdrop },
        { keys: "[/TouchA]", target: backdrop },
      ]);
      expect(hitTest).toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      hitTest.mockReturnValue(backdrop);
      await user.pointer([
        { keys: "[TouchA>]", target: backdrop },
        { keys: "[/TouchA]", target: backdrop },
      ]);
      expect(onClose).toHaveBeenCalledOnce();
    } finally {
      delete document.elementFromPoint;
    }
  });

  it("keeps a pending operation open and discards a gesture interrupted by it", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const view = render(<Fixture onClose={onClose} />);
    const backdrop = screen.getByTestId("backdrop");
    await user.pointer({ keys: "[MouseLeft>]", target: backdrop });
    view.rerender(<Fixture busy onClose={onClose} />);
    await user.pointer({ keys: "[/MouseLeft]", target: backdrop });
    await user.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
    view.rerender(<Fixture onClose={onClose} />);
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
