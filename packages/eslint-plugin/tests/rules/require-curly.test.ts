import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { requireCurly } from "../../src/rules/require-curly.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("require-curly", requireCurly, {
  valid: [
    {
      code: "if (account.isActive === true) { return account }",
    },
    {
      code: "for (const orderLine of orderLines) { processOrderLine(orderLine) }",
    },
  ],
  invalid: [
    {
      code: "if (account.isActive === true) return account",
      errors: [{ messageId: "requireCurly" }],
    },
    {
      code: "for (const orderLine of orderLines) processOrderLine(orderLine)",
      errors: [{ messageId: "requireCurly" }],
    },
  ],
})
