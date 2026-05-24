# Stage 2 Fix And Pull Request Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a safe, user-approved issue remediation workflow that previews deterministic fixes and opens GitHub pull requests through the backend.

**Architecture:** Keep browser code read-only and secret-free. Add a backend fix workflow module that validates auto-fix payloads, previews unified diffs, and creates PRs with GitHub App installation credentials; wire the React issue detail screen to preview before creating a PR.

**Tech Stack:** Python 3.10, `unittest`, SQLite-backed app state, Git subprocesses, GitHub REST API via `requests`, Vite, React 18, Vitest, Testing Library.

---

## Notes

- This plan is stored in the `web` repo, but several tasks modify the sibling
  `server` repo.
- Current worktree paths:
  - Web: `E:\Git-Pullwise\web\.worktrees\stage1-production-readiness`
  - Server: `E:\Git-Pullwise\server\.worktrees\stage1-production-readiness`
- Both worktrees should be on branch `stage2-fix-pr-workflow`.
- Use test-first changes. Do not implement batch fixes, auto-merge, Slack,
  Linear, notification delivery, or AI-generated replacement patches in this
  stage.
- Do not commit `.env`, private keys, provider tokens, generated checkout
  state, or smoke logs.

### Task 1: Backend Deterministic Fix Preview

**Files:**
- Create: `server/tests/test_fix_workflow.py`
- Create: `server/pullwise_server/fix_workflow.py`

**Step 1: Write failing patch-preview tests**

Create `tests/test_fix_workflow.py` with tests for deterministic replacement
logic independent of HTTP routing:

```python
from __future__ import annotations

import os
import tempfile
import unittest

from pullwise_server import fix_workflow


class FixWorkflowPreviewTest(unittest.TestCase):
    def issue(self, **overrides):
        payload = {
            "id": "f_123",
            "repo": "owner/repo",
            "branch": "main",
            "file": "src/auth.py",
            "autoFix": True,
            "title": "Validate redirect targets",
            "badCode": [{"ln": 2, "code": "return redirect(next_url)", "t": "del"}],
            "goodCode": [{"ln": 2, "code": "return redirect(safe_redirect(next_url))", "t": "add"}],
        }
        payload.update(overrides)
        return payload

    def test_preview_rejects_non_autofixable_issue(self):
        with tempfile.TemporaryDirectory() as root:
            result = fix_workflow.preview_issue_fix(root, self.issue(autoFix=False))

        self.assertFalse(result["valid"])
        self.assertIn("not auto-fixable", result["message"])

    def test_preview_rejects_unsafe_paths(self):
        with tempfile.TemporaryDirectory() as root:
            result = fix_workflow.preview_issue_fix(root, self.issue(file="../secrets.env"))

        self.assertFalse(result["valid"])
        self.assertIn("unsafe", result["message"].lower())

    def test_preview_rejects_missing_old_block(self):
        with tempfile.TemporaryDirectory() as root:
            os.makedirs(os.path.join(root, "src"))
            with open(os.path.join(root, "src", "auth.py"), "w", encoding="utf-8") as handle:
                handle.write("return redirect('/dashboard')\n")

            result = fix_workflow.preview_issue_fix(root, self.issue())

        self.assertFalse(result["valid"])
        self.assertIn("expected code", result["message"].lower())

    def test_preview_rejects_ambiguous_old_block(self):
        with tempfile.TemporaryDirectory() as root:
            os.makedirs(os.path.join(root, "src"))
            with open(os.path.join(root, "src", "auth.py"), "w", encoding="utf-8") as handle:
                handle.write("return redirect(next_url)\nreturn redirect(next_url)\n")

            result = fix_workflow.preview_issue_fix(root, self.issue())

        self.assertFalse(result["valid"])
        self.assertIn("multiple", result["message"].lower())

    def test_preview_returns_unified_diff_for_valid_fix(self):
        with tempfile.TemporaryDirectory() as root:
            os.makedirs(os.path.join(root, "src"))
            with open(os.path.join(root, "src", "auth.py"), "w", encoding="utf-8") as handle:
                handle.write("def handler(next_url):\n    return redirect(next_url)\n")

            result = fix_workflow.preview_issue_fix(root, self.issue())

        self.assertTrue(result["valid"])
        self.assertEqual(result["file"], "src/auth.py")
        self.assertIn("--- a/src/auth.py", result["diff"])
        self.assertIn("+++ b/src/auth.py", result["diff"])
        self.assertIn("-    return redirect(next_url)", result["diff"])
        self.assertIn("+    return redirect(safe_redirect(next_url))", result["diff"])
```

**Step 2: Run test to verify it fails**

Run from `server`:

```powershell
python -m unittest tests.test_fix_workflow
```

Expected: FAIL because `pullwise_server.fix_workflow` does not exist.

**Step 3: Implement minimal preview module**

Create `pullwise_server/fix_workflow.py` with:

```python
from __future__ import annotations

import difflib
import os
from pathlib import PurePosixPath


def preview_issue_fix(repo_path: str, issue: dict) -> dict:
    if not issue.get("autoFix") and not issue.get("autoFixable"):
        return invalid(issue, "This issue is not auto-fixable.")

    target_file = safe_issue_file(issue.get("file"))
    if not target_file:
        return invalid(issue, "Issue fix target path is unsafe.")

    bad_lines = code_lines(issue.get("badCode"))
    good_lines = code_lines(issue.get("goodCode"))
    if not bad_lines or not good_lines:
        return invalid(issue, "Issue fix is missing replacement code.")

    file_path = safe_join(repo_path, target_file)
    if not file_path or not os.path.exists(file_path):
        return invalid(issue, "Issue fix target file was not found.")

    with open(file_path, "r", encoding="utf-8") as handle:
        original = handle.read()

    replacement = replacement_preview(original, bad_lines, good_lines)
    if not replacement["valid"]:
        return invalid(issue, replacement["message"])

    diff = "".join(difflib.unified_diff(
        original.splitlines(keepends=True),
        replacement["content"].splitlines(keepends=True),
        fromfile=f"a/{target_file}",
        tofile=f"b/{target_file}",
    ))
    return {
        "issueId": str(issue.get("id") or ""),
        "autoFixable": True,
        "valid": True,
        "repository": issue.get("repo") or issue.get("repository") or "",
        "branch": issue.get("branch") or "main",
        "file": target_file,
        "diff": diff,
        "summary": "1 file changed",
    }


def apply_issue_fix(repo_path: str, issue: dict) -> dict:
    preview = preview_issue_fix(repo_path, issue)
    if not preview.get("valid"):
        return preview
    target_file = str(preview["file"])
    file_path = safe_join(repo_path, target_file)
    with open(file_path, "r", encoding="utf-8") as handle:
        original = handle.read()
    replacement = replacement_preview(
        original,
        code_lines(issue.get("badCode")),
        code_lines(issue.get("goodCode")),
    )
    with open(file_path, "w", encoding="utf-8", newline="") as handle:
        handle.write(replacement["content"])
    return preview


def invalid(issue: dict, message: str) -> dict:
    return {
        "issueId": str(issue.get("id") or ""),
        "autoFixable": bool(issue.get("autoFix") or issue.get("autoFixable")),
        "valid": False,
        "message": message,
    }


def code_lines(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item.get("code") or "") for item in value if isinstance(item, dict)]


def replacement_preview(original: str, bad_lines: list[str], good_lines: list[str]) -> dict:
    old_block = "\n".join(bad_lines)
    new_block = "\n".join(good_lines)
    if old_block not in original:
        indented_old = "\n".join(line if not line else f"    {line}" for line in bad_lines)
        indented_new = "\n".join(line if not line else f"    {line}" for line in good_lines)
        if indented_old in original:
            old_block = indented_old
            new_block = indented_new
        else:
            return {"valid": False, "message": "Expected code block was not found."}
    if original.count(old_block) > 1:
        return {"valid": False, "message": "Expected code block appears multiple times."}
    return {"valid": True, "content": original.replace(old_block, new_block, 1)}


def safe_issue_file(value: object) -> str | None:
    path = str(value or "").replace("\\", "/").strip()
    if not path:
        return None
    parsed = PurePosixPath(path)
    if parsed.is_absolute() or any(part in {"", ".", ".."} for part in parsed.parts):
        return None
    if ":" in parsed.parts[0]:
        return None
    return str(parsed)


def safe_join(root: str, relative_path: str) -> str | None:
    root_abs = os.path.abspath(root)
    target = os.path.abspath(os.path.join(root_abs, relative_path))
    try:
        common = os.path.commonpath([root_abs, target])
    except ValueError:
        return None
    if os.path.normcase(common) != os.path.normcase(root_abs):
        return None
    return target
```

**Step 4: Run test to verify it passes**

Run from `server`:

```powershell
python -m unittest tests.test_fix_workflow
```

Expected: PASS.

**Step 5: Commit**

Commit in `server`:

```powershell
git add tests/test_fix_workflow.py pullwise_server/fix_workflow.py
git commit -m "feat: preview deterministic issue fixes"
```

### Task 2: Backend Fix Preview Route

**Files:**
- Modify: `server/tests/test_security_contracts.py`
- Modify: `server/pullwise_server/app.py`

**Step 1: Write failing route tests**

Add tests near issue status tests in `tests/test_security_contracts.py`.
Use the existing `RouteHarness` class.

```python
    def signed_in(self):
        app.SESSIONS = {
            "ses_1": {
                "id": "ses_1",
                "userId": "usr_1",
                "createdAt": app.now(),
                "expiresAt": app.now() + 3600,
            }
        }
        return "pw_session=ses_1"

    def test_issue_fix_preview_requires_sign_in(self):
        handler = RouteHarness("/issues/iss_1/fixes/preview")

        app.PullwiseHandler.route(handler, "POST")

        self.assertEqual(handler.status, HTTPStatus.UNAUTHORIZED)

    def test_issue_fix_preview_returns_server_preview(self):
        app.ISSUES[0].update({
            "repo": "owner/repo",
            "scanId": "sc_1",
            "autoFix": True,
            "file": "src/auth.py",
            "badCode": [{"ln": 1, "code": "old()", "t": "del"}],
            "goodCode": [{"ln": 1, "code": "new()", "t": "add"}],
        })
        handler = RouteHarness("/issues/iss_1/fixes/preview", cookie=self.signed_in())

        with patch("pullwise_server.app.preview_issue_fix_for_user", return_value={
            "issueId": "iss_1",
            "autoFixable": True,
            "valid": True,
            "repository": "owner/repo",
            "branch": "main",
            "file": "src/auth.py",
            "diff": "--- a/src/auth.py\n+++ b/src/auth.py\n-old()\n+new()\n",
            "summary": "1 file changed",
        }) as preview:
            app.PullwiseHandler.route(handler, "POST")

        self.assertEqual(handler.status, HTTPStatus.OK)
        self.assertTrue(handler.payload["valid"])
        self.assertIn("-old()", handler.payload["diff"])
        preview.assert_called_once()
```

**Step 2: Run test to verify it fails**

Run from `server`:

```powershell
python -m unittest tests.test_security_contracts.SecurityContractsTest.test_issue_fix_preview_requires_sign_in tests.test_security_contracts.SecurityContractsTest.test_issue_fix_preview_returns_server_preview
```

Expected: FAIL because the route still returns `501` or the helper does not
exist.

**Step 3: Implement route and helper**

In `pullwise_server/app.py`:

- Import `fix_workflow` and `checkout`.
- Add `preview_issue_fix_for_user(user, issue)` near issue helpers:

```python
def preview_issue_fix_for_user(user: dict, issue: dict) -> dict:
    scan = next((item for item in SCANS if item.get("id") == issue.get("scanId")), None)
    if not scan or scan.get("userId") != user.get("id"):
        raise ValueError("Original scan is not available for this issue.")
    repo_path = scan.get("repoPath")
    if not repo_path:
        raise ValueError("A checked-out repository is required to preview this fix. Re-run the scan or create the pull request directly.")
    if not checkout.path_in_scan_workspace(repo_path, str(user.get("id") or ""), str(scan.get("id") or "")):
        raise ValueError("Stored repository path is not in the scan workspace.")
    return fix_workflow.preview_issue_fix(str(repo_path), issue)
```

- Add a `POST /issues/{id}/fixes/preview` branch before the existing
  `POST /issues/{id}/fixes/apply` not-implemented route:

```python
        if len(segments) == 4 and segments[0] == "issues" and segments[2] == "fixes" and segments[3] == "preview":
            session = self.current_session()
            if not session:
                return self.error(HTTPStatus.UNAUTHORIZED, "Sign in before previewing a fix.")
            user = USERS.get(session["userId"]) or {}
            issue = self.find_or_404(user_issues(session), segments[1], "Issue")
            try:
                preview = preview_issue_fix_for_user(user, issue)
            except ValueError as exc:
                return self.error(HTTPStatus.BAD_REQUEST, str(exc))
            return self.json(preview, HTTPStatus.OK if preview.get("valid") else HTTPStatus.BAD_REQUEST)
```

**Step 4: Run tests**

Run from `server`:

```powershell
python -m unittest tests.test_security_contracts.SecurityContractsTest.test_issue_fix_preview_requires_sign_in tests.test_security_contracts.SecurityContractsTest.test_issue_fix_preview_returns_server_preview
```

Expected: PASS.

**Step 5: Commit**

Commit in `server`:

```powershell
git add tests/test_security_contracts.py pullwise_server/app.py
git commit -m "feat: add issue fix preview route"
```

### Task 3: Backend Pull Request Workflow

**Files:**
- Create: `server/tests/test_pull_request_workflow.py`
- Modify: `server/pullwise_server/fix_workflow.py`
- Modify: `server/pullwise_server/github_auth.py`
- Modify: `server/pullwise_server/app.py`

**Step 1: Write failing PR workflow tests**

Create `tests/test_pull_request_workflow.py`. Use mocks for git and GitHub so
no network or real repository write is needed.

```python
from __future__ import annotations

import os
import tempfile
import unittest
from unittest.mock import patch

from pullwise_server import app, fix_workflow


class PullRequestWorkflowTest(unittest.TestCase):
    def setUp(self):
        self.persist = patch.object(app, "persist_state")
        self.persist.start()
        self.addCleanup(self.persist.stop)
        app.USERS = {
            "usr_1": {
                "id": "usr_1",
                "githubRepositoryAccess": {
                    "mode": "github-app",
                    "authorizedUserId": "usr_1",
                    "authorizedGithubId": "1",
                    "authorizedGithubLogin": "octocat",
                    "repositories": ["owner/repo"],
                    "repositoryItems": [{
                        "fullName": "owner/repo",
                        "installationId": "123",
                        "defaultBranch": "main",
                        "cloneUrl": "https://github.com/owner/repo.git",
                    }],
                },
            }
        }
        app.SCANS = [{"id": "sc_1", "userId": "usr_1", "repo": "owner/repo", "branch": "main"}]
        app.ISSUES = [{
            "id": "f_123",
            "userId": "usr_1",
            "scanId": "sc_1",
            "repo": "owner/repo",
            "branch": "main",
            "title": "Validate redirect targets",
            "file": "src/auth.py",
            "autoFix": True,
            "badCode": [{"ln": 2, "code": "return redirect(next_url)", "t": "del"}],
            "goodCode": [{"ln": 2, "code": "return redirect(safe_redirect(next_url))", "t": "add"}],
        }]

    def test_create_issue_pull_request_requires_github_app_api(self):
        with patch("pullwise_server.github_auth.app_api_configured", return_value=False):
            with self.assertRaisesRegex(ValueError, "GitHub App API"):
                app.create_issue_pull_request(app.USERS["usr_1"], app.ISSUES[0])

    def test_create_issue_pull_request_reuses_existing_record(self):
        app.ISSUES[0]["pullRequest"] = {"url": "https://github.com/owner/repo/pull/1", "number": 1}

        result = app.create_issue_pull_request(app.USERS["usr_1"], app.ISSUES[0])

        self.assertEqual(result["url"], "https://github.com/owner/repo/pull/1")

    def test_create_issue_pull_request_pushes_without_leaking_token(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            repo_path = os.path.join(tmpdir, "repo")
            os.makedirs(os.path.join(repo_path, "src"))
            with open(os.path.join(repo_path, "src", "auth.py"), "w", encoding="utf-8") as handle:
                handle.write("def handler(next_url):\n    return redirect(next_url)\n")
            commands = []

            def fake_run_git(command, *, cwd, extra_env, is_cancelled, action):
                commands.append((command, extra_env, action))

            with (
                patch.dict(os.environ, {"PULLWISE_CHECKOUT_ROOT": tmpdir, "PULLWISE_GITHUB_WEB_URL": "https://github.com"}, clear=False),
                patch("pullwise_server.github_auth.app_api_configured", return_value=True),
                patch("pullwise_server.github_auth.create_installation_access_token", return_value={"token": "ghs_secret_token"}),
                patch("pullwise_server.github_auth.create_pull_request", return_value={"url": "https://github.com/owner/repo/pull/7", "number": 7, "title": "Fix: Validate redirect targets"}),
                patch("pullwise_server.checkout.prepare_checkout", return_value=repo_path),
                patch("pullwise_server.checkout.run_git", side_effect=fake_run_git),
            ):
                result = app.create_issue_pull_request(app.USERS["usr_1"], app.ISSUES[0])

        self.assertEqual(result["number"], 7)
        serialized = repr(commands)
        self.assertNotIn("ghs_secret_token", serialized)
        self.assertEqual(app.ISSUES[0]["pullRequest"]["number"], 7)
```

**Step 2: Run test to verify it fails**

Run from `server`:

```powershell
python -m unittest tests.test_pull_request_workflow
```

Expected: FAIL because `create_issue_pull_request()` and
`github_auth.create_pull_request()` do not exist.

**Step 3: Add GitHub PR helper**

In `pullwise_server/github_auth.py`, add:

```python
def create_pull_request(token: str, repo: str, *, title: str, head: str, base: str, body: str) -> dict:
    response = requests.post(
        f"{github_api_url()}/repos/{repo}/pulls",
        headers=github_api_headers(token),
        json={"title": title, "head": head, "base": base, "body": body},
        timeout=request_timeout(),
    )
    try:
        response.raise_for_status()
    except Exception as exc:
        raise GitHubError(f"GitHub pull request creation failed: {exc}") from exc
    payload = response.json()
    return {
        "url": payload.get("html_url") or payload.get("url") or "",
        "number": payload.get("number"),
        "title": payload.get("title") or title,
    }
```

**Step 4: Add app PR helper**

In `pullwise_server/app.py`, add `create_issue_pull_request(user, issue)`.
It should:

- Return `issue["pullRequest"]` if present.
- Validate `github_auth.app_api_configured()`.
- Validate current user's GitHub repo access and `repository_is_authorized()`.
- Find the repo item and installation id.
- Build a synthetic scan-like checkout payload from issue/repo metadata.
- Call `checkout.prepare_checkout(f"pr_{issue_id}", scan, lambda: False)`.
- Call `fix_workflow.apply_issue_fix(repo_path, issue)` and reject invalid
  previews with `ValueError`.
- Create a branch name with `make_id("fix")`, commit, push, and call
  `github_auth.create_pull_request()`.
- Persist a safe `pullRequest` dict on the issue.
- Clean up with `checkout.cleanup_scan_workspace(user_id, pr_scan_id)` in a
  `finally` block when the PR workspace is under the checkout root.

Use `checkout.run_git()` for:

```python
["git", "checkout", "-B", branch_name]
["git", "add", "--", preview["file"]]
["git", "commit", "-m", commit_message]
["git", "push", "origin", f"HEAD:{branch_name}"]
```

Do not place the token directly in commands.

**Step 5: Add route**

Replace the current `POST /issues/{id}/pull-requests` `501` branch with:

```python
        if len(segments) == 3 and segments[0] == "issues" and segments[2] == "pull-requests":
            session = self.current_session()
            if not session:
                return self.error(HTTPStatus.UNAUTHORIZED, "Sign in before creating a pull request.")
            user = USERS.get(session["userId"]) or {}
            issue = self.find_or_404(user_issues(session), segments[1], "Issue")
            try:
                result = create_issue_pull_request(user, issue)
            except ValueError as exc:
                return self.error(HTTPStatus.BAD_REQUEST, str(exc))
            except github_auth.GitHubError as exc:
                return self.error(HTTPStatus.SERVICE_UNAVAILABLE, str(exc))
            return self.json(result, HTTPStatus.OK)
```

**Step 6: Run tests**

Run from `server`:

```powershell
python -m unittest tests.test_pull_request_workflow
```

Expected: PASS.

**Step 7: Commit**

Commit in `server`:

```powershell
git add tests/test_pull_request_workflow.py pullwise_server/fix_workflow.py pullwise_server/github_auth.py pullwise_server/app.py
git commit -m "feat: create pull requests for issue fixes"
```

### Task 4: Frontend API Contract

**Files:**
- Modify: `web/src/api/pullwise.js`

**Step 1: Write failing API contract test**

If there is no dedicated API contract test file, create
`src/api/pullwise.test.js`:

```js
import { describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "./pullwise.js";
import { request } from "./http.js";

vi.mock("./http.js", () => ({ request: vi.fn() }));

describe("pullwiseApi issue fix endpoints", () => {
  it("calls preview and pull request endpoints", async () => {
    request.mockResolvedValue({});

    await pullwiseApi.issues.previewFix("f_123");
    await pullwiseApi.issues.createPullRequest("f_123");

    expect(request).toHaveBeenNthCalledWith(1, "/issues/f_123/fixes/preview", { method: "POST" });
    expect(request).toHaveBeenNthCalledWith(2, "/issues/f_123/pull-requests", { method: "POST" });
  });
});
```

**Step 2: Run test to verify it fails**

Run from `web`:

```powershell
npm run test -- src/api/pullwise.test.js
```

Expected: FAIL because the new issue API methods do not exist.

**Step 3: Implement API methods**

In `src/api/pullwise.js`, extend `issues`:

```js
previewFix: (issueId) => request(`/issues/${issueId}/fixes/preview`, { method: "POST" }),
createPullRequest: (issueId) => request(`/issues/${issueId}/pull-requests`, { method: "POST" }),
```

**Step 4: Run test**

Run from `web`:

```powershell
npm run test -- src/api/pullwise.test.js
```

Expected: PASS.

**Step 5: Commit**

Commit in `web`:

```powershell
git add src/api/pullwise.js src/api/pullwise.test.js
git commit -m "feat: add issue fix api methods"
```

### Task 5: Frontend Issue Detail Fix Workflow

**Files:**
- Modify: `web/src/screens/issues.test.jsx`
- Modify: `web/src/screens/issues.jsx`
- Modify: `web/styles/screens.css`

**Step 1: Update mocks and write failing UI tests**

In `src/screens/issues.test.jsx`, mock `pullwiseApi`:

```js
vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    issues: {
      updateStatus: vi.fn(),
      previewFix: vi.fn(),
      createPullRequest: vi.fn(),
    },
  },
}));
```

Import it:

```js
import { pullwiseApi } from "../api/pullwise.js";
```

Add tests:

```jsx
it("previews an auto-fix and then opens a pull request", async () => {
  const user = userEvent.setup();
  const issue = {
    id: "f_123",
    repo: "acme/api",
    severity: "high",
    category: "Security",
    title: "Validate redirect targets",
    summary: "The redirect endpoint accepts arbitrary URLs.",
    status: "open",
    autoFix: true,
    file: "src/auth.py",
    badCode: [{ ln: 42, code: "return redirect(next_url)", t: "del" }],
    goodCode: [{ ln: 42, code: "return redirect(safe_redirect(next_url))", t: "add" }],
  };
  pullwiseApi.issues.previewFix.mockResolvedValueOnce({
    valid: true,
    file: "src/auth.py",
    diff: "--- a/src/auth.py\n+++ b/src/auth.py\n-return redirect(next_url)\n+return redirect(safe_redirect(next_url))\n",
  });
  pullwiseApi.issues.createPullRequest.mockResolvedValueOnce({
    url: "https://github.com/acme/api/pull/42",
    number: 42,
    branch: "pullwise/fix-f_123-a1b2c3",
    title: "Fix: Validate redirect targets",
  });

  render(<IssueDetailScreen go={vi.fn()} issue={issue} />);

  await user.click(screen.getByRole("button", { name: /preview fix/i }));
  expect(await screen.findByText("src/auth.py")).toBeInTheDocument();
  expect(screen.getByText(/return redirect\(safe_redirect\(next_url\)\)/i)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /open pr/i }));
  expect(await screen.findByRole("link", { name: /pull request #42/i })).toHaveAttribute(
    "href",
    "https://github.com/acme/api/pull/42"
  );
});

it("keeps non-auto-fixable issues honest", () => {
  render(<IssueDetailScreen go={vi.fn()} issue={{ id: "f_123", title: "Manual issue", status: "open", autoFix: false }} />);

  expect(screen.getByRole("button", { name: /preview fix/i })).toBeDisabled();
  expect(screen.getByText(/not auto-fixable/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run from `web`:

```powershell
npm run test -- src/screens/issues.test.jsx
```

Expected: FAIL because the issue detail still renders disabled Stage 2 buttons.

**Step 3: Implement issue detail workflow**

In `IssueDetailScreen`:

- Add state:

```js
const [fixPreview, setFixPreview] = useState(null);
const [pullRequest, setPullRequest] = useState(issue?.pullRequest || null);
const [fixLoading, setFixLoading] = useState("");
```

- Reset those states in the existing `useEffect`.
- Add handlers:

```js
const previewFix = async () => {
  setActionError("");
  setFixLoading("preview");
  try {
    const preview = await pullwiseApi.issues.previewFix(issue.id);
    setFixPreview(preview);
  } catch (error) {
    setActionError(error?.message || "Unable to preview fix.");
  } finally {
    setFixLoading("");
  }
};

const openPullRequest = async () => {
  setActionError("");
  setFixLoading("pr");
  try {
    const result = await pullwiseApi.issues.createPullRequest(issue.id);
    setPullRequest(result);
  } catch (error) {
    setActionError(error?.message || "Unable to open pull request.");
  } finally {
    setFixLoading("");
  }
};
```

- Replace disabled Stage 2 buttons with:

```jsx
<button className="btn sm" disabled={!issue.autoFix && !issue.autoFixable || Boolean(fixLoading)} onClick={previewFix}>
  <I.Sparkle size={13} /> {fixLoading === "preview" ? "Previewing..." : "Preview fix"}
</button>
<button className="btn sm" disabled={!fixPreview?.valid || Boolean(fixLoading)} onClick={openPullRequest}>
  <I.GitBranch size={13} /> {fixLoading === "pr" ? "Opening..." : "Open PR"}
</button>
```

- Add preview panel:

```jsx
{fixPreview && (
  <div className="fix-preview">
    <div className="fix-preview-h">
      <b>{fixPreview.file}</b>
      <span className="tag">{fixPreview.valid ? "validated" : "blocked"}</span>
    </div>
    {fixPreview.message && <div className="muted">{fixPreview.message}</div>}
    {fixPreview.diff && <pre className="diff-block">{fixPreview.diff}</pre>}
  </div>
)}
{pullRequest?.url && (
  <a className="auth-link" href={pullRequest.url} target="_blank" rel="noreferrer">
    Pull request #{pullRequest.number}
  </a>
)}
```

Add compact CSS in `styles/screens.css` for `.fix-preview` and `.diff-block`.

**Step 4: Run test**

Run from `web`:

```powershell
npm run test -- src/screens/issues.test.jsx
```

Expected: PASS.

**Step 5: Commit**

Commit in `web`:

```powershell
git add src/screens/issues.test.jsx src/screens/issues.jsx styles/screens.css
git commit -m "feat: add issue fix pull request workflow"
```

### Task 6: Documentation And Final Verification

**Files:**
- Modify: `web/README.md`
- Modify: `web/src/api/README.md`
- Modify: `server/README.md`

**Step 1: Update docs**

Update docs to move these items out of "not implemented":

- Applying deterministic issue fixes.
- Creating GitHub pull requests for auto-fixable issues.

Keep these as not implemented:

- Batch fixes.
- Auto-merge.
- Notifications.
- Slack/Linear writes.
- AI-generated replacement patches beyond the finding payload.

Document that the GitHub App needs write permissions suitable for branch push
and pull request creation.

**Step 2: Run targeted checks**

Run from `server`:

```powershell
python -m unittest tests.test_fix_workflow tests.test_pull_request_workflow tests.test_security_contracts
```

Expected: PASS.

Run from `web`:

```powershell
npm run test -- src/api/pullwise.test.js src/screens/issues.test.jsx
```

Expected: PASS.

**Step 3: Run full checks**

Run from `server`:

```powershell
python -m unittest discover -s tests
```

Expected: PASS, except documented platform skips.

Run from `web`:

```powershell
npm run check
```

Expected: PASS.

**Step 4: Product smoke**

Start local services:

```powershell
python -m pullwise_server --host 127.0.0.1 --port 8080
npm run dev -- --host 127.0.0.1 --port 5173
```

Smoke with local mock configuration only if real GitHub credentials are not
available. Verify:

- Issue detail shows `Preview fix` for auto-fixable issue payloads.
- Preview returns a diff or a specific actionable failure.
- `Open PR` returns a specific actionable failure when GitHub App API write
  configuration is missing.
- Non-auto-fixable issues stay disabled with an explanation.
- `/health` still exposes readiness without secrets.

**Step 5: Commit docs**

Commit in each repo as needed:

```powershell
git add README.md src/api/README.md
git commit -m "docs: document fix pr workflow"
```

```powershell
git add README.md
git commit -m "docs: document fix pr backend"
```
