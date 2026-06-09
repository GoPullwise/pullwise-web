import { useEffect, useReducer } from "react";
import { localStorageGet, localStorageSet } from "./lib/browser-storage.js";

// i18n: tiny inline translations.
// Usage: T("English", "中文") returns the active variant.
// For newer translations, pass T("English", { zh: "中文", ja: "日本語" }).
// Components that need to re-render on lang change call useLang().
export const LANGUAGES = [
  { code: "en", label: "English", shortLabel: "EN", nativeLabel: "English" },
  { code: "zh", label: "Chinese", shortLabel: "中", nativeLabel: "中文" },
  { code: "ja", label: "Japanese", shortLabel: "日", nativeLabel: "日本語" },
  { code: "ko", label: "Korean", shortLabel: "한", nativeLabel: "한국어" },
  { code: "fr", label: "French", shortLabel: "FR", nativeLabel: "Français" },
  { code: "es", label: "Spanish", shortLabel: "ES", nativeLabel: "Español" },
];

const LANGUAGE_CODES = new Set(LANGUAGES.map((language) => language.code));
const LANGUAGE_ALIASES = {
  "zh-cn": "zh",
  zh_cn: "zh",
  "zh-hans": "zh",
  zh_hans: "zh",
  cn: "zh",
};

const PHRASE_TRANSLATIONS = {
  "Account overview": {
    zh: "账户总览",
    ja: "アカウント概要",
    ko: "계정 개요",
    fr: "Vue d'ensemble du compte",
    es: "Resumen de la cuenta",
  },
  "Add account or organization": {
    zh: "添加账号或组织",
    ja: "アカウントまたは組織を追加",
    ko: "계정 또는 조직 추가",
    fr: "Ajouter un compte ou une organisation",
    es: "Agregar cuenta u organización",
  },
  "All issues": {
    zh: "所有问题",
    ja: "すべての問題",
    ko: "모든 이슈",
    fr: "Tous les problèmes",
    es: "Todos los problemas",
  },
  "API docs": {
    zh: "API 文档",
    ja: "API ドキュメント",
    ko: "API 문서",
    fr: "Docs API",
    es: "Docs de API",
  },
  "API Keys": { zh: "API 密钥", ja: "API キー", ko: "API 키", fr: "Clés API", es: "Claves API" },
  "Back": { zh: "返回", ja: "戻る", ko: "뒤로", fr: "Retour", es: "Atrás" },
  "Back to home": {
    zh: "返回首页",
    ja: "ホームに戻る",
    ko: "홈으로 돌아가기",
    fr: "Retour à l'accueil",
    es: "Volver al inicio",
  },
  "Back to top": {
    zh: "回到顶部",
    ja: "先頭へ戻る",
    ko: "맨 위로",
    fr: "Retour en haut",
    es: "Volver arriba",
  },
  Billing: { zh: "账单", ja: "請求", ko: "청구", fr: "Facturation", es: "Facturación" },
  "Checking API": {
    zh: "正在检查 API",
    ja: "API を確認中",
    ko: "API 확인 중",
    fr: "Vérification de l'API",
    es: "Comprobando API",
  },
  "Checking session": {
    zh: "正在检查会话",
    ja: "セッションを確認中",
    ko: "세션 확인 중",
    fr: "Vérification de la session",
    es: "Comprobando sesión",
  },
  "Checking session...": {
    zh: "正在检查会话...",
    ja: "セッションを確認中...",
    ko: "세션 확인 중...",
    fr: "Vérification de la session...",
    es: "Comprobando sesión...",
  },
  Close: { zh: "关闭", ja: "閉じる", ko: "닫기", fr: "Fermer", es: "Cerrar" },
  "Connect repositories": {
    zh: "连接仓库",
    ja: "リポジトリを接続",
    ko: "저장소 연결",
    fr: "Connecter des dépôts",
    es: "Conectar repositorios",
  },
  Connected: { zh: "已连接", ja: "接続済み", ko: "연결됨", fr: "Connecté", es: "Conectado" },
  Dashboard: { zh: "工作台", ja: "ダッシュボード", ko: "대시보드", fr: "Tableau de bord", es: "Panel" },
  Disconnected: {
    zh: "未连接",
    ja: "未接続",
    ko: "연결 안 됨",
    fr: "Déconnecté",
    es: "Desconectado",
  },
  Feedback: { zh: "反馈", ja: "フィードバック", ko: "피드백", fr: "Retour", es: "Comentarios" },
  History: { zh: "历史", ja: "履歴", ko: "기록", fr: "Historique", es: "Historial" },
  Home: { zh: "首页", ja: "ホーム", ko: "홈", fr: "Accueil", es: "Inicio" },
  Issues: { zh: "问题", ja: "問題", ko: "이슈", fr: "Problèmes", es: "Problemas" },
  "GitHub App repository access": {
    zh: "GitHub App 仓库访问",
    ja: "GitHub App リポジトリアクセス",
    ko: "GitHub App 저장소 접근",
    fr: "Accès aux dépôts GitHub App",
    es: "Acceso a repositorios de GitHub App",
  },
  "GitHub identity": {
    zh: "GitHub 身份",
    ja: "GitHub ID",
    ko: "GitHub ID",
    fr: "Identité GitHub",
    es: "Identidad de GitHub",
  },
  "GitHub OAuth": {
    zh: "GitHub OAuth",
    ja: "GitHub OAuth",
    ko: "GitHub OAuth",
    fr: "GitHub OAuth",
    es: "GitHub OAuth",
  },
  "GitHub review workflow": {
    zh: "GitHub 审查工作流",
    ja: "GitHub レビューワークフロー",
    ko: "GitHub 리뷰 워크플로",
    fr: "Workflow de revue GitHub",
    es: "Flujo de revisión de GitHub",
  },
  Loading: { zh: "正在加载", ja: "読み込み中", ko: "로드 중", fr: "Chargement", es: "Cargando" },
  "Loading...": {
    zh: "正在加载...",
    ja: "読み込み中...",
    ko: "로드 중...",
    fr: "Chargement...",
    es: "Cargando...",
  },
  Manage: { zh: "管理", ja: "管理", ko: "관리", fr: "Gérer", es: "Administrar" },
  Navigation: { zh: "导航", ja: "ナビゲーション", ko: "탐색", fr: "Navigation", es: "Navegación" },
  "New scan": {
    zh: "新扫描",
    ja: "新規スキャン",
    ko: "새 스캔",
    fr: "Nouveau scan",
    es: "Nuevo escaneo",
  },
  "No results for": {
    zh: "无匹配结果",
    ja: "検索結果なし:",
    ko: "결과 없음:",
    fr: "Aucun résultat pour",
    es: "Sin resultados para",
  },
  Overview: { zh: "总览", ja: "概要", ko: "개요", fr: "Vue d'ensemble", es: "Resumen" },
  "Open dashboard": {
    zh: "打开工作台",
    ja: "ダッシュボードを開く",
    ko: "대시보드 열기",
    fr: "Ouvrir le tableau de bord",
    es: "Abrir panel",
  },
  "Opening GitHub...": {
    zh: "正在打开 GitHub...",
    ja: "GitHub を開いています...",
    ko: "GitHub 여는 중...",
    fr: "Ouverture de GitHub...",
    es: "Abriendo GitHub...",
  },
  Preferences: { zh: "偏好", ja: "設定", ko: "환경설정", fr: "Préférences", es: "Preferencias" },
  "Privacy Policy": {
    zh: "隐私政策",
    ja: "プライバシーポリシー",
    ko: "개인정보 처리방침",
    fr: "Politique de confidentialité",
    es: "Política de privacidad",
  },
  Pricing: { zh: "价格", ja: "料金", ko: "가격", fr: "Tarifs", es: "Precios" },
  Profile: { zh: "个人资料", ja: "プロフィール", ko: "프로필", fr: "Profil", es: "Perfil" },
  Repositories: { zh: "仓库", ja: "リポジトリ", ko: "저장소", fr: "Dépôts", es: "Repositorios" },
  "Repository authorization": {
    zh: "仓库授权",
    ja: "リポジトリ認可",
    ko: "저장소 권한 부여",
    fr: "Autorisation de dépôt",
    es: "Autorización de repositorio",
  },
  "Repository access": {
    zh: "仓库访问",
    ja: "リポジトリアクセス",
    ko: "저장소 접근",
    fr: "Accès aux dépôts",
    es: "Acceso a repositorios",
  },
  "Repository metadata": {
    zh: "仓库元数据",
    ja: "リポジトリメタデータ",
    ko: "저장소 메타데이터",
    fr: "Métadonnées du dépôt",
    es: "Metadatos del repositorio",
  },
  Review: { zh: "审查", ja: "レビュー", ko: "리뷰", fr: "Revue", es: "Revisión" },
  "Review output language": {
    zh: "产出语言偏好",
    ja: "レビュー出力言語",
    ko: "리뷰 출력 언어",
    fr: "Langue de sortie des revues",
    es: "Idioma de salida de la revisión",
  },
  "Run your first scan to check for issues.": {
    zh: "运行第一次扫描以检查问题。",
    ja: "最初のスキャンを実行して問題を確認します。",
    ko: "첫 스캔을 실행해 이슈를 확인하세요.",
    fr: "Lancez votre premier scan pour rechercher des problèmes.",
    es: "Ejecuta tu primer escaneo para buscar problemas.",
  },
  "Scan history": {
    zh: "扫描历史",
    ja: "スキャン履歴",
    ko: "스캔 기록",
    fr: "Historique des scans",
    es: "Historial de escaneos",
  },
  "Search issues, repos, pages...": {
    zh: "搜索问题、仓库、页面...",
    ja: "問題、リポジトリ、ページを検索...",
    ko: "이슈, 저장소, 페이지 검색...",
    fr: "Rechercher problèmes, dépôts, pages...",
    es: "Buscar problemas, repositorios, páginas...",
  },
  "Search...": {
    zh: "搜索...",
    ja: "検索...",
    ko: "검색...",
    fr: "Rechercher...",
    es: "Buscar...",
  },
  Security: { zh: "安全", ja: "セキュリティ", ko: "보안", fr: "Sécurité", es: "Seguridad" },
  "Server-backed scans": {
    zh: "服务端扫描",
    ja: "サーバー管理スキャン",
    ko: "서버 기반 스캔",
    fr: "Scans côté serveur",
    es: "Escaneos respaldados por servidor",
  },
  "Select language": {
    zh: "选择语言",
    ja: "言語を選択",
    ko: "언어 선택",
    fr: "Choisir la langue",
    es: "Seleccionar idioma",
  },
  Settings: { zh: "设置", ja: "設定", ko: "설정", fr: "Paramètres", es: "Configuración" },
  "Sign in to Pullwise": {
    zh: "登录 Pullwise",
    ja: "Pullwise にサインイン",
    ko: "Pullwise에 로그인",
    fr: "Se connecter à Pullwise",
    es: "Iniciar sesión en Pullwise",
  },
  "Sign in with GitHub": {
    zh: "使用 GitHub 登录",
    ja: "GitHub でサインイン",
    ko: "GitHub로 로그인",
    fr: "Se connecter avec GitHub",
    es: "Iniciar sesión con GitHub",
  },
  "Sign in": { zh: "登录", ja: "サインイン", ko: "로그인", fr: "Se connecter", es: "Iniciar sesión" },
  "Sign out": {
    zh: "退出登录",
    ja: "サインアウト",
    ko: "로그아웃",
    fr: "Se déconnecter",
    es: "Cerrar sesión",
  },
  "Start a scan": {
    zh: "开始扫描",
    ja: "スキャンを開始",
    ko: "스캔 시작",
    fr: "Démarrer un scan",
    es: "Iniciar escaneo",
  },
  "Start scan": {
    zh: "开始扫描",
    ja: "スキャン開始",
    ko: "스캔 시작",
    fr: "Démarrer le scan",
    es: "Iniciar escaneo",
  },
  Status: { zh: "状态", ja: "ステータス", ko: "상태", fr: "Statut", es: "Estado" },
  Sync: { zh: "同步", ja: "同期", ko: "동기화", fr: "Synchroniser", es: "Sincronizar" },
  "Terms of Service": {
    zh: "服务条款",
    ja: "利用規約",
    ko: "서비스 약관",
    fr: "Conditions d'utilisation",
    es: "Términos del servicio",
  },
  "Toggle theme": {
    zh: "切换主题",
    ja: "テーマ切替",
    ko: "테마 전환",
    fr: "Changer le thème",
    es: "Cambiar tema",
  },
};

function normalizeLang(nextLang) {
  const code = String(nextLang || "en").trim().toLowerCase();
  const normalized = LANGUAGE_ALIASES[code] || code;
  return LANGUAGE_CODES.has(normalized) ? normalized : "en";
}

let lang = normalizeLang(localStorageGet("pw-lang", "en"));

export function setLang(nextLang) {
  lang = normalizeLang(nextLang);
  localStorageSet("pw-lang", lang);
  window.dispatchEvent(new Event("pw-langchange"));
}

export function T(en, translations) {
  if (lang === "en") return en;

  if (translations && typeof translations === "object" && !Array.isArray(translations)) {
    return translations[lang] || translations.en || PHRASE_TRANSLATIONS[en]?.[lang] || en;
  }

  if (lang === "zh" && translations) {
    return translations === en ? PHRASE_TRANSLATIONS[en]?.zh || translations : translations;
  }

  return PHRASE_TRANSLATIONS[en]?.[lang] || en;
}

export function useLang() {
  const [, force] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    const handler = () => force();
    window.addEventListener("pw-langchange", handler);
    return () => window.removeEventListener("pw-langchange", handler);
  }, []);

  return lang;
}
