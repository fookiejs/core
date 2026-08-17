import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noUnknown } from "../../src/rules/no-unknown.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-unknown", noUnknown, {
  valid: [
    { code: "function parseAccount(raw: AccountDraft): Account { return Account.create(raw) }" },
    { code: "const account: Account = loadAccount()" },
  ],
  invalid: [
    {
      code: "function parseAccount(raw: unknown): Account { return Account.create(raw) }",
      errors: [{ messageId: "noUnknown" }],
    },
    {
      code: "const blob: unknown = readBlob()",
      errors: [{ messageId: "noUnknown" }],
    },
  ],
})
