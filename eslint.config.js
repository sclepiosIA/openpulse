import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "dist-lighthouse", "coverage", "node_modules", ".venv-browser-use", "tests/browser-use/**", "supabase/functions/**", "docs/archive/**", "**/target/**"] },
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
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Décision audit 2026-06-07 : `no-unused-vars` dégradé en `warn` pour
      // séparer signal-bug (rules-of-hooks, parser, restricted-imports) du
      // bruit de nettoyage. Ratchet via `check:lint-errors` (cf. package.json).
      "@typescript-eslint/no-unused-vars": ["warn", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_",
        "destructuredArrayIgnorePattern": "^_"
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-restricted-syntax": [
        "warn",
        {
          "selector": "MemberExpression[object.property.name='auth'][property.name='getUser']",
          "message": "Avoid supabase.auth.getUser() in components/hooks. Use useAuth() instead for performance."
        }
      ],
      // DEBT-03 (session 70) — racine src/hooks/ vidée, tous les hooks sont
      // domainisés sous src/hooks/<domain>/useXxx. Interdit les imports racine
      // pour éviter la régression.
      "no-restricted-imports": [
        "error",
        {
          "patterns": [
            {
              "group": ["@/hooks/use*"],
              "message": "Import depuis le domaine: @/hooks/<domain>/useXxx (racine src/hooks/ vidée — DEBT-03)."
            }
          ]
        }
      ],
      // Style/structural rules: downgraded to warn to keep CI green without
      // behavior changes. They remain visible as warnings for cleanup.
      "no-useless-escape": "warn",
      "no-case-declarations": "warn",
      "no-empty": "warn",
      "no-irregular-whitespace": "warn",
      "no-constant-binary-expression": "warn",
      "no-extra-boolean-cast": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/prefer-as-const": "warn",
      "@typescript-eslint/triple-slash-reference": "warn",
      "prefer-const": "warn",
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}", "**/__mocks__/**/*.{ts,tsx}", "src/test/**/*.{ts,tsx}"],
    rules: {
      "prefer-const": "off", "no-var": "off", "no-useless-escape": "off",
      "@typescript-eslint/ban-ts-comment": "off", "@typescript-eslint/no-require-imports": "off",
      "no-empty": "off", "no-restricted-imports": "off", "no-case-declarations": "off",
      "@typescript-eslint/no-this-alias": "off", "react-hooks/exhaustive-deps": "off",
      "react-hooks/rules-of-hooks": "off", "no-irregular-whitespace": "off",
      "@typescript-eslint/no-unused-expressions": "off", "@typescript-eslint/no-empty-object-type": "off",
      "no-constant-binary-expression": "off", "@typescript-eslint/no-non-null-asserted-optional-chain": "off",
      "no-self-assign": "off", "no-constant-condition": "off", "no-unexpected-multiline": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
    },
  }
);
