import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setLang } from "../i18n.jsx";
import { DocsScreen } from "./docs.jsx";
import { ApiDocsScreen } from "./api-docs.jsx";

afterEach(() => setLang("en"));

describe("Jev preference product contract", () => {
  it.each([
    [
      "en",
      "Jev settings",
      "The preference belongs to your account",
      "GET and PATCH /api/v1/account/jev",
      "API keys cannot use these endpoints",
      "Free cannot run model checks even if its saved preference is On",
    ],
    [
      "zh",
      "Jev 设置",
      "偏好属于你的账户",
      "GET 和 PATCH /api/v1/account/jev",
      "API 密钥不能使用这些接口",
      "即使保存的偏好为开启，Free 仍不能运行模型检查",
    ],
    [
      "ja",
      "Jev 設定",
      "設定は現在選択している共有台帳",
      "GET と PATCH /api/v1/account/jev",
      "API キーでは利用できません",
      "保存済みの設定が On でも Free ではモデルチェックを実行できません",
    ],
    [
      "ko",
      "Jev 설정",
      "환경설정은 현재 선택한 공유 장부",
      "GET 및 PATCH /api/v1/account/jev",
      "API 키로 사용할 수 없습니다",
      "저장된 설정이 On이어도 Free는 모델 검사를 실행할 수 없습니다",
    ],
    [
      "fr",
      "Paramètres Jev",
      "La préférence appartient à votre compte",
      "GET et PATCH /api/v1/account/jev",
      "Les clés API ne peuvent pas les utiliser",
      "Free ne peut pas exécuter de contrôles du modèle",
    ],
    [
      "es",
      "Configuración de Jev",
      "La preferencia pertenece a tu cuenta",
      "GET y PATCH /api/v1/account/jev",
      "Las claves API no pueden utilizarlos",
      "Free no puede ejecutar comprobaciones del modelo",
    ],
  ])(
    "explains the account switch and cookie-only revision contract in %s",
    async (locale, heading, guide, api, auth, freeGate) => {
      await setLang(locale);
      render(<DocsScreen go={vi.fn()} auth={{ authenticated: true }} />);
      expect(screen.getByRole("heading", { name: heading })).toHaveAttribute("id", "jev-settings");
      expect(
        screen.getByText((_, node) => node.tagName === "P" && node.textContent.includes(guide))
      ).toHaveTextContent(freeGate);
      cleanup();
      render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: true }} />);
      expect(screen.getByRole("heading", { name: heading })).toHaveAttribute("id", "jev-settings");
      const contract = screen.getByText(
        (_, node) => node.tagName === "P" && node.textContent.startsWith(api)
      );
      expect(contract).toHaveTextContent(auth);
      expect(contract).toHaveTextContent(freeGate);
      expect(contract).toHaveTextContent("If-Match");
      expect(contract).toHaveTextContent("412");
      expect(contract).toHaveTextContent("monthlyBudgetUsd");
      const endpoints = screen.getAllByText("/api/v1/account/jev");
      expect(endpoints).toHaveLength(2);
      for (const path of endpoints)
        expect(path.closest("details").textContent).not.toContain("profile:write");
    }
  );
});
