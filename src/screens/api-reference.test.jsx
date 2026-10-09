import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import apiContract from "../data/api-contract.json";
import { setLang } from "../i18n.jsx";
import { ApiReference, referenceMarkdown } from "./api-reference.jsx";

const METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options", "trace"]);

async function openEndpoint(path, method = "GET") {
  const summary = [...document.querySelectorAll("summary")].find(
    (item) =>
      item.querySelector(".docs-method")?.textContent === method &&
      item.querySelector("code")?.textContent === path
  );
  expect(summary).toBeTruthy();
  const details = summary.closest("details");
  details.open = true;
  fireEvent(details, new Event("toggle"));
  await waitFor(() =>
    expect(within(details).getByRole("heading", { name: "Authentication" })).toBeInTheDocument()
  );
  return details;
}

const fixture = {
  openapi: "3.1.0",
  info: { version: "test", description: "Reference fixture" },
  security: [{ cookieSession: [] }, { bearerKey: [] }],
  components: {
    securitySchemes: {
      cookieSession: { type: "apiKey", in: "cookie", name: "pw_session" },
      bearerKey: { type: "http", scheme: "bearer", bearerFormat: "pwk_ API key" },
    },
    parameters: {
      Id: {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^[a-z]+$" },
      },
      Page: {
        name: "limit",
        in: "query",
        schema: { type: "integer", minimum: 1, maximum: 100, default: 50 },
      },
    },
    schemas: {
      Input: {
        type: "object",
        additionalProperties: false,
        required: ["amount", "target"],
        properties: {
          amount: { type: "string", pattern: "^[0-9]+$", description: "Exact amount" },
          target: {
            oneOf: [
              { type: "object", required: ["kind"], properties: { kind: { const: "shared" } } },
              { type: "null" },
            ],
          },
        },
      },
      Result: {
        allOf: [
          { $ref: "#/components/schemas/Input" },
          {
            type: "object",
            required: ["revision"],
            properties: { revision: { type: "integer", minimum: 1 } },
          },
        ],
      },
      Recursive: {
        type: "object",
        properties: { child: { $ref: "#/components/schemas/Recursive" } },
      },
    },
    responses: {
      Rejected: {
        description: "Target denied",
        content: {
          "application/json": {
            schema: { type: "object", properties: { code: { const: "TARGET_DENIED" } } },
          },
        },
      },
    },
    headers: {
      RetryAfter: { description: "Delay in seconds", schema: { type: "integer", minimum: 1 } },
    },
  },
  paths: {
    "/api/v1/expenses/{id}": {
      parameters: [{ $ref: "#/components/parameters/Id" }],
      get: {
        operationId: "getFixtureExpense",
        "x-pullwise-scope": "expenses:read",
        description: "Read fixture expense",
        parameters: [{ $ref: "#/components/parameters/Page" }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/Input" } } },
        },
        responses: {
          200: {
            description: "Expense returned",
            headers: { "Retry-After": { $ref: "#/components/headers/RetryAfter" } },
            content: { "application/json": { schema: { $ref: "#/components/schemas/Result" } } },
          },
          403: { $ref: "#/components/responses/Rejected" },
          204: { description: "No response body" },
        },
      },
      delete: {
        security: [{ cookieSession: [] }],
        "x-pullwise-scope": "expenses:write",
        responses: { 204: { description: "Removed" } },
      },
    },
    "/auth/session": {
      get: {
        security: [],
        responses: {
          200: {
            description: "Session state",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Recursive" } } },
          },
        },
      },
    },
  },
};

describe("complete OpenAPI reference", () => {
  afterEach(async () => {
    await act(async () => {
      await setLang("en");
    });
  });

  it("serves the same source-hashed contract that the rendered reference imports", () => {
    const downloadable = JSON.parse(readFileSync("public/openapi/ledger-v1.json", "utf8"));
    expect(downloadable).toEqual(apiContract);
    expect(apiContract["x-pullwise-source-sha256"]).toMatch(/^[a-f0-9]{64}$/);
  });

  it("lists every operation in the published contract, with detailed bodies initially closed", () => {
    render(<ApiReference />);
    const operations = Object.entries(apiContract.paths).flatMap(([path, value]) =>
      Object.keys(value)
        .filter((key) => METHODS.has(key))
        .map((method) => `${method.toUpperCase()}${path}`)
    );
    expect(
      [...document.querySelectorAll(".api-reference-endpoint > summary")].map(
        (summary) =>
          `${summary.querySelector(".docs-method").textContent}${summary.querySelector("code").textContent}`
      )
    ).toEqual(expect.arrayContaining(operations));
    expect(document.querySelectorAll(".api-reference-endpoint")).toHaveLength(operations.length);
    expect(document.querySelectorAll(".api-reference-content")).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Download OpenAPI JSON" })).toHaveAttribute(
      "href",
      "/openapi/ledger-v1.json"
    );
    expect(screen.getByRole("link", { name: "Download OpenAPI JSON" })).toHaveAttribute("download");
  });

  it("expands inherited path/query parameters, schema references, unions and all response definitions", async () => {
    render(<ApiReference contract={fixture} />);
    const details = await openEndpoint("/api/v1/expenses/{id}");
    expect(details).toHaveTextContent("path: id");
    expect(details).toHaveTextContent("query: limit");
    expect(details).toHaveTextContent("maximum: 100");
    expect(details).toHaveTextContent("pattern:");
    expect(details).toHaveTextContent("additionalProperties: false");
    expect(details).toHaveTextContent("target (oneOf 1).kind");
    expect(details).toHaveTextContent("target (oneOf 2)");
    expect(details).toHaveTextContent("$ (allOf 2).revision");
    expect(details).toHaveTextContent("Exact amount");
    expect(details).toHaveTextContent("Cookie session (pw_session) OR Bearer API key");
    expect(details).toHaveTextContent("expenses:read");
    expect(details).toHaveTextContent("Retry-After");
    expect(details).toHaveTextContent("Delay in seconds");
    expect(details).toHaveTextContent("Target denied");
    expect(details).toHaveTextContent("TARGET_DENIED");
    expect(details.textContent).not.toContain("#/components/");

    const nested = details.querySelector(".api-reference-schema");
    nested.open = true;
    fireEvent(nested, new Event("toggle", { bubbles: true }));
    await waitFor(() => expect(nested.querySelector("pre")).toHaveTextContent('"required"'));
    nested.open = false;
    fireEvent(nested, new Event("toggle", { bubbles: true }));
    await waitFor(() => expect(nested.querySelector("pre")).toBeNull());
    expect(within(details).getByRole("heading", { name: "Authentication" })).toBeInTheDocument();
  });

  it("keeps Cookie-only endpoints distinct from the Bearer integration surface", async () => {
    render(<ApiReference />);
    for (const [path, method] of [
      ["/api/v1/workspace-invitations/preview", "POST"],
      ["/api/v1/workspace-invitations/accept", "POST"],
    ]) {
      const details = await openEndpoint(path, method);
      const auth = within(details).getByRole("heading", {
        name: "Authentication",
      }).nextElementSibling;
      expect(auth).toHaveTextContent("Cookie session (pw_session)");
      expect(auth).not.toHaveTextContent("Bearer API key");
    }
    const activity = await openEndpoint("/api/v1/activity");
    expect(
      within(activity).getByRole("heading", { name: "Authentication" }).nextElementSibling
    ).toHaveTextContent("Cookie session (pw_session) OR Bearer API key");
  });

  it("offers named keyboard focus for each horizontally scrollable table and expanded schema", async () => {
    render(<ApiReference contract={fixture} />);
    const details = await openEndpoint("/api/v1/expenses/{id}");
    const parameters = within(details).getByRole("region", {
      name: "GET /api/v1/expenses/{id} · Parameters",
    });
    expect(parameters).toHaveAttribute("tabindex", "0");
    parameters.focus();
    expect(document.activeElement).toBe(parameters);

    const request = within(details).getByRole("region", {
      name: "GET /api/v1/expenses/{id} · Request body · application/json",
    });
    request.focus();
    expect(document.activeElement).toBe(request);
    const schema = request.nextElementSibling;
    schema.open = true;
    fireEvent(schema, new Event("toggle", { bubbles: true }));
    const json = await within(schema).findByRole("region", {
      name: "GET /api/v1/expenses/{id} · Request body · application/json · Resolved schema (JSON)",
    });
    expect(json).toHaveAttribute("tabindex", "0");
    json.focus();
    expect(document.activeElement).toBe(json);
    expect(json).toHaveTextContent('"additionalProperties": false');
  });

  it("publishes permanent Owner deletion and historical removed-category metadata from the combined contract", async () => {
    render(<ApiReference />);
    const deletion = await openEndpoint("/api/v1/projects/{id}", "DELETE");
    expect(deletion).toHaveTextContent("Current actual Owner");
    expect(deletion).toHaveTextContent("projects:write");
    expect(deletion).toHaveTextContent("If-Match");
    expect(deletion).toHaveTextContent(
      "Moved-out current expenses and unrelated schedules survive"
    );
    expect(deletion).toHaveTextContent("cumulative project capacity");
    expect(deletion).toHaveTextContent("Active expense capacity is released");
    expect(deletion).toHaveTextContent("Cookie session (pw_session) OR Bearer API key");
    const categories = await openEndpoint("/api/v1/categories");
    expect(categories).toHaveTextContent("query: includeRemoved");
    expect(categories).toHaveTextContent("removedAt");
    expect(categories).toHaveTextContent(
      "Present only for a removed row requested with includeRemoved=true"
    );
    const removal = await openEndpoint("/api/v1/categories/{id}/remove", "POST");
    expect(removal).toHaveTextContent(
      "Existing expense edits may explicitly retain their original removed category"
    );
    expect(removal).toHaveTextContent("INVALID_CATEGORY");
    expect(removal).not.toHaveTextContent("CATEGORY_IN_USE");
  });

  it("copies every operation and resolves request, response and parameter references without recursive expansion", () => {
    const markdown = referenceMarkdown(fixture);
    expect(markdown).toContain("### GET /api/v1/expenses/{id}");
    expect(markdown).toContain("### DELETE /api/v1/expenses/{id}");
    expect(markdown).toContain("### GET /auth/session");
    expect(markdown).toContain("path: id (required)");
    expect(markdown).toContain('"maximum": 100');
    expect(markdown).toContain('"oneOf"');
    expect(markdown).toContain('"allOf"');
    expect(markdown).toContain("Header Retry-After: Delay in seconds");
    expect(markdown).toContain("**403**: Target denied");
    expect(markdown).toContain("Recursive schema: Recursive");
    expect(markdown).not.toContain('"$ref"');
    const actual = referenceMarkdown();
    for (const [path, operations] of Object.entries(apiContract.paths)) {
      for (const method of Object.keys(operations).filter((key) => METHODS.has(key)))
        expect(actual).toContain(`### ${method.toUpperCase()} ${path}`);
    }
    expect(actual).not.toContain("Unresolved schema:");
    expect(actual).not.toContain('"$ref"');
  });

  for (const [lang, heading, download] of [
    ["zh", "完整 API 参考", "下载 OpenAPI JSON"],
    ["ja", "API リファレンス全体", "OpenAPI JSON をダウンロード"],
    ["ko", "전체 API 참조", "OpenAPI JSON 다운로드"],
    ["fr", "Référence API complète", "Télécharger le JSON OpenAPI"],
    ["es", "Referencia completa de la API", "Descargar OpenAPI JSON"],
  ])
    it(`localizes reference navigation in ${lang} while preserving contract names`, async () => {
      await act(async () => {
        await setLang(lang);
      });
      render(<ApiReference />);
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: download })).toBeInTheDocument();
      const session = [...document.querySelectorAll(".api-reference-endpoint > summary")].find(
        (summary) => summary.querySelector("code")?.textContent === "/auth/session"
      );
      expect(session.querySelector(".docs-method")).toHaveTextContent("GET");
      expect(session.querySelector("code")).toHaveTextContent("/auth/session");
    });
});
