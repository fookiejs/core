import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noNanInMathResult } from "../../src/rules/no-nan-in-math-result.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-nan-in-math-result", noNanInMathResult, {
  valid: [
    { code: "const r = Math.sqrt(4); if (!Number.isNaN(r)) { r + 1 }" },
    { code: "const r = Math.abs(-1) + 2" },
    { code: "const r = Math.floor(3.5) + 1" },
    { code: "const r = Math.round(1.5) * 2" },
  ],
  invalid: [
    {
      code: "const r = Math.sqrt(x) + 1",
      errors: [{ messageId: "noNanInMathResult" }],
    },
    {
      code: "const r = Math.log(x) * 2",
      errors: [{ messageId: "noNanInMathResult" }],
    },
    {
      code: "const r = Math.asin(x) - 0.5",
      errors: [{ messageId: "noNanInMathResult" }],
    },
    {
      code: "const r = 1 + Math.acos(x)",
      errors: [{ messageId: "noNanInMathResult" }],
    },
  ],
})
