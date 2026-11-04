import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import next from "@next/eslint-plugin-next";
import hooks from "eslint-plugin-react-hooks";
export default defineConfig([
  ...tseslint.configs.recommended,
  { files: ["**/*.{ts,tsx}"], plugins: { "@next/next": next, "react-hooks": hooks },
    rules: { ...next.configs.recommended.rules, ...next.configs["core-web-vitals"].rules, ...hooks.configs.recommended.rules } },
  globalIgnores([".next/**", "playwright-report/**", "test-results/**", "next-env.d.ts"]),
]);
