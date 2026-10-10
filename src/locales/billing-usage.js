export const BILLING_USAGE_COPY = {
  jevTitle: [
    "Jev usage",
    { zh: "Jev 用量", ja: "Jev の使用量", ko: "Jev 사용량", fr: "Utilisation de Jev", es: "Uso de Jev" },
  ],
  jevAllowance: [
    "Jev assistance allowance",
    { zh: "Jev 辅助额度", ja: "Jev アシスト利用枠", ko: "Jev 지원 한도", fr: "Allocation d’assistance Jev", es: "Asignación de asistencia Jev" },
  ],
  jevMonth: [
    "UTC month",
    { zh: "UTC 月份", ja: "UTC の月", ko: "UTC 월", fr: "Mois UTC", es: "Mes UTC" },
  ],
  jevPolicy: [
    "Used tracks the allowance reserved for model calls, not the provider’s actual invoice. This is for the ledger you own. The allowance resets each UTC calendar month without rollover, including annual subscriptions. Use Refresh usage to update these values.",
    {
      zh: "已使用额度按模型调用的保守预留计算，并非服务商实际账单。这里显示你拥有的账本用量。额度按 UTC 自然月重置，不结转，年订阅也一样。点击“刷新用量”可更新数值。",
      ja: "使用量はモデル呼び出しに予約した利用枠であり、プロバイダーの実際の請求額ではありません。あなたが所有する帳簿の使用量です。年額契約も含め、枠は UTC の暦月ごとにリセットされ、繰り越されません。「使用量を更新」で数値を更新できます。",
      ko: "사용량은 모델 호출을 위해 보수적으로 예약한 한도이며 공급자의 실제 청구액이 아닙니다. 본인이 소유한 장부의 사용량입니다. 연간 구독도 한도는 UTC 달력 월마다 초기화되며 이월되지 않습니다. 사용량 새로고침으로 값을 갱신하세요.",
      fr: "L’utilisation correspond au quota réservé pour les appels au modèle, pas à la facture réelle du fournisseur. Elle concerne le registre dont vous êtes propriétaire. Le quota est réinitialisé chaque mois civil UTC sans report, y compris pour les abonnements annuels. Utilisez Actualiser l’utilisation pour mettre à jour ces valeurs.",
      es: "El uso refleja el cupo reservado para las llamadas al modelo, no la factura real del proveedor. Corresponde al libro que posees. El cupo se restablece cada mes natural UTC sin acumulación, también en las suscripciones anuales. Usa Actualizar uso para actualizar estos valores.",
    },
  ],
  title: [
    "Ledger usage",
    {
      zh: "账本用量",
      ja: "帳簿の使用量",
      ko: "장부 사용량",
      fr: "Utilisation du registre",
      es: "Uso del libro",
    },
  ],
  projects: [
    "Projects",
    { zh: "项目", ja: "プロジェクト", ko: "프로젝트", fr: "Projets", es: "Proyectos" },
  ],
  expenseRecords: [
    "Expense records",
    {
      zh: "支出记录",
      ja: "支出記録",
      ko: "지출 기록",
      fr: "Enregistrements de dépenses",
      es: "Registros de gastos",
    },
  ],
  used: ["Used", { zh: "已使用", ja: "使用済み", ko: "사용됨", fr: "Utilisé", es: "Usado" }],
  total: [
    "Total allowance",
    {
      zh: "总额度",
      ja: "合計枠",
      ko: "총 한도",
      fr: "Quota total",
      es: "Cupo total",
    },
  ],
  unavailable: [
    "Usage unavailable",
    {
      zh: "用量暂不可用",
      ja: "使用量を取得できません",
      ko: "사용량을 확인할 수 없습니다",
      fr: "Utilisation indisponible",
      es: "Uso no disponible",
    },
  ],
  refresh: [
    "Refresh usage",
    {
      zh: "刷新用量",
      ja: "使用量を更新",
      ko: "사용량 새로고침",
      fr: "Actualiser l’utilisation",
      es: "Actualizar uso",
    },
  ],
  scope: [
    "Usage is for the ledger you own, even when another ledger is selected. Members and API keys share this capacity.",
    {
      zh: "这里显示你拥有的账本用量，即使当前选择了其他账本。成员与 API 密钥共用这份容量。",
      ja: "別の帳簿を選択している場合も、ここにはあなたが所有する帳簿の使用量が表示されます。メンバーと API キーで容量を共有します。",
      ko: "다른 장부를 선택해도 여기에는 본인이 소유한 장부의 사용량이 표시됩니다. 구성원과 API 키는 이 용량을 공유합니다.",
      fr: "L’utilisation concerne le registre dont vous êtes propriétaire, même si un autre registre est sélectionné. Les membres et les clés API partagent cette capacité.",
      es: "El uso corresponde al libro que posees, aunque hayas seleccionado otro libro. Los miembros y las claves API comparten esta capacidad.",
    },
  ],
  retention: [
    "Archived or removed projects still count toward the project limit. Expense usage counts records still in the ledger, including archived projects and recurring expenses. Removing an expense manually or automatically frees its place; removing a project frees its expense places. Capacity does not reset each month.",
    {
      zh: "归档或移除的项目仍计入项目上限。支出用量统计账本中现存的记录，包括归档项目的支出和周期生成的支出。手动或自动移除支出会释放其容量；移除项目会释放该项目的支出容量。容量不会每月重置。",
      ja: "アーカイブ・削除済みのプロジェクトもプロジェクト上限に含まれます。支出は帳簿に残っている記録を数え、アーカイブ済みプロジェクトや定期支出も含みます。手動・自動で支出を削除するとその枠が空き、プロジェクトを削除するとその支出の枠も空きます。容量は毎月リセットされません。",
      ko: "보관하거나 제거한 프로젝트도 프로젝트 한도에 포함됩니다. 지출 사용량은 장부에 남아 있는 기록을 계산하며 보관된 프로젝트와 반복 지출도 포함합니다. 지출을 직접 또는 자동으로 제거하면 공간이 생기고, 프로젝트를 제거하면 해당 지출의 공간도 생깁니다. 용량은 매월 초기화되지 않습니다.",
      fr: "Les projets archivés ou supprimés comptent toujours dans la limite de projets. L’utilisation des dépenses compte les enregistrements présents, y compris les projets archivés et les dépenses récurrentes. Supprimer une dépense manuellement ou automatiquement libère sa place ; supprimer un projet libère les places de ses dépenses. La capacité n’est pas réinitialisée chaque mois.",
      es: "Los proyectos archivados o eliminados siguen contando en el límite de proyectos. El uso de gastos cuenta los registros presentes, incluidos los proyectos archivados y los gastos recurrentes. Eliminar un gasto manual o automáticamente libera su espacio; eliminar un proyecto libera los espacios de sus gastos. La capacidad no se restablece cada mes.",
    },
  ],
  policy: [
    "Project and expense limits apply to the Owner’s ledger and are shared by members and API keys. Archived or removed projects still count toward the project limit. Removing expenses manually or automatically, or removing their project, frees expense capacity. Limits do not reset each month.",
    {
      zh: "项目和支出上限作用于 Owner 的账本，由成员及 API 密钥共用。归档或移除的项目仍计入项目上限；手动或自动移除支出、或移除所属项目，会释放支出容量。上限不会每月重置。",
      ja: "プロジェクトと支出の上限は Owner の帳簿に適用され、メンバーと API キーで共有します。アーカイブ・削除済みプロジェクトもプロジェクト上限に含まれます。支出の手動・自動削除や所属プロジェクトの削除で、支出の枠が空きます。上限は毎月リセットされません。",
      ko: "프로젝트와 지출 한도는 Owner의 장부에 적용되며 구성원과 API 키가 공유합니다. 보관하거나 제거한 프로젝트도 프로젝트 한도에 포함됩니다. 지출을 직접 또는 자동으로 제거하거나 해당 프로젝트를 제거하면 지출 공간이 생깁니다. 한도는 매월 초기화되지 않습니다.",
      fr: "Les limites s’appliquent au registre de l’Owner et sont partagées par les membres et les clés API. Les projets archivés ou supprimés comptent toujours dans la limite de projets. La suppression manuelle ou automatique de dépenses, ou de leur projet, libère de la capacité de dépenses. Les limites ne sont pas réinitialisées chaque mois.",
      es: "Los límites se aplican al libro del Owner y se comparten entre miembros y claves API. Los proyectos archivados o eliminados siguen contando en el límite de proyectos. Eliminar gastos manual o automáticamente, o eliminar su proyecto, libera capacidad de gastos. Los límites no se restablecen cada mes.",
    },
  ],
};
