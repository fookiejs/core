import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noNullishOperators } from "../../src/rules/no-nullish-operators.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-nullish-operators", noNullishOperators, {
  valid: [
    { code: "const displayName = account.name" },
    { code: "const city = account.address.city" },
    { code: "const flag = ready === true || fallback === true" },
  ],
  invalid: [
    {
      code: "const displayName = account.name ?? 'guest'",
      errors: [{ messageId: "noNullish" }],
    },
    {
      code: "const city = account.address?.city",
      errors: [{ messageId: "noOptionalChain" }],
    },
    {
      code: "const label = account.getLabel?.()",
      errors: [{ messageId: "noOptionalChain" }],
    },
  ],
})
