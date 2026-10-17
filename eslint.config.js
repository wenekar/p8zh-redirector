import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "downloads/**",
      "coverage/**",
      "**/__pycache__/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["extension/**/*.js"],
    languageOptions: { globals: { URL: "readonly", browser: "readonly" } },
  },
  {
    files: ["scripts/**/*.js", "tests/**/*.js", "*.config.js"],
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      curly: ["error", "all"],
      eqeqeq: ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",
      "no-implicit-coercion": "error",
      "no-unused-vars": ["error", { args: "all", argsIgnorePattern: "^_" }],
    },
  },
];
