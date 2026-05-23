import { I } from "../icons.jsx";
import { T } from "../i18n.jsx";

function installationId(installation) {
  return String(installation?.installationId || installation?.id || "");
}

function installationAccount(installation) {
  return String(
    installation?.installationAccount ||
    installation?.account?.login ||
    installation?.account ||
    ""
  );
}

function installationTargetType(installation) {
  const raw = String(installation?.installationTargetType || installation?.targetType || installation?.target_type || "");
  if (!raw) return T("Account", "账号");
  return raw.toLowerCase() === "organization" ? T("Organization", "组织") : T("User", "用户");
}

function installationSelection(installation) {
  const raw = String(installation?.repositorySelection || installation?.repository_selection || installation?.scope || "");
  return raw === "all" ? T("all repositories", "全部仓库") : T("selected", "已选择仓库");
}

function repositoryCountLabel(count) {
  const value = Number(count || 0);
  return value === 1 ? "1 repository" : `${value} repositories`;
}

function installationRepositoryCount(installation) {
  if (typeof installation?.repositoryCount === "number") return installation.repositoryCount;
  if (Array.isArray(installation?.repositories)) return installation.repositories.length;
  return 0;
}

function installationHtmlUrl(installation) {
  return String(installation?.installationHtmlUrl || installation?.htmlUrl || installation?.html_url || "");
}

function normalizedInstallations(installations) {
  return (Array.isArray(installations) ? installations : [])
    .map((installation) => ({
      id: installationId(installation),
      account: installationAccount(installation),
      targetType: installationTargetType(installation),
      selection: installationSelection(installation),
      repositoryCount: installationRepositoryCount(installation),
      htmlUrl: installationHtmlUrl(installation),
    }))
    .filter((installation) => installation.id || installation.account);
}

export function GitHubInstallationsList({ installations }) {
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
            <div className="gh-install-icon"><I.Github size={14} /></div>
            <div className="gh-install-main">
              <div className="gh-install-account">{installation.account || installation.id}</div>
              <div className="gh-install-meta">
                {installation.targetType} / {installation.selection} / {repositoryCountLabel(installation.repositoryCount)}
              </div>
            </div>
            {installation.htmlUrl && (
              <a
                className="btn sm ghost"
                href={installation.htmlUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`Manage ${installation.account || installation.id} GitHub App installation`}
              >
                <I.Settings size={13} /> {T("Manage", "管理")}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
