import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noDelete } from "../../src/rules/no-delete.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-delete", noDelete, {
  valid: [
    { code: "const recordWithoutKey = record.withoutKey()" },
    { code: "const next = account.withoutTag()" },
  ],
  invalid: [
    {
      code: "delete record.key",
      errors: [{ messageId: "noDelete" }],
    },
    {
      code: "delete account['tag']",
      errors: [{ messageId: "noDelete" }],
    },
  ],
})
