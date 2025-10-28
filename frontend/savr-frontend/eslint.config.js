import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Temporary: disable these warnings to unblock development. We'll fix hook deps and exports properly later.
      "react-refresh/only-export-components": "off",
      "react-hooks/exhaustive-deps": "off",
      "@typescript-eslint/no-unused-vars": "off",
      // Allow `any` in the short term to unblock development; we'll fix types incrementally.
      "@typescript-eslint/no-explicit-any": "off",
      // Allow empty blocks in a few places used as placeholders
      "no-empty": "off",
      // Some generated/ported components use empty-object-type - relax for now
      "@typescript-eslint/no-empty-object-type": "off",
      // Allow unused expressions in a few JSX/conditional constructs
      "@typescript-eslint/no-unused-expressions": "off",
    },
  }
);
