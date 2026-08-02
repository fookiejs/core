import fookie from "@fookiejs/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

const relaxedForTests = {
  "fookie/no-async-without-await": "off",
  "fookie/min-function-lines": "off",
  "fookie/no-floating-promise": "off",
  "fookie/no-type-assertion": "off",
  "fookie/no-nullish-operators": "off",
  "fookie/no-null-undefined": "off",
  "fookie/no-empty-string": "off",
  "fookie/no-generic-names": "off",
  "fookie/no-typeof": "off",
  "fookie/no-unknown": "off",
  "fookie/no-comments": "off",
  "fookie/no-union-type": "off",
  "fookie/no-process-env": "off",
  "fookie/require-explicit-return-type": "off",
  "fookie/require-private-constructor": "off",
  "fookie/prefer-readonly-params": "off",
  "fookie/no-array-mutating-methods": "off",
  "fookie/no-map-set-mutation": "off",
  "fookie/no-class-mutation": "off",
  "fookie/no-spread": "off",
};

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "scripts/**",
      "eslint.config.js",
      "example.ts",
    ],
  },
  fookie.configs["recommended"],
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["tests/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.lint.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: relaxedForTests,
  },
];
