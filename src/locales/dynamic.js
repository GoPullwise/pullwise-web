// Dynamic phrases used by current account, billing and ledger screens.
export const DYNAMIC_PHRASE_TRANSLATIONS = [
  {
    match:
      /^Contact (.+) to request access, export, correction or deletion of account data\. We may verify your identity and consider applicable law and other ledger members' rights before acting\. You can export authorized expenses as CSV, manage members and GitHub access according to your permissions, and revoke your API keys in the product\.$/,
    translations: {
      zh: "请联系 $1 请求访问、导出、更正或删除账户数据。处理前我们可能核实身份，并考虑适用法律及其他账本成员的权利。你可以导出有权访问的支出 CSV、按权限管理成员与 GitHub 授权，并在产品中撤销自己的 API 密钥。",
      ja: "アカウントデータへのアクセス、エクスポート、訂正、削除を請求するには、$1 までご連絡ください。対応に先立ち、本人確認を行い、適用される法律や他の台帳メンバーの権利を考慮する場合があります。製品内では、アクセス権のある支出を CSV でエクスポートし、権限に応じてメンバーと GitHub アクセス権を管理し、ご自身の API キーを取り消すことができます。",
      ko: "계정 데이터의 접근, 내보내기, 정정 또는 삭제를 요청하려면 $1으로 연락해 주세요. 당사는 조치 전에 신원을 확인하고 적용 법률과 다른 장부 멤버의 권리를 고려할 수 있습니다. 제품에서 접근 권한이 있는 지출을 CSV로 내보내고, 권한에 따라 멤버와 GitHub 접근 권한을 관리하며, 본인의 API 키를 취소할 수 있습니다.",
      fr: "Contactez $1 pour demander l'accès, l'export, la rectification ou la suppression des données de votre compte. Nous pouvons vérifier votre identité et prendre en compte la législation applicable ainsi que les droits des autres membres du registre avant de donner suite à votre demande. Vous pouvez exporter au format CSV les dépenses auxquelles vous avez accès, gérer les membres et l'accès à GitHub selon vos autorisations, et révoquer vos clés API dans le produit.",
      es: "Contacta con $1 para solicitar el acceso, la exportación, la rectificación o la eliminación de los datos de tu cuenta. Podemos verificar tu identidad y tener en cuenta la legislación aplicable y los derechos de otros miembros del libro antes de actuar. Puedes exportar en formato CSV los gastos a los que tienes acceso, gestionar los miembros y el acceso a GitHub según tus permisos, y revocar tus claves API en el producto.",
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
