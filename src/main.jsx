import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../styles/base.css";
import "../styles/screens.css";
import "./app.css";
import { App } from "./App.jsx";
import { preloadActiveLocale, T } from "./i18n.jsx";
import { localStorageGet } from "./lib/browser-storage.js";
import { isInstallPopupReturn, notifyOpenerAndClose } from "./lib/install-popup.js";

const root = createRoot(document.getElementById("root"));
document.documentElement.setAttribute("data-theme", localStorageGet("pw-theme", "light"));

if (isInstallPopupReturn()) {
  notifyOpenerAndClose();
  root.render(<InstallPopupReturn />);
} else {
  root.render(
    <StrictMode>
      <ApplicationStartup />
    </StrictMode>
  );
}

function ApplicationStartup() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let current = true;
    const finish = () => {
      if (current) setReady(true);
    };
    // The catalog loader retains its English fallback on a failed download.
    // Show a localized status while it resolves, including on a cold mobile connection.
    preloadActiveLocale().then(finish, finish);
    return () => {
      current = false;
    };
  }, []);
  if (ready) return <App />;
  return (
    <div className="app-startup" role="status" aria-live="polite">
      <strong>Pullwise</strong>
      <p>
        {T("Loading Pullwise…", {
          zh: "正在加载 Pullwise…",
          ja: "Pullwise を読み込み中…",
          ko: "Pullwise 로딩 중…",
          fr: "Chargement de Pullwise…",
          es: "Cargando Pullwise…",
        })}
      </p>
    </div>
  );
}

function InstallPopupReturn() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "16px",
        textAlign: "center",
        fontFamily: "var(--font-sans)",
        color: "var(--text)",
      }}
    >
      <div>
        <p style={{ fontSize: "var(--fs-xl)", margin: 0 }}>
          {T("GitHub installation complete", {
            zh: "GitHub 安装完成",
            ja: "GitHub インストールが完了しました",
            ko: "GitHub 설치 완료",
            fr: "Installation GitHub terminée",
            es: "Instalación de GitHub completada",
          })}
        </p>
        <p style={{ fontSize: "var(--fs-md)", marginTop: 8, color: "var(--text-3)" }}>
          {T("You can close this window.", {
            zh: "你可以关闭此窗口。",
            ja: "このウィンドウを閉じてかまいません。",
            ko: "이 창을 닫아도 됩니다.",
            fr: "Vous pouvez fermer cette fenêtre.",
            es: "Puedes cerrar esta ventana.",
          })}
        </p>
      </div>
    </div>
  );
}
