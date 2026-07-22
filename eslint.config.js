import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  {
    ignores: [
      ".worktrees/**",
      "build/**",
      "coverage/**",
      "dist/**",
      "dist-ssr/**",
      "node_modules/**",
      "out/**",
      "vendor/generated/agent-task-contract-npm/**",
    ],
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
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/jsx-uses-vars": "error",
      "react/react-in-jsx-scope": "off",
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
  {
    files: ["src/i18n.jsx"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
];
