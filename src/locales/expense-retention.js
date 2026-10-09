export const EXPENSE_RETENTION_COPY = {
  title: [
    "Expense capacity",
    {
      zh: "支出容量",
      ja: "支出の容量",
      ko: "지출 용량",
      fr: "Capacité des dépenses",
      es: "Capacidad de gastos",
    },
  ],
  toggle: [
    "Automatically remove the oldest expense at capacity",
    {
      zh: "满额时自动移除最旧支出",
      ja: "上限に達したら最も古い支出を自動削除",
      ko: "한도에 도달하면 가장 오래된 지출 자동 제거",
      fr: "Supprimer automatiquement la dépense la plus ancienne à la limite",
      es: "Eliminar automáticamente el gasto más antiguo al alcanzar el límite",
    },
  ],
  scope: [
    "Applies to the ledger you own, including project and shared pool expenses added by you, members, API keys and recurring schedules. Selecting another owner's ledger does not change this setting.",
    {
      zh: "此设置作用于你拥有的账本，涵盖你、成员、API 密钥和周期计划添加的项目与共享池支出。选择其他所有者的账本不会改变此设置。",
      ja: "自分が所有する帳簿に適用されます。自分、メンバー、API キー、定期スケジュールが追加するプロジェクトと共有プールの支出が対象です。他の所有者の帳簿を選択しても、この設定は変わりません。",
      ko: "본인이 소유한 장부에 적용되며 본인, 구성원, API 키, 반복 일정이 추가하는 프로젝트 및 공유 풀 지출을 포함합니다. 다른 소유자의 장부를 선택해도 이 설정은 바뀌지 않습니다.",
      fr: "S’applique au registre que vous possédez, y compris aux dépenses de projets et du fonds partagé ajoutées par vous, les membres, les clés API et les échéanciers. Choisir le registre d’un autre propriétaire ne modifie pas ce réglage.",
      es: "Se aplica al libro que posees, incluidos los gastos de proyectos y del fondo compartido añadidos por ti, miembros, claves API y programaciones recurrentes. Seleccionar el libro de otro propietario no cambia este ajuste.",
    },
  ],
  description: [
    "Off by default. When the expense limit is reached, Off blocks new expenses. On removes the oldest saved expense before adding a new one. Removed expenses cannot be restored. Available on every plan, with no extra charges.",
    {
      zh: "默认关闭。达到支出上限时，关闭会阻止新增支出；开启会先移除最旧的已保存支出，再添加新支出。已移除的支出无法恢复。所有套餐均可使用，不产生额外费用。",
      ja: "初期設定はオフです。支出の上限に達すると、オフの場合は新規支出を追加できません。オンの場合は最も古い保存済み支出を削除してから新しい支出を追加します。削除した支出は復元できません。すべてのプランで追加料金なしで利用できます。",
      ko: "기본값은 꺼짐입니다. 지출 한도에 도달하면 꺼짐 상태에서는 새 지출을 추가할 수 없습니다. 켜면 가장 오래된 저장 지출을 제거한 후 새 지출을 추가합니다. 제거된 지출은 복원할 수 없습니다. 모든 요금제에서 추가 비용 없이 사용할 수 있습니다.",
      fr: "Désactivé par défaut. À la limite de dépenses, Désactivé bloque les nouveaux ajouts. Activé supprime la dépense enregistrée la plus ancienne avant d’en ajouter une nouvelle. Les dépenses supprimées ne peuvent pas être restaurées. Disponible sur tous les forfaits, sans frais supplémentaires.",
      es: "Desactivado por defecto. Al alcanzar el límite, Desactivado bloquea nuevos gastos. Activado elimina el gasto guardado más antiguo antes de añadir uno nuevo. Los gastos eliminados no se pueden restaurar. Disponible en todos los planes, sin cargos adicionales.",
    },
  ],
  selection: [
    "The oldest expense is chosen by expense date across all projects and the shared pool; earlier creation breaks date ties. New expenses are blocked if the person or API key cannot remove that record. If usage is already above the limit after a plan change, remove expenses yourself first; this setting never clears multiple records at once. Turning it on does not remove any expense immediately.",
    {
      zh: "最旧支出按所有项目与共享池中的支出日期确定；日期相同时，先移除更早创建的记录。若操作人或 API 密钥无权移除该记录，将阻止新增。套餐变更后用量已超上限时，请先手动清理；此设置不会一次批量移除多笔记录。开启开关不会立即移除任何支出。",
      ja: "すべてのプロジェクトと共有プールから、支出日が最も古い記録を選びます。同じ日付なら先に作成された記録が対象です。操作する人や API キーにその記録の削除権限がない場合、追加はできません。プラン変更後に使用量が上限を超えている場合は、先に手動で削除してください。この設定で複数の記録を一度に削除することはありません。オンにしても直ちに支出は削除されません。",
      ko: "모든 프로젝트와 공유 풀에서 지출 날짜가 가장 이른 기록을 선택하며, 날짜가 같으면 먼저 생성된 기록을 제거합니다. 사용자나 API 키가 해당 기록을 제거할 권한이 없으면 새 지출이 차단됩니다. 요금제 변경 후 이미 한도를 초과했다면 먼저 직접 정리하세요. 이 설정은 여러 기록을 한 번에 제거하지 않으며, 켜는 즉시 지출을 제거하지도 않습니다.",
      fr: "La dépense est choisie selon sa date dans tous les projets et le fonds partagé ; à date égale, la création la plus ancienne est prioritaire. L’ajout est bloqué si la personne ou la clé API ne peut pas supprimer cet enregistrement. Si un changement de forfait laisse l’utilisation au-dessus de la limite, supprimez d’abord des dépenses vous-même. Ce réglage ne supprime jamais plusieurs dépenses à la fois. L’activer ne supprime rien immédiatement.",
      es: "Se elige el gasto con la fecha más antigua entre todos los proyectos y el fondo compartido; a igual fecha, tiene prioridad el creado antes. Se bloquean nuevos gastos si la persona o clave API no puede eliminar ese registro. Si un cambio de plan deja el uso por encima del límite, elimina gastos manualmente primero. Este ajuste nunca elimina varios registros a la vez. Activarlo no elimina ningún gasto de inmediato.",
    },
  ],
  on: [
    "On. At the limit, adding a new expense replaces the oldest expense.",
    {
      zh: "已开启。达到上限时，新增支出会替换最旧支出。",
      ja: "オンです。上限に達したら、新規支出の追加時に最も古い支出を置き換えます。",
      ko: "켜짐. 한도에 도달하면 새 지출을 추가할 때 가장 오래된 지출을 대체합니다.",
      fr: "Activé. À la limite, ajouter une dépense remplace la plus ancienne.",
      es: "Activado. Al alcanzar el límite, añadir un gasto sustituye al más antiguo.",
    },
  ],
  off: [
    "Off. At capacity, remove an expense yourself before adding another.",
    {
      zh: "已关闭。满额时，请先手动移除支出，再新增记录。",
      ja: "オフです。上限に達した場合は、支出を手動で削除してから追加してください。",
      ko: "꺼짐. 한도에 도달하면 지출을 직접 제거한 후 새 기록을 추가하세요.",
      fr: "Désactivé. À la limite, supprimez vous-même une dépense avant d’en ajouter une autre.",
      es: "Desactivado. Al alcanzar el límite, elimina un gasto antes de añadir otro.",
    },
  ],
  unavailable: [
    "Expense retention settings are unavailable until reloaded.",
    {
      zh: "重新加载成功后才能使用支出保留设置。",
      ja: "再読み込みするまで支出の保持設定は利用できません。",
      ko: "다시 불러올 때까지 지출 보존 설정을 사용할 수 없습니다.",
      fr: "Les réglages de conservation des dépenses sont indisponibles jusqu’au rechargement.",
      es: "Los ajustes de conservación de gastos no están disponibles hasta recargar.",
    },
  ],
  loadFailed: [
    "Expense retention settings could not be loaded. Reload to try again.",
    {
      zh: "无法读取支出保留设置，请重新加载后重试。",
      ja: "支出の保持設定を読み込めませんでした。再読み込みしてください。",
      ko: "지출 보존 설정을 불러오지 못했습니다. 다시 불러오세요.",
      fr: "Impossible de charger les réglages de conservation des dépenses. Rechargez pour réessayer.",
      es: "No se pudieron cargar los ajustes de conservación de gastos. Recarga para reintentar.",
    },
  ],
  saveFailed: [
    "Expense retention settings could not be saved. Reload before trying again.",
    {
      zh: "无法保存支出保留设置，请重新加载后再试。",
      ja: "支出の保持設定を保存できませんでした。再読み込みしてから再試行してください。",
      ko: "지출 보존 설정을 저장하지 못했습니다. 다시 불러온 후 재시도하세요.",
      fr: "Impossible d’enregistrer les réglages de conservation des dépenses. Rechargez avant de réessayer.",
      es: "No se pudieron guardar los ajustes de conservación de gastos. Recarga antes de reintentar.",
    },
  ],
  changed: [
    "Expense retention settings changed elsewhere. Reload and choose again.",
    {
      zh: "支出保留设置已在其他位置更改，请重新加载后再选择。",
      ja: "支出の保持設定が別の場所で変更されました。再読み込みして選び直してください。",
      ko: "다른 곳에서 지출 보존 설정이 변경되었습니다. 다시 불러온 후 선택하세요.",
      fr: "Les réglages de conservation des dépenses ont changé ailleurs. Rechargez et choisissez à nouveau.",
      es: "Los ajustes de conservación de gastos cambiaron en otro lugar. Recarga y vuelve a elegir.",
    },
  ],
  refreshFailed: [
    "Expense retention preference was saved, but current status could not be refreshed. Reload before changing it again.",
    {
      zh: "支出保留偏好已保存，但无法刷新当前状态。再次修改前请重新加载。",
      ja: "支出の保持設定は保存されましたが、現在の状態を更新できませんでした。再変更する前に再読み込みしてください。",
      ko: "지출 보존 설정은 저장되었지만 현재 상태를 새로고침하지 못했습니다. 다시 변경하기 전에 불러오세요.",
      fr: "La préférence de conservation des dépenses est enregistrée, mais son état n’a pas pu être actualisé. Rechargez avant de la modifier à nouveau.",
      es: "La preferencia de conservación de gastos se guardó, pero no se pudo actualizar su estado. Recarga antes de volver a cambiarla.",
    },
  ],
};
