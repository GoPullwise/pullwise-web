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
