import nextPlugin from "@next/eslint-plugin-next";
import parser from "@typescript-eslint/parser";

export default [
  { ignores: [".next/**", "node_modules/**"] },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: { parser },
    plugins: { "@next/next": nextPlugin },
    rules: nextPlugin.configs["core-web-vitals"].rules,
  },
];
