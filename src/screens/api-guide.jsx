import { T } from "../i18n.jsx";
import { API_GUIDE_COPY } from "../locales/api-guide.js";

const text = (key) => T(API_GUIDE_COPY[key][0], API_GUIDE_COPY[key][1]);
const code = (title, value) => ({ title, code: value });
const paragraph = (key) => ({ text: key });

export function integrationSections(base) {
  return [
    { id: "quickstart", title: "quickstart", blocks: [
      paragraph("sharedApi"), paragraph("setup"), paragraph("key"),
      code("firstExpense", [
        "# Bash, curl, jq and openssl. Use a key from the same environment as this base.",
        "set -euo pipefail",
        `export PULLWISE_API_BASE='${base}'`,
        "export PULLWISE_API_KEY='PASTE_YOUR_ONE_TIME_KEY'",
        "api() { curl --fail-with-body --silent --show-error \\",
        '  "$PULLWISE_API_BASE$1" -H "Authorization: Bearer $PULLWISE_API_KEY" "${@:2}"; }',
        "",
        "api /api/v1/me | jq '{id, workspace, scopes}'",
        "api /api/v1/categories | jq '.[] | select(.archivedAt == null) | {id, name}'",
        "export CATEGORY_ID='PASTE_AN_ACTIVE_CATEGORY_ID_FROM_ABOVE'",
        "",
        "# One new intent gets one unique key. Keep it unchanged for a network retry.",
        'export IDEMPOTENCY_KEY="expense-$(date +%s)-$(openssl rand -hex 8)"',
        'BODY=$(jq -n --arg category "$CATEGORY_ID" \\',
        '  \'{target:{kind:"shared"},occurredOn:"2026-10-09",amount:"12.00",currency:"USD",categoryId:$category,purpose:"Hosting"}\')',
        'CREATED=$(api /api/v1/expenses -X POST -H "Content-Type: application/json" \\',
        '  -H "Idempotency-Key: $IDEMPOTENCY_KEY" --data "$BODY") || exit 1',
        'printf \'%s\\n\' "$CREATED" | jq .',
        'export EXPENSE_ID=$(printf \'%s\' "$CREATED" | jq -r .id)',
        'api "/api/v1/expenses/$EXPENSE_ID" | jq .',
        'api "/api/v1/reports/summary?target=shared&currency=USD" | jq .',
      ].join("\n")),
      paragraph("response"),
      code("responseExample", JSON.stringify({ id: "exp_example", target: { kind: "shared" }, occurredOn: "2026-10-09", amount: "12.00", currency: "USD", categoryId: "cat_example", purpose: "Hosting", amountMinor: 1200, revision: 1 }, null, 2)),
      paragraph("projectTarget"),
      code("projectExpense", 'api "/api/v1/projects?limit=50" | jq .\n# Replace only the target in the create body with a real project ID:\n# "target": {"kind":"project","projectId":"prj_FROM_PROJECTS_RESPONSE"}'),
    ]},
    { id: "environments", title: "environments", blocks: [paragraph("base"),
      code("directUrls", "Preview:    https://preview-api.pull-wise.com\nProduction: https://api.pull-wise.com\n\nGET <direct-base>/api/v1/me\nGET https://preview.pull-wise.com/api/api/v1/me"), paragraph("availability"), paragraph("cookies") ]},
    { id: "permissions", title: "permissions", blocks: [paragraph("authority"),
      { rows: [
        ["profile:read", "profileScope"], ["projects:read / projects:write", "projectScope"],
        ["categories:read / categories:write", "categoryScope"], ["expenses:read / expenses:write", "expenseScope"],
        ["reports:read", "reportScope"], ["members:read / members:write", "memberScope"],
        ["suggestions:use", "suggestionScope"],
      ]}, paragraph("memberKey"), paragraph("memberAuthority"), paragraph("workspace") ]},
    { id: "writes", title: "writes", blocks: [paragraph("revision"),
      code("editExpense", [
        'CURRENT=$(api "/api/v1/expenses/$EXPENSE_ID") || exit 1',
        'REVISION=$(printf \'%s\' "$CURRENT" | jq -r .revision)',
        "# Expense PATCH replaces the complete editable input, not just one field.",
        'EDIT=$(printf \'%s\' "$CURRENT" | jq \\',
        '  \'{target,occurredOn,amount,currency,categoryId,purpose:"Updated hosting",note,quantity,unit}\')',
        'api "/api/v1/expenses/$EXPENSE_ID" -X PATCH -H "Content-Type: application/json" \\',
        '  -H "If-Match: \\"$REVISION\\"" --data "$EDIT" | jq .',
        "",
        "# Removal is a separate, explicit operation using the latest revision.",
        'REVISION=$(api "/api/v1/expenses/$EXPENSE_ID" | jq -r .revision)',
        'api "/api/v1/expenses/$EXPENSE_ID" -X DELETE -H "If-Match: \\"$REVISION\\""',
      ].join("\n")), paragraph("idempotency"), paragraph("pagination"), paragraph("money"),
      code("csv", 'api "/api/v1/expenses/export?target=shared&from=2026-10-01&to=2026-11-01" > expenses.csv'),
    ]},
    { id: "project-management", title: "projectManagement", blocks: [paragraph("projectCrud"),
      code("projectCrudExample", [
        "# Use an Owner key with profile:read, projects:read and projects:write.",
        "export PULLWISE_API_KEY='PASTE_YOUR_PROJECT_MANAGEMENT_KEY'",
        'PROJECT=$(api /api/v1/projects -X POST -H "Content-Type: application/json" \\',
        '  --data \'{"name":"Website launch","description":"Launch costs"}\') || exit 1',
        'PROJECT_ID=$(printf \'%s\' "$PROJECT" | jq -r .id)',
        'REVISION=$(printf \'%s\' "$PROJECT" | jq -r .revision)',
        'api "/api/v1/projects/$PROJECT_ID" -X PATCH -H "Content-Type: application/json" \\',
        '  -H "If-Match: \\"$REVISION\\"" --data \'{"name":"Website launch v2","productUrl":"https://example.com"}\' | jq .',
        "# Archive is reversible: PATCH {\"status\":\"archived\"}; restore with active.",
        "# Owner-only removal is irreversible through this API; confirm intent first.",
        'REVISION=$(api "/api/v1/projects/$PROJECT_ID" | jq -r .revision)',
        'api "/api/v1/projects/$PROJECT_ID" -X DELETE -H "If-Match: \\"$REVISION\\""',
      ].join("\n")), paragraph("projectRemoval"), paragraph("categories") ]},
    { id: "recurring", title: "recurring", blocks: [paragraph("recurringBehavior"),
      code("createRecurring", [
        "# Use a key with expenses:read and expenses:write for this target.",
        "export PULLWISE_API_KEY='PASTE_YOUR_EXPENSE_MANAGEMENT_KEY'",
        'RULE_BODY=$(jq -n --arg category "$CATEGORY_ID" \\',
        '  \'{target:{kind:"shared"},amount:"12.00",currency:"USD",categoryId:$category,purpose:"Monthly hosting",',
        '    schedule:{frequency:"monthly",timezone:"Asia/Shanghai",startOn:"2026-11-01",day:1}}\')',
        'RULE_KEY="rule-$(date +%s)-$(openssl rand -hex 8)"',
        'RULE=$(api /api/v1/expense-recurring-rules -X POST -H "Content-Type: application/json" \\',
        '  -H "Idempotency-Key: $RULE_KEY" --data "$RULE_BODY") || exit 1',
        'RULE_ID=$(printf \'%s\' "$RULE" | jq -r .id)',
        'api "/api/v1/expense-recurring-rules?target=shared&limit=50" | jq .',
        "# For a project rule, replace target with {kind:project, projectId:...}.",
      ].join("\n")), paragraph("schedule"),
      code("manageRecurring", [
        'REVISION=$(api "/api/v1/expense-recurring-rules/$RULE_ID" | jq -r .revision)',
        'api "/api/v1/expense-recurring-rules/$RULE_ID" -X PATCH -H "Content-Type: application/json" \\',
        '  -H "If-Match: \\"$REVISION\\"" --data \'{"status":"paused"}\' | jq .',
        "# Read a fresh revision before each edit, resume or cancel.",
        "# Resume: PATCH {\"status\":\"active\"}.",
        "# Edit: PATCH the complete RULE_BODY (template + schedule); target is immutable.",
        'REVISION=$(api "/api/v1/expense-recurring-rules/$RULE_ID" | jq -r .revision)',
        'api "/api/v1/expense-recurring-rules/$RULE_ID" -X DELETE -H "If-Match: \\"$REVISION\\""',
      ].join("\n")), paragraph("recurringFailures"),
      code("manageRecurring", [
        "# Resolve capacity first, then select one retained historical occurrence.",
        'CURRENT=$(api "/api/v1/expense-recurring-rules/$RULE_ID") || exit 1',
        'printf \'%s\\n\' "$CURRENT" | jq .pendingOccurrences',
        "# Replace with an actual periodKey from that response, such as M2026-09.",
        "export RETRY_PERIOD_KEY='PASTE_RETAINED_PERIOD_KEY'",
        'REVISION=$(printf \'%s\' "$CURRENT" | jq -r .revision)',
        'RETRY_BODY=$(jq -n --arg period "$RETRY_PERIOD_KEY" \'{retryPeriodKey:$period}\')',
        'api "/api/v1/expense-recurring-rules/$RULE_ID" -X PATCH -H "Content-Type: application/json" \\',
        '  -H "If-Match: \\"$REVISION\\"" --data "$RETRY_BODY" | jq .',
        "# Each success creates a separate expense using the frozen occurrence values.",
        "# Re-read the current rule before another retry; no automatic write retry loop.",
      ].join("\n")), paragraph("recurringAuthority") ]},
    { id: "members", title: "members", blocks: [paragraph("memberManagement"),
      code("inviteMember", [
        "# Use an Owner/Admin whole-ledger key: profile:read, members:read, members:write.",
        "export PULLWISE_API_KEY='PASTE_YOUR_MEMBER_MANAGEMENT_KEY'",
        'WORKSPACE_ID=$(api /api/v1/me | jq -r .workspace.id)',
        'api "/api/v1/workspaces/$WORKSPACE_ID/members" | jq .',
        'INVITE=$(api "/api/v1/workspaces/$WORKSPACE_ID/invites" -X POST \\',
        '  -H "Content-Type: application/json" --data \'{"role":"editor"}\') || exit 1',
        'INVITE_ID=$(printf \'%s\' "$INVITE" | jq -r .id)',
        '# Give the applicant the one-time token from INVITE, in the Web invitation link.',
        'api "/api/v1/workspaces/$WORKSPACE_ID/invites/$INVITE_ID/requests" | jq .',
        "# After reading an actual pending applicant, set its id and revision:",
        "REQUEST_ID='PASTE_PENDING_REQUEST_ID'",
        "REQUEST_REVISION='PASTE_PENDING_REQUEST_REVISION'",
        'api "/api/v1/workspaces/$WORKSPACE_ID/invites/$INVITE_ID/requests/$REQUEST_ID/approve" \\',
        '  -X POST -H "Content-Type: application/json" -H "If-Match: \\"$REQUEST_REVISION\\"" --data \'{}\' | jq .',
        "# Reject uses the same request revision and /reject instead of /approve.",
      ].join("\n")), paragraph("joining"),
      code("editMember", [
        "USER_ID='PASTE_MEMBER_USER_ID'",
        'REVISION=$(api "/api/v1/workspaces/$WORKSPACE_ID/members" \\',
        '  | jq -r --arg id "$USER_ID" \'.items[] | select(.userId == $id) | .revision\')',
        'api "/api/v1/workspaces/$WORKSPACE_ID/members/$USER_ID" -X PATCH \\',
        '  -H "Content-Type: application/json" -H "If-Match: \\"$REVISION\\"" --data \'{"role":"viewer"}\' | jq .',
        "# Re-read member revision before DELETE; the Owner cannot be removed.",
        "# DELETE /api/v1/workspaces/$WORKSPACE_ID/members/$USER_ID",
        "# Revoke an invitation: DELETE /api/v1/workspaces/$WORKSPACE_ID/invites/$INVITE_ID",
        "# Both DELETE operations require the current record's quoted If-Match revision.",
      ].join("\n")) ]},
    { id: "activity", title: "activity", blocks: [paragraph("history"),
      code("historyExample", "# Use a key with expenses:read; include projects:read for project-setting history.\nexport PULLWISE_API_KEY='PASTE_YOUR_ACTIVITY_READ_KEY'\nexport ACTIVE_PROJECT_ID='PASTE_AN_ACTIVE_PROJECT_ID'\napi \"/api/v1/activity?target=shared&limit=50\" | jq .\napi \"/api/v1/activity?target=project&projectId=$ACTIVE_PROJECT_ID&limit=50\" | jq .") ]},
    { id: "expense-retention", title: "retentionTitle", blocks: [
      paragraph("expenseRetention"), paragraph("retentionAuthority"), paragraph("retentionAccount"),
      code("retentionTitle", [
        "# Use your authenticated browser session, never a Bearer key.",
        "# Keep the session cookie in a protected curl cookie-jar file.",
        "export PULLWISE_COOKIE_JAR='/path/to/your/protected-cookie-jar'",
        `export PULLWISE_APP_ORIGIN='${base.includes("preview") ? "https://preview.pull-wise.com" : "https://pull-wise.com"}'`,
        'PREFERENCE=$(curl --fail-with-body --silent --show-error \\',
        '  "$PULLWISE_API_BASE/api/v1/account/expense-retention" -b "$PULLWISE_COOKIE_JAR") || exit 1',
        'REVISION=$(printf \'%s\' "$PREFERENCE" | jq -r .revision)',
        "# This explicit choice affects future creates; it removes nothing immediately.",
        'curl --fail-with-body --silent --show-error -X PATCH \\',
        '  "$PULLWISE_API_BASE/api/v1/account/expense-retention" -b "$PULLWISE_COOKIE_JAR" \\',
        '  -H "Origin: $PULLWISE_APP_ORIGIN" -H "Content-Type: application/json" \\',
        '  -H "If-Match: \\"$REVISION\\"" --data \'{"autoRemoveOldestExpense":true}\' | jq .',
        '# Disable with {"autoRemoveOldestExpense":false}, using a fresh revision.',
      ].join("\n")),
    ]},
    { id: "troubleshooting", title: "troubleshooting", blocks: [paragraph("errors"),
      code("errorExample", '{"error":{"code":"CATEGORY_REQUIRED"}}'),
      { rows: [["401", "error401"], ["403", "error403"], ["409", "error409"], ["412 / 428", "error412"], ["422", "error422"], ["429", "error429"], ["502 / 503", "error503"]] },
      paragraph("limits") ]},
  ];
}

export function ApiIntegrationGuide({ base, ids }) {
  return integrationSections(base).filter(section => !ids || ids.includes(section.id)).map(section => (
    <section key={section.id} className="docs-section">
      <h2 id={section.id} className="docs-h2">{text(section.title)}</h2>
      {section.blocks.map((block, index) => block.text ? <p key={index}>{text(block.text)}</p> : block.rows ? (
        <div key={index} className="docs-table">{block.rows.map(([label, key]) => <div key={label} className="docs-table-r"><b>{label}</b><span>{text(key)}</span></div>)}</div>
      ) : (
        <div key={index} className="docs-code"><div className="docs-code-h"><span>{text(block.title)}</span></div><pre>{block.code}</pre></div>
      ))}
    </section>
  ));
}

export function integrationMarkdown(base, ids) {
  return integrationSections(base).filter(section => !ids || ids.includes(section.id)).flatMap(section => [
    `## ${text(section.title)}`, "", ...section.blocks.flatMap(block => block.text ? [text(block.text), ""] : block.rows ? block.rows.map(([label, key]) => `- ${label}: ${text(key)}`) : [`### ${text(block.title)}`, "```", block.code, "```", ""]),
  ]).join("\n");
}
