# Production Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Pullwise Stage 1 stable, usable, and honest for production trials before building Stage 2 automation.

**Architecture:** Keep the current split between `pullwise-web` and `pullwise-server`. Harden the existing GitHub authorization, scan, issue, billing, and settings flows; expose backend state clearly; and render existing structured finding data in the frontend instead of adding fixture-only behavior.

**Tech Stack:** Vite, React 18, Vitest, Testing Library, axios, Python 3.10, `unittest`, SQLite, GitHub OAuth/App APIs, Codex/Claude CLI providers.

---

## Notes

- This plan is stored in `web/docs/plans`, but several tasks modify the sibling `../server` repository.
- Run commands from the repo named in each task.
- Use test-first changes. Do not implement Stage 2 automation in Stage 1.
- Do not commit `.env`, private keys, provider tokens, or generated checkout state.

### Task 1: Render Complete Issue Detail

**Files:**
- Modify: `web/src/screens/issues.test.jsx`
- Modify: `web/src/screens/issues.jsx`
- Modify: `web/src/lib/pullwise-data.js`

**Step 1: Write failing tests**

Add tests that render `IssueDetailScreen` with a finding shaped like the backend output:

```jsx
const issue = {
  id: "f_123",
  scanId: "sc_1",
  repo: "acme/api",
  severity: "high",
  category: "Security",
  title: "Validate redirect targets",
  summary: "The redirect endpoint accepts arbitrary URLs.",
  impact: "Attackers can abuse this for phishing.",
  file: "src/auth.py",
  line: 42,
  confidence: 0.91,
  status: "open",
  steps: ["Allow only same-origin redirect targets.", "Add tests for rejected external URLs."],
  badCode: [{ ln: 42, code: "return redirect(next_url)", t: "del" }],
  goodCode: [{ ln: 42, code: "return redirect(safe_redirect(next_url))", t: "add" }],
  references: [{ label: "OWASP redirects", url: "https://cheatsheetseries.owasp.org/" }],
};
```

Assert that the detail view shows impact, remediation steps, code evidence,
references, status actions, and disabled Stage 2 actions.

**Step 2: Run test to verify it fails**

Run from `web`:

```powershell
npm run test -- src/screens/issues.test.jsx
```

Expected: FAIL because `IssueDetailScreen` does not render the rich fields yet.

**Step 3: Implement detail rendering**

Update `normalizeIssue()` to preserve:

```js
scanId: issue.scanId || issue.scan_id || "",
impact: issue.impact || "",
steps: Array.isArray(issue.steps) ? issue.steps : [],
badCode: Array.isArray(issue.badCode) ? issue.badCode : [],
goodCode: Array.isArray(issue.goodCode) ? issue.goodCode : [],
references: Array.isArray(issue.references) ? issue.references : [],
tags: Array.isArray(issue.tags) ? issue.tags : [],
```

Update `IssueDetailScreen` to render sections:

- `Impact`
- `Remediation`
- `Evidence`
- `References`
- `Actions`

Use existing `.card`, `.section`, `.tag`, `.code`, `.code-line`, and `.btn`
styles where possible. Add only targeted CSS when existing styles do not cover
the layout.

For Stage 2 actions, render disabled buttons:

```jsx
<button className="btn sm" disabled title="Backend support is not implemented yet">
  <I.Sparkle size={13} /> Apply fix
</button>
<button className="btn sm" disabled title="Pull request creation is not implemented yet">
  <I.GitBranch size={13} /> Open PR
</button>
```

**Step 4: Run test to verify it passes**

Run from `web`:

```powershell
npm run test -- src/screens/issues.test.jsx
```

Expected: PASS.

**Step 5: Commit**

Commit in `web`:

```powershell
git add src/screens/issues.test.jsx src/screens/issues.jsx src/lib/pullwise-data.js
git commit -m "feat: render complete issue details"
```

### Task 2: Wire Issue Search To Detail

**Files:**
- Modify: `web/src/App.jsx`
- Modify: `web/src/shell.jsx`
- Modify: `web/src/App.test.jsx`

**Step 1: Write failing test**

Add a test that opens global search, clicks an issue result, and expects the
issue detail screen for that issue instead of only navigating to the issues
list.

**Step 2: Run test to verify it fails**

Run from `web`:

```powershell
npm run test -- src/App.test.jsx
```

Expected: FAIL because `SearchModal` currently calls `go("issues")` without
setting the selected issue.

**Step 3: Implement issue selection callback**

Thread `setIssue` from `App` into `Topbar`, then into `SearchModal`:

```jsx
<Topbar go={go} setIssue={setIssue} breadcrumbs={[...]} />
```

In `SearchModal`, update issue result clicks:

```jsx
onClick={() => {
  setIssue(issue);
  close();
  go("issue");
}}
```

Keep page and repository search behavior unchanged.

**Step 4: Run test to verify it passes**

Run from `web`:

```powershell
npm run test -- src/App.test.jsx
```

Expected: PASS.

**Step 5: Commit**

Commit in `web`:

```powershell
git add src/App.jsx src/shell.jsx src/App.test.jsx
git commit -m "fix: open issue details from search"
```

### Task 3: Make Scan Failure States Actionable

**Files:**
- Modify: `web/src/screens/flow.test.jsx`
- Modify: `web/src/screens/flow.jsx`
- Modify: `web/src/screens/billing.jsx` if quota navigation is needed

**Step 1: Write failing tests**

Add tests for these scan error messages:

- Review provider disabled.
- GitHub repositories need sync.
- Monthly review quota exceeded.
- CLI missing or unauthenticated provider error.

Assert that each state shows a user action such as `Open settings`, `Sync`,
`Open billing`, or `Retry`.

**Step 2: Run test to verify it fails**

Run from `web`:

```powershell
npm run test -- src/screens/flow.test.jsx
```

Expected: FAIL because scan errors are currently displayed as plain text.

**Step 3: Implement error classification**

Add a small helper in `flow.jsx`:

```js
function scanErrorAction(errorMessage) {
  const text = String(errorMessage || "").toLowerCase();
  if (text.includes("review provider") || text.includes("cli")) return { label: "Open settings", screen: "settings" };
  if (text.includes("sync github repositories")) return { label: "Sync repositories", screen: "repos" };
  if (text.includes("monthly review limit")) return { label: "Open billing", screen: "billing" };
  return { label: "Retry", screen: "repos" };
}
```

Render the action next to the existing error alert.

**Step 4: Run test to verify it passes**

Run from `web`:

```powershell
npm run test -- src/screens/flow.test.jsx
```

Expected: PASS.

**Step 5: Commit**

Commit in `web`:

```powershell
git add src/screens/flow.test.jsx src/screens/flow.jsx src/screens/billing.jsx
git commit -m "fix: add actionable scan errors"
```

### Task 4: Recover Interrupted Server Scans

**Files:**
- Create: `server/tests/test_scan_recovery.py`
- Modify: `server/pullwise_server/app.py`

**Step 1: Write failing tests**

Create tests for a new `recover_interrupted_scans()` function:

```python
def test_recover_interrupted_scans_requeues_running_scans(self):
    app.SCANS = [{
        "id": "sc_1",
        "status": "running",
        "progress": 44,
        "phase": "ai",
        "createdAt": app.now() - 60,
    }]

    recovered = app.recover_interrupted_scans()

    self.assertEqual(recovered, 1)
    self.assertEqual(app.SCANS[0]["status"], "queued")
    self.assertEqual(app.SCANS[0]["progress"], 0)
    self.assertIsNone(app.SCANS[0]["phase"])
    self.assertIn("recoveredAt", app.SCANS[0])
```

Also test that terminal scans stay unchanged.

**Step 2: Run test to verify it fails**

Run from `server`:

```powershell
python -m unittest tests.test_scan_recovery
```

Expected: FAIL because `recover_interrupted_scans()` does not exist.

**Step 3: Implement scan recovery**

In `app.py`, add:

```python
def recover_interrupted_scans() -> int:
    recovered = 0
    with STATE_LOCK:
        for scan in SCANS:
            if scan.get("status") != "running":
                continue
            scan["status"] = "queued"
            scan["progress"] = 0
            scan["phase"] = None
            scan["recoveredAt"] = now()
            scan["recoveryReason"] = "server_restart"
            recovered += 1
        if recovered:
            mark_state_dirty()
            persist_state()
    return recovered
```

Call it from `main()` after `ensure_state_loaded()` and before
`worker.ensure_workers()`. Log the recovered count when non-zero.

**Step 4: Run test to verify it passes**

Run from `server`:

```powershell
python -m unittest tests.test_scan_recovery
```

Expected: PASS.

**Step 5: Commit**

Commit in `server`:

```powershell
git add tests/test_scan_recovery.py pullwise_server/app.py
git commit -m "fix: recover interrupted scans on startup"
```

### Task 5: Add Safe Readiness Details

**Files:**
- Modify: `server/tests/test_configuration_contracts.py`
- Modify: `server/pullwise_server/app.py`
- Modify: `web/src/screens/status.test.jsx`
- Modify: `web/src/screens/legal.jsx`

**Step 1: Write failing backend test**

Add a test that `/health` exposes non-secret readiness fields:

```python
self.assertIn("reviewProvider", handler.payload)
self.assertIn("github", handler.payload)
self.assertIn("limits", handler.payload)
self.assertNotIn("secret", json.dumps(handler.payload).lower())
self.assertNotIn("privateKey", json.dumps(handler.payload))
```

**Step 2: Run backend test to verify it fails**

Run from `server`:

```powershell
python -m unittest tests.test_configuration_contracts
```

Expected: FAIL because `/health` does not include readiness details.

**Step 3: Implement health details**

Add a helper in `app.py`:

```python
def readiness_payload() -> dict:
    return {
        "reviewProvider": review.selected_provider(),
        "github": {
            "oauthConfigured": github_auth.oauth_configured(),
            "appInstallConfigured": github_auth.app_install_configured(),
            "appApiConfigured": github_auth.app_api_configured(),
            "appVisibilityCheck": github_auth.app_visibility_check_enabled(),
        },
        "billing": {"provider": billing.selected_provider(), "enabled": billing.billing_enabled()},
        "limits": {
            "maxConcurrentScans": env_int("PULLWISE_MAX_CONCURRENT_SCANS", 1),
            "maxConcurrentScansPerUser": env_int("PULLWISE_MAX_CONCURRENT_SCANS_PER_USER", 1),
            "rateLimitEnabled": rate_limit_enabled(),
        },
    }
```

Merge this into the existing `/health` response. Do not include secrets, full
private key paths, access tokens, session ids, or raw environment values.

**Step 4: Update status page tests**

Assert the status page can render readiness details when present and still works
when older health payloads omit them.

**Step 5: Run tests**

Run from each repo:

```powershell
python -m unittest tests.test_configuration_contracts
npm run test -- src/screens/status.test.jsx
```

Expected: PASS.

**Step 6: Commit**

Commit backend and frontend changes separately:

```powershell
git add tests/test_configuration_contracts.py pullwise_server/app.py
git commit -m "feat: expose safe readiness details"
```

```powershell
git add src/screens/status.test.jsx src/screens/legal.jsx
git commit -m "feat: show backend readiness status"
```

### Task 6: Make Local Verification Repeatable

**Files:**
- Modify: `server/tests/test_launcher_contracts.py`
- Modify: `server/README.md`
- Modify: `web/README.md`

**Step 1: Write failing test or reproduce current failure**

Run from `server`:

```powershell
python -m unittest tests.test_launcher_contracts
```

Current expected failure in this Windows workspace:

```text
cygpath: command not found
```

**Step 2: Implement safe skip for incompatible shell**

In `test_launcher_contracts.py`, replace direct `cygpath` failure with
`SkipTest` when `os.name == "nt"` and the available POSIX shell cannot provide
`cygpath`.

Use a helper:

```python
def require_shell_path_converter(shell: str) -> None:
    if os.name != "nt":
        return
    result = subprocess.run(
        [shell, "-lc", "command -v cygpath"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise unittest.SkipTest("launcher tests require cygpath on Windows")
```

Call it before using `cygpath`.

**Step 3: Document verification setup**

In `server/README.md`, document:

- `python -m pip install -e .` before tests.
- Windows launcher contract tests require a POSIX shell with `cygpath`, or they
  skip.

In `web/README.md`, document:

- `npm install` before `npm run check`.
- Missing `node_modules` means local setup is incomplete, not a product failure.

**Step 4: Run verification**

Run from `server`:

```powershell
python -m unittest discover -s tests
```

Expected: PASS or SKIP launcher tests with an explicit skip reason if `cygpath`
is unavailable.

Run from `web` after dependencies are installed:

```powershell
npm run check
```

Expected: PASS.

**Step 5: Commit**

Commit in each repo:

```powershell
git add tests/test_launcher_contracts.py README.md
git commit -m "test: make launcher contracts skip incompatible shells"
```

```powershell
git add README.md
git commit -m "docs: clarify frontend verification setup"
```

### Task 7: Production Documentation Cleanup

**Files:**
- Modify: `server/README.md`
- Modify: `web/README.md`
- Modify: `web/src/api/README.md`

**Step 1: Review implemented vs planned capabilities**

Search both repos:

```powershell
rg -n "not implemented|notifications|auto-fix|pull request|Slack|Linear|mock|synthetic|production" .
```

**Step 2: Update docs**

Make docs clear that Stage 1 implements:

- GitHub login.
- GitHub App repository authorization.
- Scans and history.
- Rich issue review and manual triage.
- Billing and status pages.

Make docs clear that Stage 2 does not yet implement:

- Applying fixes.
- Creating pull requests.
- Notifications.
- Slack/Linear writes.

Add a security note:

```text
If real GitHub OAuth secrets or GitHub App private keys were ever committed or
shared outside the local machine, rotate them in GitHub before production use.
```

Do not print real values.

**Step 3: Run docs-related checks**

Run from `web`:

```powershell
npm run lint
```

Run from `server`:

```powershell
python -m unittest discover -s tests
```

Expected: PASS or documented environment skip.

**Step 4: Commit**

Commit in each repo as needed:

```powershell
git add README.md src/api/README.md
git commit -m "docs: align production readiness scope"
```

```powershell
git add README.md
git commit -m "docs: align server production scope"
```

### Task 8: Final Verification And Product Smoke Test

**Files:**
- No code files unless verification exposes a bug.

**Step 1: Install dependencies if missing**

Run from `web`:

```powershell
npm install
```

Run from `server`:

```powershell
python -m pip install -e .
```

If network sandboxing blocks either command, rerun with approved escalation.

**Step 2: Run full checks**

Run from `web`:

```powershell
npm run check
```

Run from `server`:

```powershell
python -m unittest discover -s tests
```

Expected: PASS, except explicit documented skips for platform-specific launcher
contracts.

**Step 3: Start local services**

Run from `server`:

```powershell
python -m pullwise_server --host 127.0.0.1 --port 8080
```

Run from `web`:

```powershell
npm run dev
```

Expected:

- Server listens on `http://127.0.0.1:8080`.
- Web listens on `http://localhost:5173`.

**Step 4: Smoke product flows**

In the browser or with tests where available, verify:

- Landing page loads.
- Login error is actionable if GitHub OAuth is not configured.
- Repository authorization error is actionable if GitHub App is not configured.
- Scan creation error explains disabled provider or missing sync.
- Issue detail renders rich finding fields from test data.
- Billing page loads and handles disabled provider.
- Status page renders health and readiness.

**Step 5: Summarize remaining Stage 2 gaps**

Prepare a concise note listing:

- Auto-fix apply is still unimplemented.
- Pull request creation is still unimplemented.
- Notifications are still unimplemented.
- Slack/Linear writes are still unimplemented.
- Dedicated database tables and pagination remain future production scale work.
