import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noNullUndefined } from "../../src/rules/no-null-undefined.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-null-undefined", noNullUndefined, {
  valid: [
    { code: "const account = Account.create(draft)" },
    { code: "function loadAccount(): Account { return repo.loadOrThrow(id) }" },
    { code: "return" },
  ],
  invalid: [
    {
      code: "const missing = null",
      errors: [{ messageId: "noNull" }],
    },
    {
      code: "type Broken = string | null",
      errors: [{ messageId: "noNull" }],
    },
    {
      code: "const missing = undefined",
      errors: [{ messageId: "noUndefined" }],
    },
    {
      code: "type Broken = string | undefined",
      errors: [{ messageId: "noUndefined" }],
    },
    {
      code: "const missing = void 0",
      errors: [{ messageId: "noVoidExpr" }],
    },
  ],
})
