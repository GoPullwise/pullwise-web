import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/http.js";
import { pullwiseApi } from "../api/pullwise.js";
import { EmailSignIn } from "./email-sign-in.jsx";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    auth: {
      requestEmailCode: vi.fn(),
      verifyEmailCode: vi.fn(),
    },
  },
}));

vi.mock("../i18n.jsx", () => ({ T: (english) => english, useLang: () => {} }));

const EMAIL = "person@example.com";
const SESSION = { authenticated: true, user: { id: "usr_1", email: EMAIL } };

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function submit(input) {
  await act(async () => fireEvent.submit(input.closest("form")));
}

async function advance(ms) {
  await act(async () => vi.advanceTimersByTimeAsync(ms));
}

async function issueCode(overrides = {}) {
  pullwiseApi.auth.requestEmailCode.mockResolvedValueOnce({
    challengeId: "challenge_1",
    expiresIn: 600,
    retryAfter: 60,
    ...overrides,
  });
  const email = screen.getByRole("textbox", { name: "Email" });
  fireEvent.change(email, { target: { value: EMAIL } });
  await submit(email);
  return screen.getByRole("textbox", { name: "6-digit code" });
}

function enterCode(code = "001234") {
  const input = screen.getByRole("textbox", { name: "6-digit code" });
  fireEvent.change(input, { target: { value: code } });
  return input;
}

describe("EmailSignIn", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T03:00:00Z"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it.each(["login", "link"])(
    "rejects empty or malformed %s email input before requesting a code",
    async (purpose) => {
      const onBusy = vi.fn();
      render(<EmailSignIn purpose={purpose} onBusy={onBusy} />);
      const email = screen.getByRole("textbox", { name: "Email" });
      for (const value of ["", "not-an-email"]) {
        fireEvent.change(email, { target: { value } });
        expect(email).toBeInvalid();
        await submit(email);
        expect(pullwiseApi.auth.requestEmailCode).not.toHaveBeenCalled();
        expect(pullwiseApi.auth.verifyEmailCode).not.toHaveBeenCalled();
        expect(onBusy).not.toHaveBeenCalled();
        expect(email).toBeEnabled();
        expect(screen.queryByRole("textbox", { name: "6-digit code" })).not.toBeInTheDocument();
      }
    }
  );

  it.each([
    [undefined, "login", "Verify and sign in"],
    ["link", "link", "Verify and link email"],
  ])(
    "uses the explicit %s purpose and returns the verified server session",
    async (purpose, expectedPurpose, action) => {
      const onVerified = vi.fn();
      render(<EmailSignIn purpose={purpose} onVerified={onVerified} />);

      await issueCode();

      expect(pullwiseApi.auth.requestEmailCode).toHaveBeenCalledWith(
        { email: EMAIL, purpose: expectedPurpose },
        { signal: expect.any(AbortSignal) }
      );
      expect(screen.getByRole("button", { name: action })).toBeDisabled();
      pullwiseApi.auth.verifyEmailCode.mockResolvedValueOnce(SESSION);
      await submit(enterCode());

      expect(pullwiseApi.auth.verifyEmailCode).toHaveBeenCalledWith(
        { email: EMAIL, challengeId: "challenge_1", code: "001234" },
        { signal: expect.any(AbortSignal) }
      );
      expect(onVerified).toHaveBeenCalledWith(SESSION);
    }
  );

  it("uses native email and single-code inputs with autofill and leading-zero support", async () => {
    render(<EmailSignIn />);
    const email = screen.getByRole("textbox", { name: "Email" });
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(email).toHaveAttribute("maxlength", "254");
    expect(email).toBeRequired();

    const code = await issueCode();

    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(code).toHaveFocus();
    expect(code).toHaveAttribute("type", "text");
    expect(code).toHaveAttribute("inputmode", "numeric");
    expect(code).toHaveAttribute("autocomplete", "one-time-code");
    expect(code).toHaveAttribute("pattern", "[0-9]{6}");
    expect(code).toHaveAttribute("maxlength", "6");
    expect(code).toBeRequired();
    fireEvent.change(code, { target: { value: "00 12-34more" } });
    expect(code).toHaveValue("001234");
    code.setSelectionRange(0, 2);
    expect(code.selectionStart).toBe(0);
    expect(code.selectionEnd).toBe(2);
    expect(screen.getByRole("button", { name: "Verify and sign in" })).toBeEnabled();
  });

  it("honors the server cooldown and resends only on manual intent with a new challenge", async () => {
    render(<EmailSignIn />);
    await issueCode();
    enterCode();
    const resend = screen.getByRole("button", { name: "Resend code" });
    expect(resend).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("60s");
    fireEvent.click(resend);
    expect(pullwiseApi.auth.requestEmailCode).toHaveBeenCalledTimes(1);

    await advance(59_000);
    expect(resend).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("1s");
    await advance(1_000);
    expect(resend).toBeEnabled();
    expect(pullwiseApi.auth.requestEmailCode).toHaveBeenCalledTimes(1);

    pullwiseApi.auth.requestEmailCode.mockResolvedValueOnce({
      challengeId: "challenge_2",
      expiresIn: 600,
      retryAfter: 30,
    });
    await act(async () => fireEvent.click(resend));
    expect(screen.getByRole("textbox", { name: "6-digit code" })).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent("30s");
    expect(pullwiseApi.auth.requestEmailCode).toHaveBeenLastCalledWith(
      { email: EMAIL, purpose: "login" },
      { signal: expect.any(AbortSignal) }
    );
    pullwiseApi.auth.verifyEmailCode.mockResolvedValueOnce(SESSION);
    await submit(enterCode());
    expect(pullwiseApi.auth.verifyEmailCode).toHaveBeenCalledWith(
      { email: EMAIL, challengeId: "challenge_2", code: "001234" },
      expect.anything()
    );
  });

  it.each(["", "12345", "1234"])(
    "rejects incomplete code %j without a verification request",
    async (value) => {
      render(<EmailSignIn />);
      await issueCode();
      const code = enterCode(value);

      expect(screen.getByRole("button", { name: "Verify and sign in" })).toBeDisabled();
      await submit(code);

      expect(pullwiseApi.auth.verifyEmailCode).not.toHaveBeenCalled();
    }
  );

  it("expires the server challenge without automatically requesting another code", async () => {
    render(<EmailSignIn />);
    await issueCode({ expiresIn: 5, retryAfter: 2 });
    const code = enterCode();
    await advance(5_000);

    expect(screen.getByRole("status")).toHaveTextContent("This code has expired");
    expect(screen.getByRole("button", { name: "Verify and sign in" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Resend code" })).toBeEnabled();
    await submit(code);
    expect(pullwiseApi.auth.verifyEmailCode).not.toHaveBeenCalled();
    expect(pullwiseApi.auth.requestEmailCode).toHaveBeenCalledTimes(1);
  });

  it("preserves code, challenge and focus after an invalid code for explicit retry", async () => {
    const onVerified = vi.fn();
    const onBusy = vi.fn();
    render(<EmailSignIn onVerified={onVerified} onBusy={onBusy} />);
    await issueCode();
    const code = enterCode();
    const failure = new ApiError("Provider details must not replace the code guidance.", {
      status: 400,
      payload: { error: { code: "EMAIL_CODE_INVALID" } },
    });
    pullwiseApi.auth.verifyEmailCode.mockRejectedValueOnce(failure);
    await submit(code);
    await advance(0);

    expect(screen.getByRole("alert").textContent).toBe(
      "That code is invalid. Check the code and try again."
    );
    expect(code).toHaveValue("001234");
    expect(code).toHaveFocus();
    expect(screen.getByRole("button", { name: "Verify and sign in" })).toBeEnabled();
    expect(onVerified).not.toHaveBeenCalled();
    expect(pullwiseApi.auth.verifyEmailCode).toHaveBeenCalledTimes(1);
    expect(onBusy.mock.calls.map(([busy]) => busy)).toEqual([true, false, true, false]);

    pullwiseApi.auth.verifyEmailCode.mockResolvedValueOnce(SESSION);
    await submit(code);
    expect(pullwiseApi.auth.verifyEmailCode).toHaveBeenLastCalledWith(
      { email: EMAIL, challengeId: "challenge_1", code: "001234" },
      expect.anything()
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onVerified).toHaveBeenCalledOnce();
  });

  it("expires a server-rejected code immediately and requires manual resend before verification", async () => {
    const onVerified = vi.fn();
    render(<EmailSignIn onVerified={onVerified} />);
    await issueCode({ retryAfter: 0 });
    const code = enterCode();
    pullwiseApi.auth.verifyEmailCode.mockRejectedValueOnce(
      new ApiError("Server code expired.", {
        status: 400,
        payload: { error: { code: "EMAIL_CODE_EXPIRED" } },
      })
    );
    await submit(code);
    await advance(0);

    expect(screen.getByRole("alert").textContent).toBe(
      "This code has expired. Request a new code."
    );
    expect(screen.getByRole("status")).toHaveTextContent("This code has expired");
    expect(code).toHaveValue("001234");
    expect(code).toHaveFocus();
    expect(screen.getByRole("button", { name: "Verify and sign in" })).toBeDisabled();
    await submit(code);
    expect(pullwiseApi.auth.verifyEmailCode).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.auth.requestEmailCode).toHaveBeenCalledTimes(1);
    expect(onVerified).not.toHaveBeenCalled();

    pullwiseApi.auth.requestEmailCode.mockResolvedValueOnce({
      challengeId: "replacement_challenge",
      expiresIn: 600,
      retryAfter: 0,
    });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Resend code" })));
    expect(screen.getByRole("textbox", { name: "6-digit code" })).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    pullwiseApi.auth.verifyEmailCode.mockResolvedValueOnce(SESSION);
    await submit(enterCode());
    expect(pullwiseApi.auth.verifyEmailCode).toHaveBeenLastCalledWith(
      { email: EMAIL, challengeId: "replacement_challenge", code: "001234" },
      expect.anything()
    );
    expect(onVerified).toHaveBeenCalledOnce();
  });

  it("keeps the email and server rate-limit cooldown after a request failure", async () => {
    render(<EmailSignIn />);
    const email = screen.getByRole("textbox", { name: "Email" });
    fireEvent.change(email, { target: { value: EMAIL } });
    pullwiseApi.auth.requestEmailCode.mockRejectedValueOnce(
      new ApiError("Too many requests.", {
        status: 429,
        payload: { error: { code: "EMAIL_RATE_LIMIT" } },
        retryAfter: 7,
      })
    );
    await submit(email);
    await advance(0);

    expect(email).toHaveValue(EMAIL);
    expect(email).toHaveFocus();
    expect(screen.getByRole("alert").textContent).toBe(
      "Please wait before requesting another code."
    );
    expect(screen.getByRole("button", { name: "Send code" })).toBeDisabled();
    await submit(email);
    expect(pullwiseApi.auth.requestEmailCode).toHaveBeenCalledTimes(1);
    await advance(7_000);
    expect(screen.getByRole("button", { name: "Send code" })).toBeEnabled();
    expect(pullwiseApi.auth.requestEmailCode).toHaveBeenCalledTimes(1);

    await issueCode();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(["send", "verify"])(
    "restores failed %s focus only after both local and parent disabled controls are enabled",
    async (stage) => {
      const request = deferred();
      const onBusy = vi.fn();
      const props = { purpose: "link", onBusy };
      const view = render(<EmailSignIn {...props} />);
      let field;
      if (stage === "send") {
        field = screen.getByRole("textbox", { name: "Email" });
        fireEvent.change(field, { target: { value: EMAIL } });
        pullwiseApi.auth.requestEmailCode.mockReturnValueOnce(request.promise);
      } else {
        await issueCode({ retryAfter: 0 });
        field = enterCode();
        pullwiseApi.auth.verifyEmailCode.mockReturnValueOnce(request.promise);
      }
      field.focus();
      // jsdom does not blur an already-disabled input like a native browser.
      // Model the browser's resulting body focus before disabling it.
      field.blur();
      expect(document.body).toHaveFocus();
      fireEvent.submit(field.closest("form"));
      expect(field).toBeDisabled();
      view.rerender(<EmailSignIn {...props} disabled />);

      const focus = vi.spyOn(field, "focus");
      await act(async () =>
        request.reject(
          new ApiError("Rejected by the server.", {
            status: stage === "send" ? 409 : 400,
            payload: {
              error: { code: stage === "send" ? "EMAIL_ALREADY_LINKED" : "EMAIL_CODE_INVALID" },
            },
          })
        )
      );
      await advance(0);
      expect(screen.getByRole("alert")).toBeVisible();
      expect(field).toBeDisabled();
      expect(document.body).toHaveFocus();
      expect(focus).not.toHaveBeenCalled();

      view.rerender(<EmailSignIn {...props} />);
      expect(field).toBeEnabled();
      expect(field).toHaveFocus();
      expect(focus).toHaveBeenCalledOnce();
      focus.mockRestore();
    }
  );

  it.each(["before", "after"])(
    "keeps a user-selected outside control focused when it is selected %s the failed request settles",
    async (when) => {
      const request = deferred();
      pullwiseApi.auth.requestEmailCode.mockReturnValueOnce(request.promise);
      const fixture = (disabled = false) => (
        <>
          <button type="button">Theme</button>
          <EmailSignIn purpose="link" disabled={disabled} />
        </>
      );
      const view = render(fixture());
      const email = screen.getByRole("textbox", { name: "Email" });
      fireEvent.change(email, { target: { value: EMAIL } });
      fireEvent.submit(email.closest("form"));
      email.blur();
      view.rerender(fixture(true));
      const outside = screen.getByRole("button", { name: "Theme" });
      if (when === "before") outside.focus();
      await act(async () =>
        request.reject(
          new ApiError("Already linked.", {
            status: 409,
            payload: { error: { code: "EMAIL_ALREADY_LINKED" } },
          })
        )
      );
      await advance(0);
      if (when === "after") outside.focus();
      expect(outside).toHaveFocus();
      view.rerender(fixture());
      expect(email).toBeEnabled();
      expect(outside).toHaveFocus();
    }
  );

  it("does not carry deferred failure focus into a replacement form after unmount", async () => {
    const request = deferred();
    pullwiseApi.auth.requestEmailCode.mockReturnValueOnce(request.promise);
    const view = render(<EmailSignIn purpose="link" />);
    const email = screen.getByRole("textbox", { name: "Email" });
    fireEvent.change(email, { target: { value: EMAIL } });
    fireEvent.submit(email.closest("form"));
    view.rerender(<EmailSignIn purpose="link" disabled />);
    await act(async () =>
      request.reject(
        new ApiError("Already linked.", {
          status: 409,
          payload: { error: { code: "EMAIL_ALREADY_LINKED" } },
        })
      )
    );
    view.unmount();
    render(
      <>
        <button type="button">Theme</button>
        <EmailSignIn />
      </>
    );
    const outside = screen.getByRole("button", { name: "Theme" });
    outside.focus();
    await advance(0);
    expect(outside).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("rejects an email belonging to another account and requires a new email challenge", async () => {
    const onVerified = vi.fn();
    render(<EmailSignIn purpose="link" onVerified={onVerified} />);
    await issueCode({ retryAfter: 0 });
    const code = enterCode();
    pullwiseApi.auth.verifyEmailCode.mockRejectedValueOnce(
      new ApiError("Already linked elsewhere.", {
        status: 409,
        payload: { error: { code: "EMAIL_ALREADY_LINKED" } },
      })
    );
    await submit(code);
    await advance(0);

    expect(screen.getByRole("alert").textContent).toBe(
      "This email belongs to another account. Use a different email."
    );
    expect(code).toHaveValue("001234");
    expect(code).toHaveFocus();
    expect(screen.getByRole("button", { name: "Verify and link email" })).toBeDisabled();
    await submit(code);
    expect(pullwiseApi.auth.verifyEmailCode).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.auth.requestEmailCode).toHaveBeenCalledTimes(1);
    expect(onVerified).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Edit email" }));
    await advance(0);
    const email = screen.getByRole("textbox", { name: "Email" });
    const availableEmail = "available@example.com";
    fireEvent.change(email, { target: { value: availableEmail } });
    pullwiseApi.auth.requestEmailCode.mockResolvedValueOnce({
      challengeId: "available_email_challenge",
      expiresIn: 600,
      retryAfter: 0,
    });
    await submit(email);
    expect(pullwiseApi.auth.requestEmailCode).toHaveBeenLastCalledWith(
      { email: availableEmail, purpose: "link" },
      expect.anything()
    );
    expect(screen.getByRole("textbox", { name: "6-digit code" })).toHaveValue("");
    const linkedSession = {
      authenticated: true,
      user: { id: SESSION.user.id, email: availableEmail },
    };
    pullwiseApi.auth.verifyEmailCode.mockResolvedValueOnce(linkedSession);
    await submit(enterCode());
    expect(pullwiseApi.auth.verifyEmailCode).toHaveBeenLastCalledWith(
      { email: availableEmail, challengeId: "available_email_challenge", code: "001234" },
      expect.anything()
    );
    expect(onVerified).toHaveBeenCalledExactlyOnceWith(linkedSession);
  });

  it("blocks further verification of a challenge after the server's attempts limit", async () => {
    const onVerified = vi.fn();
    render(<EmailSignIn onVerified={onVerified} />);
    await issueCode({ retryAfter: 0 });
    const code = enterCode();
    pullwiseApi.auth.verifyEmailCode.mockRejectedValueOnce(
      new ApiError("Attempts exhausted.", {
        status: 429,
        payload: { error: { code: "EMAIL_ATTEMPTS_EXCEEDED" } },
      })
    );
    await submit(code);
    await advance(0);

    expect(screen.getByRole("alert").textContent).toBe(
      "Too many incorrect codes. Request a new code."
    );
    expect(code).toHaveFocus();
    expect(code).toHaveValue("001234");
    fireEvent.change(code, { target: { value: "987654" } });
    expect(screen.getByRole("button", { name: "Verify and sign in" })).toBeDisabled();
    await submit(code);
    expect(pullwiseApi.auth.verifyEmailCode).toHaveBeenCalledTimes(1);
    expect(onVerified).not.toHaveBeenCalled();
    expect(pullwiseApi.auth.requestEmailCode).toHaveBeenCalledTimes(1);

    pullwiseApi.auth.requestEmailCode.mockResolvedValueOnce({
      challengeId: "fresh_attempts_challenge",
      expiresIn: 600,
      retryAfter: 0,
    });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Resend code" })));
    const freshCode = enterCode();
    expect(screen.getByRole("button", { name: "Verify and sign in" })).toBeEnabled();
    pullwiseApi.auth.verifyEmailCode.mockResolvedValueOnce(SESSION);
    await submit(freshCode);
    expect(pullwiseApi.auth.verifyEmailCode).toHaveBeenLastCalledWith(
      { email: EMAIL, challengeId: "fresh_attempts_challenge", code: "001234" },
      expect.anything()
    );
    expect(onVerified).toHaveBeenCalledOnce();
  });

  it("clears the code and challenge when editing email without sending another request", async () => {
    render(<EmailSignIn />);
    await issueCode({ retryAfter: 0 });
    enterCode();
    fireEvent.click(screen.getByRole("button", { name: "Edit email" }));
    await advance(0);

    const email = screen.getByRole("textbox", { name: "Email" });
    expect(email).toHaveValue(EMAIL);
    expect(email).toHaveFocus();
    expect(screen.queryByRole("textbox", { name: "6-digit code" })).not.toBeInTheDocument();
    expect(pullwiseApi.auth.requestEmailCode).toHaveBeenCalledTimes(1);
    const changedEmail = "changed@example.com";
    fireEvent.change(email, { target: { value: changedEmail } });
    expect(pullwiseApi.auth.requestEmailCode).toHaveBeenCalledTimes(1);
    pullwiseApi.auth.requestEmailCode.mockResolvedValueOnce({
      challengeId: "challenge_changed",
      expiresIn: 600,
      retryAfter: 0,
    });
    await submit(email);
    expect(screen.getByRole("textbox", { name: "6-digit code" })).toHaveValue("");
    pullwiseApi.auth.verifyEmailCode.mockResolvedValueOnce(SESSION);
    await submit(enterCode());
    expect(pullwiseApi.auth.verifyEmailCode).toHaveBeenCalledWith(
      { email: changedEmail, challengeId: "challenge_changed", code: "001234" },
      expect.anything()
    );
  });

  it("locks sending controls synchronously and accepts only one in-flight request", async () => {
    const request = deferred();
    const onBusy = vi.fn();
    pullwiseApi.auth.requestEmailCode.mockReturnValueOnce(request.promise);
    render(<EmailSignIn onBusy={onBusy} />);
    const email = screen.getByRole("textbox", { name: "Email" });
    fireEvent.change(email, { target: { value: EMAIL } });
    fireEvent.submit(email.closest("form"));
    fireEvent.submit(email.closest("form"));

    expect(email).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sending code..." })).toBeDisabled();
    expect(pullwiseApi.auth.requestEmailCode).toHaveBeenCalledOnce();
    expect(onBusy).toHaveBeenCalledOnce();
    expect(onBusy).toHaveBeenCalledWith(true);

    await act(async () =>
      request.resolve({ challengeId: "challenge_1", expiresIn: 600, retryAfter: 0 })
    );
    expect(screen.getByRole("textbox", { name: "6-digit code" })).toBeEnabled();
    expect(onBusy.mock.calls.map(([busy]) => busy)).toEqual([true, false]);
  });

  it("keeps every verification control locked through the parent's required session refresh", async () => {
    const verification = deferred();
    const refresh = deferred();
    const onBusy = vi.fn();
    const onVerified = vi.fn().mockReturnValueOnce(refresh.promise);
    render(<EmailSignIn onBusy={onBusy} onVerified={onVerified} />);
    await issueCode({ retryAfter: 0 });
    pullwiseApi.auth.verifyEmailCode.mockReturnValueOnce(verification.promise);
    const code = enterCode();
    fireEvent.submit(code.closest("form"));
    fireEvent.submit(code.closest("form"));

    for (const control of [code, ...screen.getAllByRole("button")]) expect(control).toBeDisabled();
    expect(pullwiseApi.auth.verifyEmailCode).toHaveBeenCalledOnce();
    await act(async () => verification.resolve(SESSION));
    expect(onVerified).toHaveBeenCalledWith(SESSION);
    for (const control of [code, ...screen.getAllByRole("button")]) expect(control).toBeDisabled();
    expect(onBusy.mock.calls.map(([busy]) => busy)).toEqual([true, false, true]);

    await act(async () => refresh.resolve());
    for (const control of [code, ...screen.getAllByRole("button")]) expect(control).toBeEnabled();
    expect(onBusy.mock.calls.map(([busy]) => busy)).toEqual([true, false, true, false]);
  });

  it("does not begin sending when the parent's synchronous operation guard rejects it", async () => {
    const onBusy = vi.fn().mockReturnValue(false);
    render(<EmailSignIn onBusy={onBusy} />);
    const email = screen.getByRole("textbox", { name: "Email" });
    fireEvent.change(email, { target: { value: EMAIL } });
    await submit(email);

    expect(onBusy).toHaveBeenCalledExactlyOnceWith(true);
    expect(pullwiseApi.auth.requestEmailCode).not.toHaveBeenCalled();
    expect(email).toBeEnabled();
    expect(email).toHaveValue(EMAIL);
    expect(screen.getByRole("button", { name: "Send code" })).toBeEnabled();
  });

  it("retains the code when the parent's operation guard rejects verification", async () => {
    const onBusy = vi.fn();
    render(<EmailSignIn onBusy={onBusy} />);
    await issueCode({ retryAfter: 0 });
    onBusy.mockClear();
    onBusy.mockReturnValue(false);
    const code = enterCode();
    await submit(code);

    expect(onBusy).toHaveBeenCalledExactlyOnceWith(true);
    expect(pullwiseApi.auth.verifyEmailCode).not.toHaveBeenCalled();
    expect(code).toHaveValue("001234");
    for (const control of [code, ...screen.getAllByRole("button")]) expect(control).toBeEnabled();
  });

  it("honors a parent-disabled state for both email and challenge controls", async () => {
    const { rerender } = render(<EmailSignIn disabled />);
    const email = screen.getByRole("textbox", { name: "Email" });
    expect(email).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send code" })).toBeDisabled();
    fireEvent.change(email, { target: { value: EMAIL } });
    await submit(email);
    expect(pullwiseApi.auth.requestEmailCode).not.toHaveBeenCalled();

    rerender(<EmailSignIn />);
    await issueCode({ retryAfter: 0 });
    const code = enterCode();
    rerender(<EmailSignIn disabled />);
    for (const control of [code, ...screen.getAllByRole("button")]) expect(control).toBeDisabled();
    await submit(code);
    expect(pullwiseApi.auth.verifyEmailCode).not.toHaveBeenCalled();
  });

  it("keeps the user's outside focus when an existing challenge is enabled after a parent operation", async () => {
    const fixture = (disabled = false) => (
      <>
        <button type="button">Language</button>
        <EmailSignIn disabled={disabled} />
      </>
    );
    const view = render(fixture());
    const code = await issueCode({ retryAfter: 0 });
    expect(code).toHaveFocus();
    view.rerender(fixture(true));
    const outside = screen.getByRole("button", { name: "Language" });
    outside.focus();
    view.rerender(fixture());
    expect(code).toBeEnabled();
    expect(outside).toHaveFocus();
    expect(pullwiseApi.auth.requestEmailCode).toHaveBeenCalledOnce();
    expect(pullwiseApi.auth.verifyEmailCode).not.toHaveBeenCalled();
  });

  it("does not replay a completed challenge's initial focus when unrelated parent locking ends", async () => {
    const view = render(<EmailSignIn />);
    const code = await issueCode({ retryAfter: 0 });
    expect(code).toHaveFocus();
    code.blur();
    expect(document.body).toHaveFocus();
    const focus = vi.spyOn(code, "focus");
    view.rerender(<EmailSignIn disabled />);
    view.rerender(<EmailSignIn />);
    expect(code).toBeEnabled();
    expect(document.body).toHaveFocus();
    expect(focus).not.toHaveBeenCalled();
    focus.mockRestore();
    expect(pullwiseApi.auth.requestEmailCode).toHaveBeenCalledOnce();
    expect(pullwiseApi.auth.verifyEmailCode).not.toHaveBeenCalled();
  });

  it.each(["send", "verify"])(
    "aborts pending %s on unmount and ignores its stale completion",
    async (stage) => {
      const pending = deferred();
      const onBusy = vi.fn();
      const onVerified = vi.fn();
      const { unmount } = render(<EmailSignIn onBusy={onBusy} onVerified={onVerified} />);
      if (stage === "send") {
        pullwiseApi.auth.requestEmailCode.mockReturnValueOnce(pending.promise);
        const email = screen.getByRole("textbox", { name: "Email" });
        fireEvent.change(email, { target: { value: EMAIL } });
        fireEvent.submit(email.closest("form"));
      } else {
        await issueCode({ retryAfter: 0 });
        pullwiseApi.auth.verifyEmailCode.mockReturnValueOnce(pending.promise);
        const code = enterCode();
        fireEvent.submit(code.closest("form"));
      }
      const api =
        stage === "send" ? pullwiseApi.auth.requestEmailCode : pullwiseApi.auth.verifyEmailCode;
      const signal = api.mock.calls.at(-1)[1].signal;
      expect(signal.aborted).toBe(false);
      unmount();
      expect(signal.aborted).toBe(true);
      expect(onBusy).toHaveBeenLastCalledWith(false);
      const busyCalls = onBusy.mock.calls.length;

      await act(async () =>
        pending.resolve(
          stage === "send"
            ? { challengeId: "stale_challenge", expiresIn: 600, retryAfter: 0 }
            : SESSION
        )
      );

      expect(onVerified).not.toHaveBeenCalled();
      expect(onBusy).toHaveBeenCalledTimes(busyCalls);
      // Native selection events in jsdom queue a zero-delay task when code changes.
      await advance(0);
      expect(vi.getTimerCount()).toBe(0);
      render(<EmailSignIn />);
      expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("");
      expect(screen.queryByRole("textbox", { name: "6-digit code" })).not.toBeInTheDocument();
    }
  );

  it("does not confirm a response without the server's authenticated stable identity", async () => {
    const onVerified = vi.fn();
    render(<EmailSignIn onVerified={onVerified} />);
    await issueCode();
    const code = enterCode();
    pullwiseApi.auth.verifyEmailCode.mockResolvedValueOnce({
      authenticated: true,
      user: { email: EMAIL },
    });
    await submit(code);

    expect(onVerified).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Sign-in could not be confirmed");
    expect(code).toHaveValue("001234");
  });
});
