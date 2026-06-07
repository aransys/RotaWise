import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: [".next/**", "node_modules/**", "prisma/seed.ts"] },
  {
    rules: {
      // Apostrophes in copy are fine and readable as-is.
      "react/no-unescaped-entities": "off",
      // We intentionally use @ts-ignore for optional deps (ioredis/nodemailer)
      // that may be absent at type-check time but present at runtime.
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
];

export default eslintConfig;
