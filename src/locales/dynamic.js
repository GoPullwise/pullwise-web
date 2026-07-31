// Extracted from the former src/i18n-extra.js. Regex-driven phrases that
// cannot be expressed as a flat key/value table, plus the severity
// vocabulary their templates close over. Loaded only for non-English locales.
const severityWords = {
  critical: { zh: "关键", ja: "クリティカル", ko: "치명적", fr: "critique", es: "crítico" },
  high: { zh: "高", ja: "高", ko: "높음", fr: "élevé", es: "alto" },
  medium: { zh: "中", ja: "中", ko: "중간", fr: "moyen", es: "medio" },
  low: { zh: "低", ja: "低", ko: "낮음", fr: "faible", es: "bajo" },
  info: { zh: "信息", ja: "情報", ko: "정보", fr: "info", es: "info" },
};

function severityLabel(value, lang) {
  return severityWords[String(value || "").toLowerCase()]?.[lang] || value;
}

export const DYNAMIC_PHRASE_TRANSLATIONS = [
  {
    match: /^(.+) (.+) \((.+)%\)$/,
    translations: {
      zh: "$1 $2（$3%）",
      ja: "$1 $2（$3%）",
      ko: "$1 $2($3%)",
      fr: "$1 $2 ($3 %)",
      es: "$1 $2 ($3 %)",
    },
  },
  {
    match: /^([\d,]+) repositories$/,
    translations: { zh: "$1 个仓库", ja: "$1 件のリポジトリ", ko: "저장소 $1개", fr: "$1 dépôts", es: "$1 repositorios" },
  },
  {
    match: /^Last verified by @(.+)$/,
    translations: { zh: "最近由 @$1 验证", ja: "最終確認: @$1", ko: "마지막 검증: @$1", fr: "Dernière vérification par @$1", es: "Última verificación por @$1" },
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
    match: /^(.+) of (.+) verified or static$/,
    translations: {
      zh: "$1 / $2 已验证或静态证明",
      ja: "$1 / $2 検証済みまたは静的証明",
      ko: "$1 / $2 검증됨 또는 정적 증명",
      fr: "$1 sur $2 vérifiés ou statiques",
      es: "$1 de $2 verificados o estáticos",
    },
  },
  {
    match: /^Top (.+)$/,
    translations: { zh: "Top $1", ja: "上位 $1", ko: "상위 $1", fr: "Top $1", es: "Top $1" },
  },
  {
    match: /^A machine-readable API description is also available from GET \/api-docs or GET \/api\/docs on the backend\. For support, email (.+)\.$/,
    translations: {
      zh: "后端还提供机器可读 API 描述：GET /api-docs 或 GET /api/docs。如需支持，请发送邮件至 $1。",
      ja: "バックエンドでは機械可読 API 記述も GET /api-docs または GET /api/docs で利用できます。サポートは $1 までメールしてください。",
      ko: "백엔드에서는 GET /api-docs 또는 GET /api/docs로 기계 판독 가능한 API 설명도 제공합니다. 지원은 $1로 이메일을 보내세요.",
      fr: "Une description API lisible par machine est aussi disponible via GET /api-docs ou GET /api/docs sur le backend. Pour le support, écrivez à $1.",
      es: "También hay una descripción de API legible por máquina desde GET /api-docs o GET /api/docs en el backend. Para soporte, escribe a $1.",
    },
  },
  {
    match: /^(.+) more per (.+)$/,
    translations: { zh: "每 $2 多 $1", ja: "$2 あたり $1 増", ko: "$2당 $1 증가", fr: "$1 de plus par $2", es: "$1 más por $2" },
  },
  {
    match: /^(.+) less per (.+)$/,
    translations: { zh: "每 $2 少 $1", ja: "$2 あたり $1 減", ko: "$2당 $1 감소", fr: "$1 de moins par $2", es: "$1 menos por $2" },
  },
  {
    match: /^([\d,]+) reviews$/,
    translations: { zh: "$1 次审查", ja: "$1 件のレビュー", ko: "리뷰 $1개", fr: "$1 revues", es: "$1 revisiones" },
  },
  {
    match: /^Repository checkout up to (.+)$/,
    translations: {
      zh: "仓库 checkout 最高 $1",
      ja: "リポジトリ checkout 最大 $1",
      ko: "저장소 checkout 최대 $1",
      fr: "Checkout de dépôt jusqu'à $1",
      es: "Checkout de repositorio hasta $1",
    },
  },
  {
    match: /^(.+) \/ (.+) reviews used$/,
    translations: { zh: "$1 / $2 次审查已用", ja: "$1 / $2 件のレビュー使用済み", ko: "$1 / $2 리뷰 사용됨", fr: "$1 / $2 revues utilisées", es: "$1 / $2 revisiones usadas" },
  },
  {
    match: /^(.+) - (.+) pending$/,
    translations: { zh: "$1 - $2 个待处理", ja: "$1 - $2 件保留中", ko: "$1 - $2개 대기 중", fr: "$1 - $2 en attente", es: "$1 - $2 pendientes" },
  },
  {
    match: /^([+-].+) quota$/,
    translations: { zh: "$1 配额", ja: "$1 クォータ", ko: "$1 할당량", fr: "$1 quota", es: "$1 cuota" },
  },
  {
    match: /^([+-].+) pending$/,
    translations: { zh: "$1 待处理", ja: "$1 保留中", ko: "$1 대기 중", fr: "$1 en attente", es: "$1 pendiente" },
  },
  {
    match: /^([\d,]+) scan quota events$/,
    translations: { zh: "$1 条 scan 配额事件", ja: "$1 件のスキャンクォータイベント", ko: "스캔 할당량 이벤트 $1개", fr: "$1 événements de quota de scan", es: "$1 eventos de cuota de escaneo" },
  },
  {
    match: /^Open quota activity for (.+)$/,
    translations: { zh: "打开 $1 的配额明细", ja: "$1 のクォータ履歴を開く", ko: "$1의 할당량 활동 열기", fr: "Ouvrir l'activité de quota pour $1", es: "Abrir actividad de cuota de $1" },
  },
  {
    match: /^Billed (.+)$/,
    translations: { zh: "按 $1 计费", ja: "$1 請求", ko: "$1 청구", fr: "Facturé $1", es: "Facturado $1" },
  },
  {
    match: /^Switch to (.+)$/,
    translations: { zh: "切换到 $1", ja: "$1 に切り替え", ko: "$1로 전환", fr: "Passer à $1", es: "Cambiar a $1" },
  },
  {
    match: /^Start (.+)$/,
    translations: { zh: "升级 $1", ja: "$1 を開始", ko: "$1 시작", fr: "Démarrer $1", es: "Iniciar $1" },
  },
  {
    match: /^(.+) shared account reviews \/ month$/,
    translations: { zh: "$1 次/月 共享账户审查", ja: "$1 件/月 共有アカウントレビュー", ko: "월 $1개 공유 계정 리뷰", fr: "$1 revues de compte partagées / mois", es: "$1 revisiones de cuenta compartidas / mes" },
  },
  {
    match: /^reasoning: (.+)$/,
    translations: { zh: "推理：$1", ja: "推論: $1", ko: "추론: $1", fr: "raisonnement : $1", es: "razonamiento: $1" },
  },
  {
    match: /^(\d+) (critical|high|medium|low|info)$/,
    translations: {
      zh: (m, lang) => `${m[1]} ${severityLabel(m[2], lang)}`,
      ja: (m, lang) => `${m[1]} ${severityLabel(m[2], lang)}`,
      ko: (m, lang) => `${m[1]} ${severityLabel(m[2], lang)}`,
      fr: (m, lang) => `${m[1]} ${severityLabel(m[2], lang)}`,
      es: (m, lang) => `${m[1]} ${severityLabel(m[2], lang)}`,
    },
  },
  {
    match: /^(.+) risk$/,
    translations: { zh: "$1 风险", ja: "$1 リスク", ko: "$1 위험", fr: "risque $1", es: "riesgo $1" },
  },
  {
    match: /^(\d+) open issues$/,
    translations: { zh: "$1 个未解决问题", ja: "$1 件の未解決問題", ko: "열린 이슈 $1개", fr: "$1 problèmes ouverts", es: "$1 problemas abiertos" },
  },
  {
    match: /^Last: (.+)$/,
    translations: { zh: "最近：$1", ja: "最終: $1", ko: "최근: $1", fr: "Dernier : $1", es: "Último: $1" },
  },
  {
    match: /^Failed at (.+)%$/,
    translations: { zh: "失败时 $1%", ja: "$1% で失敗", ko: "$1%에서 실패", fr: "Échec à $1 %", es: "Falló al $1 %" },
  },
  {
    match: /^Scan failed at (.+)%$/,
    translations: { zh: "扫描在 $1% 时失败", ja: "スキャンは $1% で失敗しました", ko: "스캔이 $1%에서 실패했습니다", fr: "Le scan a échoué à $1 %", es: "El escaneo falló al $1 %" },
  },
  {
    match: /^Cancelled at (.+)%$/,
    translations: { zh: "取消时 $1%", ja: "$1% でキャンセル", ko: "$1%에서 취소됨", fr: "Annulé à $1 %", es: "Cancelado al $1 %" },
  },
  {
    match: /^Scan cancelled at (.+)%$/,
    translations: { zh: "扫描在 $1% 时取消", ja: "スキャンは $1% でキャンセルされました", ko: "스캔이 $1%에서 취소되었습니다", fr: "Le scan a été annulé à $1 %", es: "El escaneo se canceló al $1 %" },
  },
  {
    match: /^Last seen at (.+)%$/,
    translations: { zh: "最后为 $1%", ja: "最後は $1%", ko: "마지막 확인은 $1%", fr: "Dernière valeur à $1 %", es: "Último valor al $1 %" },
  },
  {
    match: /^Last reported progress was (.+)%$/,
    translations: { zh: "最后上报进度为 $1%", ja: "最後に報告された進捗は $1% でした", ko: "마지막으로 보고된 진행률은 $1%였습니다", fr: "La dernière progression signalée était de $1 %", es: "El último progreso informado fue del $1 %" },
  },
  {
    match: /^Estimated completion (.+)%$/,
    translations: { zh: "预计完成度 $1%", ja: "完了見込み $1%", ko: "예상 완료율 $1%", fr: "Achèvement estimé $1 %", es: "Finalización estimada $1 %" },
  },
  {
    match: /^(.+)% verified or static proof$/,
    translations: { zh: "$1% 已验证或静态证明", ja: "$1% 検証済みまたは静的証明", ko: "$1% 검증됨 또는 정적 증명", fr: "$1 % vérifiés ou preuve statique", es: "$1 % verificado o prueba estática" },
  },
  {
    match: /^(.+)% high-confidence findings$/,
    translations: { zh: "$1% 高置信度发现", ja: "$1% 高信頼度の検出", ko: "$1% 높은 신뢰도 발견", fr: "$1 % de résultats à forte confiance", es: "$1 % de hallazgos de alta confianza" },
  },
  {
    match: /^Showing (.+) of (.+) open issues$/,
    translations: { zh: "显示 $1 / $2 个未解决问题", ja: "$2 件中 $1 件の未解決問題を表示", ko: "$2개 열린 이슈 중 $1개 표시", fr: "Affichage de $1 sur $2 problèmes ouverts", es: "Mostrando $1 de $2 problemas abiertos" },
  },
  {
    match: /^(.+) of (.+) account scans left$/,
    translations: { zh: "账户扫描剩余 $1 / $2", ja: "アカウントスキャン残り $1 / $2", ko: "계정 스캔 남음 $1 / $2", fr: "$1 sur $2 scans de compte restants", es: "$1 de $2 escaneos de cuenta restantes" },
  },
  {
    match: /^(.+) of (.+) repo scans left$/,
    translations: { zh: "仓库扫描剩余 $1 / $2", ja: "リポジトリスキャン残り $1 / $2", ko: "저장소 스캔 남음 $1 / $2", fr: "$1 sur $2 scans de dépôt restants", es: "$1 de $2 escaneos de repositorio restantes" },
  },
  {
    match: /^Current checkout limit: (.+) files \/ (.+)\.$/,
    translations: { zh: "当前 checkout 限制：$1 个文件 / $2。", ja: "現在の checkout 制限: $1 ファイル / $2。", ko: "현재 checkout 제한: 파일 $1개 / $2.", fr: "Limite de checkout actuelle : $1 fichiers / $2.", es: "Límite actual de checkout: $1 archivos / $2." },
  },
  {
    match: /^Your account has (.+) (.+) left for this billing period\. Deselect another repository before selecting more\.$/,
    translations: {
      zh: "此计费周期账户剩余 $1 $2。请先取消选择其他仓库，再选择更多仓库。",
      ja: "この請求期間でアカウントに残っているのは $1 $2 です。さらに選択する前に別のリポジトリの選択を解除してください。",
      ko: "이 결제 기간에 계정에 $1 $2 남았습니다. 더 선택하기 전에 다른 저장소 선택을 해제하세요.",
      fr: "Votre compte dispose encore de $1 $2 pour cette période de facturation. Désélectionnez un autre dépôt avant d'en sélectionner davantage.",
      es: "Tu cuenta tiene $1 $2 restantes para este período de facturación. Deselecciona otro repositorio antes de seleccionar más.",
    },
  },
  {
    match: /^(.+) has 0 repository scans left for this billing period\.$/,
    translations: {
      zh: "$1 此计费周期仓库扫描剩余 0 次。",
      ja: "$1 はこの請求期間のリポジトリスキャン残り 0 件です。",
      ko: "$1의 이 결제 기간 저장소 스캔이 0개 남았습니다.",
      fr: "$1 n'a plus aucun scan de dépôt pour cette période de facturation.",
      es: "$1 no tiene escaneos de repositorio restantes para este período de facturación.",
    },
  },
  {
    match: /^Your account currently has (.+) (.+) left\. Choose up to (.+) repositories to scan now\.$/,
    translations: {
      zh: "此账户当前剩余 $1 $2。请最多选择 $3 个仓库进行扫描。",
      ja: "アカウントには現在 $1 $2 残っています。今スキャンするリポジトリを最大 $3 件選択してください。",
      ko: "이 계정에는 현재 $1 $2 남았습니다. 지금 스캔할 저장소를 최대 $3개 선택하세요.",
      fr: "Votre compte dispose actuellement de $1 $2. Choisissez jusqu'à $3 dépôts à scanner maintenant.",
      es: "Tu cuenta tiene actualmente $1 $2 restantes. Elige hasta $3 repositorios para escanear ahora.",
    },
  },
  {
    match: /^Only (.+) of these repositories can be scanned right now based on current quota\. Choose which repositories to scan\.$/,
    translations: {
      zh: "根据当前配额，现在只能扫描这些仓库中的 $1 个。请选择要扫描的仓库。",
      ja: "現在のクォータでは、これらのリポジトリのうち $1 件だけを今スキャンできます。スキャンするリポジトリを選択してください。",
      ko: "현재 할당량 기준으로 이 저장소 중 $1개만 지금 스캔할 수 있습니다. 스캔할 저장소를 선택하세요.",
      fr: "Selon le quota actuel, seuls $1 de ces dépôts peuvent être scannés maintenant. Choisissez les dépôts à scanner.",
      es: "Según la cuota actual, solo $1 de estos repositorios se pueden escanear ahora. Elige qué repositorios escanear.",
    },
  },
  {
    match: /^You can choose (.+) (.+) because that is the current effective quota\.$/,
    translations: {
      zh: "当前有效配额下，你只能选择 $1 $2。",
      ja: "現在の有効クォータのため、$1 $2 を選択できます。",
      ko: "현재 유효 할당량이므로 $1 $2 선택할 수 있습니다.",
      fr: "Vous pouvez choisir $1 $2 car c'est le quota effectif actuel.",
      es: "Puedes elegir $1 $2 porque esa es la cuota efectiva actual.",
    },
  },
  {
    match: /^([\d,]+) authorized repos$/,
    translations: { zh: "$1 个已授权仓库", ja: "$1 件の認可済みリポジトリ", ko: "승인된 저장소 $1개", fr: "$1 dépôts autorisés", es: "$1 repositorios autorizados" },
  },
  {
    match: /^Loaded (.+) of (.+) repositories\.$/,
    translations: { zh: "已加载 $1 / $2 个仓库。", ja: "$2 件中 $1 件のリポジトリを読み込み済み。", ko: "$2개 저장소 중 $1개 로드됨.", fr: "$1 sur $2 dépôts chargés.", es: "$1 de $2 repositorios cargados." },
  },
  {
    match: /^(.+) of (.+) selected$/,
    translations: { zh: "已选 $1 / $2", ja: "$2 件中 $1 件選択済み", ko: "$2개 중 $1개 선택됨", fr: "$1 sur $2 sélectionnés", es: "$1 de $2 seleccionados" },
  },
  {
    match: /^(.+) scans created, (.+) not created$/,
    translations: { zh: "$1 个扫描已创建，$2 个未创建", ja: "$1 件のスキャンを作成、$2 件は未作成", ko: "스캔 $1개 생성됨, $2개 생성되지 않음", fr: "$1 scans créés, $2 non créés", es: "$1 escaneos creados, $2 no creados" },
  },
  {
    match: /^(.+) scans created$/,
    translations: { zh: "$1 个扫描已创建", ja: "$1 件のスキャンを作成", ko: "스캔 $1개 생성됨", fr: "$1 scans créés", es: "$1 escaneos creados" },
  },
  {
    match: /^Checkout: (.+) files \/ (.+)$/,
    translations: { zh: "检出规模：$1 个文件 / $2", ja: "Checkout: $1 ファイル / $2", ko: "Checkout: 파일 $1개 / $2", fr: "Checkout : $1 fichiers / $2", es: "Checkout: $1 archivos / $2" },
  },
  {
    match: /^Limit: (.+) files \/ (.+)$/,
    translations: { zh: "限制：$1 个文件 / $2", ja: "制限: $1 ファイル / $2", ko: "제한: 파일 $1개 / $2", fr: "Limite : $1 fichiers / $2", es: "Límite: $1 archivos / $2" },
  },
  {
    match: /^Reasons: (.+)$/,
    translations: { zh: "命中限制：$1", ja: "理由: $1", ko: "이유: $1", fr: "Raisons : $1", es: "Motivos: $1" },
  },
  {
    match: /^([\d,]+) manifests$/,
    translations: { zh: "$1 个清单", ja: "$1 件のマニフェスト", ko: "매니페스트 $1개", fr: "$1 manifestes", es: "$1 manifiestos" },
  },
  {
    match: /^([\d,]+) tool checks$/,
    translations: { zh: "$1 项工具检查", ja: "$1 件のツールチェック", ko: "도구 검사 $1개", fr: "$1 contrôles d'outils", es: "$1 comprobaciones de herramientas" },
  },
  {
    match: /^([\d,]+) confirmed$/,
    translations: { zh: "$1 个已确认", ja: "$1 件確認済み", ko: "$1개 확인됨", fr: "$1 confirmés", es: "$1 confirmados" },
  },
  {
    match: /^(.+) issue status update failed\.$/,
    translations: { zh: "$1 个问题状态更新失败。", ja: "$1 件の問題ステータス更新に失敗しました。", ko: "이슈 상태 업데이트 $1개 실패.", fr: "$1 mise à jour de statut de problème a échoué.", es: "Falló la actualización de estado de $1 problema(s)." },
  },
  {
    match: /^(.+) of (.+) items$/,
    translations: { zh: "$1 / $2 项", ja: "$2 件中 $1 件", ko: "$2개 항목 중 $1개", fr: "$1 sur $2 éléments", es: "$1 de $2 elementos" },
  },
  {
    match: /^View issue (.+)$/,
    translations: { zh: "查看问题 $1", ja: "問題 $1 を表示", ko: "이슈 $1 보기", fr: "Voir le problème $1", es: "Ver problema $1" },
  },
  {
    match: /^job (.+)$/,
    translations: { zh: "任务 $1", ja: "ジョブ $1", ko: "작업 $1", fr: "tâche $1", es: "trabajo $1" },
  },
  {
    match: /^([\d,]+) scan$/,
    translations: { zh: "$1 次扫描", ja: "$1 件のスキャン", ko: "스캔 $1개", fr: "$1 scan", es: "$1 escaneo" },
  },
  {
    match: /^([\d,]+) scans$/,
    translations: { zh: "$1 次扫描", ja: "$1 件のスキャン", ko: "스캔 $1개", fr: "$1 scans", es: "$1 escaneos" },
  },
  {
    match: /^View scan (.*)$/,
    translations: { zh: "查看扫描 $1", ja: "スキャン $1 を表示", ko: "스캔 $1 보기", fr: "Voir le scan $1", es: "Ver escaneo $1" },
  },
  {
    match: /^([\d,]+) issue$/,
    translations: { zh: "$1 个问题", ja: "$1 件の問題", ko: "이슈 $1개", fr: "$1 problème", es: "$1 problema" },
  },
  {
    match: /^([\d,]+) issues$/,
    translations: { zh: "$1 个问题", ja: "$1 件の問題", ko: "이슈 $1개", fr: "$1 problèmes", es: "$1 problemas" },
  },
  {
    match: /^(.+) issues: critical (.+), high (.+), medium (.+), low (.+)$/,
    translations: {
      zh: "$1 个问题：关键 $2，高 $3，中 $4，低 $5",
      ja: "$1 件の問題: クリティカル $2、高 $3、中 $4、低 $5",
      ko: "이슈 $1개: 치명적 $2, 높음 $3, 중간 $4, 낮음 $5",
      fr: "$1 problèmes : critique $2, élevé $3, moyen $4, faible $5",
      es: "$1 problemas: crítico $2, alto $3, medio $4, bajo $5",
    },
  },
  {
    match: /^(.+) of (.+) scans$/,
    translations: { zh: "$1 / $2 次扫描", ja: "$2 件中 $1 件のスキャン", ko: "$2개 스캔 중 $1개", fr: "$1 sur $2 scans", es: "$1 de $2 escaneos" },
  },
  {
    match: /^(.+) repositories authorized(.*)$/,
    translations: { zh: "$1 个仓库已授权$2", ja: "$1 件のリポジトリ認可済み$2", ko: "저장소 $1개 승인됨$2", fr: "$1 dépôts autorisés$2", es: "$1 repositorios autorizados$2" },
  },
  {
    match: /^Questions\? Email (.+)\.$/,
    translations: { zh: "如有问题，请联系 $1。", ja: "質問は $1 までメールしてください。", ko: "질문은 $1로 이메일을 보내세요.", fr: "Questions ? Écrivez à $1.", es: "¿Preguntas? Escribe a $1." },
  },
  {
    match: /^You can request access, export, correction, or deletion of your account data by contacting (.+)\. You can also revoke API keys, disconnect or manage GitHub access, cancel or resume renewal, and use supported subscription upgrades from Pullwise Billing where those controls are available\.$/,
    translations: {
      zh: "你可以通过 $1 请求访问、导出、更正或删除账户数据。你也可以在产品提供相应控件时吊销 API key、断开或管理 GitHub 访问、取消或恢复续订，并使用支持的订阅升级。",
      ja: "$1 に連絡して、アカウントデータのアクセス、エクスポート、訂正、削除を要求できます。利用可能な場合は、API キーの取り消し、GitHub アクセスの切断または管理、更新のキャンセルまたは再開、Pullwise Billing から対応サブスクリプションアップグレードも利用できます。",
      ko: "$1에 연락하여 계정 데이터 접근, 내보내기, 수정 또는 삭제를 요청할 수 있습니다. 해당 제어가 제공되는 경우 API 키 취소, GitHub 접근 연결 해제 또는 관리, 갱신 취소 또는 재개, Pullwise Billing의 지원되는 구독 업그레이드도 사용할 수 있습니다.",
      fr: "Vous pouvez demander l'accès, l'export, la correction ou la suppression de vos données de compte en contactant $1. Vous pouvez aussi révoquer les clés API, déconnecter ou gérer l'accès GitHub, annuler ou reprendre le renouvellement et utiliser les mises à niveau d'abonnement prises en charge depuis Pullwise Billing lorsque ces contrôles sont disponibles.",
      es: "Puedes solicitar acceso, exportación, corrección o eliminación de los datos de tu cuenta contactando a $1. También puedes revocar claves API, desconectar o gestionar acceso a GitHub, cancelar o reanudar renovación y usar mejoras de suscripción admitidas desde Pullwise Billing cuando esos controles estén disponibles.",
    },
  },
  {
    match: /^For privacy questions or data requests, contact (.+)\. For security reports, contact (.+)\.$/,
    translations: {
      zh: "隐私问题或数据请求请联系 $1。安全报告请联系 $2。",
      ja: "プライバシーの質問またはデータリクエストは $1 へ。セキュリティ報告は $2 へ連絡してください。",
      ko: "개인정보 질문 또는 데이터 요청은 $1로 문의하세요. 보안 보고는 $2로 문의하세요.",
      fr: "Pour les questions de confidentialité ou demandes de données, contactez $1. Pour les rapports de sécurité, contactez $2.",
      es: "Para preguntas de privacidad o solicitudes de datos, contacta a $1. Para reportes de seguridad, contacta a $2.",
    },
  },
  {
    match: /^For questions about these Terms, contact (.+)\.$/,
    translations: { zh: "如对本条款有疑问，请联系 $1。", ja: "本規約に関する質問は $1 まで。", ko: "본 약관에 대한 질문은 $1로 문의하세요.", fr: "Pour toute question sur ces Conditions, contactez $1.", es: "Para preguntas sobre estos Términos, contacta a $1." },
  },
  {
    match: /^Repo checkout (.+) files \/ (.+)$/,
    translations: { zh: "仓库 checkout $1 个文件 / $2", ja: "リポジトリ checkout $1 ファイル / $2", ko: "저장소 checkout 파일 $1개 / $2", fr: "Checkout dépôt $1 fichiers / $2", es: "Checkout repo $1 archivos / $2" },
  },
  {
    match: /^(.+) global queued$/,
    translations: { zh: "全局排队上限 $1", ja: "全体キュー $1", ko: "전체 대기열 $1", fr: "$1 en file globalement", es: "$1 en cola global" },
  },
  {
    match: /^(.+) queued \/ (.+) running \/ (.+) busy \/ (.+) idle workers$/,
    translations: {
      zh: "$1 排队 / $2 运行中 / $3 忙碌 / $4 空闲工作器",
      ja: "$1 待機 / $2 実行中 / $3 処理中 / $4 アイドルのワーカー",
      ko: "$1 대기 / $2 실행 중 / $3 작업 중 / $4 유휴 워커",
      fr: "$1 en attente / $2 en cours / $3 occupés / $4 workers inactifs",
      es: "$1 en cola / $2 en ejecución / $3 ocupados / $4 workers inactivos",
    },
  },
  {
    match: /^Go to (.+)$/,
    translations: { zh: "前往 $1", ja: "$1 へ移動", ko: "$1로 이동", fr: "Aller à $1", es: "Ir a $1" },
  },
];
