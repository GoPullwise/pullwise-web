import { useState } from "react";
import apiContract from "../data/api-contract.json";
import { T, useLang } from "../i18n.jsx";

const METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options", "trace"]);
const STRUCTURAL_KEYS = new Set([
  "$ref",
  "type",
  "title",
  "description",
  "properties",
  "items",
  "prefixItems",
  "additionalProperties",
  "patternProperties",
  "$defs",
  "definitions",
  "oneOf",
  "anyOf",
  "allOf",
  "not",
  "if",
  "then",
  "else",
  "dependentSchemas",
  "required",
]);

const COPY = {
  reference: [
    "Complete API reference",
    {
      zh: "完整 API 参考",
      ja: "API リファレンス全体",
      ko: "전체 API 참조",
      fr: "Référence API complète",
      es: "Referencia completa de la API",
    },
  ],
  introduction: [
    "Expand an endpoint to see its authentication, parameters, request fields and every documented response. Field names and the formal contract descriptions are in English.",
    {
      zh: "展开接口可查看认证方式、参数、请求字段及所有已定义响应。字段名和正式契约说明使用英文。",
      ja: "各エンドポイントを開くと、認証、パラメーター、リクエスト項目と定義済みの全レスポンスを確認できます。項目名と正式な仕様説明は英語です。",
      ko: "엔드포인트를 펼치면 인증, 매개변수, 요청 필드 및 정의된 모든 응답을 확인할 수 있습니다. 필드 이름과 공식 계약 설명은 영어입니다.",
      fr: "Développez un endpoint pour voir son authentification, ses paramètres, ses champs et toutes les réponses documentées. Les noms des champs et la description du contrat sont en anglais.",
      es: "Abre un endpoint para ver su autenticación, parámetros, campos y todas las respuestas documentadas. Los nombres de los campos y las descripciones del contrato están en inglés.",
    },
  ],
  download: [
    "Download OpenAPI JSON",
    {
      zh: "下载 OpenAPI JSON",
      ja: "OpenAPI JSON をダウンロード",
      ko: "OpenAPI JSON 다운로드",
      fr: "Télécharger le JSON OpenAPI",
      es: "Descargar OpenAPI JSON",
    },
  ],
  auth: [
    "Authentication",
    { zh: "认证", ja: "認証", ko: "인증", fr: "Authentification", es: "Autenticación" },
  ],
  scope: [
    "Required scope",
    {
      zh: "所需权限",
      ja: "必要なスコープ",
      ko: "필수 범위",
      fr: "Permission requise",
      es: "Permiso necesario",
    },
  ],
  parameters: [
    "Parameters",
    { zh: "参数", ja: "パラメーター", ko: "매개변수", fr: "Paramètres", es: "Parámetros" },
  ],
  request: [
    "Request body",
    {
      zh: "请求体",
      ja: "リクエスト本文",
      ko: "요청 본문",
      fr: "Corps de la requête",
      es: "Cuerpo de la solicitud",
    },
  ],
  responses: [
    "Responses",
    { zh: "响应", ja: "レスポンス", ko: "응답", fr: "Réponses", es: "Respuestas" },
  ],
  headers: [
    "Response headers",
    {
      zh: "响应头",
      ja: "レスポンスヘッダー",
      ko: "응답 헤더",
      fr: "En-têtes de réponse",
      es: "Cabeceras de respuesta",
    },
  ],
  field: ["Field", { zh: "字段", ja: "項目", ko: "필드", fr: "Champ", es: "Campo" }],
  constraints: [
    "Type and constraints",
    {
      zh: "类型与约束",
      ja: "型と制約",
      ko: "유형 및 제약",
      fr: "Type et contraintes",
      es: "Tipo y restricciones",
    },
  ],
  description: [
    "Description",
    { zh: "说明", ja: "説明", ko: "설명", fr: "Description", es: "Descripción" },
  ],
  required: [
    "Required",
    { zh: "必填", ja: "必須", ko: "필수", fr: "Obligatoire", es: "Obligatorio" },
  ],
  optional: [
    "Optional",
    { zh: "可选", ja: "任意", ko: "선택 사항", fr: "Facultatif", es: "Opcional" },
  ],
  none: [
    "None documented",
    {
      zh: "未定义",
      ja: "定義なし",
      ko: "정의 없음",
      fr: "Aucun élément documenté",
      es: "Ninguno documentado",
    },
  ],
  noBody: [
    "No response body documented",
    {
      zh: "未定义响应体",
      ja: "レスポンス本文の定義なし",
      ko: "정의된 응답 본문 없음",
      fr: "Aucun corps de réponse documenté",
      es: "No se documenta un cuerpo de respuesta",
    },
  ],
  resolved: [
    "Resolved schema (JSON)",
    {
      zh: "已解析引用的 Schema（JSON）",
      ja: "参照解決済みスキーマ（JSON）",
      ko: "참조가 해석된 스키마 (JSON)",
      fr: "Schéma résolu (JSON)",
      es: "Esquema resuelto (JSON)",
    },
  ],
  deprecated: [
    "Deprecated endpoint",
    {
      zh: "已弃用接口",
      ja: "非推奨のエンドポイント",
      ko: "사용 중단 예정 엔드포인트",
      fr: "Endpoint obsolète",
      es: "Endpoint obsoleto",
    },
  ],
  groups: {
    Authentication: {
      zh: "账户认证",
      ja: "アカウント認証",
      ko: "계정 인증",
      fr: "Authentification du compte",
      es: "Autenticación de la cuenta",
    },
    "Workspaces and members": {
      zh: "账本与成员",
      ja: "台帳とメンバー",
      ko: "원장 및 구성원",
      fr: "Registres et membres",
      es: "Libros y miembros",
    },
    "Recurring expenses": {
      zh: "周期支出",
      ja: "定期支出",
      ko: "반복 지출",
      fr: "Dépenses récurrentes",
      es: "Gastos recurrentes",
    },
    "Operation history": {
      zh: "操作历史",
      ja: "操作履歴",
      ko: "작업 이력",
      fr: "Historique des opérations",
      es: "Historial de operaciones",
    },
    "Expense suggestions": {
      zh: "支出建议",
      ja: "支出の提案",
      ko: "지출 제안",
      fr: "Suggestions de dépenses",
      es: "Sugerencias de gastos",
    },
    Reports: { zh: "报表", ja: "レポート", ko: "보고서", fr: "Rapports", es: "Informes" },
    Categories: {
      zh: "类别",
      ja: "カテゴリー",
      ko: "카테고리",
      fr: "Catégories",
      es: "Categorías",
    },
    Expenses: { zh: "支出", ja: "支出", ko: "지출", fr: "Dépenses", es: "Gastos" },
    "Projects and repositories": {
      zh: "项目与仓库",
      ja: "プロジェクトとリポジトリ",
      ko: "프로젝트 및 저장소",
      fr: "Projets et dépôts",
      es: "Proyectos y repositorios",
    },
    Account: { zh: "账户", ja: "アカウント", ko: "계정", fr: "Compte", es: "Cuenta" },
    Ledger: { zh: "账本", ja: "台帳", ko: "원장", fr: "Registre", es: "Libro" },
  },
};

function copy(key) {
  return T(...COPY[key]);
}

function resolve(node, document, seen = new Set()) {
  if (!node || typeof node !== "object" || !node.$ref) return node;
  const reference = node.$ref;
  if (seen.has(reference))
    return { description: `Recursive schema: ${reference.split("/").at(-1)}` };
  if (!reference.startsWith("#/")) return { description: `External schema: ${reference}` };
  const target = reference
    .slice(2)
    .split("/")
    .reduce((value, part) => {
      const key = decodeURIComponent(part).replace(/~1/g, "/").replace(/~0/g, "~");
      return value?.[key];
    }, document);
  if (target === undefined)
    return { description: `Unresolved schema: ${reference.split("/").at(-1)}` };
  const siblings = Object.fromEntries(Object.entries(node).filter(([key]) => key !== "$ref"));
  return { ...resolve(target, document, new Set([...seen, reference])), ...siblings };
}

function resolvedTree(node, document, seen = new Set()) {
  if (Array.isArray(node)) return node.map((item) => resolvedTree(item, document, seen));
  if (!node || typeof node !== "object") return node;
  if (node.$ref && seen.has(node.$ref))
    return { description: `Recursive schema: ${node.$ref.split("/").at(-1)}` };
  const nextSeen = node.$ref ? new Set([...seen, node.$ref]) : seen;
  const value = resolve(node, document);
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, resolvedTree(item, document, nextSeen)])
  );
}

function constraints(schema) {
  if (schema === true) return "any value";
  if (schema === false) return "disallowed";
  const type = Array.isArray(schema?.type)
    ? schema.type.join(" | ")
    : schema?.type || (schema?.properties ? "object" : "schema");
  const extra = Object.entries(schema || {})
    .filter(([key]) => !STRUCTURAL_KEYS.has(key))
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  if (schema?.required?.length) extra.push(`required fields: ${schema.required.join(", ")}`);
  if (schema?.additionalProperties === false) extra.push("additionalProperties: false");
  if (schema?.additionalProperties === true) extra.push("additionalProperties: true");
  return [type, ...extra].join("; ");
}

function schemaRows(schema, document, field = "$", required = false, seen = new Set()) {
  if (schema === undefined) return [];
  const reference = schema?.$ref;
  const value = resolve(schema, document, seen);
  const rows = [
    {
      field,
      required,
      constraints: constraints(value),
      description: value?.description || value?.title || "",
    },
  ];
  if (reference && seen.has(reference)) return rows;
  const nextSeen = reference ? new Set([...seen, reference]) : seen;
  for (const [key, child] of Object.entries(value?.properties || {})) {
    rows.push(
      ...schemaRows(
        child,
        document,
        field === "$" ? key : `${field}.${key}`,
        value.required?.includes(key),
        nextSeen
      )
    );
  }
  if (value?.items !== undefined)
    rows.push(...schemaRows(value.items, document, `${field}[]`, false, nextSeen));
  for (const [index, child] of (value?.prefixItems || []).entries())
    rows.push(...schemaRows(child, document, `${field}[${index}]`, false, nextSeen));
  for (const keyword of ["oneOf", "anyOf", "allOf"]) {
    for (const [index, child] of (value?.[keyword] || []).entries()) {
      rows.push(
        ...schemaRows(child, document, `${field} (${keyword} ${index + 1})`, required, nextSeen)
      );
    }
  }
  for (const keyword of ["not", "if", "then", "else"]) {
    if (value?.[keyword])
      rows.push(...schemaRows(value[keyword], document, `${field} (${keyword})`, false, nextSeen));
  }
  for (const keyword of ["additionalProperties", "patternProperties", "dependentSchemas"]) {
    if (value?.[keyword] && typeof value[keyword] === "object") {
      if (keyword === "additionalProperties")
        rows.push(...schemaRows(value[keyword], document, `${field}.*`, false, nextSeen));
      else
        for (const [key, child] of Object.entries(value[keyword]))
          rows.push(
            ...schemaRows(child, document, `${field} (${keyword}: ${key})`, false, nextSeen)
          );
    }
  }
  return rows;
}

function operations(document) {
  return Object.entries(document.paths || {}).flatMap(([path, item]) =>
    Object.entries(resolve(item, document))
      .filter(([method]) => METHODS.has(method))
      .map(([method, operation]) => ({
        path,
        method: method.toUpperCase(),
        item,
        operation: resolve(operation, document),
      }))
  );
}

function parametersFor(item, operation, document) {
  const combined = new Map();
  for (const parameter of [...(item.parameters || []), ...(operation.parameters || [])]) {
    const resolved = resolve(parameter, document);
    combined.set(`${resolved.in}:${resolved.name}`, resolved);
  }
  return [...combined.values()];
}

function authentication(operation, document) {
  const security = operation.security ?? document.security ?? [];
  if (!security.length)
    return "No unconditional security scheme; follow the session, browser-proof and Origin requirements in the endpoint description.";
  return security
    .map((requirement) => {
      if (!Object.keys(requirement).length) return "Unauthenticated";
      return Object.entries(requirement)
        .map(([name, scopes]) => {
          const scheme = resolve(document.components?.securitySchemes?.[name], document);
          const label =
            scheme?.type === "http" && scheme.scheme === "bearer"
              ? `Bearer API key (Authorization: Bearer <key>)${scheme.bearerFormat ? `; ${scheme.bearerFormat}` : ""}`
              : scheme?.type === "apiKey" && scheme.in === "cookie"
                ? `Cookie session (${scheme.name})`
                : `${name}${scheme?.description ? `: ${scheme.description}` : ""}`;
          return `${label}${scopes.length ? `; scopes: ${scopes.join(", ")}` : ""}`;
        })
        .join(" AND ");
    })
    .join(" OR ");
}

function groupName(path, operation) {
  if (path.startsWith("/auth/")) return "Authentication";
  if (/\/workspace(?:s|-invitation)/.test(path)) return "Workspaces and members";
  if (path.includes("/expense-recurring-rules")) return "Recurring expenses";
  if (path.includes("/activity")) return "Operation history";
  if (path.includes("/expense-suggestions")) return "Expense suggestions";
  if (path.includes("/reports")) return "Reports";
  if (path.includes("/categories")) return "Categories";
  if (path.includes("/expenses")) return "Expenses";
  if (path.includes("/projects") || path.includes("/repositories"))
    return "Projects and repositories";
  return operation.tags?.[0] || "Account";
}

function FieldsTable({ rows }) {
  if (!rows.length) return <p>{copy("none")}</p>;
  return (
    <div className="api-reference-table-wrap">
      <table className="api-reference-table">
        <thead>
          <tr>
            <th>{copy("field")}</th>
            <th>{copy("constraints")}</th>
            <th>{copy("description")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.field}-${index}`}>
              <td>
                <code>{row.field}</code>
                {row.required && <span className="docs-scope">{copy("required")}</span>}
              </td>
              <td>
                <code>{row.constraints}</code>
              </td>
              <td lang="en">{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Schema({ schema, document }) {
  const [showJson, setShowJson] = useState(false);
  return (
    <>
      <FieldsTable rows={schemaRows(schema, document)} />
      <details
        className="api-reference-schema"
        onToggle={(event) => {
          if (event.target === event.currentTarget) setShowJson(event.currentTarget.open);
        }}
      >
        <summary>{copy("resolved")}</summary>
        {showJson && <pre lang="en">{JSON.stringify(resolvedTree(schema, document), null, 2)}</pre>}
      </details>
    </>
  );
}

function Content({ content, document }) {
  return Object.entries(content || {}).map(([mediaType, media]) => (
    <div key={mediaType}>
      <p>
        <code>{mediaType}</code>
      </p>
      {media.schema !== undefined && <Schema schema={media.schema} document={document} />}
      {media.example !== undefined && <pre>{JSON.stringify(media.example, null, 2)}</pre>}
      {media.examples && (
        <pre>{JSON.stringify(resolvedTree(media.examples, document), null, 2)}</pre>
      )}
    </div>
  ));
}

function Endpoint({ entry, document }) {
  const [open, setOpen] = useState(false);
  const { method, path, item, operation } = entry;
  const parameters = parametersFor(item, operation, document);
  const request = resolve(operation.requestBody, document);
  return (
    <details
      className="docs-endpoint-card api-reference-endpoint"
      onToggle={(event) => {
        if (event.target === event.currentTarget) setOpen(event.currentTarget.open);
      }}
    >
      <summary className="docs-endpoint-card-h">
        <span className="docs-method">{method}</span>
        <code>{path}</code>
        <span className="api-reference-disclosure" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </summary>
      {open && (
        <div className="api-reference-content">
          {operation.operationId && (
            <p>
              <code>{operation.operationId}</code>
            </p>
          )}
          {operation.summary && <p lang="en">{operation.summary}</p>}
          {operation.description && (
            <p lang="en" className="api-reference-description">
              {operation.description}
            </p>
          )}
          <h4>{copy("auth")}</h4>
          <p lang="en">{authentication(operation, document)}</p>
          {operation["x-pullwise-scope"] && (
            <p>
              {copy("scope")}: <code>{operation["x-pullwise-scope"]}</code>
            </p>
          )}
          {operation.deprecated && <p>{copy("deprecated")}</p>}
          <h4>{copy("parameters")}</h4>
          <FieldsTable
            rows={parameters.flatMap((parameter) => {
              const rows = schemaRows(
                parameter.schema,
                document,
                `${parameter.in}: ${parameter.name}`,
                parameter.required
              );
              if (!rows.length)
                rows.push({
                  field: `${parameter.in}: ${parameter.name}`,
                  required: parameter.required,
                  constraints: "",
                  description: "",
                });
              rows[0].description = [parameter.description, rows[0].description]
                .filter(Boolean)
                .join(" ");
              return rows;
            })}
          />
          {request && (
            <>
              <h4>
                {copy("request")} · {request.required ? copy("required") : copy("optional")}
              </h4>
              {request.description && <p lang="en">{request.description}</p>}
              <Content content={request.content} document={document} />
            </>
          )}
          <h4>{copy("responses")}</h4>
          {Object.entries(operation.responses || {}).map(([status, value]) => {
            const response = resolve(value, document);
            return (
              <section key={status} className="api-reference-response">
                <h5>
                  <code>{status}</code>
                </h5>
                <p lang="en">{response.description}</p>
                {response.headers && (
                  <>
                    <h5>{copy("headers")}</h5>
                    <FieldsTable
                      rows={Object.entries(response.headers).flatMap(([name, header]) => {
                        const resolved = resolve(header, document);
                        const rows = schemaRows(resolved.schema, document, name, resolved.required);
                        if (!rows.length)
                          rows.push({ field: name, constraints: "", description: "" });
                        rows[0].description = [resolved.description, rows[0].description]
                          .filter(Boolean)
                          .join(" ");
                        return rows;
                      })}
                    />
                  </>
                )}
                {response.content ? (
                  <Content content={response.content} document={document} />
                ) : (
                  <p>{copy("noBody")}</p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </details>
  );
}

export function ApiReference({ contract = apiContract }) {
  useLang();
  const groups = new Map();
  for (const entry of operations(contract)) {
    const name = groupName(entry.path, entry.operation);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(entry);
  }
  return (
    <section className="api-reference">
      <h2 id="reference" className="docs-h2">
        {copy("reference")}
      </h2>
      <p>{copy("introduction")}</p>
      <p>
        <a className="auth-link" href="/openapi/ledger-v1.json" download="pullwise-ledger-v1.json">
          {copy("download")}
        </a>{" "}
        · OpenAPI {contract.openapi} · v{contract.info?.version}
      </p>
      {[...groups.entries()].map(([name, entries]) => (
        <section key={name} className="api-reference-group">
          <h3>
            {T(name, COPY.groups[name])} <span className="muted">({entries.length})</span>
          </h3>
          <div className="docs-endpoint-list">
            {entries.map((entry) => (
              <Endpoint key={`${entry.method}:${entry.path}`} entry={entry} document={contract} />
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}

function schemaMarkdown(schema, document) {
  return ["```json", JSON.stringify(resolvedTree(schema, document), null, 2), "```"].join("\n");
}

export function referenceMarkdown(document = apiContract) {
  const lines = [
    "## Complete API reference",
    "",
    `OpenAPI ${document.openapi}; contract version ${document.info?.version}.`,
    "",
    "Download the machine-readable contract: /openapi/ledger-v1.json",
    "",
    document.info?.description || "",
    "",
  ];
  for (const { path, method, item, operation } of operations(document)) {
    lines.push(
      `### ${method} ${path}`,
      "",
      operation.summary || "",
      operation.description || "",
      `Authentication: ${authentication(operation, document)}`,
      `Scope: ${operation["x-pullwise-scope"] || "See endpoint conditions"}`,
      ""
    );
    const parameters = parametersFor(item, operation, document);
    if (parameters.length) {
      lines.push("#### Parameters", "");
      for (const parameter of parameters) {
        lines.push(
          `- ${parameter.in}: ${parameter.name} (${parameter.required ? "required" : "optional"})`,
          parameter.description || ""
        );
        if (parameter.schema !== undefined) lines.push(schemaMarkdown(parameter.schema, document));
      }
      lines.push("");
    }
    const request = resolve(operation.requestBody, document);
    if (request) {
      lines.push(
        `#### Request body (${request.required ? "required" : "optional"})`,
        request.description || "",
        ""
      );
      for (const [type, media] of Object.entries(request.content || {})) {
        lines.push(type);
        if (media.schema !== undefined) lines.push(schemaMarkdown(media.schema, document));
        if (media.example !== undefined)
          lines.push("Example:", schemaMarkdown(media.example, document));
        if (media.examples) lines.push("Examples:", schemaMarkdown(media.examples, document));
      }
      lines.push("");
    }
    lines.push("#### Responses", "");
    for (const [status, value] of Object.entries(operation.responses || {})) {
      const response = resolve(value, document);
      lines.push(`**${status}**: ${response.description}`, "");
      for (const [name, header] of Object.entries(response.headers || {})) {
        const resolved = resolve(header, document);
        lines.push(`Header ${name}: ${resolved.description || ""}`);
        if (resolved.schema !== undefined) lines.push(schemaMarkdown(resolved.schema, document));
      }
      for (const [type, media] of Object.entries(response.content || {})) {
        lines.push(type);
        if (media.schema !== undefined) lines.push(schemaMarkdown(media.schema, document));
        if (media.example !== undefined)
          lines.push("Example:", schemaMarkdown(media.example, document));
        if (media.examples) lines.push("Examples:", schemaMarkdown(media.examples, document));
      }
      if (!response.content) lines.push("No response body documented.");
      lines.push("");
    }
  }
  return lines.join("\n");
}
