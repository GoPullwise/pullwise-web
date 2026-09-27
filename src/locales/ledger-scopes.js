const rows = [
  ["Read profile", "读取资料", "プロフィールを読む", "프로필 읽기", "Lire le profil", "Leer perfil"],
  ["Read the current account profile.", "读取当前账户资料。", "現在のアカウント情報を読みます。", "현재 계정 프로필을 읽습니다.", "Lire le profil du compte actuel.", "Leer el perfil de la cuenta actual."],
  ["Read projects", "读取项目", "プロジェクトを読む", "프로젝트 읽기", "Lire les projets", "Leer proyectos"],
  ["List authorized repositories and your projects.", "列出已授权仓库和你的项目。", "認可済みリポジトリと自分のプロジェクトを一覧表示します。", "승인된 저장소와 내 프로젝트를 나열합니다.", "Lister les dépôts autorisés et vos projets.", "Listar repositorios autorizados y tus proyectos."],
  ["Manage projects", "管理项目", "プロジェクトを管理", "프로젝트 관리", "Gérer les projets", "Gestionar proyectos"],
  ["Bind repositories and edit descriptions.", "绑定仓库并修改描述。", "リポジトリを紐付け、説明を編集します。", "저장소를 연결하고 설명을 수정합니다.", "Lier des dépôts et modifier les descriptions.", "Vincular repositorios y editar descripciones."],
  ["Read categories", "读取类别", "カテゴリを読む", "카테고리 읽기", "Lire les catégories", "Leer categorías"],
  ["List account categories.", "列出账户类别。", "アカウントのカテゴリを一覧表示します。", "계정 카테고리를 나열합니다.", "Lister les catégories du compte.", "Listar categorías de la cuenta."],
  ["Manage categories", "管理类别", "カテゴリを管理", "카테고리 관리", "Gérer les catégories", "Gestionar categorías"],
  ["Create, rename and archive categories.", "创建、重命名和归档类别。", "カテゴリを作成、名前変更、アーカイブします。", "카테고리를 만들고 이름을 바꾸거나 보관합니다.", "Créer, renommer et archiver des catégories.", "Crear, renombrar y archivar categorías."],
  ["Read expenses", "读取支出", "支出を読む", "지출 읽기", "Lire les dépenses", "Leer gastos"],
  ["Read and export allowed expenses.", "读取和导出获准的支出。", "許可された支出を読み取り、エクスポートします。", "허용된 지출을 읽고 내보냅니다.", "Lire et exporter les dépenses autorisées.", "Leer y exportar los gastos permitidos."],
  ["Manage expenses", "管理支出", "支出を管理", "지출 관리", "Gérer les dépenses", "Gestionar gastos"],
  ["Create, edit and remove allowed expenses.", "创建、修改和移除获准的支出。", "許可された支出を作成、編集、削除します。", "허용된 지출을 생성, 수정 및 삭제합니다.", "Créer, modifier et retirer les dépenses autorisées.", "Crear, editar y eliminar los gastos permitidos."],
  ["Read reports", "读取报表", "レポートを読む", "보고서 읽기", "Lire les rapports", "Leer informes"],
  ["Read currency, date and category totals.", "读取币种、日期和类别汇总。", "通貨、日付、カテゴリ別の合計を読みます。", "통화, 날짜 및 카테고리별 합계를 읽습니다.", "Lire les totaux par devise, date et catégorie.", "Leer totales por moneda, fecha y categoría."],
  ["Request suggestions", "请求建议", "提案をリクエスト", "추천 요청", "Demander des suggestions", "Solicitar sugerencias"],
  ["Request optional expense suggestions; cannot record entries.", "请求可选的支出建议；不能据此自动入账。", "任意の支出提案をリクエストします。記録の作成はできません。", "선택적인 지출 추천을 요청합니다. 항목을 기록할 수 없습니다.", "Demander des suggestions facultatives sans pouvoir créer d'écriture.", "Solicitar sugerencias opcionales sin poder registrar gastos."],
];
export const LEDGER_SCOPE_PHRASES = Object.fromEntries(
  ["zh", "ja", "ko", "fr", "es"].map((code, index) =>
    [code, Object.fromEntries(rows.map(row => [row[0], row[index + 1]]))]));
