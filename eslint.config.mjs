import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Next.js 15 provides legacy presets; adapt them for ESLint 9's flat config.
const compat = new FlatCompat({ baseDirectory: path.dirname(fileURLToPath(import.meta.url)) });
const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: [".next/**", ".next-dev/**", "node_modules/**", ".npm-cache/**", "next-env.d.ts"] },
];
export default config;
