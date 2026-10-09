export const API_KEY_SCOPES = [
  { value: "profile:read", labelEn: "Read profile", labelZh: "读取资料", descEn: "Read the current account profile.", descZh: "读取当前账户资料。" },
  { value: "projects:read", labelEn: "Read projects", labelZh: "读取项目", descEn: "List projects in this ledger and repositories authorized to you.", descZh: "列出当前账本的项目及你已授权的仓库。" },
  { value: "projects:write", labelEn: "Manage projects", labelZh: "管理项目", descEn: "Create and manage projects, including names, descriptions, status and optional GitHub links.", descZh: "创建和管理项目，包括名称、说明、状态及可选 GitHub 关联。" },
  { value: "categories:read", labelEn: "Read categories", labelZh: "读取类别", descEn: "List categories in this ledger.", descZh: "列出当前账本的类别。" },
  { value: "categories:write", labelEn: "Manage categories", labelZh: "管理类别", descEn: "Create, rename and archive categories.", descZh: "创建、重命名和归档类别。" },
  { value: "expenses:read", labelEn: "Read expenses", labelZh: "读取支出", descEn: "Read and export allowed expenses.", descZh: "读取和导出获准的支出。" },
  { value: "expenses:write", labelEn: "Manage expenses", labelZh: "管理支出", descEn: "Create, edit and remove allowed expenses.", descZh: "创建、修改和移除获准的支出。" },
  { value: "reports:read", labelEn: "Read reports", labelZh: "读取报表", descEn: "Read currency, date and category totals.", descZh: "读取币种、日期和类别汇总。" },
  { value: "suggestions:use", labelEn: "Request suggestions", labelZh: "请求建议", descEn: "Request optional expense suggestions; cannot record entries.", descZh: "请求可选的支出建议；不能据此自动入账。" },
  { value: "members:read", labelEn: "Read members", labelZh: "读取成员", descEn: "Read members in this ledger; cannot be limited to selected projects.", descZh: "读取当前账本成员，不能与指定项目限制组合。" },
  { value: "members:write", labelEn: "Manage members", labelZh: "管理成员", descEn: "Manage invitations, join requests and members within your current role; applies to the whole ledger.", descZh: "按当前角色管理邀请、加入申请及成员，作用于整个账本。" },
];

export const API_KEY_SCOPE_VALUES = API_KEY_SCOPES.map(scope => scope.value);
export const DEFAULT_SCOPE_VALUES = ["profile:read", "projects:read", "categories:read", "expenses:read", "reports:read"];
