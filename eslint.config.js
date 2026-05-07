import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        React: "readonly",
        ReactDOM: "readonly",
        Icon: "readonly",
        I: "readonly",
        T: "readonly",
        useLang: "readonly",
        setLang: "readonly",
        Topbar: "readonly",
        Sidebar: "readonly",
        LandingScreen: "readonly",
        PricingScreen: "readonly",
        DocsScreen: "readonly",
        LoginScreen: "readonly",
        OAuthScreen: "readonly",
        ReposScreen: "readonly",
        ScanningScreen: "readonly",
        DashboardScreen: "readonly",
        IssuesScreen: "readonly",
        IssueDetailScreen: "readonly",
        HistoryScreen: "readonly",
        SettingsScreen: "readonly",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "no-undef": "off",
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "react-refresh/only-export-components": "off",
    },
  },
];
