import { useId, useMemo, useState } from "react";
import { T, useLang } from "../i18n.jsx";

export function ProjectRepositoryPicker({
  repositories,
  hasMore,
  selectedRepository,
  additionalRepoIds,
  selectedCount,
  required = false,
  disabled,
  onSelect,
  onAdditionalChange,
}) {
  useLang();
  const fieldId = useId();
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const matchingRepositories = useMemo(
    () => repositories.filter((repo) => repo.fullName.toLowerCase().includes(query)),
    [repositories, query],
  );
  // Retain an authorized selection when the user narrows the local search.
  const primaryOptions = selectedRepository &&
      !matchingRepositories.some((repo) => repo.githubRepoId === selectedRepository.githubRepoId)
    ? [selectedRepository, ...matchingRepositories]
    : matchingRepositories;
  const additionalOptions = matchingRepositories.filter(
    (repo) => repo.githubRepoId !== selectedRepository?.githubRepoId,
  );
  return (
    <>
      <div className="ledger-field">
        <label htmlFor={`${fieldId}-search`}>{T("Find a repository", "查找仓库")}</label>
        <input
          id={`${fieldId}-search`}
          type="search"
          value={search}
          disabled={disabled}
          aria-describedby={`${fieldId}-guidance`}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <p className="ledger-help" id={`${fieldId}-guidance`}>
        {hasMore
          ? T("Search applies to loaded authorized repositories only. Load more repositories to include the next page.")
          : T("Search the loaded authorized repositories. Selected repositories stay selected when you search.")}
      </p>
      <div className="ledger-field">
        <label htmlFor={`${fieldId}-repository`}>{T("Repository")}</label>
        <select
          id={`${fieldId}-repository`}
          value={selectedRepository ? String(selectedRepository.githubRepoId) : ""}
          required={required}
          disabled={disabled}
          onChange={(event) => onSelect(event.target.value)}
        >
          <option value="">{T("Choose a repository", "选择仓库")}</option>
          {primaryOptions.map((repo) => (
            <option key={repo.githubRepoId} value={repo.githubRepoId}>{repo.fullName}</option>
          ))}
        </select>
      </div>
      {query && matchingRepositories.length === 0 && (
        <p className="ledger-help" role="status">{T("No loaded repositories match this search.")}</p>
      )}
      {selectedRepository && repositories.length > 1 && (
        <fieldset className="api-scope-panel">
          <legend>{T("Additional repositories (optional)", "其他仓库（选填）")}</legend>
          <div className="api-scope-list ledger-repository-list">
            {additionalOptions.map((repo) => (
              <label className="api-scope-row" key={repo.githubRepoId}>
                <input
                  type="checkbox"
                  checked={additionalRepoIds.includes(repo.githubRepoId)}
                  disabled={disabled || (selectedCount >= 30 && !additionalRepoIds.includes(repo.githubRepoId))}
                  onChange={(event) => onAdditionalChange(repo.githubRepoId, event.target.checked)}
                />
                <span className="api-scope-copy"><span>{repo.fullName}</span></span>
              </label>
            ))}
          </div>
          <p className="ledger-help" role="status" aria-live="polite" aria-atomic="true">
            {selectedCount} / 30 {T("repositories", "个仓库")}
          </p>
        </fieldset>
      )}
    </>
  );
}
