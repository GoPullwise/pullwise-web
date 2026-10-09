import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocsScreen } from "./docs.jsx";
import { setLang } from "../i18n.jsx";

describe("product Docs", () => {
  afterEach(() => setLang("en"));
  it("explains project and shared expense workflows", () => {
    render(<DocsScreen go={vi.fn()} auth={{ authenticated: false }} />);

    expect(screen.getByRole("heading", { name: /project expense ledger/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /create a project/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /record expenses/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /review reports/i })).toBeInTheDocument();
    expect(screen.getByText(/shared pool is counted once/i)).toBeInTheDocument();
    expect(screen.queryByText(/monthly account scans|scan limits|review agents/i)).not.toBeInTheDocument();
  });

  it("links to the current product configuration and API contract", () => {
    render(<DocsScreen go={vi.fn()} auth={{ authenticated: true }} />);

    expect(screen.getByRole("link", { name: /open projects/i })).toHaveAttribute("href", "/projects");
    expect(screen.getByRole("link", { name: /API contract/i })).toHaveAttribute("href", "/developers/api");
  });

  it("explains project settings, recurring expenses and operation history", () => {
    render(<DocsScreen go={vi.fn()} auth={{ authenticated: true }} />);

    const settingsHeading = screen.getByRole("heading", { name: "Manage project settings" });
    expect(settingsHeading).toHaveAttribute("id", "project-settings");
    const settings = settingsHeading.closest("section");
    for (const phrase of ["Project settings", "development and product", "Archived", "Removing", "cannot restore"]) {
      expect(settings).toHaveTextContent(phrase);
    }

    const recurringHeading = screen.getByRole("heading", { name: "Manage recurring expenses" });
    expect(recurringHeading).toHaveAttribute("id", "recurring");
    const recurring = recurringHeading.closest("section");
    for (const phrase of ["Asia/Shanghai", "weekly", "monthly", "quarterly", "yearly", "future occurrences", "not backfilled", "already recorded expenses"]) {
      expect(recurring).toHaveTextContent(phrase);
    }

    const activityHeading = screen.getByRole("heading", { name: "Read the operation log" });
    expect(activityHeading).toHaveAttribute("id", "activity");
    const activity = activityHeading.closest("section");
    for (const phrase of ["last 24 hours", "Reload", "does not poll"]) {
      expect(activity).toHaveTextContent(phrase);
    }
  });

  it("explains category management and links API key users to the REST quickstart", () => {
    render(<DocsScreen go={vi.fn()} auth={{ authenticated: true }} />);

    const categoriesHeading = screen.getByRole("heading", { name: "Create categories" });
    expect(categoriesHeading).toHaveAttribute("id", "categories");
    const categories = categoriesHeading.closest("section");
    for (const phrase of ["Rename", "Archive", "Remove", "unused"]) {
      expect(categories).toHaveTextContent(phrase);
    }

    const keysHeading = screen.getByRole("heading", { name: "Use API keys" });
    expect(keysHeading).toHaveAttribute("id", "keys");
    const keys = keysHeading.closest("section");
    for (const phrase of ["REST API", "target", "If-Match", "Idempotency-Key"]) {
      expect(keys).toHaveTextContent(phrase);
    }
    expect(screen.getByRole("link", { name: "API quickstart" })).toHaveAttribute("href", "/developers/api#quickstart");
  });

  it("explains opt-in expense removal, capacity release and the exact oldest-record boundary", () => {
    render(<DocsScreen go={vi.fn()} auth={{ authenticated: true }} />);
    const heading = screen.getByRole("heading", { name: "Expense capacity and automatic removal" });
    expect(heading).toHaveAttribute("id", "expense-retention");
    const section = heading.closest("section");
    for (const phrase of ["Off by default on every plan", "adds no charges", "frees expense slots",
      "archived and removed projects still count", "expense date, then creation time, then ID",
      "permission to remove that exact expense", "cannot be restored", "does not perform bulk cleanup",
      "failed save does not remove", "Recurring generation follows the same setting"]) {
      expect(section).toHaveTextContent(phrase);
    }
  });

  it("explains automatic Jev assistance as part of ordinary expense entry and REST writes", () => {
    render(<DocsScreen go={vi.fn()} auth={{ authenticated: true }} />);
    expect(screen.getByRole("heading", { name: "Automatic Jev assistance" })).toBeInTheDocument();
    expect(screen.getByText(/Jev automatically assists when you save an expense/i)).toHaveTextContent("REST API");
    const assistance = screen.getByText(/leave the category blank/i);
    expect(assistance).toHaveTextContent("Owner's effective Pro or Max plan");
    expect(assistance).toHaveTextContent("$3 for Pro and $5 for Max");
    expect(assistance).toHaveTextContent("server-provided allowance applies");
    expect(assistance).toHaveTextContent("Editing keeps the original category unless you choose Automatic");
    expect(assistance).toHaveTextContent("the expense is not saved; choose a category and retry");
    expect(assistance).toHaveTextContent("Recurring schedules always require an explicit category");
  });

  it("explains explicit bounded checks and manual editing of saved expenses", () => {
    render(<DocsScreen go={vi.fn()} auth={{ authenticated: true }} />);
    expect(screen.getByRole("heading", { name: "Review saved expenses" })).toHaveAttribute("id", "expense-review");
    const review = screen.getByText(/open Expense review and select up to 10/i);
    expect(review).toHaveTextContent("currently loaded filtered list");
    expect(review).toHaveTextContent("Opening the dialog does not run Jev");
    expect(review).toHaveTextContent("only Start review sends requests, one record at a time");
    expect(review).toHaveTextContent("Stop ends the remaining queue");
    expect(review).toHaveTextContent("requests already started may still consume allowance");
    expect(review).toHaveTextContent("predefined choices and any returned confidence scores");
    expect(review).toHaveTextContent("the interface uses fixed wording");
    expect(review).toHaveTextContent("Possible duplicates are checked locally");
    expect(review).toHaveTextContent("even when model checks are disabled or unavailable");
    expect(review).toHaveTextContent("Checks never change saved records");
    expect(review).toHaveTextContent("Edit reloads the current expense and opens its saved values without applying the results");
    expect(review).toHaveTextContent("Uncertain or unavailable checks do not mean a clear result");
  });

  it("explains email registration, explicit linking and inviter-approved join requests", () => {
    render(<DocsScreen go={vi.fn()} auth={{ authenticated: false }} />);
    const signIn = screen.getByText(/Enter your email and verify the 6-digit code/i);
    expect(signIn).toHaveTextContent("first successful verification creates your account automatically");
    expect(signIn).toHaveTextContent("sign in first and link an email from Settings");
    expect(signIn).toHaveTextContent("never links or merges accounts");
    expect(screen.getByText(/GitHub is optional for standalone projects/i)).toBeInTheDocument();
    const sharing = screen.getByText(/In Members, choose a role/i);
    expect(sharing).toHaveTextContent("including an email-only account");
    expect(sharing).toHaveTextContent("Only the original inviter can approve or reject");
    expect(sharing).toHaveTextContent("Opening the link or sending a request grants no ledger access");
    expect(sharing).toHaveTextContent("Legacy invitations to a specific GitHub account still check that identity");
  });

  for (const { locale, sections, categories, quickstart } of [
    {
      locale: "zh",
      sections: [
        ["project-settings", "管理项目设置", ["开发和产品链接", "不能通过修改状态恢复已移除项目"]],
        ["recurring", "管理周期支出", ["每周、每月、每季度或每年", "不补记暂停或阻塞期间的支出", "已经记入的支出仍保留"]],
        ["activity", "查看操作日志", ["最近 24 小时", "重新加载", "不会轮询"]],
        ["expense-retention", "支出容量与自动移除", ["默认关闭", "无法恢复", "设置不会批量移除"]],
      ],
      categories: "移除只会永久删除未被使用的类别",
      quickstart: "API 接入教程",
    },
    {
      locale: "ja",
      sections: [
        ["project-settings", "プロジェクト設定を管理", ["開発・製品リンク", "削除済みプロジェクトを復元することはできません"]],
        ["recurring", "定期支出を管理", ["毎週、毎月、四半期ごと、毎年", "停止・ブロック期間分は遡って記録されません", "記録済み支出は保持します"]],
        ["activity", "操作ログを確認", ["直近 24 時間", "再読み込み", "定期取得は行いません"]],
        ["expense-retention", "支出の容量と自動削除", ["追加料金はかかりません", "一括削除は行いません"]],
      ],
      categories: "削除できるのは未使用のカテゴリーだけ",
      quickstart: "API 導入ガイド",
    },
    {
      locale: "ko",
      sections: [
        ["project-settings", "프로젝트 설정 관리", ["개발 및 제품 링크", "제거한 프로젝트를 복원할 수는 없습니다"]],
        ["recurring", "반복 지출 관리", ["매주, 매월, 분기별 또는 매년", "중지 또는 차단된 기간은 소급 기록되지 않습니다", "이미 기록된 지출은 유지됩니다"]],
        ["activity", "작업 로그 보기", ["최근 24시간", "새로고침", "주기적으로 조회하지 않고"]],
        ["expense-retention", "지출 용량 및 자동 제거", ["추가 요금이 없습니다", "일괄 제거하지 않습니다"]],
      ],
      categories: "제거는 사용하지 않은 카테고리만 영구 삭제",
      quickstart: "API 시작 안내",
    },
    {
      locale: "fr",
      sections: [
        ["project-settings", "Gérer les paramètres du projet", ["liens de développement et de produit", "ne permet pas de restaurer un projet supprimé"]],
        ["recurring", "Gérer les dépenses récurrentes", ["hebdomadaire, mensuelle, trimestrielle ou annuelle", "sans rattraper les périodes en pause ou bloquées", "conserve les dépenses déjà enregistrées"]],
        ["activity", "Consulter le journal des opérations", ["dernières 24 heures", "Recharger", "sans interrogation périodique"]],
        ["expense-retention", "Capacité des dépenses et suppression automatique", ["sans frais supplémentaires", "aucun nettoyage en masse"]],
      ],
      categories: "Supprimer efface définitivement une catégorie inutilisée",
      quickstart: "Démarrage rapide de l’API",
    },
    {
      locale: "es",
      sections: [
        ["project-settings", "Gestionar la configuración del proyecto", ["enlaces de desarrollo y producto", "no puedes restaurar un proyecto eliminado"]],
        ["recurring", "Gestionar gastos recurrentes", ["semanal, mensual, trimestral o anual", "sin recuperar períodos pausados o bloqueados", "conserva los gastos ya registrados"]],
        ["activity", "Consultar el registro de operaciones", ["últimas 24 horas", "Recargar", "sin consultas periódicas"]],
        ["expense-retention", "Capacidad de gastos y eliminación automática", ["sin cargos adicionales", "no hay limpieza masiva"]],
      ],
      categories: "Eliminar borra definitivamente solo una categoría sin uso",
      quickstart: "Inicio rápido de la API",
    },
  ]) {
    it(`keeps project, recurring, history and REST onboarding guidance localized in ${locale}`, async () => {
      await setLang(locale);
      render(<DocsScreen go={vi.fn()} auth={{ authenticated: false }} />);

      for (const [id, title, phrases] of sections) {
        const heading = screen.getByRole("heading", { name: title });
        expect(heading).toHaveAttribute("id", id);
        for (const phrase of phrases) {
          expect(heading.closest("section")).toHaveTextContent(phrase);
        }
      }
      expect(document.getElementById("recurring").closest("section")).toHaveTextContent("Asia/Shanghai");
      expect(document.getElementById("categories").closest("section")).toHaveTextContent(categories);
      const keys = document.getElementById("keys").closest("section");
      for (const phrase of ["target", "If-Match", "Idempotency-Key"]) {
        expect(keys).toHaveTextContent(phrase);
      }
      expect(screen.getByRole("link", { name: quickstart })).toHaveAttribute("href", "/developers/api#quickstart");
    });
  }

  for (const [locale, heading, registration, invitation] of [
    ["zh", "登录或创建账户", "首次验证成功会自动创建账户", "只有原邀请人"],
    ["ja", "ログインまたはアカウント作成", "アカウントが自動で作成され", "招待者だけが申請を承認"],
    ["ko", "로그인 또는 계정 만들기", "계정이 자동으로 생성됩니다", "초대자만 신청을 승인"],
    ["fr", "Se connecter ou créer un compte", "crée automatiquement votre compte", "Seul l’auteur du lien"],
    ["es", "Iniciar sesión o crear una cuenta", "crea tu cuenta automáticamente", "Solo quien creó el enlace"],
  ]) {
    it(`keeps email onboarding and invitation guidance localized in ${locale}`, async () => {
      await setLang(locale);
      render(<DocsScreen go={vi.fn()} auth={{ authenticated: false }} />);
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
      expect(document.body.textContent).toContain(registration);
      expect(document.body.textContent).toContain(invitation);
      expect(document.body.textContent).not.toContain("Enter your email and verify");
      const reviewHeading = {
        zh: "检查已保存支出",
        ja: "保存済み支出をチェック",
        ko: "저장된 지출 점검",
        fr: "Vérifier les dépenses enregistrées",
        es: "Comprobar gastos guardados",
      }[locale];
      expect(screen.getByRole("heading", { name: reviewHeading })).toBeInTheDocument();
      expect(document.body.textContent).not.toContain("In project expenses or the shared pool, open Expense review");
    });
  }
});
