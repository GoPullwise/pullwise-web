import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@xyflow/react/dist/style.css";
import "../styles/base.css";
import "../styles/screens.css";
import "./app.css";
import { App } from "./App.jsx";
import { T } from "./i18n.jsx";
import { isInstallPopupReturn, notifyOpenerAndClose } from "./lib/install-popup.js";

const root = createRoot(document.getElementById("root"));

if (isInstallPopupReturn()) {
  notifyOpenerAndClose();
  root.render(<InstallPopupReturn />);
} else {
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
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#1f2937",
      }}
    >
      <div>
        <p style={{ fontSize: 15, margin: 0 }}>
          {T("GitHub installation complete", {
            zh: "GitHub 安装完成",
            ja: "GitHub インストールが完了しました",
            ko: "GitHub 설치 완료",
            fr: "Installation GitHub terminée",
            es: "Instalación de GitHub completada",
          })}
        </p>
        <p style={{ fontSize: 13, marginTop: 8, color: "#6b7280" }}>
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
