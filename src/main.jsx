import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles/base.css";
import "../styles/screens.css";
import "./app.css";
import { App } from "./App.jsx";
import { preloadActiveLocale, T } from "./i18n.jsx";
import { localStorageGet } from "./lib/browser-storage.js";
import { isInstallPopupReturn, notifyOpenerAndClose } from "./lib/install-popup.js";

const root = createRoot(document.getElementById("root"));

if (isInstallPopupReturn()) {
  notifyOpenerAndClose();
  document.documentElement.setAttribute("data-theme", localStorageGet("pw-theme", "light"));
  root.render(<InstallPopupReturn />);
} else {
  // Resolves immediately for English; for other locales this avoids a first
  // paint of English copy before the catalog lands.
  await preloadActiveLocale();
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
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
