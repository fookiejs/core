import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noNan } from "../../src/rules/no-nan.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-nan", noNan, {
  valid: [
    { code: "Number.isNaN(x)" },
    { code: "const value = 42" },
    { code: "if (Number.isNaN(result)) {}" },
  ],
  invalid: [
    {
      code: "if (x === NaN) {}",
      errors: [{ messageId: "noNaN" }],
    },
    {
      code: "const x = NaN",
      errors: [{ messageId: "noNaN" }],
    },
    {
      code: "return NaN",
      errors: [{ messageId: "noNaN" }],
    },
    {
      code: "isNaN(NaN)",
      errors: [{ messageId: "noNaN" }],
    },
  ],
})
