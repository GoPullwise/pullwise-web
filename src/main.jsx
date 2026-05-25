import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles/base.css";
import "../styles/screens.css";
import "./app.css";
import { App } from "./App.jsx";
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
        <p style={{ fontSize: 15, margin: 0 }}>GitHub installation complete · GitHub 安装完成</p>
        <p style={{ fontSize: 13, marginTop: 8, color: "#6b7280" }}>
          You can close this window. 你可以关闭此窗口。
        </p>
      </div>
    </div>
  );
}
