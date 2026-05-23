import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // ──────────────────────────────────────────────
  // Rule overrides
  // ──────────────────────────────────────────────
  {
    rules: {
      // Data fetching in useEffect is the standard React pattern for this project.
      // This rule is overly strict for our use case.
      "react-hooks/set-state-in-effect": "off",
      // Allow underscore-prefixed unused vars (e.g. destructured password)
      "@typescript-eslint/no-unused-vars": ["warn", {
        "varsIgnorePattern": "^_",
        "argsIgnorePattern": "^_",
        "ignoreRestSiblings": true,
      }],
    },
  },
]);

export default eslintConfig;
