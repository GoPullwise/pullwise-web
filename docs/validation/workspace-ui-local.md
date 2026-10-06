# Shared-ledger Web local browser evidence

Updated 2026-10-06. Companion to [current acceptance](local-acceptance.md).
This evidence covers the new multi-repository, GitHub Organization and shared
ledger UI. It does not establish real GitHub grants, invitations between real
accounts, payment/provider behavior or authenticated preview acceptance.

## Source checks

The complete Web check passed ESLint, 36 test files / 418 tests and the Vite
build; the offline Workers configuration check passed. After the browser-found
CSS repairs, the relevant five UI test files / 159 tests, ESLint, Workers
configuration check and final build passed. The final browser run used the
stable build completed at 09:05:04 UTC; no build ran during capture.

Focused regressions cover repository binding occupancy and pagination recovery,
actual-actor repository metadata, role-based controls, protected data and draft
isolation on workspace changes, API-key workspace/member-revision restrictions,
and invitation lifecycle races. A deleted invitation's `WORKSPACE_NOT_FOUND`
response stays local to that invitation; it does not invalidate a separately
valid selected workspace or repeat the preview POST.

## Actual Chromium cases

Headless system Chromium executed the built JavaScript with native controls at
1440px desktop and 390px touch. Every request was intercepted: static responses
came from `dist`, account/ledger responses were synthetic local fixtures, and
external font requests were aborted. No request was forwarded to a remote
server or provider. Service workers were blocked. Each case had a 150-request
limit, explicit 30-second readiness expectations and a finite interaction list.

| Scenario | Verified interactions |
| --- | --- |
| Project | Select actual-actor Organization metadata and two repositories; create a named finance project; rename it with `If-Match`. |
| Workspace switch | Open a personal expense draft, switch to a Viewer ledger, remove the previous private record/draft, hide expense writes and create a read-only key bound to the selected workspace and membership revision. |
| Invitation creation | Create one invitation, display its new token link once and retain that link through the same-workspace metadata refresh. |
| Invitation acceptance | Preview once, explicitly accept once, switch to the accepted ledger and clear the completed invitation hash. |
| Recipient mismatch | Display the local 403, omit acceptance and keep the existing workspace usable without another preview POST. |
| Deleted invitation | Display the local 404, omit acceptance and keep the existing workspace usable without another preview POST. |

The first closed cycle completed all six scenarios on both viewports: **12
functional cases**, 362 locally routed requests, 138 fixture API requests and
zero page errors. Subsequent screenshot review found two real mobile layout
failures in Project settings and invitation creation: showing Back to top made
the document 414px wide despite a configured 390px viewport. The initial
`documentWidth <= innerWidth` assertion incorrectly accepted the expanded layout;
the preserved result records therefore mark these two layout cases as failures.
The remaining ten layout cases passed.

Finite intercepted diagnostics identified three connected CSS issues. The
Topbar action group could not shrink; the workspace picker retained a minimum
width; and ledger form styles leaked into the shared Header/Sidebar. These rules
were repaired at their owning locations. The Sidebar now uses the measured
Header height instead of a fixed offset, so the mobile two-row Header no longer
covers navigation. Overflow was resolved without hiding horizontal content.

The final cycle repeated the six affected phone flows and one desktop Project
smoke case: **7/7 functional and layout cases passed**, using 224 locally routed
requests and 93 fixture API requests, with zero page errors or remote forwards.
The largest case used 43 routed requests. Assertions now compare configured
width, document client width and `visualViewport.width`, require document width
within one pixel of that configured width, and require Sidebar top to remain
below Header bottom. All phone widths were 390px; desktop widths were 1440px.

Native taps and center-point hit checks confirmed that the Ledger picker and
mobile account/tools selector remained operable. Back to top was actually
visible on the longer phone pages while these checks ran; short pages could
not scroll far enough and do not claim that state. Phone cases confirmed coarse
pointer media and one touch point before and after screenshots, restoring touch
events after Chromium capture. Project and Members phone images and the desktop
Project image were visually reviewed for readable fields and navigation. The
Viewer API Keys page's Ledger select measured 27px high; the other final phone
routes measured 44px. The run establishes native operability, not a universal
44px-target audit.

Across the two closed acceptance cycles there were 586 locally routed requests
and 231 fixture API requests. Separate targeted diagnostics were also fully
intercepted; their measurements are diagnostic evidence, not additional accepted
user journeys. Browser contexts/processes were closed. No Vite proxy, loopback
HTTP server, OAuth popup or provider request was used in these two cycles.

## Artifact identity and retained evidence

The final build's relevant assets and SHA-256 values are:

| Asset | SHA-256 |
| --- | --- |
| `index-D2iP-fc1.js` | `621379ba4bf58903a0b482ff0e4eb2ae3498333e673241ce6375f0e2df8207f0` |
| `index-5eu4-MCJ.css` | `ad31be41b1f24d387397b51034b2ec689714484ba8d3af02797ca23e13e9daa6` |
| `ledger-IFEmUSMo.js` | `386a400631d178d8dad93dca73257a17fd45ec7fc918100b65c14c25bdac634f` |
| `ledger-BZBu9qAp.css` | `db25eb464b29a8a3f4eb9827aea14448831fc09040fcbd90a18e01985a8541d9` |

Private generated evidence remains outside the repository:

- `/tmp/pullwise-workspaces-ui-audit/results.json`: first 12-case cycle, retaining the two layout failures and corrected harness boundary.
- `/tmp/pullwise-workspaces-ui-audit/css-final-results.json`: final seven cases, widths, hit checks, touch state and complete asset hashes.
- `/tmp/pullwise-workspaces-ui-audit/project-390.png` and `invite-390.png`: pre-repair captures.
- `/tmp/pullwise-workspaces-ui-audit/css-final-project-390.png`, `css-final-invite-390.png` and `css-final-project-1440.png`: reviewed final captures.
- `/tmp/pullwise-workspaces-overflow-probe/`: finite scrolled-layout measurements and injected-CSS diagnostic captures.

Earlier original-version authenticated REST/model evidence belongs to its own
release phase. It is not evidence that this version's four roles were exercised
between real GitHub accounts. Preview publication and any finite remote browser
checks must be recorded separately with their actual scope.
