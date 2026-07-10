import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { I } from "../icons.jsx";
import { T } from "../i18n.jsx";

export const NOTIFICATION_AUTO_DISMISS_MS = 5 * 60 * 1000;

const NotificationContext = createContext(null);

function notificationMessage(value) {
  return String(value || "").trim();
}

function notificationTone(value) {
  return value === "success" || value === "warning" || value === "info" ? value : "error";
}

function NotificationAction({ action, onDismiss }) {
  if (!action?.label) return null;
  if (action.href) {
    return (
      <a
        className="btn sm notification-action"
        href={action.href}
        onClick={(event) => {
          action.onClick?.(event);
          onDismiss();
        }}
      >
        {action.label}
      </a>
    );
  }
  return (
    <button
      type="button"
      className="btn sm notification-action"
      onClick={(event) => {
        action.onClick?.(event);
        onDismiss();
      }}
    >
      {action.label}
    </button>
  );
}

function NotificationToast({ notification, onDismiss }) {
  const title = notification.title || T("Error", "错误");
  return (
    <div
      className={`notification-toast notification-${notification.tone}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="notification-icon" aria-hidden="true">
        {notification.tone === "success" ? <I.Check size={14} /> : <I.X size={14} />}
      </div>
      <div className="notification-copy">
        <div className="notification-title">{title}</div>
        <div className="notification-message">{notification.message}</div>
        <NotificationAction action={notification.action} onDismiss={onDismiss} />
      </div>
      <button
        type="button"
        className="notification-close"
        onClick={onDismiss}
        title={T("Close notification", "关闭通知")}
        aria-label={T("Close notification", "关闭通知")}
      >
        <I.X size={13} />
      </button>
    </div>
  );
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const nextIdRef = useRef(1);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setNotifications((current) => current.filter((item) => item.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(id);
  }, []);

  const notify = useCallback(
    ({ title = "", message, tone = "error", action = null, durationMs = NOTIFICATION_AUTO_DISMISS_MS } = {}) => {
      const cleanMessage = notificationMessage(message);
      if (!cleanMessage) return "";
      const id = `notification-${nextIdRef.current}`;
      nextIdRef.current += 1;
      setNotifications((current) => [
        ...current,
        {
          id,
          title: notificationMessage(title),
          message: cleanMessage,
          tone: notificationTone(tone),
          action,
        },
      ]);
      if (durationMs > 0) {
        const timer = setTimeout(() => dismiss(id), durationMs);
        timersRef.current.set(id, timer);
      }
      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      notify,
      dismiss,
      error: (message, options = {}) => notify({ ...options, message, tone: "error" }),
    }),
    [dismiss, notify]
  );

  useEffect(
    () => () => {
      for (const timer of timersRef.current.values()) clearTimeout(timer);
      timersRef.current.clear();
    },
    []
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="notification-stack" aria-label={T("Notifications", "通知")}>
        {notifications.map((notification) => (
          <NotificationToast
            key={notification.id}
            notification={notification}
            onDismiss={() => dismiss(notification.id)}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotify() {
  return useContext(NotificationContext) || { notify: () => "", error: () => "", dismiss: () => {} };
}

export function useErrorNotification(message, { title = T("Error", "错误"), action = null, key = "" } = {}) {
  const { error } = useNotify();
  const lastKeyRef = useRef("");
  const cleanMessage = notificationMessage(message);

  useEffect(() => {
    if (!cleanMessage) {
      lastKeyRef.current = "";
      return;
    }
    const nextKey = key || cleanMessage;
    if (lastKeyRef.current === nextKey) return;
    lastKeyRef.current = nextKey;
    error(cleanMessage, { title, action });
  }, [action, cleanMessage, error, key, title]);
}
