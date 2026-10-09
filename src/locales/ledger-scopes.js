const rows = [
  ["Member scopes apply to the whole ledger. Turn off project restrictions to select them, or deselect member scopes to restrict projects.", "成员权限作用于整个账本。关闭项目限制后可选择成员权限；取消成员权限后可限制项目。", "メンバー権限は台帳全体に適用されます。選択するにはプロジェクト制限を解除し、プロジェクトを制限するにはメンバー権限を外してください。", "멤버 권한은 장부 전체에 적용됩니다. 선택하려면 프로젝트 제한을 끄고, 프로젝트를 제한하려면 멤버 권한을 해제하세요.", "Les permissions des membres s’appliquent à tout le registre. Désactivez les restrictions de projets pour les sélectionner, ou retirez ces permissions pour restreindre les projets.", "Los permisos de miembros se aplican a todo el libro. Desactiva las restricciones de proyectos para seleccionarlos o quita esos permisos para restringir proyectos."],
  ["Read members", "读取成员", "メンバーを読む", "멤버 읽기", "Lire les membres", "Leer miembros"],
  ["Manage members", "管理成员", "メンバーを管理", "멤버 관리", "Gérer les membres", "Gestionar miembros"],
  ["Read members in this ledger; cannot be limited to selected projects.", "读取当前账本成员，不能与指定项目限制组合。", "この台帳のメンバーを読みます。特定のプロジェクトには制限できません。", "이 장부의 멤버를 읽습니다. 특정 프로젝트로 제한할 수 없습니다.", "Lire les membres de ce registre ; cette permission ne peut pas être limitée à certains projets.", "Leer los miembros de este libro; no se puede limitar a proyectos seleccionados."],
  ["Manage invitations, join requests and members within your current role; applies to the whole ledger.", "按当前角色管理邀请、加入申请及成员，作用于整个账本。", "現在のロールの範囲で招待、参加申請、メンバーを管理します。台帳全体に適用されます。", "현재 역할에 따라 초대, 가입 신청 및 멤버를 관리합니다. 장부 전체에 적용됩니다.", "Gérer les invitations, les demandes d’adhésion et les membres selon votre rôle actuel ; s’applique à tout le registre.", "Gestionar invitaciones, solicitudes de acceso y miembros según tu rol actual; se aplica a todo el libro."],
  ["Read profile", "读取资料", "プロフィールを読む", "프로필 읽기", "Lire le profil", "Leer perfil"],
  ["Read the current account profile.", "读取当前账户资料。", "現在のアカウント情報を読みます。", "현재 계정 프로필을 읽습니다.", "Lire le profil du compte actuel.", "Leer el perfil de la cuenta actual."],
  ["Read projects", "读取项目", "プロジェクトを読む", "프로젝트 읽기", "Lire les projets", "Leer proyectos"],
  ["Manage projects", "管理项目", "プロジェクトを管理", "프로젝트 관리", "Gérer les projets", "Gestionar proyectos"],
  ["Read categories", "读取类别", "カテゴリを読む", "카테고리 읽기", "Lire les catégories", "Leer categorías"],
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
