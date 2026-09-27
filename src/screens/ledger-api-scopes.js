export const API_KEY_SCOPES = [
  { value: "profile:read", labelEn: "Read profile", labelZh: "读取资料", descEn: "Read the current account profile.", descZh: "读取当前账户资料。" },
  { value: "projects:read", labelEn: "Read projects", labelZh: "读取项目", descEn: "List authorized repositories and your projects.", descZh: "列出已授权仓库和你的项目。" },
  { value: "projects:write", labelEn: "Manage projects", labelZh: "管理项目", descEn: "Bind repositories and edit descriptions.", descZh: "绑定仓库并修改描述。" },
  { value: "categories:read", labelEn: "Read categories", labelZh: "读取类别", descEn: "List account categories.", descZh: "列出账户类别。" },
  { value: "categories:write", labelEn: "Manage categories", labelZh: "管理类别", descEn: "Create, rename and archive categories.", descZh: "创建、重命名和归档类别。" },
  { value: "expenses:read", labelEn: "Read expenses", labelZh: "读取支出", descEn: "Read and export allowed expenses.", descZh: "读取和导出获准的支出。" },
  { value: "expenses:write", labelEn: "Manage expenses", labelZh: "管理支出", descEn: "Create, edit and remove allowed expenses.", descZh: "创建、修改和移除获准的支出。" },
  { value: "reports:read", labelEn: "Read reports", labelZh: "读取报表", descEn: "Read currency, date and category totals.", descZh: "读取币种、日期和类别汇总。" },
  { value: "suggestions:use", labelEn: "Request suggestions", labelZh: "请求建议", descEn: "Request optional expense suggestions; cannot record entries.", descZh: "请求可选的支出建议；不能据此自动入账。" },
];

export const API_KEY_SCOPE_VALUES = API_KEY_SCOPES.map(scope => scope.value);
export const DEFAULT_SCOPE_VALUES = ["profile:read", "projects:read", "categories:read", "expenses:read", "reports:read"];
