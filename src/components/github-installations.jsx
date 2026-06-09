import { I } from "../icons.jsx";
import { T } from "../i18n.jsx";

function scalarText(value) {
  if (value === undefined || value === null || value === "") return "";
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  return "";
}

function displayText(value) {
  return scalarText(value)
    .trim()
    .split(/[\r\n]/, 1)[0]
    .trim();
}

function installationId(installation) {
  return displayText(installation?.installationId) || displayText(installation?.id);
}

function installationAccount(installation) {
  return (
    displayText(installation?.installationAccount) ||
    displayText(installation?.account?.login) ||
    displayText(installation?.account)
  );
}

function installationTargetType(installation) {
  const raw =
    displayText(installation?.installationTargetType) ||
    displayText(installation?.targetType) ||
    displayText(installation?.target_type);
  if (!raw) return T("Account", "账号");
  return raw.toLowerCase() === "organization" ? T("Organization", "组织") : T("User", "用户");
}

function installationSelection(installation) {
  const raw =
    displayText(installation?.repositorySelection) ||
    displayText(installation?.repository_selection) ||
    displayText(installation?.scope);
  return raw === "all" ? T("all repositories", "全部仓库") : T("selected", "已选择仓库");
}

function repositoryCountLabel(count) {
  const value = normalizedRepositoryCount(count);
  return value === 1
    ? T("1 repository", "1 个仓库")
    : T(`${value} repositories`, `${value} 个仓库`);
}

function normalizedRepositoryCount(count) {
  const value = Number(count);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function installationRepositoryCount(installation) {
  if (installation?.repositoryCount !== undefined)
    return normalizedRepositoryCount(installation.repositoryCount);
  if (Array.isArray(installation?.repositories)) return installation.repositories.length;
  return 0;
}

function installationManage(installation) {
  const manage = installation?.manage && typeof installation.manage === "object" ? installation.manage : {};
  return {
    mode: scalarText(manage.mode) || "needs_identity",
    githubIdentityId: scalarText(manage.githubIdentityId),
    githubLogin: scalarText(manage.githubLogin),
    lastVerifiedAt: manage.lastVerifiedAt,
  };
}

function installationStatusLabel(manage, account) {
  if (manage.mode === "verified_identity" && manage.githubLogin) {
    return T(
      `Last verified by @${manage.githubLogin}`,
      `最近由 @${manage.githubLogin} 验证`
    );
  }
  if (manage.mode === "needs_reauth")
    return T("GitHub account needs reconnect", "GitHub 账户需要重新连接");
  if (manage.mode === "needs_identity") {
    return T(
      `Needs a GitHub account with access to ${account || "this installation"}`,
      `需要有权访问 ${account || "该安装"} 的 GitHub 账户`
    );
  }
  return T("GitHub manage access is unknown", "GitHub 管理访问状态未知");
}

function normalizedInstallations(installations) {
  return (Array.isArray(installations) ? installations : [])
    .map((installation) => {
      const account = installationAccount(installation);
      const manage = installationManage(installation);
      return {
        id: installationId(installation),
        account,
        targetType: installationTargetType(installation),
        selection: installationSelection(installation),
        repositoryCount: installationRepositoryCount(installation),
        manage,
        status: installationStatusLabel(manage, account),
      };
    })
    .filter((installation) => installation.id || installation.account);
}

export function GitHubInstallationsList({ installations, onManage, managingInstallationId = "" }) {
  const rows = normalizedInstallations(installations);
  if (!rows.length) return null;

  return (
    <div className="gh-installs">
      <div className="gh-installs-h">
        <I.Github size={14} />
        <span>{T("Authorized GitHub installations", "已授权 GitHub 安装")}</span>
      </div>
      <div className="gh-install-list">
        {rows.map((installation) => (
          <div className="gh-install-row" key={installation.id || installation.account}>
            <div className="gh-install-icon">
              <I.Github size={14} />
            </div>
            <div className="gh-install-main">
              <div className="gh-install-account">{installation.account || installation.id}</div>
              <div className="gh-install-meta">
                <span>{installation.targetType}</span>
                <span className="gh-install-meta-separator" aria-hidden="true">
                  /
                </span>
                <span>{installation.selection}</span>
                <span className="gh-install-meta-separator" aria-hidden="true">
                  /
                </span>
                <span>{repositoryCountLabel(installation.repositoryCount)}</span>
              </div>
              <div className="gh-install-status">{installation.status}</div>
            </div>
            {installation.id && onManage && (
              <button
                type="button"
                className="btn sm ghost"
                disabled={managingInstallationId === installation.id}
                onClick={() => onManage(installation)}
                aria-label={T(
                  `Manage ${installation.account || installation.id} GitHub App installation`,
                  `管理 ${installation.account || installation.id} 的 GitHub App 安装`
                )}
              >
                {managingInstallationId === installation.id ? (
                  <span className="spin" style={{ display: "inline-block" }}>
                    <I.Refresh size={13} />
                  </span>
                ) : (
                  <I.Settings size={13} />
                )}{" "}
                {T("Manage", "管理")}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
