import { lazy, StrictMode, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../styles/base.css";
import "../styles/screens.css";
import "./app.css";
import { App } from "./App.jsx";
import { preloadActiveLocale, T, useLang } from "./i18n.jsx";
import { applyTheme, resolveTheme } from "./lib/theme.js";
import { isInstallPopupReturn, notifyOpenerAndClose } from "./lib/install-popup.js";
import { githubOAuthFailureCode } from "./lib/github-oauth-result.js";

const GitHubOAuthFailureScreen = lazy(() =>
  import("./screens/public.jsx").then((module) => ({ default: module.GitHubOAuthFailureScreen }))
);

const root = createRoot(document.getElementById("root"));
applyTheme(resolveTheme());

const oauthFailure = githubOAuthFailureCode();
if (!oauthFailure && isInstallPopupReturn()) {
  notifyOpenerAndClose();
  root.render(<InstallPopupReturn failed={Boolean(new URLSearchParams(window.location.search).get("github_error"))} />);
} else {
  root.render(
    <StrictMode>
      <ApplicationStartup oauthFailure={oauthFailure} />
    </StrictMode>
  );
}

function ApplicationStartup({ oauthFailure }) {
  const lang = useLang();
  const [ready, setReady] = useState(lang === "en");
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
  const loading = (
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
  if (!ready) return loading;
  // Error redirects have no trusted popup nonce. Keep them visible for manual
  // recovery and never notify success, check the session or synchronize access.
  return oauthFailure ? (
    <Suspense fallback={loading}>
      <GitHubOAuthFailureScreen code={oauthFailure} />
    </Suspense>
  ) : <App />;
}

function InstallPopupReturn({ failed }) {
  return (
    <main className="install-return">
      <div>
        <p className="install-return-title">
          {failed
            ? T("GitHub installation was not completed", {
                zh: "GitHub 安装未完成",
                ja: "GitHub のインストールは完了していません",
                ko: "GitHub 설치가 완료되지 않았습니다",
                fr: "L’installation GitHub n’a pas abouti",
                es: "La instalación de GitHub no se completó",
              })
            : T("GitHub installation complete", {
                zh: "GitHub 安装完成",
                ja: "GitHub インストールが完了しました",
                ko: "GitHub 설치 완료",
                fr: "Installation GitHub terminée",
                es: "Instalación de GitHub completada",
              })}
        </p>
        <p className="install-return-description">
          {T("You can close this window.", {
            zh: "你可以关闭此窗口。",
            ja: "このウィンドウを閉じてかまいません。",
            ko: "이 창을 닫아도 됩니다.",
            fr: "Vous pouvez fermer cette fenêtre.",
            es: "Puedes cerrar esta ventana.",
          })}
        </p>
      </div>
    </main>
  );
}
