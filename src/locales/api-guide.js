// Source-backed integration guidance in all supported languages.
export const API_GUIDE_COPY = {
  quickstart: [
    "Quickstart: save your first expense",
    {
      zh: "快速接入：保存第一笔支出",
      ja: "クイックスタート：最初の支出を保存",
      ko: "빠른 시작: 첫 지출 저장",
      fr: "Démarrage rapide : enregistrer votre première dépense",
      es: "Inicio rápido: guarda tu primer gasto",
    },
  ],
  sharedApi: [
    "The Web ledger and external clients use the same REST resources and business rules. Web authenticates with its login cookie; integrations use a Bearer API key. Projects, categories, project/shared expenses, recurring rules and member management use this API.",
    {
      zh: "Web 账本与外部客户端使用相同 REST 资源和业务规则。Web 使用登录 Cookie，外部集成使用 Bearer API 密钥。项目、类别、项目和公共池支出、周期计划及成员管理都通过这套 API 完成。",
      ja: "Web 台帳と外部クライアントは同じ REST リソースと業務ルールを使います。Web はログイン Cookie、外部連携は Bearer API キーで認証します。プロジェクト、カテゴリー、プロジェクトと共有プールの支出、定期ルール、メンバー管理をこの API で扱います。",
      ko: "Web 원장과 외부 클라이언트는 같은 REST 리소스와 업무 규칙을 사용합니다. Web은 로그인 Cookie로, 외부 연동은 Bearer API 키로 인증합니다. 프로젝트, 카테고리, 프로젝트 및 공유 풀 지출, 반복 규칙과 구성원 관리는 이 API를 사용합니다.",
      fr: "Le registre Web et les clients externes utilisent les mêmes ressources REST et règles métier. Le Web s’authentifie avec son cookie de connexion ; les intégrations utilisent une clé API Bearer. Projets, catégories, dépenses de projet ou du pool partagé, règles récurrentes et gestion des membres passent par cette API.",
      es: "El libro Web y los clientes externos usan los mismos recursos REST y reglas de negocio. Web se autentica con su cookie de sesión; las integraciones usan una clave API Bearer. Esta API gestiona proyectos, categorías, gastos de proyecto y del fondo compartido, reglas recurrentes y miembros.",
    },
  ],
  setup: [
    "Sign in, select a ledger, and create at least one active category in Categories. A standalone project does not need GitHub. This example records a real shared expense and needs Bash, curl, jq and openssl. Replace the date, amount and purpose with your intended entry before running.",
    {
      zh: "登录并选择账本，在类别页面至少创建一个启用类别。独立项目无需 GitHub。本例会记录真实公共池支出，需要 Bash、curl、jq 和 openssl；执行前请替换为要记录的日期、金额和用途。",
      ja: "ログインして台帳を選び、Categories で有効なカテゴリーを少なくとも 1 件作成します。独立したプロジェクトに GitHub は不要です。この例は実際の共有支出を記録するため、Bash、curl、jq、openssl が必要です。実行前に日付、金額、用途を記録したい内容に置き換えてください。",
      ko: "로그인하고 원장을 선택한 뒤 Categories에서 활성 카테고리를 하나 이상 만드세요. 독립 프로젝트에는 GitHub가 필요하지 않습니다. 이 예제는 실제 공유 지출을 기록하며 Bash, curl, jq, openssl이 필요합니다. 실행 전에 날짜, 금액과 용도를 기록하려는 내용으로 바꾸세요.",
      fr: "Connectez-vous, sélectionnez un registre et créez au moins une catégorie active dans Categories. Un projet indépendant ne nécessite pas GitHub. Cet exemple enregistre une véritable dépense partagée et nécessite Bash, curl, jq et openssl. Remplacez la date, le montant et le motif par votre entrée avant de l’exécuter.",
      es: "Inicia sesión, selecciona un libro y crea al menos una categoría activa en Categories. Un proyecto independiente no necesita GitHub. Este ejemplo registra un gasto compartido real y requiere Bash, curl, jq y openssl. Antes de ejecutarlo, sustituye la fecha, el importe y el motivo por los datos que quieras registrar.",
    },
  ],
  key: [
    "Open API Keys in the same ledger. Select profile:read, categories:read, projects:read, expenses:read, expenses:write and reports:read, and enable shared-pool access. Save the one-time token immediately; later key listings never reveal it. Keep it on your server in an environment variable. A key with an explicit empty project allowlist can access no projects; shared access is independent.",
    {
      zh: "在同一账本打开 API 密钥，选择 profile:read、categories:read、projects:read、expenses:read、expenses:write、reports:read，并允许公共池访问。立即保存仅展示一次的令牌，后续列表不会显示完整令牌；在自己的服务端通过环境变量保存。明确为空的项目白名单无法访问任何项目，公共池权限独立控制。",
      ja: "同じ台帳で API Keys を開きます。profile:read、categories:read、projects:read、expenses:read、expenses:write、reports:read を選び、共有プールへのアクセスを有効にします。一度だけ表示されるトークンをすぐに保存してください。後のキー一覧で全文は表示されません。サーバーの環境変数に保管します。プロジェクトの許可リストが明示的に空の場合、どのプロジェクトにもアクセスできません。共有プールの権限は別に設定します。",
      ko: "같은 원장에서 API Keys를 여세요. profile:read, categories:read, projects:read, expenses:read, expenses:write, reports:read를 선택하고 공유 풀 접근을 허용하세요. 한 번만 표시되는 토큰을 즉시 저장하세요. 이후 키 목록에는 전체 토큰이 나타나지 않습니다. 서버의 환경 변수에 보관하세요. 프로젝트 허용 목록이 명시적으로 비어 있으면 어떤 프로젝트에도 접근할 수 없으며, 공유 풀 접근은 별도로 제어됩니다.",
      fr: "Ouvrez API Keys dans le même registre. Sélectionnez profile:read, categories:read, projects:read, expenses:read, expenses:write et reports:read, puis autorisez le pool partagé. Enregistrez immédiatement le jeton affiché une seule fois : les listes ultérieures ne le révèlent jamais. Conservez-le dans une variable d’environnement de votre serveur. Une liste de projets explicitement vide n’autorise aucun projet ; l’accès partagé est indépendant.",
      es: "Abre API Keys en el mismo libro. Selecciona profile:read, categories:read, projects:read, expenses:read, expenses:write y reports:read, y permite el acceso al fondo compartido. Guarda de inmediato el token que se muestra una sola vez; las listas posteriores nunca lo revelan completo. Guárdalo en una variable de entorno de tu servidor. Una lista de proyectos permitidos explícitamente vacía no permite acceder a ningún proyecto; el acceso compartido es independiente.",
    },
  ],
  firstExpense: [
    "Verify the key, find a category, create and read an expense",
    {
      zh: "验证密钥、获取类别、创建并读取支出",
      ja: "キーを確認し、カテゴリーを取得して支出を作成・取得",
      ko: "키 확인, 카테고리 조회, 지출 생성 및 조회",
      fr: "Vérifier la clé, trouver une catégorie, créer et lire une dépense",
      es: "Verifica la clave, busca una categoría, crea y consulta un gasto",
    },
  ],
  response: [
    "A successful create returns HTTP 201 and the expense object directly. Read id and revision from that object; there is no data wrapper. The following response is illustrative and omits timestamps, optional fields and assistance. Categories return a JSON array; expense/project/rule lists return items and nextCursor.",
    {
      zh: "创建成功返回 HTTP 201，响应直接是支出对象，没有 data 包装，从中读取 id 和 revision。下面是说明性响应，省略了时间戳、可选字段和辅助结果。类别返回 JSON 数组，支出、项目和周期计划列表返回 items 和 nextCursor。",
      ja: "作成に成功すると HTTP 201 と支出オブジェクトが直接返されます。data ラッパーはなく、そのオブジェクトから id と revision を読み取ります。以下は説明用のレスポンスで、タイムスタンプ、任意項目、補助結果を省略しています。カテゴリーは JSON 配列、支出・プロジェクト・ルールの一覧は items と nextCursor を返します。",
      ko: "생성에 성공하면 HTTP 201과 지출 객체가 직접 반환됩니다. data 래퍼 없이 해당 객체에서 id와 revision을 읽습니다. 아래 응답은 설명용이며 타임스탬프, 선택 필드와 보조 결과를 생략했습니다. 카테고리는 JSON 배열을 반환하고 지출·프로젝트·규칙 목록은 items와 nextCursor를 반환합니다.",
      fr: "Une création réussie renvoie HTTP 201 et directement l’objet dépense, sans enveloppe data. Lisez id et revision dans cet objet. La réponse suivante est illustrative et omet les horodatages, les champs facultatifs et l’assistance. Les catégories renvoient un tableau JSON ; les listes de dépenses, projets et règles renvoient items et nextCursor.",
      es: "Una creación correcta devuelve HTTP 201 y el objeto de gasto directamente, sin envoltorio data. Lee id y revision de ese objeto. La siguiente respuesta es ilustrativa y omite marcas de tiempo, campos opcionales y asistencia. Las categorías devuelven un array JSON; las listas de gastos, proyectos y reglas devuelven items y nextCursor.",
    },
  ],
  responseExample: [
    "Example response (illustrative IDs)",
    {
      zh: "响应示例（说明性 ID）",
      ja: "レスポンス例（説明用の ID）",
      ko: "응답 예시 (설명용 ID)",
      fr: "Exemple de réponse (identifiants illustratifs)",
      es: "Ejemplo de respuesta (ID ilustrativos)",
    },
  ],
  projectTarget: [
    "Project expenses use the same POST /api/v1/expenses endpoint. Choose an allowed active project from GET /api/v1/projects and use target.kind project with target.projectId. Shared expenses use target.kind shared and must omit projectId. Neither expenses nor recurring rules accept a separate workspace ID in the body.",
    {
      zh: "项目支出使用相同 POST /api/v1/expenses 接口。从 GET /api/v1/projects 选择获准的启用项目，设置 target.kind 为 project 并填写 target.projectId。公共池支出的 target.kind 为 shared，必须省略 projectId。支出和周期计划请求体都不接受另一个 workspace ID。",
      ja: "プロジェクト支出も POST /api/v1/expenses を使います。GET /api/v1/projects から許可された有効なプロジェクトを選び、target.kind を project、target.projectId をその ID にします。共有支出は target.kind を shared にして projectId を省略します。支出と定期ルールの本文には別の workspace ID を指定できません。",
      ko: "프로젝트 지출도 POST /api/v1/expenses를 사용합니다. GET /api/v1/projects에서 허용된 활성 프로젝트를 선택하고 target.kind를 project로, target.projectId를 해당 ID로 지정하세요. 공유 지출은 target.kind를 shared로 지정하고 projectId를 생략해야 합니다. 지출 및 반복 규칙 본문에는 별도의 workspace ID를 넣을 수 없습니다.",
      fr: "Les dépenses de projet utilisent aussi POST /api/v1/expenses. Choisissez un projet actif autorisé via GET /api/v1/projects, avec target.kind égal à project et target.projectId. Les dépenses partagées utilisent target.kind égal à shared et doivent omettre projectId. Les dépenses et règles récurrentes n’acceptent pas d’autre ID de workspace dans le corps.",
      es: "Los gastos de proyecto usan el mismo POST /api/v1/expenses. Elige un proyecto activo permitido desde GET /api/v1/projects y usa target.kind igual a project con target.projectId. Los gastos compartidos usan target.kind igual a shared y deben omitir projectId. Ni los gastos ni las reglas recurrentes aceptan otro ID de workspace en el cuerpo.",
    },
  ],
  projectExpense: [
    "Choose the project target",
    {
      zh: "选择项目目标",
      ja: "対象プロジェクトを選ぶ",
      ko: "프로젝트 대상 선택",
      fr: "Choisir le projet cible",
      es: "Selecciona el proyecto de destino",
    },
  ],
  environments: [
    "Environments and request URLs",
    {
      zh: "环境与请求地址",
      ja: "環境とリクエスト URL",
      ko: "환경 및 요청 URL",
      fr: "Environnements et URL des requêtes",
      es: "Entornos y URL de las solicitudes",
    },
  ],
  base: [
    "Append the exact reference path to the base URL. Direct Server clients use /api/v1/... . The Web base ends in /api, so its ledger requests are /api/api/v1/...; the Web Worker removes only the outer /api. Authentication paths such as /auth/session have no /api/v1 prefix.",
    {
      zh: "将参考中的完整路径追加到基础地址。直连 Server 使用 /api/v1/...；Web 基础地址以 /api 结尾，所以账本请求为 /api/api/v1/...，Web Worker 只移除外层 /api。/auth/session 等认证路径没有 /api/v1 前缀。",
      ja: "ベース URL にリファレンスの正確なパスを追加します。Server に直接接続するクライアントは /api/v1/... を使います。Web のベースは /api で終わるため、台帳リクエストは /api/api/v1/... になり、Web Worker は外側の /api だけを取り除きます。/auth/session などの認証パスには /api/v1 の接頭辞がありません。",
      ko: "참조 문서의 정확한 경로를 기본 URL에 붙이세요. Server 직접 연결 클라이언트는 /api/v1/...를 사용합니다. Web 기본 주소는 /api로 끝나므로 원장 요청은 /api/api/v1/...가 되며 Web Worker는 바깥쪽 /api만 제거합니다. /auth/session 같은 인증 경로에는 /api/v1 접두사가 없습니다.",
      fr: "Ajoutez le chemin exact de la référence à l’URL de base. Les clients directs du Server utilisent /api/v1/... . La base Web se termine par /api : ses requêtes de registre sont donc /api/api/v1/..., et le Web Worker retire seulement le /api extérieur. Les chemins d’authentification comme /auth/session n’ont pas de préfixe /api/v1.",
      es: "Añade la ruta exacta de la referencia a la URL base. Los clientes directos del Server usan /api/v1/... . La base Web termina en /api, por lo que sus solicitudes del libro usan /api/api/v1/...; el Web Worker elimina solo el /api exterior. Las rutas de autenticación, como /auth/session, no tienen el prefijo /api/v1.",
    },
  ],
  directUrls: [
    "Direct and Web proxy URLs",
    {
      zh: "直连与 Web 代理地址",
      ja: "直接接続と Web プロキシの URL",
      ko: "직접 연결 및 Web 프록시 URL",
      fr: "URL directes et du proxy Web",
      es: "URL directas y del proxy Web",
    },
  ],
  availability: [
    "The current ledger release is available in Preview. Production database access remains paused; production can return 503 D1_ACCESS_PAUSED. Preview and production accounts, keys and data are separate. Use the Preview API and a Preview key for the current integration; this documentation does not activate production.",
    {
      zh: "当前账本版本在 Preview 可用，生产数据库访问仍暂停，生产可能返回 503 D1_ACCESS_PAUSED。Preview 和生产账户、密钥及数据相互隔离；当前接入请使用 Preview API 和 Preview 密钥。文档更新不会启用生产。",
      ja: "現在の台帳バージョンは Preview で利用できます。本番データベースへのアクセスは停止中で、503 D1_ACCESS_PAUSED が返る場合があります。Preview と本番のアカウント、キー、データは別です。現在の連携には Preview API と Preview キーを使ってください。この文書は本番環境を有効にしません。",
      ko: "현재 원장 버전은 Preview에서 사용할 수 있습니다. 프로덕션 데이터베이스 접근은 계속 중지되어 있으며 503 D1_ACCESS_PAUSED가 반환될 수 있습니다. Preview와 프로덕션의 계정, 키, 데이터는 분리되어 있습니다. 현재 연동에는 Preview API와 Preview 키를 사용하세요. 이 문서가 프로덕션을 활성화하지는 않습니다.",
      fr: "La version actuelle du registre est disponible en Preview. L’accès à la base de production reste suspendu et peut renvoyer 503 D1_ACCESS_PAUSED. Les comptes, clés et données de Preview et de production sont séparés. Utilisez l’API Preview et une clé Preview pour l’intégration actuelle ; cette documentation n’active pas la production.",
      es: "La versión actual del libro está disponible en Preview. El acceso a la base de producción sigue en pausa y puede devolver 503 D1_ACCESS_PAUSED. Las cuentas, claves y datos de Preview y producción están separados. Para la integración actual usa la API Preview y una clave Preview; esta documentación no activa producción.",
    },
  ],
  cookies: [
    "The Web REST client sends its HttpOnly login cookie and X-Pullwise-Workspace for the selected ledger. Cookie writes require the configured trusted Origin; setting a Referer alone is insufficient for ledger writes. API-key requests use Authorization: Bearer and do not need a browser cookie. Account login, linking and joining another ledger remain explicit authenticated account flows.",
    {
      zh: "Web REST 客户端发送 HttpOnly 登录 Cookie，并用 X-Pullwise-Workspace 指定当前账本。Cookie 写操作需要已配置的可信 Origin，仅 Referer 不足以授权账本写入。API 密钥请求使用 Authorization: Bearer，无需浏览器 Cookie。账户登录、绑定及加入其他账本仍是明确的账户认证流程。",
      ja: "Web REST クライアントは HttpOnly のログイン Cookie と、選択した台帳を指定する X-Pullwise-Workspace を送信します。Cookie による書き込みには設定済みの信頼できる Origin が必要で、台帳の書き込みに Referer だけでは不十分です。API キーのリクエストは Authorization: Bearer を使い、ブラウザー Cookie は不要です。ログイン、アカウント連携、別台帳への参加は明示的なアカウント認証フローです。",
      ko: "Web REST 클라이언트는 HttpOnly 로그인 Cookie와 선택한 원장을 지정하는 X-Pullwise-Workspace를 보냅니다. Cookie 쓰기에는 설정된 신뢰 Origin이 필요하며, Referer만으로는 원장 쓰기를 허용할 수 없습니다. API 키 요청은 Authorization: Bearer를 사용하며 브라우저 Cookie가 필요 없습니다. 로그인, 계정 연결과 다른 원장 참여는 명시적인 계정 인증 흐름입니다.",
      fr: "Le client REST Web envoie son cookie de connexion HttpOnly et X-Pullwise-Workspace pour le registre sélectionné. Les écritures par cookie exigent l’Origin de confiance configuré ; un Referer seul ne suffit pas pour écrire dans le registre. Les requêtes par clé API utilisent Authorization: Bearer sans cookie navigateur. Connexion, liaison et adhésion à un autre registre restent des démarches explicites d’authentification du compte.",
      es: "El cliente REST Web envía su cookie de sesión HttpOnly y X-Pullwise-Workspace para el libro seleccionado. Las escrituras con Cookie requieren el Origin de confianza configurado; un Referer por sí solo no basta para escribir en el libro. Las solicitudes con clave API usan Authorization: Bearer sin Cookie del navegador. Iniciar sesión, vincular cuentas y unirse a otro libro siguen siendo flujos explícitos de autenticación de la cuenta.",
    },
  ],
  permissions: [
    "Scopes, roles and ledger boundaries",
    {
      zh: "权限范围、角色与账本边界",
      ja: "スコープ、役割、台帳の境界",
      ko: "권한 범위, 역할 및 원장 경계",
      fr: "Permissions, rôles et limites du registre",
      es: "Permisos, roles y límites del libro",
    },
  ],
  authority: [
    "A scope never grants a stronger role. Every operation intersects the key's scopes, its bound ledger, the issuing member's current role and target restrictions. Owner and Admin manage projects/categories; Editor also writes expenses and recurring rules; Viewer reads. Only the Owner removes projects. Member changes invalidate keys tied to the old membership revision.",
    {
      zh: "权限范围不会提升角色。每项操作都同时检查密钥范围、绑定账本、发行成员的当前角色和目标限制。Owner 和 Admin 管理项目与类别，Editor 可写支出与周期计划，Viewer 只读。只有 Owner 可移除项目；成员版本变化会使旧版本密钥失效。",
      ja: "スコープで役割が強化されることはありません。すべての操作でキーのスコープ、固定された台帳、発行者の現在の役割、対象制限を同時に確認します。Owner と Admin はプロジェクトとカテゴリーを管理し、Editor も支出と定期ルールを書き込めます。Viewer は読み取り専用です。プロジェクトを削除できるのは Owner だけです。メンバーのバージョン変更は古いバージョンに紐づくキーを無効にします。",
      ko: "권한 범위는 더 높은 역할을 부여하지 않습니다. 모든 작업은 키의 범위, 연결된 원장, 발급 구성원의 현재 역할과 대상 제한을 함께 확인합니다. Owner와 Admin은 프로젝트와 카테고리를 관리하고, Editor도 지출과 반복 규칙을 쓸 수 있습니다. Viewer는 읽기만 가능합니다. 프로젝트 제거는 Owner만 할 수 있습니다. 구성원 버전이 바뀌면 이전 버전에 연결된 키가 무효화됩니다.",
      fr: "Une permission n’accorde jamais un rôle supérieur. Chaque opération vérifie les permissions de la clé, son registre lié, le rôle actuel de son émetteur et les restrictions de cible. Owner et Admin gèrent projets et catégories ; Editor écrit aussi les dépenses et règles récurrentes ; Viewer lit. Seul Owner supprime les projets. Les changements de version d’adhésion invalident les clés liées à l’ancienne version.",
      es: "Un permiso nunca concede un rol superior. Cada operación comprueba los permisos de la clave, su libro vinculado, el rol actual del emisor y las restricciones de destino. Owner y Admin gestionan proyectos y categorías; Editor también escribe gastos y reglas recurrentes; Viewer consulta. Solo Owner elimina proyectos. Los cambios de versión de la membresía invalidan las claves vinculadas a la versión anterior.",
    },
  ],
  profileScope: [
    "Read the current actor, bound workspace and effective scopes with /me.",
    {
      zh: "通过 /me 读取当前操作账户、绑定账本及有效权限范围。",
      ja: "/me で現在の操作アカウント、固定された workspace、有効なスコープを取得します。",
      ko: "/me로 현재 작업 계정, 연결된 workspace와 유효 권한 범위를 조회합니다.",
      fr: "Lisez l’acteur actuel, le workspace lié et les permissions effectives via /me.",
      es: "Consulta el actor actual, el workspace vinculado y los permisos efectivos con /me.",
    },
  ],
  projectScope: [
    "Read projects/repositories; create or edit projects as Owner/Admin. Project removal additionally requires Owner.",
    {
      zh: "读取项目与仓库；Owner/Admin 可创建或编辑项目，移除项目还要求 Owner。",
      ja: "プロジェクトとリポジトリを取得します。Owner/Admin はプロジェクトを作成・編集でき、削除にはさらに Owner が必要です。",
      ko: "프로젝트와 저장소를 조회합니다. Owner/Admin은 프로젝트를 생성하거나 편집하며, 제거에는 Owner가 필요합니다.",
      fr: "Lisez projets et dépôts ; Owner/Admin crée ou modifie les projets. Leur suppression exige en plus Owner.",
      es: "Consulta proyectos y repositorios; Owner/Admin crea o edita proyectos. La eliminación requiere además ser Owner.",
    },
  ],
  categoryScope: [
    "Read categories and historical labels; Owner/Admin can create, rename, archive or remove categories. Removal preserves historical names.",
    {
      "zh": "读取类别与历史名称；Owner/Admin 可以创建、改名、归档或移除类别。移除仍保留历史名称。",
      "ja": "カテゴリーと履歴の名称を読み取ります。Owner/Admin は作成、改名、アーカイブ、削除ができ、削除後も履歴の名称は保持されます。",
      "ko": "카테고리와 과거 이름을 읽습니다. Owner/Admin은 생성, 이름 변경, 보관 또는 제거할 수 있으며 제거 후에도 과거 이름은 유지됩니다.",
      "fr": "Lire les catégories et leurs libellés historiques ; Owner/Admin peut créer, renommer, archiver ou supprimer une catégorie. La suppression conserve les noms historiques.",
      "es": "Leer categorías y nombres históricos; Owner/Admin puede crear, renombrar, archivar o eliminar categorías. La eliminación conserva los nombres históricos."
    }
  ],
  expenseScope: [
    "Read/export expenses and read recurring rules; Owner/Admin/Editor creates, edits and removes expenses and creates, edits, pauses, resumes or cancels recurring rules.",
    {
      zh: "读取和导出支出、读取周期计划；Owner/Admin/Editor 可创建、编辑、移除支出以及创建、编辑、暂停、恢复、取消周期计划。",
      ja: "支出を取得・エクスポートし、定期ルールを取得します。Owner/Admin/Editor は支出の作成・編集・削除と、定期ルールの作成・編集・一時停止・再開・取消を行えます。",
      ko: "지출 조회·내보내기와 반복 규칙 조회를 합니다. Owner/Admin/Editor는 지출 생성·편집·제거 및 반복 규칙 생성·편집·일시 중지·재개·취소를 할 수 있습니다.",
      fr: "Lisez/exportez les dépenses et lisez les règles récurrentes. Owner/Admin/Editor crée, modifie ou supprime les dépenses et crée, modifie, suspend, reprend ou annule les règles.",
      es: "Consulta y exporta gastos y consulta reglas recurrentes. Owner/Admin/Editor crea, edita o elimina gastos y crea, edita, pausa, reanuda o cancela reglas recurrentes.",
    },
  ],
  reportScope: [
    "Read separate totals by currency, date and category.",
    {
      zh: "按币种、日期及类别读取独立汇总。",
      ja: "通貨、日付、カテゴリー別の独立した集計を取得します。",
      ko: "통화, 날짜 및 카테고리별 독립 집계를 조회합니다.",
      fr: "Lisez les totaux séparés par devise, date et catégorie.",
      es: "Consulta totales separados por moneda, fecha y categoría.",
    },
  ],
  memberScope: [
    "Read the roster with members:read. Owner/Admin uses members:write for invitations, approval/rejection, role changes and removals, subject to existing role hierarchy and original-inviter checks.",
    {
      zh: "members:read 读取成员列表。Owner/Admin 使用 members:write 完成邀请、批准/拒绝、角色修改及移除，并遵守原有角色层级和原邀请人检查。",
      ja: "members:read でメンバー一覧を取得します。Owner/Admin は members:write で招待、承認・拒否、役割変更、削除を行います。役割の階層と元の招待者の確認は引き続き適用されます。",
      ko: "members:read로 구성원 목록을 조회합니다. Owner/Admin은 members:write로 초대, 승인·거절, 역할 변경과 제거를 수행하며 기존 역할 계층 및 원래 초대자 검사를 따릅니다.",
      fr: "Lisez les membres avec members:read. Owner/Admin utilise members:write pour les invitations, approbations/rejets, changements de rôle et suppressions, selon la hiérarchie des rôles et les contrôles de l’invitant d’origine.",
      es: "Consulta miembros con members:read. Owner/Admin usa members:write para invitaciones, aprobación/rechazo, cambios de rol y eliminación, respetando la jerarquía existente y las comprobaciones del invitador original.",
    },
  ],
  suggestionScope: [
    "Use the advanced draft suggestion/decision endpoints. Ordinary automatic expense assistance only needs expenses:write.",
    {
      zh: "调用高级草稿建议及决定接口。普通支出自动辅助只需要 expenses:write。",
      ja: "高度な下書き提案と判断のエンドポイントを使います。通常の支出の自動補助には expenses:write だけが必要です。",
      ko: "고급 초안 제안 및 결정 엔드포인트를 사용합니다. 일반 지출 자동 보조에는 expenses:write만 필요합니다.",
      fr: "Utilisez les endpoints avancés de suggestion de brouillon et de décision. L’assistance automatique ordinaire requiert seulement expenses:write.",
      es: "Usa los endpoints avanzados de sugerencias de borrador y decisiones. La asistencia automática habitual solo necesita expenses:write.",
    },
  ],
  memberAuthority: [
    "Member REST reads require members:read; governance writes require members:write and the issuer's current Owner or Admin role. Owner manages Admins; Admin manages only Editors and Viewers. Governance keys must omit projectIds and remain bound to one ledger. Only the original inviter can approve or reject requests, using the request's If-Match revision. GET /api/v1/workspaces and GET /api/v1/workspace-invitation-requests expose only a key's bound ledger. Invitation preview and application still require the applicant's independent cookie account; a management key cannot join on their behalf.",
    {
      "zh": "成员 REST 读取需要 members:read；管理写入需要 members:write 及发行者当前的 Owner 或 Admin 角色。Owner 管理 Admin，Admin 只能管理 Editor 和 Viewer。管理密钥不能设置 projectIds，且始终绑定一个账本。只有原邀请人能使用申请版本的 If-Match 批准或拒绝申请。GET /api/v1/workspaces 和 GET /api/v1/workspace-invitation-requests 仅向密钥返回其绑定账本的数据。邀请预览和申请仍需要申请人自己的独立 Cookie 账户，管理密钥不能代其加入。",
      "ja": "メンバーの REST 読み取りには members:read、管理書き込みには members:write と発行者の現在の Owner または Admin 権限が必要です。Owner は Admin を管理し、Admin は Editor と Viewer のみを管理します。管理キーでは projectIds を省略し、1つの台帳に紐付けます。元の招待者だけが申請リビジョンの If-Match で承認・却下できます。GET /api/v1/workspaces と GET /api/v1/workspace-invitation-requests はキーに紐付いた台帳のみを返します。招待のプレビューと申請には申請者自身の独立した Cookie アカウントが必要で、管理キーは代理参加できません。",
      "ko": "멤버 REST 읽기는 members:read, 관리 쓰기는 members:write와 발급자의 현재 Owner 또는 Admin 역할이 필요합니다. Owner는 Admin을 관리하고 Admin은 Editor와 Viewer만 관리합니다. 관리 키는 projectIds를 생략하고 한 장부에 연결되어야 합니다. 원래 초대자만 신청 리비전의 If-Match로 승인하거나 거부할 수 있습니다. GET /api/v1/workspaces와 GET /api/v1/workspace-invitation-requests는 키에 연결된 장부만 반환합니다. 초대 미리보기와 신청에는 신청자 자신의 독립된 쿠키 계정이 필요하며 관리 키는 대신 가입할 수 없습니다.",
      "fr": "Les lectures REST des membres nécessitent members:read ; les écritures de gestion exigent members:write et le rôle actuel Owner ou Admin de l’émetteur. Owner gère les Admin ; Admin ne gère que les Editor et Viewer. Les clés de gestion doivent omettre projectIds et rester liées à un seul registre. Seul l’invitant initial peut approuver ou refuser avec If-Match de la demande. GET /api/v1/workspaces et GET /api/v1/workspace-invitation-requests ne montrent que le registre lié à la clé. Prévisualiser une invitation et demander à rejoindre exigent le propre compte cookie du candidat ; une clé de gestion ne peut pas le faire à sa place.",
      "es": "Las lecturas REST de miembros requieren members:read; la gestión requiere members:write y el rol actual Owner o Admin del emisor. Owner gestiona Admin; Admin solo gestiona Editor y Viewer. Las claves de gestión deben omitir projectIds y vincularse a un solo libro. Solo el invitante original puede aprobar o rechazar con If-Match de la solicitud. GET /api/v1/workspaces y GET /api/v1/workspace-invitation-requests solo muestran el libro de la clave. La vista previa y la solicitud de una invitación requieren la propia cuenta independiente con cookies del solicitante; una clave de gestión no puede unirse en su nombre."
    }
  ],
  memberKey: [
    "Member scopes apply to the whole bound ledger and cannot be combined with a project allowlist. Use a separate member-management key with no projectIds restriction. The shared switch still controls financial shared-pool access. Member scopes are opt-in, and Viewer/Editor cannot receive members:write.",
    {
      zh: "成员权限作用于整个绑定账本，不能与项目白名单组合。使用不带 projectIds 限制的独立成员管理密钥；shared 开关仍只控制公共池财务访问。成员权限需主动选择，Viewer/Editor 不能获得 members:write。",
      ja: "メンバー用スコープは固定された台帳全体に適用され、プロジェクトの許可リストとは併用できません。projectIds 制限のない別のメンバー管理キーを使います。shared スイッチは引き続き共有プールの財務データへのアクセスを制御します。メンバー用スコープは明示的に選択し、Viewer/Editor に members:write は付与できません。",
      ko: "구성원 범위는 연결된 원장 전체에 적용되며 프로젝트 허용 목록과 함께 사용할 수 없습니다. projectIds 제한이 없는 별도 구성원 관리 키를 사용하세요. shared 스위치는 여전히 공유 풀 재무 접근을 제어합니다. 구성원 범위는 명시적으로 선택해야 하며 Viewer/Editor에는 members:write를 부여할 수 없습니다.",
      fr: "Les permissions membres portent sur tout le registre lié et ne peuvent pas être combinées à une liste de projets. Utilisez une clé de gestion des membres distincte, sans restriction projectIds. Le commutateur shared contrôle toujours l’accès financier au pool partagé. Ces permissions sont optionnelles ; Viewer/Editor ne peut pas recevoir members:write.",
      es: "Los permisos de miembros se aplican a todo el libro vinculado y no pueden combinarse con una lista de proyectos permitidos. Usa una clave independiente para gestionar miembros sin restricción projectIds. El interruptor shared sigue controlando el acceso financiero al fondo compartido. Estos permisos se eligen expresamente y Viewer/Editor no puede recibir members:write.",
    },
  ],
  workspace: [
    "GET /api/v1/me returns workspace.id and workspace.role. A Bearer key selects its own bound ledger; an X-Pullwise-Workspace header or workspaceId query cannot switch it to another ledger. Use workspace.id in member-management paths. Web sessions list their ledgers and select one explicitly. Ledger quotas and Jev allowances belong to the Owner, while platform billing belongs to each account.",
    {
      zh: "GET /api/v1/me 返回 workspace.id 和 workspace.role。Bearer 密钥选择自己的绑定账本，X-Pullwise-Workspace 或 workspaceId 不能将其切换到其他账本。成员管理路径使用 workspace.id。Web 会话列出可访问账本并明确选择。账本容量及 Jev 额度属于 Owner，平台账单则属于各账户。",
      ja: "GET /api/v1/me は workspace.id と workspace.role を返します。Bearer キーは固定された台帳を選び、X-Pullwise-Workspace ヘッダーや workspaceId クエリで別の台帳には切り替えられません。メンバー管理のパスでは workspace.id を使います。Web セッションはアクセス可能な台帳を列挙し、明示的に選択します。台帳容量と Jev 枠は Owner に属し、プラットフォーム請求は各アカウントに属します。",
      ko: "GET /api/v1/me는 workspace.id와 workspace.role을 반환합니다. Bearer 키는 자신이 연결된 원장을 선택하며 X-Pullwise-Workspace 헤더나 workspaceId 쿼리로 다른 원장에 전환할 수 없습니다. 구성원 관리 경로에는 workspace.id를 사용하세요. Web 세션은 접근 가능한 원장을 나열하고 명시적으로 선택합니다. 원장 한도와 Jev 허용량은 Owner에게, 플랫폼 결제는 각 계정에 속합니다.",
      fr: "GET /api/v1/me renvoie workspace.id et workspace.role. Une clé Bearer sélectionne son registre lié ; X-Pullwise-Workspace ou workspaceId ne peut pas la basculer vers un autre registre. Utilisez workspace.id dans les chemins de gestion des membres. Les sessions Web listent leurs registres et en choisissent un explicitement. Quotas et budget Jev appartiennent à Owner, la facturation de la plateforme à chaque compte.",
      es: "GET /api/v1/me devuelve workspace.id y workspace.role. Una clave Bearer selecciona su libro vinculado; X-Pullwise-Workspace o workspaceId no puede cambiarlo a otro libro. Usa workspace.id en las rutas de gestión de miembros. Las sesiones Web enumeran sus libros y seleccionan uno expresamente. Las cuotas y la asignación Jev pertenecen a Owner; la facturación de la plataforma, a cada cuenta.",
    },
  ],
  writes: [
    "Editing, retries, pagination and money",
    {
      zh: "编辑、重试、分页与金额",
      ja: "編集、再試行、ページング、金額",
      ko: "편집, 재시도, 페이지네이션 및 금액",
      fr: "Modifications, reprises, pagination et montants",
      es: "Edición, reintentos, paginación e importes",
    },
  ],
  revision: [
    'GET the current resource before changing it. Send its numeric revision as a quoted If-Match header, for example If-Match: "7". PATCH/DELETE and approval actions use that resource\'s revision, not the ledger revision. HTTP 412 means the saved record changed: reload and reconcile your draft before another explicit write. HTTP 428 means the header is missing. Ledger resource DELETE actions return 204 with no JSON response body; account API-key revocation at /api-keys/{id} returns 200 with JSON.',
    {
      zh: '修改前 GET 当前资源，将数字 revision 作为带引号的 If-Match 请求头，例如 If-Match: "7"。PATCH/DELETE 及审批使用该资源的版本，不是账本版本。412 表示记录已变化，需重新读取并合并草稿后主动写入；428 表示缺少请求头。账本资源 DELETE 成功返回 204，无 JSON 响应体；账户密钥撤销 /api-keys/{id} 返回 200 和 JSON。',
      ja: '変更前に GET で現在のリソースを取得します。数値の revision を引用符付き If-Match ヘッダーで送信します（例：If-Match: "7"）。PATCH/DELETE と承認操作には台帳ではなく対象リソースのバージョンを使います。HTTP 412 は保存済みレコードの変更を示し、再取得して下書きと照合した後に明示的に書き込みます。HTTP 428 はヘッダー不足です。台帳リソースの DELETE は 204 で JSON 本文を返しません。アカウント API キーの取消 /api-keys/{id} は 200 と JSON を返します。',
      ko: '변경 전에 GET으로 현재 리소스를 조회하세요. 숫자 revision을 따옴표로 감싼 If-Match 헤더로 보내세요(예: If-Match: "7"). PATCH/DELETE와 승인 작업에는 원장 버전이 아닌 해당 리소스 버전을 사용합니다. HTTP 412는 저장된 레코드가 변경되었음을 뜻하므로 다시 조회해 초안과 조정한 후 명시적으로 쓰세요. HTTP 428은 헤더 누락입니다. 원장 리소스 DELETE 성공은 204이며 JSON 본문이 없습니다. 계정 API 키 철회 /api-keys/{id}는 200과 JSON을 반환합니다.',
      fr: 'Faites un GET de la ressource avant de la modifier. Envoyez sa revision numérique entre guillemets dans If-Match, par exemple If-Match: "7". PATCH/DELETE et les approbations utilisent sa version, pas celle du registre. HTTP 412 indique une modification du record : rechargez et rapprochez votre brouillon avant une nouvelle écriture explicite. HTTP 428 indique un en-tête manquant. Les DELETE de ressources du registre renvoient 204 sans corps JSON ; la révocation de clé de compte /api-keys/{id} renvoie 200 avec JSON.',
      es: 'Consulta la versión actual con GET antes de modificarla. Envía revision entre comillas en If-Match, por ejemplo If-Match: "7". PATCH/DELETE y las aprobaciones usan la versión de ese recurso, no la del libro. HTTP 412 indica que el registro cambió: vuelve a leerlo y concilia el borrador antes de otra escritura explícita. HTTP 428 indica que falta la cabecera. Los DELETE de recursos del libro devuelven 204 sin cuerpo JSON; revocar una clave de cuenta en /api-keys/{id} devuelve 200 con JSON.',
    },
  ],
  editExpense: [
    "Read, edit and remove one ordinary expense",
    {
      zh: "读取、编辑、移除普通支出",
      ja: "通常の支出を取得・編集・削除",
      ko: "일반 지출 조회, 편집 및 제거",
      fr: "Lire, modifier et supprimer une dépense ordinaire",
      es: "Consulta, edita y elimina un gasto ordinario",
    },
  ],
  idempotency: [
    "POST ordinary expenses and recurring rules require Idempotency-Key (1–128 characters). Persist one key with its exact request body before sending. If the response is lost, retry the same body with that same key; an exact replay returns the original create response. A different body with the same key returns 409. A new expense, changed draft or new rule needs a new key. Do not automatically retry non-idempotent project, invitation, approval or review writes. If capacity replacement is enabled, replaying the same accepted expense request returns its original result without removing another expense. A failed new expense does not remove the old record.",
    {
      zh: "创建普通支出和周期计划需要 1–128 字符的 Idempotency-Key。发送前持久保存该键及确切请求体；响应丢失时使用相同键和请求体重试，精确重放返回原创建响应。同键不同请求体返回 409；新支出、变更的草稿或新计划使用新键。不要自动重试非幂等的项目、邀请、审批及巡检写操作。 若已启用容量替换，重放同一已成功支出请求仅返回原结果，不会再次移除其他支出；新增支出失败时不会移除旧记录。",
      ja: "通常の支出と定期ルールの POST には 1～128 文字の Idempotency-Key が必要です。送信前にキーと正確な本文を永続保存します。レスポンスを失った場合は同じキーと本文で再試行し、完全一致の再送は元の作成レスポンスを返します。同じキーで本文を変えると 409 になります。新規支出、変更した下書き、新規ルールには新しいキーを使います。非冪等なプロジェクト、招待、承認、巡検の書き込みを自動再試行しないでください。 容量に達したときの置き換えを有効にしていても、成功済みの同じ支出リクエストの再送は元の結果を返し、別の支出は削除しません。新規支出の保存が失敗した場合、既存の記録は削除されません。",
      ko: "일반 지출과 반복 규칙의 POST에는 1~128자 Idempotency-Key가 필요합니다. 보내기 전에 키와 정확한 본문을 영구 저장하세요. 응답을 받지 못하면 같은 키와 본문으로 재시도하며, 정확한 재전송은 원래 생성 응답을 반환합니다. 같은 키로 다른 본문을 보내면 409가 반환됩니다. 새 지출, 변경한 초안과 새 규칙에는 새 키를 사용하세요. 비멱등 프로젝트·초대·승인·검토 쓰기는 자동 재시도하지 마세요. 용량 도달 시 교체가 켜져 있어도 이미 성공한 동일 지출 요청을 재전송하면 원래 결과를 반환하며 다른 지출을 추가로 제거하지 않습니다. 새 지출 저장이 실패하면 기존 기록을 제거하지 않습니다.",
      fr: "Les POST de dépenses ordinaires et de règles récurrentes exigent Idempotency-Key (1–128 caractères). Conservez durablement une clé et son corps exact avant l’envoi. Si la réponse est perdue, réessayez avec la même clé et le même corps ; la reprise exacte renvoie la réponse de création initiale. Un autre corps avec la même clé renvoie 409. Une nouvelle dépense, un brouillon modifié ou une nouvelle règle exige une nouvelle clé. Ne reprenez pas automatiquement les écritures non idempotentes de projet, invitation, approbation ou vérification. Si le remplacement à capacité maximale est activé, rejouer la même création de dépense déjà acceptée renvoie le résultat initial sans supprimer une autre dépense. Un échec de création ne supprime pas l’ancien enregistrement.",
      es: "Los POST de gastos ordinarios y reglas recurrentes requieren Idempotency-Key (1–128 caracteres). Guarda de forma persistente la clave y su cuerpo exacto antes de enviarlos. Si se pierde la respuesta, reintenta con la misma clave y cuerpo; una repetición exacta devuelve la respuesta inicial. Otro cuerpo con la misma clave devuelve 409. Un gasto nuevo, un borrador modificado o una regla nueva necesita una clave nueva. No reintentes automáticamente escrituras no idempotentes de proyectos, invitaciones, aprobaciones o revisiones. Si el reemplazo al alcanzar la capacidad está activado, repetir la misma creación de gasto ya aceptada devuelve su resultado original sin eliminar otro gasto. Si falla el nuevo gasto, no se elimina el registro anterior.",
    },
  ],
  pagination: [
    "Project, expense and recurring lists return {items, nextCursor}. limit is 1–100, default 50. Pass the opaque nextCursor as cursor with the same filters until it is null; stop if a cursor repeats. Categories and the bounded member roster do not use this page shape. Invitation-request lists return items and hasMore without a cursor; approving/rejecting then explicitly reloading advances pending requests. from includes the start date and to excludes the end date.",
    {
      zh: "项目、支出和周期计划列表返回 {items, nextCursor}；limit 为 1–100，默认 50。保持筛选条件，将不透明 nextCursor 传为 cursor，直到为 null；发现重复游标应停止。类别和有界成员列表不采用相同分页格式。邀请申请列表返回 items 和 hasMore，不使用游标；批准或拒绝后主动重新读取，推进待处理申请。from 包含起始日期，to 不包含结束日期。",
      ja: "プロジェクト、支出、定期ルールの一覧は {items, nextCursor} を返します。limit は 1～100、既定値は 50 です。同じフィルターで不透明な nextCursor を cursor として送信し、null で終了します。カーソルの繰り返しを検出したら停止します。カテゴリーと件数制限のあるメンバー一覧はこの形式ではありません。招待申請一覧はカーソルなしの items と hasMore を返し、承認・拒否後の明示的な再取得で次の保留申請を取得します。from は開始日を含み、to は終了日を含みません。",
      ko: "프로젝트·지출·반복 규칙 목록은 {items, nextCursor}를 반환합니다. limit은 1~100이며 기본값은 50입니다. 같은 필터에서 불투명 nextCursor를 cursor로 전달하고 null이면 종료하세요. 커서가 반복되면 중지하세요. 카테고리 및 제한된 구성원 목록은 이 형식이 아닙니다. 초대 신청 목록은 커서 없이 items와 hasMore를 반환하며, 승인·거절 후 명시적으로 다시 조회하면 다음 대기 신청으로 진행합니다. from은 시작일을 포함하고 to는 종료일을 제외합니다.",
      fr: "Les listes de projets, dépenses et règles renvoient {items, nextCursor}. limit va de 1 à 100, par défaut 50. Réutilisez nextCursor opaque dans cursor avec les mêmes filtres jusqu’à null ; arrêtez si un curseur se répète. Catégories et liste bornée des membres n’utilisent pas ce format. Les demandes d’invitation renvoient items et hasMore sans curseur ; approuvez/rejetez puis rechargez explicitement pour avancer dans les demandes en attente. from inclut la date de début, to exclut la date de fin.",
      es: "Las listas de proyectos, gastos y reglas devuelven {items, nextCursor}. limit es de 1–100, con 50 por defecto. Pasa el nextCursor opaco como cursor con los mismos filtros hasta que sea null; detente si se repite. Las categorías y la lista acotada de miembros no usan este formato. Las solicitudes de invitación devuelven items y hasMore sin cursor; aprobar/rechazar y volver a consultar expresamente permite avanzar. from incluye la fecha inicial y to excluye la final.",
    },
  ],
  money: [
    'Send nonnegative amounts as decimal strings with the currency\'s precision, such as USD "12.00" or JPY "1200". Use uppercase three-letter currency codes and YYYY-MM-DD business dates. Single amountMinor values are safe integers in the currency\'s smallest unit; aggregate values above 9007199254740991 are exact integer strings. Use BigInt or decimal arithmetic and never combine currencies or convert unavailable amounts to zero.',
    {
      zh: '金额以非负十进制字符串提交，遵循币种精度，如 USD "12.00" 或 JPY "1200"。币种使用大写三字母代码，业务日期为 YYYY-MM-DD。单笔 amountMinor 是币种最小单位的安全整数，超过 9007199254740991 的汇总为精确整数字符串。使用 BigInt 或十进制运算，不跨币种相加，也不把不可用金额当作零。',
      ja: '金額は通貨の小数精度に合わせた非負の十進文字列で送信します（例：USD "12.00"、JPY "1200"）。通貨には大文字 3 文字のコード、業務日には YYYY-MM-DD を使います。単筆の amountMinor は通貨の最小単位の安全な整数で、9007199254740991 を超える集計は正確な整数文字列です。BigInt または十進演算を使い、通貨を混ぜたり、取得不能な金額をゼロにしたりしないでください。',
      ko: '금액은 통화 정밀도에 맞는 음이 아닌 십진 문자열로 보내세요(예: USD "12.00", JPY "1200"). 통화는 대문자 세 글자 코드, 업무 날짜는 YYYY-MM-DD를 사용합니다. 단일 amountMinor는 통화 최소 단위의 안전한 정수이며 9007199254740991을 넘는 집계는 정확한 정수 문자열입니다. BigInt 또는 십진 연산을 사용하고 통화를 합치거나 알 수 없는 금액을 0으로 바꾸지 마세요.',
      fr: 'Envoyez des montants non négatifs sous forme de chaînes décimales respectant la précision de la devise, comme USD "12.00" ou JPY "1200". Utilisez des codes de devise de trois lettres majuscules et des dates métier YYYY-MM-DD. Un amountMinor individuel est un entier sûr dans la plus petite unité ; les agrégats supérieurs à 9007199254740991 sont des chaînes entières exactes. Utilisez BigInt ou des calculs décimaux, sans combiner les devises ni remplacer les montants indisponibles par zéro.',
      es: 'Envía importes no negativos como cadenas decimales con la precisión de la moneda, por ejemplo USD "12.00" o JPY "1200". Usa códigos de moneda de tres letras mayúsculas y fechas de negocio YYYY-MM-DD. Cada amountMinor es un entero seguro en la unidad mínima; los agregados superiores a 9007199254740991 son cadenas enteras exactas. Usa BigInt o aritmética decimal, sin combinar monedas ni sustituir importes no disponibles por cero.',
    },
  ],
  csv: [
    "Export the same filtered expense set",
    {
      zh: "导出相同筛选条件下的支出",
      ja: "同じフィルターの支出をエクスポート",
      ko: "같은 필터 조건의 지출 내보내기",
      fr: "Exporter les dépenses avec les mêmes filtres",
      es: "Exporta los gastos con los mismos filtros",
    },
  ],
  projectManagement: [
    "Project and category management",
    {
      zh: "项目与类别管理",
      ja: "プロジェクトとカテゴリーの管理",
      ko: "프로젝트 및 카테고리 관리",
      fr: "Gestion des projets et des catégories",
      es: "Gestión de proyectos y categorías",
    },
  ],
  projectCrud: [
    "Before this workflow, set PULLWISE_API_KEY to a key with projects:read and projects:write. The quickstart key does not include project-write permission. Create a named standalone project with POST; edit only the intended fields with PATCH and If-Match. Optional developmentUrl and productUrl are absolute HTTP(S) URLs. GitHub links use authorized repository IDs, not names, and retain the same project ID and expense history when changed.",
    {
      zh: "执行此流程前，将 PULLWISE_API_KEY 换为包含 projects:read 和 projects:write 的密钥；快速接入密钥未授予项目写入权限。通过 POST 创建有名称的独立项目，PATCH 配合 If-Match 只修改所需字段。可选 developmentUrl 和 productUrl 为绝对 HTTP(S) 地址。GitHub 关联使用已授权仓库 ID 而非名称，修改关联会保留项目 ID 及支出历史。",
      ja: "この手順の前に PULLWISE_API_KEY を projects:read と projects:write を持つキーに変更します。クイックスタートのキーにプロジェクト書き込み権限はありません。POST で名前付きの独立したプロジェクトを作成し、PATCH と If-Match で意図した項目だけを編集します。任意の developmentUrl と productUrl は絶対 HTTP(S) URL です。GitHub 連携は名前ではなく許可されたリポジトリ ID を使い、変更してもプロジェクト ID と支出履歴は保持されます。",
      ko: "이 흐름을 실행하기 전에 PULLWISE_API_KEY를 projects:read와 projects:write가 있는 키로 바꾸세요. 빠른 시작 키에는 프로젝트 쓰기 권한이 없습니다. POST로 이름 있는 독립 프로젝트를 만들고 PATCH와 If-Match로 원하는 필드만 편집하세요. 선택 항목 developmentUrl과 productUrl은 절대 HTTP(S) URL입니다. GitHub 연결에는 이름이 아닌 허용된 저장소 ID를 사용하며, 연결을 변경해도 프로젝트 ID와 지출 이력은 유지됩니다.",
      fr: "Avant ce parcours, affectez à PULLWISE_API_KEY une clé avec projects:read et projects:write. La clé du démarrage rapide n’inclut pas l’écriture des projets. Créez un projet indépendant nommé avec POST ; modifiez seulement les champs voulus avec PATCH et If-Match. developmentUrl et productUrl sont des URL HTTP(S) absolues facultatives. Les liens GitHub utilisent des ID de dépôts autorisés, pas des noms, et leur modification conserve l’ID du projet et l’historique des dépenses.",
      es: "Antes de este flujo, establece PULLWISE_API_KEY con una clave que incluya projects:read y projects:write. La clave de inicio rápido no incluye escritura de proyectos. Crea un proyecto independiente con nombre mediante POST; edita solo los campos deseados con PATCH e If-Match. developmentUrl y productUrl son URL HTTP(S) absolutas opcionales. Los vínculos GitHub usan ID de repositorios autorizados, no nombres, y conservan el ID del proyecto y el historial de gastos al cambiar.",
    },
  ],
  projectCrudExample: [
    "Create, edit and remove a project",
    {
      zh: "创建、编辑、移除项目",
      ja: "プロジェクトを作成・編集・削除",
      ko: "프로젝트 생성, 편집 및 제거",
      fr: "Créer, modifier et supprimer un projet",
      es: "Crea, edita y elimina un proyecto",
    },
  ],
  projectRemoval: [
    "DELETE /api/v1/projects/{id} requires the actual ledger Owner, projects:write and the current project's If-Match revision. Cookie sessions and Owner API keys are supported; keys must have current ledger and project target permission. Admin, Editor and Viewer cannot remove projects. Confirmation permanently deletes the project, its currently assigned expenses, all its recurring schedules in every state and related business history. Existing expenses moved to another project or the shared pool remain. Success is 204; a stale revision is 412 and requires an explicit reload. Archive remains a separate action that preserves records.",
    {
      "zh": "DELETE /api/v1/projects/{id} 需要实际账本 Owner、projects:write 及当前项目版本的 If-Match。支持 Cookie 会话及 Owner API 密钥；密钥须具备当前账本和项目目标权限。Admin、Editor 和 Viewer 不能移除项目。确认后永久删除项目、当前归属于它的支出、所有状态的周期计划及相关业务历史。已移到其他项目或公共池的现存支出保留。成功返回 204；旧版本返回 412，须主动重新加载。归档仍是独立且保留账目的操作。",
      "ja": "DELETE /api/v1/projects/{id} には実際の台帳所有者、projects:write、現在のプロジェクトリビジョンの If-Match が必要です。Cookie セッションと所有者の API キーが使えます。キーには現在の台帳と対象プロジェクトの権限が必要です。Admin、Editor、Viewer は削除できません。確認によりプロジェクト、現在の支出、すべての状態の定期スケジュールと関連業務履歴を完全に削除します。他のプロジェクトや共有プールに移動済みの支出は残ります。成功は204、古いリビジョンは412で明示的な再読み込みが必要です。アーカイブは記録を保持する別の操作です。",
      "ko": "DELETE /api/v1/projects/{id}는 실제 장부 소유자, projects:write와 현재 프로젝트 리비전의 If-Match가 필요합니다. 쿠키 세션과 소유자 API 키를 지원하며 키에는 현재 장부와 프로젝트 대상 권한이 필요합니다. Admin, Editor, Viewer는 삭제할 수 없습니다. 확인하면 프로젝트, 현재 할당된 지출, 모든 상태의 반복 일정과 관련 업무 기록을 영구 삭제합니다. 다른 프로젝트나 공유 풀로 옮긴 지출은 남습니다. 성공은 204이며 오래된 리비전은 412로 직접 새로고침해야 합니다. 보관은 기록을 유지하는 별도 작업입니다.",
      "fr": "DELETE /api/v1/projects/{id} nécessite le propriétaire réel du registre, projects:write et If-Match avec la révision actuelle du projet. Les sessions cookie et clés API du propriétaire sont prises en charge ; les clés doivent avoir les droits actuels sur le registre et le projet. Admin, Editor et Viewer ne peuvent pas supprimer de projets. La confirmation efface définitivement le projet, ses dépenses actuelles, tous ses échéanciers dans tous les états et l’historique métier associé. Les dépenses déplacées vers un autre projet ou le pool partagé restent. Le succès renvoie 204 ; une révision périmée renvoie 412 et exige un rechargement explicite. L’archivage conserve les enregistrements.",
      "es": "DELETE /api/v1/projects/{id} requiere al propietario real del libro, projects:write y la revisión actual del proyecto en If-Match. Admite sesiones con cookies y claves API del propietario; las claves requieren permisos actuales del libro y proyecto. Admin, Editor y Viewer no pueden eliminar proyectos. Confirmar elimina permanentemente el proyecto, sus gastos actuales, todas las programaciones en cualquier estado y el historial asociado. Los gastos movidos a otro proyecto o al fondo compartido se conservan. El éxito devuelve 204; una revisión antigua devuelve 412 y exige recargar explícitamente. Archivar conserva los registros."
    }
  ],
  categories: [
    "POST /api/v1/categories/{id}/remove accepts an empty JSON body {} with If-Match and the existing categories:write authority. Referenced categories can be removed; successful removal returns 204 and retains historical names. Default GET /api/v1/categories hides removed categories. Financial history clients may request includeRemoved=true to read metadata with optional removedAt. Removed categories cannot be assigned to new expenses, selected by Jev, renamed or restored; an expense PATCH may retain that same expense's original removed categoryId. Category omission still means Automatic and may select only an active category. Schedules using a removed category are blocked with INVALID_CATEGORY on their next due run; choose an active category and explicitly Resume the blocked schedule. Archive remains distinct and does not hide the category from management.",
    {
      "zh": "POST /api/v1/categories/{id}/remove 使用空 JSON 对象 {}、If-Match 和原有 categories:write 授权。被引用的类别也可以移除；成功返回 204，并保留历史名称。默认 GET /api/v1/categories 隐藏已移除类别。金融历史客户端可通过 includeRemoved=true 读取包含可选 removedAt 的元数据。已移除类别不能分配给新支出、由 Jev 选择、改名或恢复；支出 PATCH 可保留该支出原有的已移除 categoryId。省略类别仍表示自动分类，只能选择启用类别。使用已移除类别的周期计划在下次到期执行时会因 INVALID_CATEGORY 阻止记账；请选择启用类别并主动恢复被阻止的计划。归档仍是独立操作，不会从管理列表隐藏类别。",
      "ja": "POST /api/v1/categories/{id}/remove は空の JSON {}、If-Match、既存の categories:write 権限を使います。参照中のカテゴリも削除でき、成功は204で過去の名前を保持します。通常の GET /api/v1/categories は削除済みカテゴリを除外します。履歴クライアントは includeRemoved=true で任意の removedAt を含むメタデータを取得できます。削除済みカテゴリは新規支出への割り当て、Jev による選択、名称変更、復元ができません。支出 PATCH はその支出自身の元の削除済み categoryId を保持できます。カテゴリの省略は引き続き自動分類を表し、有効なカテゴリだけを選択します。それを使用するスケジュールは次回の期日に INVALID_CATEGORY で記録が阻止されます。有効なカテゴリを選び、明示的に再開してください。アーカイブは別の操作で、管理一覧からカテゴリを除外しません。",
      "ko": "POST /api/v1/categories/{id}/remove는 빈 JSON {}와 If-Match, 기존 categories:write 권한을 사용합니다. 참조 중인 카테고리도 삭제할 수 있으며 성공은 204로 과거 이름을 보존합니다. 기본 GET /api/v1/categories는 삭제된 카테고리를 숨깁니다. 기록 클라이언트는 includeRemoved=true로 선택적인 removedAt이 있는 메타데이터를 읽을 수 있습니다. 삭제된 카테고리는 새 지출 할당, Jev 선택, 이름 변경 및 복원이 불가능하며 지출 PATCH는 그 지출의 원래 삭제된 categoryId를 유지할 수 있습니다. 카테고리 생략은 여전히 자동 분류로 활성 카테고리만 선택합니다. 사용 중인 일정은 다음 실행일부터 INVALID_CATEGORY로 기록이 차단됩니다. 활성 카테고리를 선택하고 직접 재개하세요. 보관은 별도 작업으로 관리 목록에서 카테고리를 숨기지 않습니다.",
      "fr": "POST /api/v1/categories/{id}/remove accepte un JSON vide {} avec If-Match et l’autorisation categories:write existante. Les catégories référencées peuvent être supprimées ; le succès renvoie 204 et conserve les anciens noms. GET /api/v1/categories masque par défaut les catégories supprimées. Les clients de l’historique peuvent demander includeRemoved=true pour lire les métadonnées avec removedAt facultatif. Une catégorie supprimée ne peut être attribuée à de nouvelles dépenses, choisie par Jev, renommée ni restaurée ; un PATCH peut conserver le categoryId supprimé d’origine de cette même dépense. Omettre la catégorie signifie toujours Automatique, qui ne choisit que des catégories actives. Les échéanciers qui l’utilisent sont bloqués avec INVALID_CATEGORY à leur prochaine échéance ; choisissez une catégorie active et reprenez-les explicitement. L’archivage reste distinct et ne masque pas la catégorie dans la gestion.",
      "es": "POST /api/v1/categories/{id}/remove acepta un JSON vacío {} con If-Match y la autorización categories:write existente. Se pueden eliminar categorías referenciadas; el éxito devuelve 204 y conserva nombres históricos. GET /api/v1/categories oculta por defecto las eliminadas. Los clientes del historial pueden solicitar includeRemoved=true para leer metadatos con removedAt opcional. Las eliminadas no pueden asignarse a gastos nuevos, elegirse por Jev, renombrarse ni restaurarse; un PATCH puede conservar el categoryId eliminado original de ese mismo gasto. Omitir la categoría sigue significando Automático y solo elige categorías activas. Las programaciones que la usan quedan bloqueadas con INVALID_CATEGORY en el siguiente vencimiento; elige una categoría activa y reanúdalas explícitamente. Archivar sigue siendo distinto y no oculta la categoría en la gestión."
    }
  ],
  recurring: [
    "Project and shared recurring expenses",
    {
      zh: "项目与公共池周期支出",
      ja: "プロジェクトと共有プールの定期支出",
      ko: "프로젝트 및 공유 풀 반복 지출",
      fr: "Dépenses récurrentes de projet et du pool partagé",
      es: "Gastos recurrentes de proyecto y del fondo compartido",
    },
  ],
  recurringBehavior: [
    "Both targets use /api/v1/expense-recurring-rules with expenses:read/write and ordinary project/shared restrictions. Each successful occurrence creates one separate expense record, never a cumulative amount. A startOn on or before local today immediately records exactly one expense on startOn, without backfilling intervening periods; a future start waits. Future plans do not count as spent. On create or complete edit, categoryId may be omitted for Jev under the Owner’s eligible plan, enabled preference, availability and allowance. Only a confident active category is selected; explicit categories remain unchanged. CATEGORY_REQUIRED leaves the rule unsaved for manual category selection. Background posting reuses the saved category without calling Jev. Rules do not make payments or renew subscriptions.",
    {
      zh: "两个目标都使用 /api/v1/expense-recurring-rules，要求 expenses:read/write，并遵守普通支出的目标限制。每次成功执行都会新增独立账目，不累计金额。startOn 为计划时区中的今天或过去时，只按 startOn 立即记入一笔，不补记中间周期；未来日期等待执行。未来计划不计入已支出。创建或完整编辑时，Owner 的套餐、启用偏好、模型可用性和额度允许后，可省略 categoryId 由 Jev 选择有把握的启用类别；明确类别不会改变。CATEGORY_REQUIRED 表示计划未保存，须手动选类别。后台沿用保存的类别，不调用 Jev。计划不会付款或续订服务。",
      ja: "両方の対象で /api/v1/expense-recurring-rules と expenses:read/write を使い、通常と同じ対象制限を適用します。成功するたびに別の支出を作り、金額を累積しません。startOn が現地の今日以前なら、その日付で1件だけ即時記録し、間の期間は遡って記録しません。未来の開始日は実行を待ち、将来予定は支出済み額に含めません。作成・完全編集では Owner の対象プラン、有効設定、モデル利用可否と利用枠が許せば categoryId を省略して Jev を使えます。確信のある有効カテゴリだけを選び、明示したカテゴリは変えません。CATEGORY_REQUIRED ではルールは未保存で、手動選択が必要です。バックグラウンドは保存済みカテゴリを使い、Jev を呼びません。支払いや契約更新は行いません。",
      ko: "두 대상은 /api/v1/expense-recurring-rules와 expenses:read/write 및 일반 지출의 대상 제한을 사용합니다. 실행마다 별도 지출을 만들고 금액을 누적하지 않습니다. startOn이 현지 오늘 이전이거나 오늘이면 그 날짜의 지출 한 건만 즉시 기록하고 중간 기간은 소급 기록하지 않습니다. 미래 시작은 기다리며 계획은 지출 합계에 포함되지 않습니다. 생성·전체 수정에서 Owner의 대상 요금제, 활성 설정, 모델 가용성과 한도가 허용하면 categoryId를 생략하고 Jev를 사용할 수 있습니다. 확실한 활성 카테고리만 선택하며 명시한 카테고리는 바꾸지 않습니다. CATEGORY_REQUIRED이면 규칙은 미저장 상태로 수동 선택이 필요합니다. 백그라운드는 저장된 카테고리를 사용하며 Jev를 호출하지 않습니다. 결제나 구독 갱신을 실행하지 않습니다.",
      fr: "Les deux cibles utilisent /api/v1/expense-recurring-rules avec expenses:read/write et les restrictions ordinaires. Chaque occurrence réussie crée une dépense distincte, sans cumuler les montants. Un startOn aujourd’hui ou passé dans le fuseau local enregistre immédiatement une seule dépense à cette date, sans rattraper les périodes intermédiaires ; un début futur attend. Les plans futurs ne comptent pas comme dépensés. À la création ou modification complète, categoryId peut être omis pour Jev si le forfait éligible d’Owner, son activation, la disponibilité et le quota le permettent. Seule une catégorie active certaine est choisie ; les catégories explicites sont conservées. CATEGORY_REQUIRED laisse la règle non enregistrée pour une sélection manuelle. L’arrière-plan réutilise la catégorie enregistrée sans appeler Jev. Aucun paiement ni renouvellement n’est effectué.",
      es: "Ambos destinos usan /api/v1/expense-recurring-rules con expenses:read/write y restricciones ordinarias. Cada ocurrencia correcta crea un gasto separado sin acumular importes. Un startOn hoy o anterior en la zona local registra inmediatamente un solo gasto en esa fecha, sin recuperar períodos intermedios; un inicio futuro espera. Los planes futuros no cuentan como gasto realizado. Al crear o editar completamente, puedes omitir categoryId para Jev si lo permiten el plan elegible de Owner, su activación, disponibilidad y cuota. Solo elige una categoría activa con confianza; conserva las explícitas. CATEGORY_REQUIRED deja la regla sin guardar para elegir categoría manualmente. El registro en segundo plano reutiliza la categoría guardada sin llamar a Jev. No realiza pagos ni renueva suscripciones.",
    },
  ],
  createRecurring: [
    "Create and list a monthly rule",
    {
      zh: "创建并列出月度计划",
      ja: "月次ルールを作成・一覧表示",
      ko: "월간 규칙 생성 및 목록 조회",
      fr: "Créer et lister une règle mensuelle",
      es: "Crea y consulta una regla mensual",
    },
  ],
  schedule: [
    "schedule requires frequency, a valid IANA timezone, startOn and frequency-specific fields: weekly uses weekday (Monday=1…Sunday=7); monthly uses day (1–31); quarterly uses quarterMonth (1–3 within each calendar quarter) and day; yearly uses month (1–12) and day. Optional endOn is inclusive. Days beyond a month's end use its last day. GET returns nextOccurrenceOn, nextRunAt, status, revision and blockedCode; reads never generate expenses. nextOccurrenceOn is strictly after today in the schedule timezone, or null if no future occurrence remains. awaitingSync marks an overdue stored pointer projected forward by this read, without changing financial state. pendingOccurrences separately lists retained historical capacity failures.",
    {
      zh: "schedule 必须包含 frequency、有效 IANA timezone、startOn 及频率专属字段：weekly 使用 weekday（周一=1…周日=7）；monthly 使用 day（1–31）；quarterly 使用 quarterMonth（每个自然季度的第 1–3 月）和 day；yearly 使用 month（1–12）和 day。可选 endOn 包含当天，超出月末的日期使用当月最后一天。GET 返回 nextOccurrenceOn、nextRunAt、status、revision 和 blockedCode，读取不会生成支出。 nextOccurrenceOn 始终晚于计划时区中的今天，没有未来周期时为 null。awaitingSync 标识读取时投影到未来但尚待后台同步的旧到期指针，不会改变财务状态。pendingOccurrences 单独列出保留的历史容量失败。",
      ja: "schedule には frequency、有効な IANA timezone、startOn と頻度固有の項目が必要です。weekly は weekday（月曜=1～日曜=7）、monthly は day（1～31）、quarterly は quarterMonth（各暦四半期内の 1～3 月目）と day、yearly は month（1～12）と day を使います。任意の endOn は当日を含みます。月末を超える日付はその月の最終日になります。GET は nextOccurrenceOn、nextRunAt、status、revision、blockedCode を返し、支出を生成しません。 nextOccurrenceOn はタイムゾーンの今日より後で、将来分がなければ null です。awaitingSync は古い期限ポインターを読み取りだけで将来へ投影した状態で、財務は変更しません。pendingOccurrences は過去の容量失敗を別に示します。",
      ko: "schedule에는 frequency, 유효한 IANA timezone, startOn 및 빈도별 필드가 필요합니다. weekly는 weekday(월요일=1~일요일=7), monthly는 day(1~31), quarterly는 quarterMonth(각 달력 분기의 1~3번째 달)와 day, yearly는 month(1~12)와 day를 사용합니다. 선택 항목 endOn은 해당 날짜를 포함합니다. 월말을 넘는 날짜는 그 달의 마지막 날을 사용합니다. GET은 nextOccurrenceOn, nextRunAt, status, revision, blockedCode를 반환하며 지출을 생성하지 않습니다. nextOccurrenceOn은 일정 시간대의 오늘 이후이며 미래 발생분이 없으면 null입니다. awaitingSync는 오래된 실행 포인터를 읽기만으로 미래에 투영한 상태로 재무 상태를 바꾸지 않습니다. pendingOccurrences는 과거 용량 실패를 별도로 표시합니다.",
      fr: "schedule exige frequency, un IANA timezone valide, startOn et les champs propres à la fréquence : weekly utilise weekday (lundi=1…dimanche=7), monthly day (1–31), quarterly quarterMonth (1–3 dans le trimestre civil) et day, yearly month (1–12) et day. endOn facultatif est inclusif. Un jour dépassant la fin du mois devient le dernier jour du mois. GET renvoie nextOccurrenceOn, nextRunAt, status, revision et blockedCode, sans générer de dépenses. nextOccurrenceOn est après aujourd’hui dans le fuseau du plan, ou null sans échéance future. awaitingSync indique un ancien pointeur projeté dans le futur par la lecture, sans changement financier. pendingOccurrences liste séparément les échecs passés retenus.",
      es: "schedule requiere frequency, un IANA timezone válido, startOn y campos propios de cada frecuencia: weekly usa weekday (lunes=1…domingo=7); monthly usa day (1–31); quarterly usa quarterMonth (1–3 dentro del trimestre natural) y day; yearly usa month (1–12) y day. endOn opcional incluye ese día. Los días que superan el fin del mes usan su último día. GET devuelve nextOccurrenceOn, nextRunAt, status, revision y blockedCode; consultar nunca genera gastos. nextOccurrenceOn es posterior a hoy en la zona del plan, o null si no hay futuro. awaitingSync indica un puntero antiguo proyectado al futuro por la lectura sin cambiar las finanzas. pendingOccurrences enumera por separado los fallos históricos conservados.",
    },
  ],
  recurringFailures: [
    "Capacity failures advance the future calendar while preserving the first 10 unresolved pendingOccurrences per rule. Later failures are discarded while all 10 remain unresolved. Each retained item freezes periodKey, scheduledOn, amount, currency, purpose, categoryId, blockedCode and createdAt. English email goes to the saved execution account’s usable verified email; otherwise Pullwise inbox is used. After fixing capacity, PATCH the rule with only {retryPeriodKey: the retained periodKey} and the current If-Match. A successful retry creates one separate expense and atomically removes that pending item, without changing the future schedule. A failed retry keeps it. An already posted period with a current revision returns the rule without another expense; a stale revision returns 412. Canceled rules reject retry. GET /api/v1/recurring-expense-notifications is a cookie-only, read-only account inbox across currently authorized ledgers; it returns up to 100 items and hasMore, excluding email-delivered or resolved entries.",
    {
      zh: "容量失败会推进未来日历，每个计划保留最早 10 条未处理 pendingOccurrences；10 条均未处理时，后续失败不再保留。每条冻结 periodKey、scheduledOn、amount、currency、purpose、categoryId、blockedCode 和 createdAt。优先向执行账户可用且已验证的邮箱发英文邮件，否则使用站内信。处理容量后，以当前 If-Match PATCH 计划，正文只传 {retryPeriodKey: 保留的 periodKey}。成功后新增独立账目，并原子移除该待补记项，未来计划不变；失败则保留。已记入的周期在当前版本下返回计划且不重复新增；旧版本返回 412，已取消计划拒绝补记。GET /api/v1/recurring-expense-notifications 是仅 Cookie 可读的账户收件箱，跨当前有权访问的账本返回最多 100 项及 hasMore，排除已发邮件或已处理的记录。",
      ja: "容量不足でも将来の日程は進み、各ルールの最初の未処理10件を pendingOccurrences に保持します。10件が未処理なら後続の失敗は破棄します。各項目は periodKey、scheduledOn、amount、currency、purpose、categoryId、blockedCode、createdAt を固定します。実行アカウントの利用可能な認証済みメールへ英語で通知し、なければ受信箱を使います。容量を解決後、現在の If-Match と {retryPeriodKey: 保持した periodKey} だけでルールを PATCH します。成功は別の支出を作り、項目を原子的に削除します。将来の日程は変えず、失敗なら保持します。記録済み期間は現在のリビジョンで追加せず返し、古いリビジョンは412です。解除済みルールは再試行できません。GET /api/v1/recurring-expense-notifications は Cookie 専用の読み取りで、現在許可された台帳の最大100件と hasMore を返し、メール配信済み・解決済みは除外します。",
      ko: "용량 실패여도 미래 일정은 진행하고 규칙마다 처음 10개의 미처리 pendingOccurrences를 보관합니다. 10개가 미처리면 이후 실패는 버립니다. 항목은 periodKey, scheduledOn, amount, currency, purpose, categoryId, blockedCode, createdAt을 고정합니다. 실행 계정의 사용 가능한 인증 이메일로 영어 알림을 보내며 없으면 수신함을 사용합니다. 용량을 해결한 뒤 현재 If-Match와 {retryPeriodKey: 보관된 periodKey}만으로 규칙을 PATCH하세요. 성공하면 별도 지출을 만들고 항목을 원자적으로 제거하며 미래 일정은 바꾸지 않습니다. 실패하면 보관합니다. 이미 기록된 기간은 현재 리비전에서 추가 없이 반환하고 오래된 리비전은 412입니다. 취소한 규칙은 재시도할 수 없습니다. GET /api/v1/recurring-expense-notifications는 쿠키 전용 읽기로 현재 허용된 장부의 최대 100개와 hasMore를 반환하며 이메일 전달 및 해결 항목은 제외합니다.",
      fr: "Les échecs de capacité avancent le calendrier futur et gardent les 10 premiers pendingOccurrences non résolus par règle. Les suivants sont abandonnés tant que les 10 restent non résolus. Chaque élément fige periodKey, scheduledOn, amount, currency, purpose, categoryId, blockedCode et createdAt. Un e-mail anglais est envoyé à l’adresse vérifiée utilisable du compte d’exécution, sinon la boîte Pullwise est utilisée. Après correction, PATCH avec seulement {retryPeriodKey: le periodKey retenu} et If-Match actuel. Le succès crée une dépense distincte et retire l’élément atomiquement sans modifier l’avenir ; l’échec le conserve. Une période déjà enregistrée avec la révision actuelle ne crée rien ; une révision périmée renvoie 412. Une règle annulée refuse la reprise. GET /api/v1/recurring-expense-notifications est une boîte de compte en lecture seule par Cookie dans les registres autorisés, avec au plus 100 items et hasMore, sans les éléments envoyés par e-mail ou résolus.",
      es: "Los fallos de capacidad avanzan el calendario futuro y conservan los primeros 10 pendingOccurrences pendientes por regla. Los siguientes se descartan mientras esos 10 sigan pendientes. Cada elemento congela periodKey, scheduledOn, amount, currency, purpose, categoryId, blockedCode y createdAt. Envía correo en inglés al correo verificado utilizable de la cuenta ejecutora; sin uno, usa la bandeja Pullwise. Tras resolver la capacidad, PATCH solo con {retryPeriodKey: el periodKey conservado} e If-Match actual. El éxito crea un gasto separado y elimina el elemento de forma atómica sin cambiar el calendario; el fallo lo conserva. Un período ya registrado con revisión actual no añade otro gasto; una revisión antigua devuelve 412. Una regla cancelada rechaza reintentos. GET /api/v1/recurring-expense-notifications es una bandeja de cuenta de solo lectura por Cookie en libros autorizados, con hasta 100 items y hasMore, excluyendo entregados por correo o resueltos.",
    },
  ],
  manageRecurring: [
    "Pause, resume, edit and cancel",
    {
      zh: "暂停、恢复、编辑与取消",
      ja: "一時停止、再開、編集、取消",
      ko: "일시 중지, 재개, 편집 및 취소",
      fr: "Suspendre, reprendre, modifier et annuler",
      es: "Pausa, reanuda, edita y cancela",
    },
  ],
  recurringAuthority: [
    "Recurring REST reads use expenses:read; create, edit, pause, resume and cancel use expenses:write with current role and project/shared target permission. POST /api/v1/expense-recurring-rules requires Idempotency-Key; PATCH and DELETE /api/v1/expense-recurring-rules/{id} require If-Match. A key-created or key-resumed schedule retains only a credential hash internally. Every occurrence rechecks that key's expiry, revocation, scopes, ledger membership and target restrictions. A full edit or explicit Resume adopts the current actor and credential; a session edit or Resume removes an old key grant. Categories must be active, targets stay fixed, and canceling preserves previously recorded expenses.",
    {
      "zh": "周期 REST 读取使用 expenses:read；创建、编辑、暂停、恢复和取消使用 expenses:write，并校验当前角色及项目或公共池目标权限。POST /api/v1/expense-recurring-rules 需要 Idempotency-Key；PATCH 和 DELETE /api/v1/expense-recurring-rules/{id} 需要 If-Match。由密钥创建或恢复的计划仅在内部保留凭据哈希。每次执行都重新校验密钥过期、撤销、权限、账本成员关系和目标限制。完整编辑或主动恢复会采用当前操作人和凭据；会话编辑或恢复会清除原有密钥授权。类别必须启用，目标保持固定，取消计划会保留此前已记录的支出。",
      "ja": "定期支出の REST 読み取りは expenses:read、作成・編集・一時停止・再開・解除は expenses:write と現在の役割および対象プロジェクト・共有プール権限を使います。POST /api/v1/expense-recurring-rules には Idempotency-Key、PATCH と DELETE /api/v1/expense-recurring-rules/{id} には If-Match が必要です。キーで作成・再開したスケジュールは内部に資格情報のハッシュだけを保持します。各実行時にキーの期限、失効、権限、台帳メンバー資格、対象制限を再確認します。完全な編集や明示的な再開は現在の操作ユーザーと資格情報を採用し、セッションの編集や再開は以前のキー権限を除去します。カテゴリは有効で、対象は固定です。解除しても過去の記録済み支出は残ります。",
      "ko": "반복 REST 읽기는 expenses:read를, 생성·수정·일시 정지·재개·취소는 expenses:write와 현재 역할 및 프로젝트·공유 풀 권한을 사용합니다. POST /api/v1/expense-recurring-rules는 Idempotency-Key, PATCH 및 DELETE /api/v1/expense-recurring-rules/{id}는 If-Match가 필요합니다. 키로 생성하거나 재개한 일정은 내부에 자격 증명 해시만 보관합니다. 매 실행마다 키 만료, 철회, 범위, 장부 멤버십 및 대상 제한을 재검사합니다. 전체 수정 또는 명시적인 재개는 현재 작업자와 자격 증명을 채택하며 세션 수정·재개는 이전 키 권한을 제거합니다. 카테고리는 활성 상태여야 하고 대상은 고정되며 취소해도 이미 기록된 지출은 보존됩니다.",
      "fr": "Les lectures REST récurrentes utilisent expenses:read ; création, modification, suspension, reprise et annulation utilisent expenses:write avec le rôle et les droits actuels sur le projet ou pool partagé. POST /api/v1/expense-recurring-rules exige Idempotency-Key ; PATCH et DELETE /api/v1/expense-recurring-rules/{id} exigent If-Match. Un échéancier créé ou repris avec une clé ne garde en interne qu’un hachage de l’identifiant. Chaque occurrence revérifie expiration, révocation, scopes, appartenance au registre et restrictions de cible. Une modification complète ou reprise explicite adopte l’acteur et l’identifiant actuels ; une modification ou reprise par session retire l’ancien droit de clé. Les catégories doivent être actives, les cibles restent fixes et l’annulation conserve les dépenses déjà enregistrées.",
      "es": "Las lecturas REST recurrentes usan expenses:read; crear, editar, pausar, reanudar y cancelar usan expenses:write con rol y permisos actuales del proyecto o fondo compartido. POST /api/v1/expense-recurring-rules exige Idempotency-Key; PATCH y DELETE /api/v1/expense-recurring-rules/{id} exigen If-Match. Una programación creada o reanudada con una clave solo guarda internamente un hash de la credencial. Cada ejecución vuelve a comprobar caducidad, revocación, permisos, pertenencia al libro y restricciones de destino. Una edición completa o reanudación explícita adopta al actor y credencial actuales; editar o reanudar con sesión elimina el permiso de la clave antigua. Las categorías deben estar activas, el destino permanece fijo y cancelar conserva los gastos registrados."
    }
  ],
  members: [
    "Invitations and member management",
    {
      zh: "邀请与成员管理",
      ja: "招待とメンバー管理",
      ko: "초대 및 구성원 관리",
      fr: "Invitations et gestion des membres",
      es: "Invitaciones y gestión de miembros",
    },
  ],
  memberManagement: [
    "Set PULLWISE_API_KEY to the separate member-management key before running this example; the quickstart key has no member scopes. Use a whole-ledger key with members:read/write. Read members, create/revoke invitations, read pending join requests, approve/reject them and edit/remove members through /api/v1/workspaces/{workspaceId}/... . Owner manages Admin/Editor/Viewer; Admin manages Editor/Viewer. The original inviter must still be authorized to approve or reject. Owner cannot be changed or removed by these endpoints.",
    {
      zh: "执行此示例前，将 PULLWISE_API_KEY 换为独立的成员管理密钥；快速接入密钥没有成员权限。使用包含 members:read/write 的整账本密钥，通过 /api/v1/workspaces/{workspaceId}/... 读取成员、创建和撤销邀请、读取待处理申请、批准或拒绝、编辑或移除成员。Owner 管理 Admin/Editor/Viewer，Admin 管理 Editor/Viewer。批准或拒绝仍要求有当前权限的原邀请人，不能通过这些接口更改或移除 Owner。",
      ja: "この例の実行前に PULLWISE_API_KEY を別のメンバー管理キーに変更します。クイックスタートのキーにメンバー用スコープはありません。members:read/write を付与した台帳全体のキーを使います。/api/v1/workspaces/{workspaceId}/... でメンバー取得、招待作成・取消、保留申請の取得・承認・拒否、メンバー編集・削除を行います。Owner は Admin/Editor/Viewer、Admin は Editor/Viewer を管理します。承認・拒否には現在も権限を持つ元の招待者が必要です。これらのエンドポイントで Owner の変更・削除はできません。",
      ko: "이 예제를 실행하기 전에 PULLWISE_API_KEY를 별도의 구성원 관리 키로 바꾸세요. 빠른 시작 키에는 구성원 범위가 없습니다. members:read/write가 있는 전체 원장 키를 사용하세요. /api/v1/workspaces/{workspaceId}/...로 구성원 조회, 초대 생성·철회, 대기 신청 조회·승인·거절과 구성원 편집·제거를 수행합니다. Owner는 Admin/Editor/Viewer를, Admin은 Editor/Viewer를 관리합니다. 승인·거절은 현재도 권한 있는 원래 초대자만 할 수 있습니다. 이 엔드포인트로 Owner를 변경하거나 제거할 수 없습니다.",
      fr: "Affectez à PULLWISE_API_KEY la clé distincte de gestion des membres avant cet exemple ; la clé du démarrage rapide n’a aucune permission membre. Utilisez une clé de tout le registre avec members:read/write. Via /api/v1/workspaces/{workspaceId}/..., lisez les membres, créez/révoquez les invitations, lisez et approuvez/rejetez les demandes, modifiez/supprimez les membres. Owner gère Admin/Editor/Viewer ; Admin gère Editor/Viewer. L’invitant d’origine doit toujours être autorisé pour approuver/rejeter. Ces endpoints ne changent ni ne suppriment Owner.",
      es: "Antes de ejecutar este ejemplo, establece PULLWISE_API_KEY con la clave independiente de gestión de miembros; la clave de inicio rápido no tiene permisos de miembros. Usa una clave de todo el libro con members:read/write. Mediante /api/v1/workspaces/{workspaceId}/... consulta miembros, crea/revoca invitaciones, consulta y aprueba/rechaza solicitudes pendientes y edita/elimina miembros. Owner gestiona Admin/Editor/Viewer; Admin gestiona Editor/Viewer. El invitador original debe seguir autorizado para aprobar/rechazar. Estos endpoints no pueden cambiar ni eliminar a Owner.",
    },
  ],
  inviteMember: [
    "Invite and approve a pending applicant",
    {
      zh: "邀请并批准待处理申请",
      ja: "招待を作成し、保留中の申請を承認",
      ko: "초대 및 대기 신청자 승인",
      fr: "Inviter et approuver une demande en attente",
      es: "Invita y aprueba a un solicitante pendiente",
    },
  ],
  joining: [
    "An invitation is a 24-hour link, not immediate membership. The token is returned only on creation. The applicant signs into their own account in Web, previews the link and explicitly submits a join request; these account actions use their own cookie session rather than a key bound to the inviting ledger. Pending/rejected applicants have no ledger access. After approval, the link closes. Sharing grants access to existing and future ledger data according to role, but never grants GitHub repository access.",
    {
      zh: "邀请是 24 小时有效的链接，不会立即授予成员资格，令牌只在创建时返回。申请人在 Web 登录自己的账户、预览链接并主动申请，这些账户操作使用申请人自己的 Cookie 会话，而非绑定邀请账本的密钥。待审或拒绝的申请人不能访问账本，批准后链接关闭。共享按角色开放既有及未来账本数据，不授予 GitHub 仓库访问权。",
      ja: "招待は 24 時間のリンクで、すぐにメンバー資格を与えるものではありません。トークンは作成時だけ返されます。申請者は Web で自分のアカウントにログインし、リンクを確認して明示的に参加申請します。これらのアカウント操作には招待先台帳のキーではなく本人の Cookie セッションを使います。保留・拒否状態では台帳にアクセスできません。承認後にリンクは閉じます。共有は役割に応じて既存・将来の台帳データへのアクセスを与えますが、GitHub リポジトリ権限は与えません。",
      ko: "초대는 24시간 링크이며 즉시 구성원 자격을 부여하지 않습니다. 토큰은 생성할 때만 반환됩니다. 신청자는 Web에서 자신의 계정으로 로그인해 링크를 확인하고 명시적으로 참여 신청합니다. 이 계정 작업에는 초대 원장에 연결된 키가 아닌 신청자 본인의 Cookie 세션을 사용합니다. 대기·거절된 신청자는 원장에 접근할 수 없습니다. 승인 후 링크가 닫힙니다. 공유는 역할에 따라 기존 및 미래 원장 데이터 접근을 허용하지만 GitHub 저장소 접근은 부여하지 않습니다.",
      fr: "Une invitation est un lien de 24 heures, pas une adhésion immédiate. Le jeton est renvoyé seulement à la création. Le candidat se connecte à son propre compte Web, prévisualise le lien puis demande explicitement à rejoindre. Ces actions utilisent sa session Cookie, pas une clé liée au registre invitant. Les demandes en attente/rejetées n’ont aucun accès. Après approbation, le lien ferme. Le partage ouvre les données actuelles et futures selon le rôle, jamais l’accès aux dépôts GitHub.",
      es: "Una invitación es un enlace de 24 horas, no una membresía inmediata. El token solo se devuelve al crearla. El solicitante inicia sesión en su propia cuenta Web, consulta el enlace y envía expresamente una solicitud para unirse; estas acciones usan su sesión Cookie, no una clave vinculada al libro que invita. Los solicitantes pendientes/rechazados no tienen acceso. Tras aprobar, el enlace se cierra. Compartir concede acceso a datos actuales y futuros según el rol, pero nunca a repositorios GitHub.",
    },
  ],
  editMember: [
    "Change a role, remove a member or revoke an invitation",
    {
      zh: "更改角色、移除成员或撤销邀请",
      ja: "役割変更、メンバー削除、招待取消",
      ko: "역할 변경, 구성원 제거 또는 초대 철회",
      fr: "Changer un rôle, supprimer un membre ou révoquer une invitation",
      es: "Cambia un rol, elimina un miembro o revoca una invitación",
    },
  ],
  activity: [
    "Operation history",
    {
      zh: "操作日志",
      ja: "操作履歴",
      ko: "작업 이력",
      fr: "Historique des opérations",
      es: "Historial de operaciones",
    },
  ],
  history: [
    "GET /api/v1/activity requires a project or shared target (project also needs projectId) and returns items, nextCursor and the server's rolling last-24-hour window. Page explicitly; no polling is necessary. API keys with expenses:read expose expense and recurring-rule activity within their target restrictions; project-setting activity additionally requires projects:read on the same key. Web cookie members see activity permitted by their current role. Events identify the actor and exact changes without exposing private email or credentials.",
    {
      zh: "GET /api/v1/activity 要求 project 或 shared 目标，project 还需 projectId，返回 items、nextCursor 及服务端滚动最近 24 小时窗口。主动分页即可，无需轮询。具有 expenses:read 的 API 密钥可查看目标限制内的支出及周期计划活动；查看项目设置活动还需同一密钥包含 projects:read。Web Cookie 成员可查看当前角色获准的活动。事件包含操作人及确切变更，不暴露私人邮箱和凭据。",
      ja: "GET /api/v1/activity には project または shared の対象が必要で、project には projectId も必要です。items、nextCursor、サーバーの直近 24 時間の可視範囲を返します。明示的にページングでき、ポーリングは不要です。expenses:read API キーは対象制限内の支出と定期ルールの活動を取得できます。プロジェクト設定の活動には同じキーの projects:read も必要です。Web Cookie のメンバーは役割で許可された活動を取得できます。イベントは操作アカウントと正確な変更を示し、私用メールや認証情報は公開しません。",
      ko: "GET /api/v1/activity에는 project 또는 shared 대상이 필요하며 project는 projectId도 필요합니다. items, nextCursor와 서버의 최근 24시간 가시 범위를 반환합니다. 명시적으로 페이지를 조회하면 되며 폴링은 필요 없습니다. expenses:read API 키는 대상 제한 내의 지출 및 반복 규칙 활동을 조회하며, 프로젝트 설정 활동에는 같은 키의 projects:read도 필요합니다. Web Cookie 구성원은 역할에 허용된 활동을 조회합니다. 이벤트는 작업자와 정확한 변경 사항을 보여 주며 개인 이메일이나 인증 정보를 노출하지 않습니다.",
      fr: "GET /api/v1/activity exige une cible project ou shared (project exige aussi projectId) et renvoie items, nextCursor et la fenêtre glissante de 24 heures du serveur. Paginez explicitement, sans polling. Les clés expenses:read exposent les activités de dépenses et de règles dans leurs restrictions ; les paramètres de projet exigent aussi projects:read sur la même clé. Les membres Web avec Cookie voient les activités permises par leur rôle. Les événements identifient l’acteur et les changements exacts sans exposer d’adresse privée ni d’identifiants.",
      es: "GET /api/v1/activity requiere un destino project o shared (project también necesita projectId) y devuelve items, nextCursor y la ventana móvil de las últimas 24 horas del servidor. Consulta las páginas expresamente, sin sondeo. Las claves expenses:read exponen actividad de gastos y reglas dentro de sus restricciones; los ajustes de proyecto también requieren projects:read en la misma clave. Los miembros Web con Cookie ven actividad permitida por su rol. Los eventos identifican al actor y cambios exactos sin exponer correos privados ni credenciales.",
    },
  ],
  historyExample: [
    "Read the last 24 hours",
    {
      zh: "读取最近 24 小时",
      ja: "直近 24 時間の履歴を取得",
      ko: "최근 24시간 조회",
      fr: "Lire les dernières 24 heures",
      es: "Consulta las últimas 24 horas",
    },
  ],
  troubleshooting: [
    "Error responses and recovery",
    {
      zh: "错误响应与恢复",
      ja: "エラーレスポンスと復旧",
      ko: "오류 응답 및 복구",
      fr: "Réponses d’erreur et reprise",
      es: "Respuestas de error y recuperación",
    },
  ],
  errors: [
    "Check the HTTP status before reading a success DTO. Business errors contain error.code; additional fields depend on the endpoint. A failure is not an empty list or a zero total. Do not invent success after a timeout: use the saved idempotency key for supported creates, or explicitly reload before deciding what to do next.",
    {
      zh: "读取成功对象前先检查 HTTP 状态。业务错误包含 error.code，其他字段以接口为准。失败不代表空列表或零汇总。超时后不能当作成功：支持幂等的创建使用保存的键恢复，其他操作主动读取后再决定下一步。",
      ja: "成功 DTO を読む前に HTTP ステータスを確認します。業務エラーには error.code があり、追加項目はエンドポイントによって異なります。失敗は空の一覧やゼロの集計ではありません。タイムアウトを成功とみなさず、対応する作成操作では保存した冪等キーを使い、それ以外は明示的に再取得して次の操作を判断します。",
      ko: "성공 DTO를 읽기 전에 HTTP 상태를 확인하세요. 업무 오류에는 error.code가 있으며 추가 필드는 엔드포인트마다 다릅니다. 실패는 빈 목록이나 0 합계를 뜻하지 않습니다. 시간 초과를 성공으로 간주하지 마세요. 지원되는 생성 작업은 저장한 멱등 키로 복구하고, 나머지는 명시적으로 다시 조회한 뒤 다음 작업을 결정하세요.",
      fr: "Vérifiez le statut HTTP avant de lire un DTO de succès. Les erreurs métier contiennent error.code ; les autres champs dépendent de l’endpoint. Un échec n’est ni une liste vide ni un total nul. Ne présumez pas un succès après un délai dépassé : utilisez la clé d’idempotence conservée pour les créations compatibles ou rechargez explicitement avant de décider de la suite.",
      es: "Comprueba el estado HTTP antes de leer un DTO de éxito. Los errores de negocio contienen error.code; los campos adicionales dependen del endpoint. Un fallo no equivale a una lista vacía ni a un total cero. No supongas éxito tras un timeout: usa la clave de idempotencia guardada para creaciones compatibles o vuelve a consultar expresamente antes de decidir el siguiente paso.",
    },
  ],
  errorExample: [
    "Example business error",
    {
      zh: "业务错误示例",
      ja: "業務エラーの例",
      ko: "업무 오류 예시",
      fr: "Exemple d’erreur métier",
      es: "Ejemplo de error de negocio",
    },
  ],
  error401: [
    "Missing, expired or revoked credentials. Verify the token and environment; issue a new key after membership changes.",
    {
      zh: "缺少、到期或撤销的凭据。检查令牌与环境，成员变化后重新发行密钥。",
      ja: "認証情報が欠落、期限切れ、失効しています。トークンと環境を確認し、メンバー変更後は新しいキーを発行します。",
      ko: "인증 정보가 없거나 만료·철회되었습니다. 토큰과 환경을 확인하고 구성원 변경 후에는 새 키를 발급하세요.",
      fr: "Identifiants absents, expirés ou révoqués. Vérifiez le jeton et l’environnement ; émettez une nouvelle clé après un changement d’adhésion.",
      es: "Credenciales ausentes, vencidas o revocadas. Verifica el token y el entorno; emite una clave nueva tras cambios de membresía.",
    },
  ],
  error403: [
    "Check effective scope, current member role, bound workspace, project allowlist/shared switch and GitHub grants for linked projects. RECORD_LIMIT means expense capacity is full with automatic removal Off; inspect ledgerUsage and remove records manually or explicitly enable the setting. RETENTION_TARGET_FORBIDDEN means you cannot remove the ledger's oldest candidate. RETENTION_CLEANUP_REQUIRED means usage is above the current plan limit; remove records manually before creating another. Automatic removal does not perform bulk cleanup.",
    {
      zh: "检查有效范围、当前角色、绑定账本、项目白名单、公共池开关及已关联项目的 GitHub 权限。 RECORD_LIMIT 表示自动移除关闭且支出容量已满，检查 ledgerUsage 后手动移除记录或主动开启设置。RETENTION_TARGET_FORBIDDEN 表示你无权移除账本最早候选记录。 RETENTION_CLEANUP_REQUIRED 表示使用量超过当前套餐上限，新增前须手动移除记录，自动移除不会批量清理。",
      ja: "有効なスコープ、現在の役割、固定 workspace、プロジェクト許可リスト、shared スイッチ、連携プロジェクトの GitHub 権限を確認します。 RECORD_LIMIT は自動削除 Off で支出枠が満杯です。ledgerUsage を確認し、手動削除するか明示的に設定を有効にしてください。RETENTION_TARGET_FORBIDDEN は帳簿の最古の対象を削除する権限がないことを示します。 RETENTION_CLEANUP_REQUIRED は現在のプラン上限を超えているため、新規作成前に手動削除が必要です。自動削除は一括整理を行いません。",
      ko: "유효 범위, 현재 역할, 연결된 workspace, 프로젝트 허용 목록, shared 스위치 및 연결된 프로젝트의 GitHub 권한을 확인하세요. RECORD_LIMIT는 자동 제거가 Off이고 지출 용량이 가득 찼다는 뜻입니다. ledgerUsage를 확인해 수동 제거하거나 명시적으로 설정을 켜세요. RETENTION_TARGET_FORBIDDEN은 장부의 가장 오래된 후보를 제거할 권한이 없다는 뜻입니다. RETENTION_CLEANUP_REQUIRED는 현재 요금제 한도를 초과했으므로 새 기록 전에 수동 제거해야 한다는 뜻입니다. 자동 제거는 일괄 정리하지 않습니다.",
      fr: "Vérifiez les permissions effectives, le rôle actuel, le workspace lié, la liste de projets/le commutateur shared et les accès GitHub des projets liés. RECORD_LIMIT indique une capacité de dépenses pleine avec la suppression automatique Off : consultez ledgerUsage, supprimez manuellement ou activez explicitement le réglage. RETENTION_TARGET_FORBIDDEN indique l’absence d’autorisation sur le candidat le plus ancien du registre. RETENTION_CLEANUP_REQUIRED indique un usage supérieur à la limite du plan actuel : supprimez manuellement avant toute nouvelle création. La suppression automatique ne nettoie pas en masse.",
      es: "Comprueba permisos efectivos, rol actual, workspace vinculado, lista de proyectos/interruptor shared y autorizaciones GitHub de los proyectos vinculados. RECORD_LIMIT indica capacidad de gastos llena con eliminación automática Off: consulta ledgerUsage, elimina manualmente o activa expresamente el ajuste. RETENTION_TARGET_FORBIDDEN indica que no puedes eliminar el candidato más antiguo del libro. RETENTION_CLEANUP_REQUIRED indica que el uso supera el límite del plan actual: elimina manualmente antes de crear otro registro. La eliminación automática no realiza limpieza masiva.",
    },
  ],
  error409: [
    "Idempotency body conflict, duplicate configuration or concurrent authority change. Inspect error.code and reconcile; do not resend blindly.",
    {
      zh: "幂等请求体冲突、配置重复或并发权限变化。检查 error.code 并合并处理，不要盲目重发。",
      ja: "冪等キーの本文不一致、設定重複、同時の権限変更です。error.code を確認して調整し、無条件に再送しないでください。",
      ko: "멱등 본문 충돌, 중복 설정 또는 동시 권한 변경입니다. error.code를 확인해 조정하고 무작정 다시 보내지 마세요.",
      fr: "Conflit de corps d’idempotence, configuration dupliquée ou autorité modifiée simultanément. Examinez error.code et rapprochez les données ; ne renvoyez pas à l’aveugle.",
      es: "Conflicto del cuerpo de idempotencia, configuración duplicada o cambio concurrente de autoridad. Revisa error.code y concilia; no reenvíes a ciegas.",
    },
  ],
  error412: [
    "Reload the resource for its current revision. Use a quoted If-Match on an explicit retry; missing If-Match is 428.",
    {
      zh: "读取资源当前版本，主动重试时使用带引号的 If-Match；缺少 If-Match 为 428。",
      ja: "現在の revision を取得し直します。明示的な再試行で引用符付き If-Match を使います。If-Match 不足は 428 です。",
      ko: "현재 revision을 다시 조회하세요. 명시적 재시도에 따옴표로 감싼 If-Match를 사용하며, If-Match 누락은 428입니다.",
      fr: "Rechargez la ressource pour obtenir sa version actuelle. Utilisez If-Match entre guillemets lors d’une reprise explicite ; son absence donne 428.",
      es: "Vuelve a consultar la revisión actual del recurso. Usa If-Match entre comillas en un reintento explícito; si falta If-Match, se devuelve 428.",
    },
  ],
  error422: [
    "Validate input and filters. CATEGORY_REQUIRED needs an explicit category; Free integration should always supply an active categoryId.",
    {
      zh: "检查输入和筛选条件。CATEGORY_REQUIRED 要求明确类别，Free 接入应始终指定启用 categoryId。",
      ja: "入力とフィルターを確認します。CATEGORY_REQUIRED には明示的なカテゴリーが必要です。Free の連携では常に有効な categoryId を指定してください。",
      ko: "입력과 필터를 확인하세요. CATEGORY_REQUIRED는 명시적 카테고리가 필요하며 Free 연동은 항상 활성 categoryId를 지정해야 합니다.",
      fr: "Validez les entrées et filtres. CATEGORY_REQUIRED exige une catégorie explicite ; une intégration Free doit toujours fournir un categoryId actif.",
      es: "Valida los datos y filtros. CATEGORY_REQUIRED necesita una categoría explícita; una integración Free debe aportar siempre un categoryId activo.",
    },
  ],
  error429: [
    "Account, request or model allowance reached. Inspect error.code and any Retry-After header. Avoid loops and automatic write retries.",
    {
      zh: "账户、请求或模型额度已达到限制。检查 error.code 及可能存在的 Retry-After，不要循环或自动重试写操作。",
      ja: "アカウント、リクエスト、モデルの枠に達しました。error.code と Retry-After ヘッダーがあれば確認します。ループや書き込みの自動再試行を避けてください。",
      ko: "계정, 요청 또는 모델 허용량에 도달했습니다. error.code와 제공되는 Retry-After를 확인하세요. 반복 루프와 자동 쓰기 재시도를 피하세요.",
      fr: "Limite de compte, requêtes ou modèle atteinte. Examinez error.code et tout en-tête Retry-After. Évitez les boucles et reprises automatiques d’écritures.",
      es: "Se alcanzó el límite de cuenta, solicitudes o modelo. Revisa error.code y cualquier cabecera Retry-After. Evita bucles y reintentos automáticos de escrituras.",
    },
  ],
  error503: [
    "Provider/service unavailable or environment paused. D1_ACCESS_PAUSED is an intentional pause; do not switch environments or retry writes automatically.",
    {
      zh: "供应方或服务不可用、环境暂停。D1_ACCESS_PAUSED 是明确的暂停状态，不要自动切换环境或重试写操作。",
      ja: "プロバイダー・サービスが利用不能、または環境が停止中です。D1_ACCESS_PAUSED は意図的な停止で、環境の自動切り替えや書き込みの自動再試行は行わないでください。",
      ko: "공급자·서비스가 사용 불가능하거나 환경이 중지되었습니다. D1_ACCESS_PAUSED는 의도된 중지 상태이며 환경을 자동 전환하거나 쓰기를 자동 재시도하지 마세요.",
      fr: "Fournisseur/service indisponible ou environnement suspendu. D1_ACCESS_PAUSED est une suspension intentionnelle ; ne changez pas d’environnement et ne reprenez pas les écritures automatiquement.",
      es: "Proveedor/servicio no disponible o entorno en pausa. D1_ACCESS_PAUSED es una pausa intencionada; no cambies de entorno ni reintentes escrituras automáticamente.",
    },
  ],
  limits: [
    "Use /me entitlements for the Owner's current plan and configured allowances rather than hardcoding prices or capacity. Standard list pages are bounded to 100; recurring rules are bounded to 100 noncanceled rules per ledger; explicit expense review handles one expense per request and shares the monthly model allowance without a daily attempt cap. Request/schema limits and operation-specific errors are listed below in the complete reference. Read /me ledgerUsage for used, limit and remaining capacity: projects count retained projects, including archived/removed projects; expenseRecords count undeleted expenses in the visible ledger. Manual or automatic expense removal and project removal free expense slots, with no extra charges.",
    {
      zh: "通过 /me entitlements 读取 Owner 当前套餐及配置额度，不要硬编码价格或容量。标准列表每页最多 100 条，每账本最多 100 个未取消周期计划；主动巡检每请求检查一笔并共享月度模型额度，不设每日尝试次数上限。请求、字段限制和各操作错误见下方完整参考。 通过 /me ledgerUsage 读取已用、上限及剩余容量：projects 包含保留的归档及已移除项目；expenseRecords 统计可见账本中未移除支出。手动或自动移除支出、移除项目会释放支出名额，无额外收费。",
      ja: "価格や容量を固定せず、/me entitlements から Owner の現在のプランと設定枠を取得します。通常の一覧は 1 ページ最大 100 件、定期ルールは台帳ごとに未取消 100 件です。明示的な支出巡検は 1 リクエスト 1 件で、月間モデル枠を共有し、1日の試行回数上限はありません。リクエスト・スキーマ制限と操作別エラーは下の完全なリファレンスに記載しています。 /me ledgerUsage で使用数、上限、残り枠を取得します。projects はアーカイブ・削除済みを含む保持プロジェクトを、expenseRecords は表示対象帳簿の未削除支出を数えます。支出の手動・自動削除やプロジェクト削除で支出枠が空き、追加料金はありません。",
      ko: "가격이나 용량을 하드코딩하지 말고 /me entitlements로 Owner의 현재 요금제와 설정된 허용량을 조회하세요. 표준 목록은 페이지당 최대 100개, 반복 규칙은 원장당 취소되지 않은 100개로 제한됩니다. 명시적 지출 검토는 요청당 한 건이며 월간 모델 허용량을 공유하며 일일 시도 횟수 제한은 없습니다. 요청·스키마 제한과 작업별 오류는 아래 전체 참조에 나와 있습니다. /me ledgerUsage에서 사용량·한도·남은 용량을 읽으세요. projects는 보관·제거된 프로젝트를 포함하며 expenseRecords는 표시 대상 장부에서 제거되지 않은 지출을 셉니다. 지출의 수동·자동 제거와 프로젝트 제거는 추가 요금 없이 지출 자리를 확보합니다.",
      fr: "Utilisez /me entitlements pour connaître le plan actuel et les limites configurées d’Owner, sans figer prix ni capacités. Les pages standards sont limitées à 100 éléments ; chaque registre admet 100 règles non annulées. La vérification explicite traite une dépense par requête et partage le quota mensuel du modèle, sans limite quotidienne de tentatives. Les limites de requête/schéma et erreurs par opération figurent dans la référence complète ci-dessous. Consultez /me ledgerUsage pour l’usage, la limite et les places restantes : projects compte les projets conservés, archivés ou supprimés inclus ; expenseRecords compte les dépenses non supprimées du registre visible. Les suppressions manuelles ou automatiques de dépenses et la suppression de projet libèrent des places de dépenses sans frais supplémentaires.",
      es: "Usa /me entitlements para conocer el plan actual y límites configurados de Owner, sin fijar precios ni capacidades en el código. Las páginas estándar se limitan a 100 elementos y cada libro a 100 reglas no canceladas. La revisión explícita comprueba un gasto por solicitud y comparte la asignación mensual del modelo sin un límite diario de intentos. Los límites de solicitud/esquema y errores por operación figuran en la referencia completa siguiente. Consulta /me ledgerUsage para uso, límite y capacidad restante: projects cuenta proyectos conservados, incluidos archivados y eliminados; expenseRecords cuenta gastos no eliminados del libro visible. Eliminar gastos manual o automáticamente, o eliminar proyectos, libera plazas de gastos sin cargos adicionales.",
    },
  ],
  retentionTitle: [
    "Expense capacity and automatic removal",
    {
      zh: "支出容量与自动移除",
      ja: "支出の容量と自動削除",
      ko: "지출 용량 및 자동 제거",
      fr: "Capacité des dépenses et suppression automatique",
      es: "Capacidad de gastos y eliminación automática",
    },
  ],
  expenseRetention: [
    "Expense capacity counts undeleted expenses in the Owner's visible ledger: shared-pool expenses and expenses in active or archived projects. Removing an expense manually or automatically, or removing its project, frees expense slots; archived and removed projects still consume project capacity. autoRemoveOldestExpense is Off by default on every plan. Off blocks new expenses at capacity. On, when exactly full, removes one oldest expense and saves the new expense atomically, without extra charges. Oldest means occurredOn first, then createdAt, then id. Removed expenses disappear from normal reads, reports and CSV. Internal immutable audit and idempotency records remain, without restoring removed expenses. The authorized last-24-hour operation log can still show removal events and their changes. Changing the switch does not immediately remove expenses or reset usage.",
    {
      zh: "支出容量统计 Owner 可见账本中未移除的支出，包括公共池和启用或归档项目内的支出。手动或自动移除支出、移除其项目均会释放支出名额；归档和移除的项目仍占用项目容量。所有套餐的 autoRemoveOldestExpense 默认关闭：关闭时容量满后阻止新增；开启时，恰好满额会在一次原子操作中移除最早一笔并保存新支出，不收取额外费用。最早顺序依次按 occurredOn、createdAt、id 判定。移除记录不再通过普通读取、报表或 CSV 呈现。内部不可变审计及幂等记录仍保留，但不能恢复已移除支出。获授权的最近 24 小时操作日志仍可显示移除事件及其变更。 切换开关不会立即移除支出或重置使用量。",
      ja: "支出枠は Owner の表示対象帳簿にある未削除の支出を数えます。共有プールと、有効またはアーカイブ済みプロジェクト内の支出が対象です。支出の手動・自動削除やプロジェクト削除で支出枠が空きますが、アーカイブ・削除済みプロジェクトはプロジェクト枠を消費し続けます。autoRemoveOldestExpense は全プランで既定では Off です。Off では上限に達すると新規支出を保存できません。On では上限と同数のとき、最も古い支出 1 件の削除と新規保存を単一の不可分な処理で行い、追加料金はかかりません。古さは occurredOn、createdAt、id の順で判定します。削除した支出は通常の取得、レポート、CSV に現れません。変更不可の内部監査と冪等性記録は保持しますが、削除した支出は復元できません。権限のある直近 24 時間の操作ログには削除イベントと変更内容が表示される場合があります。 切り替え自体は支出を即時削除せず、使用量もリセットしません。",
      ko: "지출 한도는 Owner의 표시 대상 장부에서 제거되지 않은 지출을 셉니다. 공유 풀과 활성 또는 보관된 프로젝트의 지출이 포함됩니다. 지출을 수동·자동 제거하거나 프로젝트를 제거하면 지출 자리가 비지만, 보관·제거된 프로젝트는 계속 프로젝트 한도를 사용합니다. autoRemoveOldestExpense는 모든 요금제에서 기본 Off입니다. Off이면 용량이 찼을 때 새 지출을 차단합니다. On이면 정확히 한도에 도달했을 때 가장 오래된 지출 한 건 제거와 새 지출 저장을 하나의 원자적 작업으로 수행하며 추가 요금은 없습니다. 순서는 occurredOn, createdAt, id 순으로 판단합니다. 제거한 지출은 일반 조회·보고서·CSV에서 사라집니다. 변경 불가능한 내부 감사와 멱등성 기록은 유지되지만 제거한 지출은 복원할 수 없습니다. 권한이 있는 최근 24시간 작업 로그에는 제거 이벤트와 변경 내용이 표시될 수 있습니다. 스위치를 바꾸는 것만으로 지출을 즉시 제거하거나 사용량을 초기화하지 않습니다.",
      fr: "La capacité compte les dépenses non supprimées du registre visible d’Owner : fonds partagé et projets actifs ou archivés. Supprimer une dépense manuellement ou automatiquement, ou supprimer son projet, libère des places de dépenses ; les projets archivés ou supprimés occupent toujours des places de projets. autoRemoveOldestExpense est Off par défaut sur tous les plans. Off bloque les nouvelles dépenses lorsque la capacité est pleine. On, lorsque le nombre atteint exactement la limite, supprime une seule dépense la plus ancienne et enregistre la nouvelle de manière atomique, sans frais supplémentaires. L’ordre est occurredOn, puis createdAt, puis id. Les dépenses supprimées disparaissent des lectures normales, rapports et CSV. Les audits internes immuables et les enregistrements d’idempotence sont conservés, sans restauration des dépenses supprimées. Le journal autorisé des dernières 24 heures peut encore afficher les suppressions et leurs changements. Changer le réglage ne supprime pas immédiatement de dépenses et ne réinitialise pas l’usage.",
      es: "La capacidad cuenta los gastos no eliminados del libro visible de Owner: fondo compartido y proyectos activos o archivados. Eliminar un gasto manual o automáticamente, o eliminar su proyecto, libera plazas de gastos; los proyectos archivados o eliminados siguen ocupando capacidad de proyectos. autoRemoveOldestExpense está Off por defecto en todos los planes. Off bloquea nuevos gastos al alcanzar la capacidad. On, cuando el número coincide exactamente con el límite, elimina un solo gasto, el más antiguo, y guarda el nuevo de forma atómica, sin cargos adicionales. El orden es occurredOn, después createdAt y después id. Los gastos eliminados desaparecen de consultas normales, informes y CSV. Se conservan las auditorías internas inmutables y los registros de idempotencia, sin restaurar los gastos eliminados. El registro autorizado de las últimas 24 horas puede seguir mostrando eliminaciones y sus cambios. Cambiar el ajuste no elimina gastos inmediatamente ni reinicia el uso.",
    },
  ],
  retentionAuthority: [
    "The oldest candidate is selected across the Owner's visible project and shared-pool expenses, including archived projects. The caller must be allowed to remove that exact record. A role or key restriction that forbids it returns 403 RETENTION_TARGET_FORBIDDEN; the server does not skip it and remove a newer permitted record. With automatic removal enabled, if a lower plan limit leaves usage above capacity, the server returns 403 RETENTION_CLEANUP_REQUIRED: remove expenses manually before creating another. Automatic removal replaces only one expense when exactly full, never performs bulk cleanup. Failed creation removes no expense; an exact Idempotency-Key replay removes no additional expense. Recurring generation follows the same Owner preference and capacity rules.",
    {
      zh: "候选记录从 Owner 的可见项目与公共池支出中全局选择，包含归档项目。调用者必须有权限移除这条确切记录；角色或密钥限制不允许时返回 403 RETENTION_TARGET_FORBIDDEN，服务端不会跳过它改删较新的可访问记录。开启自动移除后，若降级导致使用量超过容量，则返回 403 RETENTION_CLEANUP_REQUIRED，须先手动移除支出再新增。自动移除仅在恰好满额时替换一笔，不执行批量清理。新增失败不移除任何支出，相同 Idempotency-Key 的精确重放不会再次移除。周期生成遵循相同的 Owner 偏好与容量规则。",
      ja: "対象はアーカイブ済みを含む Owner の表示対象プロジェクトと共有プールの支出全体から選びます。呼び出し元にはその特定の記録を削除する権限が必要です。役割やキー制限で禁止されていれば 403 RETENTION_TARGET_FORBIDDEN を返し、飛ばして新しい許可済み記録を削除することはありません。自動削除 On でプラン引き下げにより使用数が容量を超えていれば 403 RETENTION_CLEANUP_REQUIRED となり、新規作成前に手動削除が必要です。自動削除は上限と同数のときに 1 件だけ置き換え、一括整理はしません。作成失敗は支出を削除せず、同じ Idempotency-Key の完全一致再送も追加削除を行いません。定期生成にも同じ Owner の設定と容量規則が適用されます。",
      ko: "후보는 보관된 프로젝트를 포함한 Owner의 표시 대상 프로젝트 및 공유 풀 전체 지출에서 선택합니다. 호출자는 바로 그 기록을 제거할 권한이 있어야 합니다. 역할이나 키 제한이 금지하면 403 RETENTION_TARGET_FORBIDDEN을 반환하며, 건너뛰고 더 최근의 허용된 기록을 제거하지 않습니다. 자동 제거가 On이고 요금제 하향 후 사용량이 용량을 초과하면 403 RETENTION_CLEANUP_REQUIRED가 반환되므로 새 지출 전에 수동 제거해야 합니다. 자동 제거는 정확히 한도에 도달했을 때 한 건만 교체하며 일괄 정리하지 않습니다. 생성 실패나 동일 Idempotency-Key의 정확한 재전송은 추가 지출을 제거하지 않습니다. 반복 생성도 같은 Owner 설정과 용량 규칙을 따릅니다.",
      fr: "Le candidat le plus ancien est choisi dans toutes les dépenses visibles des projets et du fonds partagé d’Owner, y compris les projets archivés. L’appelant doit pouvoir supprimer cet enregistrement précis. Une restriction de rôle ou de clé renvoie 403 RETENTION_TARGET_FORBIDDEN ; le serveur ne passe pas à une dépense plus récente autorisée. Avec la suppression automatique On, si une limite de plan réduite laisse l’usage au-dessus de la capacité, 403 RETENTION_CLEANUP_REQUIRED impose une suppression manuelle avant toute création. L’automatisme remplace une seule dépense lorsque la capacité est exactement pleine, sans nettoyage en masse. Un échec ou une reprise exacte avec Idempotency-Key ne supprime aucune dépense supplémentaire. La génération récurrente suit les mêmes préférences d’Owner et règles de capacité.",
      es: "El candidato más antiguo se elige entre todos los gastos visibles de proyectos y fondo compartido de Owner, incluidos los proyectos archivados. Quien llama debe poder eliminar ese registro concreto. Una restricción de rol o clave devuelve 403 RETENTION_TARGET_FORBIDDEN; el servidor no lo omite para eliminar otro más reciente permitido. Con la eliminación automática On, si una reducción del límite deja el uso por encima de la capacidad, 403 RETENTION_CLEANUP_REQUIRED exige eliminar gastos manualmente antes de crear otro. La eliminación automática reemplaza un solo gasto cuando el uso coincide con el límite y no realiza limpieza masiva. Un fallo o una repetición exacta con Idempotency-Key no elimina gastos adicionales. La generación recurrente sigue la misma preferencia de Owner y las mismas reglas de capacidad.",
    },
  ],
  retentionAccount: [
    "GET/PATCH /api/v1/account/expense-retention manage the signed-in account's own autoRemoveOldestExpense preference on every plan. They require a browser session Cookie; Bearer credentials are rejected. GET returns {autoRemoveOldestExpense, revision}. PATCH sends only {autoRemoveOldestExpense: boolean}, with that preference revision quoted in If-Match and a trusted app Origin or Referer. Selecting another shared workspace does not change which account is updated; that ledger uses its own Owner's preference. Changing the switch does not immediately remove expenses, reset usage or add charges. Read after a conflict before submitting another explicit change.",
    {
      zh: "所有套餐均可通过 GET/PATCH /api/v1/account/expense-retention 管理已登录账户自己的 autoRemoveOldestExpense 偏好。接口要求浏览器会话 Cookie，拒绝 Bearer 凭据。GET 返回 {autoRemoveOldestExpense, revision}。PATCH 仅提交 {autoRemoveOldestExpense: boolean}，在 If-Match 中传入带引号的偏好版本，并提供受信任应用的 Origin 或 Referer。选中其他共享账本不改变被更新的账户；该共享账本遵循其自身 Owner 的偏好。切换开关不会立即移除支出、重置使用量或额外收费。冲突后先重新读取，再主动提交修改。",
      ja: "全プランで GET/PATCH /api/v1/account/expense-retention によりログイン中アカウント自身の autoRemoveOldestExpense 設定を管理できます。ブラウザーセッションの Cookie が必要で、Bearer 認証は拒否されます。GET は {autoRemoveOldestExpense, revision} を返します。PATCH は {autoRemoveOldestExpense: boolean} だけを送り、設定の revision を引用符付き If-Match に入れ、信頼されたアプリの Origin または Referer を指定します。他の共有帳簿を選んでも更新対象アカウントは変わらず、その帳簿は自身の Owner の設定に従います。切り替え自体は支出を即時削除せず、使用量のリセットや追加料金もありません。競合時は再取得してから明示的に変更を送信してください。",
      ko: "모든 요금제에서 GET/PATCH /api/v1/account/expense-retention으로 로그인한 계정 자신의 autoRemoveOldestExpense 설정을 관리합니다. 브라우저 세션 Cookie가 필요하며 Bearer 인증은 거부됩니다. GET은 {autoRemoveOldestExpense, revision}을 반환합니다. PATCH는 {autoRemoveOldestExpense: boolean}만 보내며 설정의 revision을 If-Match에 따옴표로 감싸고 신뢰된 앱 Origin 또는 Referer를 제공해야 합니다. 다른 공유 장부를 선택해도 수정 대상 계정은 바뀌지 않으며 그 장부는 자체 Owner 설정을 따릅니다. 스위치를 바꾸는 것만으로 지출을 즉시 제거하거나 사용량을 초기화하거나 추가 요금을 부과하지 않습니다. 충돌 후 다시 조회하고 명시적으로 변경하세요.",
      fr: "GET/PATCH /api/v1/account/expense-retention gèrent sur tous les plans la préférence autoRemoveOldestExpense du compte connecté. Un Cookie de session navigateur est requis ; les identifiants Bearer sont rejetés. GET renvoie {autoRemoveOldestExpense, revision}. PATCH envoie seulement {autoRemoveOldestExpense: boolean}, avec la revision du réglage entre guillemets dans If-Match et un Origin ou Referer d’application de confiance. Choisir un autre registre partagé ne change pas le compte mis à jour ; ce registre suit la préférence de son Owner. Changer le réglage ne supprime pas immédiatement de dépenses, ne réinitialise pas l’usage et n’ajoute pas de frais. Après un conflit, relisez avant une nouvelle modification explicite.",
      es: "GET/PATCH /api/v1/account/expense-retention gestionan en todos los planes la preferencia autoRemoveOldestExpense de la cuenta conectada. Requieren Cookie de sesión del navegador y rechazan credenciales Bearer. GET devuelve {autoRemoveOldestExpense, revision}. PATCH envía solo {autoRemoveOldestExpense: boolean}, con la revision del ajuste entre comillas en If-Match y un Origin o Referer de una aplicación de confianza. Elegir otro libro compartido no cambia la cuenta actualizada; ese libro sigue la preferencia de su propio Owner. Cambiar el ajuste no elimina gastos inmediatamente, reinicia el uso ni añade cargos. Tras un conflicto, vuelve a consultar antes de otra modificación explícita.",
    },
  ],
};
