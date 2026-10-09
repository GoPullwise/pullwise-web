import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setLang } from "../i18n.jsx";
import { ApiDocsScreen } from "./api-docs.jsx";
import { DocsScreen } from "./docs.jsx";

afterEach(() => setLang("en"));

async function endpoint(method, path) {
  const row = [...document.querySelectorAll(".api-reference-endpoint")].find(
    (row) =>
      row.querySelector(".docs-method")?.textContent === method &&
      row.querySelector("code")?.textContent === path
  );
  expect(row).toBeTruthy();
  row.open = true;
  fireEvent(row, new Event("toggle"));
  await waitFor(() => expect(row.querySelector(".api-reference-content")).not.toBeNull());
  return row;
}

describe("REST key permissions in public documentation", () => {
  it.each([
    [
      "en",
      "DELETE /api/v1/projects/{id} requires",
      "Owner API keys are supported",
      "Member REST reads require",
      "Recurring REST reads use",
      "Governance keys must omit",
    ],
    [
      "zh",
      "DELETE /api/v1/projects/{id} 需要",
      "Owner API 密钥",
      "成员 REST 读取需要",
      "周期 REST 读取使用",
      "不能设置 projectIds 限制",
    ],
    [
      "ja",
      "DELETE /api/v1/projects/{id} には",
      "所有者の API キー",
      "メンバーの REST 読み取りには",
      "定期支出の REST 読み取りは",
      "管理キーでは projectIds を省略",
    ],
    [
      "ko",
      "DELETE /api/v1/projects/{id}는",
      "소유자 API 키",
      "멤버 REST 읽기는",
      "반복 REST 읽기는",
      "관리 키에는 projectIds를 생략",
    ],
    [
      "fr",
      "DELETE /api/v1/projects/{id} nécessite",
      "clés API du propriétaire",
      "Les lectures REST des membres",
      "Les lectures REST récurrentes",
      "Les clés de gestion doivent omettre",
    ],
    [
      "es",
      "DELETE /api/v1/projects/{id} requiere",
      "claves API del propietario",
      "Las lecturas REST de miembros",
      "Las lecturas REST recurrentes",
      "Las claves de gestión deben omitir",
    ],
  ])(
    "keeps Owner deletion, scoped governance and rechecked schedules accurate in %s",
    async (locale, projectPrefix, ownerKey, memberPrefix, recurringPrefix, guidePhrase) => {
      await setLang(locale);
      render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: true }} />);
      const paragraph = (prefix) =>
        screen.getByText((_, node) => node.tagName === "P" && node.textContent.startsWith(prefix));
      expect(paragraph(projectPrefix)).toHaveTextContent(ownerKey);
      expect(paragraph(projectPrefix)).toHaveTextContent("projects:write");
      expect(paragraph(projectPrefix)).toHaveTextContent("If-Match");
      expect(paragraph(memberPrefix)).toHaveTextContent("members:read");
      expect(paragraph(memberPrefix)).toHaveTextContent("members:write");
      expect(paragraph(memberPrefix)).toHaveTextContent("projectIds");
      expect(paragraph(memberPrefix)).toHaveTextContent("/api/v1/workspace-invitation-requests");
      expect(paragraph(recurringPrefix)).toHaveTextContent("Idempotency-Key");
      expect(paragraph(recurringPrefix)).toHaveTextContent("If-Match");
      for (const [method, path, scope] of [
        ["DELETE", "/api/v1/projects/{id}", "projects:write"],
        ["GET", "/api/v1/expense-recurring-rules", "expenses:read"],
        ["POST", "/api/v1/expense-recurring-rules", "expenses:write"],
        ["PATCH", "/api/v1/expense-recurring-rules/{id}", "expenses:write"],
        ["DELETE", "/api/v1/expense-recurring-rules/{id}", "expenses:write"],
        ["GET", "/api/v1/workspaces/{workspaceId}/members", "members:read"],
        ["PATCH", "/api/v1/workspaces/{workspaceId}/members/{userId}", "members:write"],
        [
          "POST",
          "/api/v1/workspaces/{workspaceId}/invites/{id}/requests/{requestId}/approve",
          "members:write",
        ],
        ["GET", "/api/v1/workspace-invitation-requests", "members:read"],
      ]) {
        const row = await endpoint(method, path);
        expect(row.querySelector(".api-reference-content")).toHaveTextContent(scope);
      }
      for (const method of ["GET", "PATCH"]) {
        const row = await endpoint(method, "/api/v1/account/jev");
        const authentication = row.querySelector("h4").nextElementSibling;
        expect(authentication).toHaveTextContent("Cookie session (pw_session)");
        expect(authentication).not.toHaveTextContent("Bearer API key");
        expect(row.querySelector(".api-reference-content")).not.toHaveTextContent("members:");
        expect(row.querySelector(".api-reference-content")).not.toHaveTextContent("projects:write");
      }
      cleanup();
      render(<DocsScreen go={vi.fn()} auth={{ authenticated: true }} />);
      expect(
        screen.getByText(
          (_, node) => node.tagName === "P" && node.textContent.includes(guidePhrase)
        )
      ).toHaveTextContent("expenses:read/write");
    }
  );
});
