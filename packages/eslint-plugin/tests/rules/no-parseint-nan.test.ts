import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noParseIntNan } from "../../src/rules/no-parseint-nan.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-parseint-nan", noParseIntNan, {
  valid: [
    { code: "const n = parseInt('42', 10); const r = n + 1" },
    { code: "const n = parseFloat('3.14'); console.log(n)" },
    { code: "const r = 1 + 2" },
  ],
  invalid: [
    {
      code: "const r = parseInt('abc') + 1",
      errors: [{ messageId: "noParseIntNan" }],
    },
    {
      code: "const r = parseFloat('x') * price",
      errors: [{ messageId: "noParseIntNan" }],
    },
    {
      code: "const r = 100 / parseInt(value)",
      errors: [{ messageId: "noParseIntNan" }],
    },
    {
      code: "const r = parseFloat(a) - parseFloat(b)",
      errors: [{ messageId: "noParseIntNan" }, { messageId: "noParseIntNan" }],
    },
  ],
})
