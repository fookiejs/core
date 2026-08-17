import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noSpread } from "../../src/rules/no-spread.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-spread", noSpread, {
  valid: [
    { code: "const nextAccount = account.withPatch(patch)" },
    { code: "const recordWithoutKey = record.withoutKey()" },
    { code: "const amounts = [1, 2, 3]" },
    { code: "function sum(left: number, right: number): number { return left + right }" },
  ],
  invalid: [
    {
      code: "const next = { ...account, ...patch }",
      errors: [{ messageId: "noSpread" }, { messageId: "noSpread" }],
    },
    {
      code: "const merged = [...left, ...right]",
      errors: [{ messageId: "noSpread" }, { messageId: "noSpread" }],
    },
    {
      code: "fn(...args)",
      errors: [{ messageId: "noSpread" }],
    },
    {
      code: "const { key, ...rest } = record",
      errors: [{ messageId: "noRest" }],
    },
    {
      code: "function collect(...items: number[]): number { return items.length }",
      errors: [{ messageId: "noRest" }],
    },
  ],
})
