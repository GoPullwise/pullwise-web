import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { T, setLang } from "../i18n.jsx";
import { DocsScreen } from "./docs.jsx";
import { ApiDocsScreen } from "./api-docs.jsx";

afterEach(() => setLang("en"));

describe("permanent project removal and historical categories", () => {
  it.each([
    [
      "en",
      "Permanently remove a project",
      "Only the ledger Owner",
      "expenses retain its name with a removed label",
      "DELETE /api/v1/projects/{id} requires",
      "Referenced categories can be removed",
      "Removed",
    ],
    [
      "zh",
      "永久移除项目",
      "只有账本 Owner",
      "历史支出仍保留类别名称",
      "DELETE /api/v1/projects/{id} 需要",
      "被引用的类别也可以移除",
      "已移除",
    ],
    [
      "ja",
      "プロジェクトを完全に削除",
      "台帳の所有者だけ",
      "保存済み記録には名前",
      "DELETE /api/v1/projects/{id} には",
      "参照中のカテゴリも削除",
      "削除済み",
    ],
    [
      "ko",
      "프로젝트 영구 삭제",
      "장부 소유자만",
      "저장된 기록에는 이름",
      "DELETE /api/v1/projects/{id}는",
      "참조 중인 카테고리도 삭제",
      "삭제됨",
    ],
    [
      "fr",
      "Supprimer définitivement un projet",
      "Seul le propriétaire",
      "enregistrements existants conservent son nom",
      "DELETE /api/v1/projects/{id} nécessite",
      "Les catégories référencées peuvent être supprimées",
      "Supprimée",
    ],
    [
      "es",
      "Eliminar permanentemente un proyecto",
      "Solo el propietario",
      "registros guardados conservan su nombre",
      "DELETE /api/v1/projects/{id} requiere",
      "Se pueden eliminar categorías referenciadas",
      "Eliminada",
    ],
  ])(
    "explains the irreversible scope and removed-label contract in %s",
    async (locale, title, owner, category, projectApi, categoryApi, removed) => {
      await setLang(locale);
      render(<DocsScreen go={vi.fn()} auth={{ authenticated: true }} />);
      const removal = screen.getByRole("heading", { name: title });
      expect(removal).toHaveAttribute("id", "project-removal");
      expect(
        within(removal.closest("section")).getByText(
          (_, node) => node.tagName === "P" && node.textContent.includes(owner)
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText((_, node) => node.tagName === "P" && node.textContent.includes(category))
      ).toBeInTheDocument();
      expect(T("Removed", "已移除")).toBe(removed);
      cleanup();
      render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: true }} />);
      const project = screen.getByText(
        (_, node) => node.tagName === "P" && node.textContent.startsWith(projectApi)
      );
      expect(project).toHaveTextContent("If-Match");
      expect(project).toHaveTextContent("204");
      const contract = screen.getByText(
        (_, node) => node.tagName === "P" && node.textContent.includes(categoryApi)
      );
      expect(contract).toHaveTextContent("includeRemoved=true");
      expect(contract).toHaveTextContent("removedAt");
      expect(contract).toHaveTextContent("INVALID_CATEGORY");
      expect(contract).toHaveTextContent("categoryId");
    }
  );
});
