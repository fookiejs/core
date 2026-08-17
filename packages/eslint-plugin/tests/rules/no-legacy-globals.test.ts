import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noLegacyGlobals } from "../../src/rules/no-legacy-globals.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-legacy-globals", noLegacyGlobals, {
  valid: [
    { code: "addEventListener('click', clickHandler)" },
    { code: "function sum(left: number, right: number): number { return left + right }" },
    { code: "Number.isNaN(amount)" },
    { code: "Number.parseInt(raw, 10)" },
  ],
  invalid: [
    {
      code: "window.addEventListener('click', clickHandler)",
      errors: [{ messageId: "legacyGlobal" }],
    },
    {
      code: "document.body",
      errors: [{ messageId: "legacyGlobal" }],
    },
    {
      code: "globalThis.fetch(url)",
      errors: [{ messageId: "legacyGlobal" }],
    },
    {
      code: "parseInt(raw, 10)",
      errors: [{ messageId: "legacyGlobal" }],
    },
    {
      code: "function legacy() { return arguments.length }",
      errors: [{ messageId: "noArguments" }],
    },
  ],
})
