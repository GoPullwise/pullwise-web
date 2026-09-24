export const API_KEY_SCOPES = [
  { value: "profile:read", labelEn: "Read profile", labelZh: "读取资料",
    descEn: "Read the current product profile.", descZh: "读取当前产品账户资料。" },
  { value: "repositories:read", labelEn: "Read repositories", labelZh: "读取仓库",
    descEn: "Read authorized repository services.", descZh: "读取已授权的仓库服务。" },
  { value: "items:read", labelEn: "Read items and sources", labelZh: "读取事项与来源",
    descEn: "Read saved PR, CI and Updates evidence.", descZh: "读取已保存的 PR、CI、Updates 证据。" },
  { value: "watches:read", labelEn: "Read watches", labelZh: "读取关注项",
    descEn: "List saved upstream update watches.", descZh: "列出已保存的上游更新关注项。" },
  { value: "usage:read", labelEn: "Read usage", labelZh: "读取用量",
    descEn: "Read entitlements and processing history.", descZh: "读取权益与处理历史。" },
  { value: "items:write", labelEn: "Handle items", labelZh: "处理事项",
    descEn: "Save handling and classification feedback.", descZh: "保存处理状态与分类反馈。" },
  { value: "watches:write", labelEn: "Manage watches", labelZh: "管理关注项",
    descEn: "Change or archive authorized watches.", descZh: "更改或归档已授权关注项。" },
  { value: "sync:write", labelEn: "Sync GitHub facts", labelZh: "同步 GitHub 事实",
    descEn: "Queue fact-only sync without model analysis.", descZh: "排队同步事实，不启动模型分析。" },
  { value: "repositories:manage", labelEn: "Manage repository services", labelZh: "管理仓库服务",
    descEn: "Update authorized repository service switches.", descZh: "更新已授权仓库服务的开关。" },
];

export const API_KEY_SCOPE_VALUES = API_KEY_SCOPES.map((scope) => scope.value);
export const DEFAULT_SCOPE_VALUES = ["profile:read", "repositories:read", "items:read", "watches:read", "usage:read"];
