// Dynamic phrases used by current account, billing and ledger screens.
export const DYNAMIC_PHRASE_TRANSLATIONS = [
  {
    match:
      /^Contact (.+) to request access, export, correction or deletion of account data\. You can manage GitHub access and revoke API keys in the product\.$/,
    translations: {
      zh: "请联系 $1 请求访问、导出、更正或删除账户数据。你也可以在产品中管理 GitHub 授权和撤销 API 密钥。",
      ja: "$1 に連絡してアカウントデータの閲覧、エクスポート、訂正、削除を依頼できます。製品内で GitHub の権限管理と API キーの失効もできます。",
      ko: "$1에 연락해 계정 데이터의 열람, 내보내기, 수정 또는 삭제를 요청할 수 있습니다. 제품에서 GitHub 접근을 관리하고 API 키를 폐기할 수도 있습니다.",
      fr: "Contactez $1 pour demander l'accès, l'exportation, la correction ou la suppression des données de votre compte. Vous pouvez aussi gérer l'accès GitHub et révoquer les clés API dans le produit.",
      es: "Contacta a $1 para solicitar acceso, exportación, corrección o eliminación de los datos de tu cuenta. También puedes gestionar el acceso a GitHub y revocar claves API en el producto.",
    },
  },
  {
    match: /^Contact (.+) with privacy or security questions\.$/,
    translations: {
      zh: "隐私或安全问题请联系 $1。",
      ja: "プライバシーやセキュリティに関する質問は $1 までお問い合わせください。",
      ko: "개인정보 또는 보안 관련 질문은 $1로 문의하세요.",
      fr: "Pour toute question de confidentialité ou de sécurité, contactez $1.",
      es: "Para dudas de privacidad o seguridad, contacta a $1.",
    },
  },
  {
    match: /^For questions, contact (.+)\.$/,
    translations: {
      zh: "如有问题，请联系 $1。",
      ja: "ご質問は $1 までお問い合わせください。",
      ko: "문의 사항은 $1로 연락하세요.",
      fr: "Pour toute question, contactez $1.",
      es: "Si tienes preguntas, contacta a $1.",
    },
  },
  {
    match: /^([\d,]+) repositories$/,
    translations: {
      zh: "$1 个仓库",
      ja: "$1 件のリポジトリ",
      ko: "저장소 $1개",
      fr: "$1 dépôts",
      es: "$1 repositorios",
    },
  },
  {
    match: /^Last verified by @(.+)$/,
    translations: {
      zh: "最近由 @$1 验证",
      ja: "最終確認: @$1",
      ko: "마지막 검증: @$1",
      fr: "Dernière vérification par @$1",
      es: "Última verificación por @$1",
    },
  },
  {
    match: /^Needs a GitHub account with access to (.+)$/,
    translations: {
      zh: "需要有权访问 $1 的 GitHub 账户",
      ja: "$1 にアクセスできる GitHub アカウントが必要です",
      ko: "$1에 접근할 수 있는 GitHub 계정이 필요합니다",
      fr: "Nécessite un compte GitHub avec accès à $1",
      es: "Requiere una cuenta de GitHub con acceso a $1",
    },
  },
  {
    match: /^Manage (.+) GitHub App installation$/,
    translations: {
      zh: "管理 $1 的 GitHub App 安装",
      ja: "$1 の GitHub App インストールを管理",
      ko: "$1 GitHub App 설치 관리",
      fr: "Gérer l'installation GitHub App de $1",
      es: "Gestionar instalación de GitHub App de $1",
    },
  },
  {
    match: /^(.+) more per (.+)$/,
    translations: {
      zh: "每 $2 多 $1",
      ja: "$2 あたり $1 増",
      ko: "$2당 $1 증가",
      fr: "$1 de plus par $2",
      es: "$1 más por $2",
    },
  },
  {
    match: /^(.+) less per (.+)$/,
    translations: {
      zh: "每 $2 少 $1",
      ja: "$2 あたり $1 減",
      ko: "$2당 $1 감소",
      fr: "$1 de moins par $2",
      es: "$1 menos por $2",
    },
  },
  {
    match: /^Billed (.+)$/,
    translations: {
      zh: "按 $1 计费",
      ja: "$1 請求",
      ko: "$1 청구",
      fr: "Facturé $1",
      es: "Facturado $1",
    },
  },
  {
    match: /^Switch to (.+)$/,
    translations: {
      zh: "切换到 $1",
      ja: "$1 に切り替え",
      ko: "$1로 전환",
      fr: "Passer à $1",
      es: "Cambiar a $1",
    },
  },
  {
    match: /^Start (.+)$/,
    translations: {
      zh: "升级 $1",
      ja: "$1 を開始",
      ko: "$1 시작",
      fr: "Démarrer $1",
      es: "Iniciar $1",
    },
  },
  {
    match: /^(.+) repositories authorized(.*)$/,
    translations: {
      zh: "$1 个仓库已授权$2",
      ja: "$1 件のリポジトリ認可済み$2",
      ko: "저장소 $1개 승인됨$2",
      fr: "$1 dépôts autorisés$2",
      es: "$1 repositorios autorizados$2",
    },
  },
  {
    match: /^Questions\? Email (.+)\.$/,
    translations: {
      zh: "如有问题，请联系 $1。",
      ja: "質問は $1 までメールしてください。",
      ko: "질문은 $1로 이메일을 보내세요.",
      fr: "Questions ? Écrivez à $1.",
      es: "¿Preguntas? Escribe a $1.",
    },
  },
  {
    match: /^Go to (.+)$/,
    translations: {
      zh: "前往 $1",
      ja: "$1 へ移動",
      ko: "$1로 이동",
      fr: "Aller à $1",
      es: "Ir a $1",
    },
  },
];
