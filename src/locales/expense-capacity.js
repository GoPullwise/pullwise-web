export const EXPENSE_CAPACITY_COPY = {
  full: ["Expense record allowance reached. Remove a record, upgrade, or ask the Owner to enable automatic removal of the oldest expense in Settings.", {
    zh: "支出记录已达上限。请移除记录、升级套餐，或由 Owner 在设置中开启自动移除最旧支出。",
    ja: "支出記録数が上限に達しました。記録を削除するか、プランを変更するか、Owner に設定で最も古い支出の自動削除を有効にしてもらってください。",
    ko: "지출 기록 한도에 도달했습니다. 기록을 삭제하거나 요금제를 업그레이드하거나 Owner에게 설정에서 가장 오래된 지출 자동 삭제를 켜 달라고 요청하세요.",
    fr: "Le quota de dépenses est atteint. Supprimez un enregistrement, changez de forfait ou demandez à l’Owner d’activer la suppression automatique de la dépense la plus ancienne dans Paramètres.",
    es: "Se alcanzó el límite de gastos. Elimina un registro, mejora el plan o pide al Owner que active en Ajustes la eliminación automática del gasto más antiguo.",
  }],
  cleanup: ["Usage exceeds your current expense limit. Remove the excess records before adding another. Automatic removal replaces one record at a time.", {
    zh: "当前支出数量超过套餐上限。请先移除多余记录，再添加新支出。自动移除每次只替换一条记录。",
    ja: "現在の支出数がプランの上限を超えています。新しい支出を追加する前に超過分を削除してください。自動削除は1回に1件だけ置き換えます。",
    ko: "현재 지출 수가 요금제 한도를 초과합니다. 새 지출을 추가하기 전에 초과 기록을 삭제하세요. 자동 삭제는 한 번에 한 기록만 교체합니다.",
    fr: "Le nombre de dépenses dépasse la limite actuelle. Supprimez les enregistrements excédentaires avant d’en ajouter un autre. La suppression automatique remplace un seul enregistrement à la fois.",
    es: "El número de gastos supera el límite actual. Elimina los registros excedentes antes de añadir otro. La eliminación automática sustituye un registro cada vez.",
  }],
  forbidden: ["The oldest expense is outside your current permissions. Nothing was removed or added. Ask the Owner to remove it or review your access.", {
    zh: "最旧支出不在你当前的权限范围内，未移除或添加任何记录。请 Owner 移除该支出或检查你的访问权限。",
    ja: "最も古い支出を削除する権限がありません。削除も追加も行われていません。Owner に削除またはアクセス権の確認を依頼してください。",
    ko: "가장 오래된 지출은 현재 권한 범위 밖에 있습니다. 삭제되거나 추가된 기록은 없습니다. Owner에게 삭제 또는 접근 권한 확인을 요청하세요.",
    fr: "La dépense la plus ancienne dépasse vos droits actuels. Aucun enregistrement n’a été supprimé ni ajouté. Demandez à l’Owner de la supprimer ou de vérifier vos accès.",
    es: "El gasto más antiguo está fuera de tus permisos. No se eliminó ni añadió ningún registro. Pide al Owner que lo elimine o revise tu acceso.",
  }],
};

export const EXPENSE_CAPACITY_ERRORS = [
  "RECORD_LIMIT", "RETENTION_CLEANUP_REQUIRED", "RETENTION_TARGET_FORBIDDEN",
];
