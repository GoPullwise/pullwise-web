import { useEffect, useId, useRef, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { T, useLang } from "../i18n.jsx";
import "./email-sign-in.css";

function retrySeconds(failure) {
  const value =
    failure?.retryAfter ?? failure?.payload?.retryAfter ?? failure?.payload?.error?.retryAfter;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

function emailErrorMessage(failure) {
  const code = failure?.code || failure?.payload?.error?.code;
  switch (code) {
    case "EMAIL_CODE_INVALID":
      return T(
        "That code is invalid. Check the code and try again.",
        "验证码不正确，请检查后重试。"
      );
    case "EMAIL_CODE_EXPIRED":
      return T("This code has expired. Request a new code.", "验证码已过期，请重新发送。");
    case "EMAIL_ATTEMPTS_EXCEEDED":
      return T("Too many incorrect codes. Request a new code.", "验证码错误次数过多，请重新发送。");
    case "EMAIL_RATE_LIMIT":
      return T("Please wait before requesting another code.", "请稍等后再重新发送验证码。");
    case "EMAIL_ALREADY_LINKED":
      return T(
        "This email belongs to another account. Use a different email.",
        "此邮箱已属于其他账户，请使用另一个邮箱。"
      );
    case "EMAIL_CHANGE_NOT_SUPPORTED":
      return T(
        "This account already has a verified email. Email replacement is unavailable.",
        "此账户已有已验证邮箱，暂不支持更换。"
      );
    case "UNAUTHENTICATED":
      return T(
        "Your session has expired. Sign in again before linking an email.",
        "会话已失效，请重新登录后绑定邮箱。"
      );
    case "ACCOUNT_CHANGED":
      return T(
        "Your account changed. Reload Settings before linking an email.",
        "账户信息已变化，请重新加载设置后绑定邮箱。"
      );
    case "INVALID_INPUT":
      return T("Check your email and 6-digit code.", "请检查邮箱和 6 位验证码。");
    case "EMAIL_AUTH_NOT_CONFIGURED":
    case "EMAIL_AUTH_UNAVAILABLE":
    case "EMAIL_SEND_UNAVAILABLE":
    case "EMAIL_IDENTITY_UNAVAILABLE":
      return T(
        "Email sign-in is temporarily unavailable. Please try again later.",
        "邮箱登录暂不可用，请稍后重试。"
      );
    default:
      return failure?.message || T("Request failed. Please retry.", "请求失败，请重试。");
  }
}

export function EmailSignIn({ purpose = "login", disabled = false, onBusy, onVerified }) {
  useLang();
  const id = useId();
  const [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const mountedRef = useRef(false);
  const controllerRef = useRef(null);
  const busyRef = useRef(false);
  const onBusyRef = useRef(onBusy);
  onBusyRef.current = onBusy;
  const emailRef = useRef(null);
  const codeRef = useRef(null);
  const retryRemaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const expired = Boolean(challenge && now >= challenge.expiresAt);
  const locked = disabled || Boolean(busy);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      controllerRef.current = null;
      if (busyRef.current) {
        busyRef.current = false;
        onBusyRef.current?.(false);
      }
    };
  }, []);

  useEffect(() => {
    if (retryAt <= now && (!challenge || challenge.expiresAt <= now)) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [retryAt, challenge, now]);

  useEffect(() => {
    if (challenge && !busy) codeRef.current?.focus();
  }, [challenge, busy]);

  const begin = (action) => {
    if (busyRef.current || disabled || !mountedRef.current) return null;
    if (onBusyRef.current?.(true) === false) return null;
    busyRef.current = true;
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(action);
    setError("");
    return controller;
  };
  const finish = (controller) => {
    if (controllerRef.current !== controller) return;
    controllerRef.current = null;
    busyRef.current = false;
    onBusyRef.current?.(false);
    if (mountedRef.current) setBusy("");
  };
  const showFailure = (failure, controller, focusRef) => {
    if (controller.signal.aborted || !mountedRef.current) return;
    setError(emailErrorMessage(failure));
    const retry = retrySeconds(failure);
    if (retry) {
      const time = Date.now();
      setNow(time);
      setRetryAt(time + retry * 1000);
    }
    window.setTimeout(() => {
      if (mountedRef.current && !busyRef.current) focusRef.current?.focus();
    }, 0);
  };

  const sendCode = async (event) => {
    event?.preventDefault();
    if (retryAt > Date.now() || (!challenge && !emailRef.current?.checkValidity())) return;
    const controller = begin("send");
    if (!controller) return;
    const requestedEmail = email.trim();
    setChallenge(null);
    setCode("");
    try {
      const response = await pullwiseApi.auth.requestEmailCode(
        { email: requestedEmail, purpose },
        { signal: controller.signal }
      );
      if (controller.signal.aborted || !mountedRef.current) return;
      if (!response?.challengeId || !(Number(response.expiresIn) > 0)) {
        throw new Error(
          T("A code could not be requested. Please retry.", "未能请求验证码，请重试。")
        );
      }
      const time = Date.now();
      setNow(time);
      setEmail(requestedEmail);
      setRetryAt(time + Math.max(0, Number(response.retryAfter) || 0) * 1000);
      setChallenge({
        id: response.challengeId,
        email: requestedEmail,
        expiresAt: time + Number(response.expiresIn) * 1000,
      });
    } catch (failure) {
      showFailure(failure, controller, emailRef);
    } finally {
      finish(controller);
    }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    if (
      !challenge ||
      challenge.invalidated ||
      Date.now() >= challenge.expiresAt ||
      !/^\d{6}$/.test(code)
    )
      return;
    const controller = begin("verify");
    if (!controller) return;
    try {
      const response = await pullwiseApi.auth.verifyEmailCode(
        { email: challenge.email, challengeId: challenge.id, code },
        { signal: controller.signal }
      );
      if (controller.signal.aborted || !mountedRef.current) return;
      if (!response?.authenticated || !response?.user?.id) {
        throw new Error(
          T("Sign-in could not be confirmed. Please retry.", "未能确认登录状态，请重试。")
        );
      }
      await onVerified?.(response);
    } catch (failure) {
      if (!controller.signal.aborted && mountedRef.current) {
        const failureCode = failure?.code || failure?.payload?.error?.code;
        if (
          [
            "EMAIL_ATTEMPTS_EXCEEDED",
            "EMAIL_ALREADY_LINKED",
            "EMAIL_CHANGE_NOT_SUPPORTED",
            "UNAUTHENTICATED",
            "ACCOUNT_CHANGED",
          ].includes(failureCode)
        ) {
          setChallenge((current) => (current ? { ...current, invalidated: true } : current));
        } else if (failureCode === "EMAIL_CODE_EXPIRED") {
          setChallenge((current) => (current ? { ...current, expiresAt: Date.now() } : current));
          setNow(Date.now());
        }
      }
      showFailure(failure, controller, codeRef);
    } finally {
      finish(controller);
    }
  };

  const editEmail = () => {
    if (busyRef.current || disabled) return;
    setChallenge(null);
    setCode("");
    setError("");
    window.setTimeout(() => emailRef.current?.focus(), 0);
  };

  return (
    <div className="email-sign-in">
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      {!challenge ? (
        <form onSubmit={sendCode}>
          <label className="email-sign-in-label" htmlFor={`${id}-email`}>
            {T("Email", "邮箱")}
          </label>
          <input
            ref={emailRef}
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            disabled={locked}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button
            className="btn primary email-sign-in-submit"
            type="submit"
            disabled={locked || retryRemaining > 0}
          >
            {busy === "send"
              ? T("Sending code...", "正在发送验证码...")
              : T("Send code", "发送验证码")}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode}>
          <p className="email-sign-in-destination">
            {T("Code sent to", "验证码已发送至")} <strong>{challenge.email}</strong>
          </p>
          <label className="email-sign-in-label" htmlFor={`${id}-code`}>
            {T("6-digit code", "6 位验证码")}
          </label>
          <input
            ref={codeRef}
            id={`${id}-code`}
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            disabled={locked}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          {expired && (
            <p className="muted" role="status">
              {T("This code has expired. Request a new code.", "验证码已过期，请重新发送。")}
            </p>
          )}
          <button
            className="btn primary email-sign-in-submit"
            type="submit"
            disabled={locked || expired || challenge.invalidated || !/^\d{6}$/.test(code)}
          >
            {busy === "verify"
              ? T("Verifying...", "正在验证...")
              : purpose === "link"
                ? T("Verify and link email", "验证并绑定邮箱")
                : T("Verify and sign in", "验证并登录")}
          </button>
          <div className="panel-actions email-sign-in-actions">
            <button
              className="btn sm"
              type="button"
              disabled={locked || retryRemaining > 0}
              onClick={sendCode}
            >
              {T("Resend code", "重新发送验证码")}
            </button>
            <button className="btn sm" type="button" disabled={locked} onClick={editEmail}>
              {T("Edit email", "修改邮箱")}
            </button>
          </div>
        </form>
      )}
      {retryRemaining > 0 && (
        <p className="muted email-sign-in-retry" role="status">
          {T(
            "You can request another code in {seconds}s.",
            "{seconds} 秒后可重新发送验证码。"
          ).replace("{seconds}", String(retryRemaining))}
        </p>
      )}
    </div>
  );
}
