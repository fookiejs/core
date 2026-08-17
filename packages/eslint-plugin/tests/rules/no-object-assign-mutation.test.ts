import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noObjectAssignMutation } from "../../src/rules/no-object-assign-mutation.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-object-assign-mutation", noObjectAssignMutation, {
  valid: [
    { code: "const nextAccount = account.withPatch(patch)" },
    { code: "const nextAccount = Account.create(draft)" },
  ],
  invalid: [
    {
      code: "Object.assign(target, source)",
      errors: [{ messageId: "noObjectAssignMutation" }],
    },
    {
      code: "Object.assign(this.state, updates)",
      errors: [{ messageId: "noObjectAssignMutation" }],
    },
    {
      code: "Object.assign(obj, a, b)",
      errors: [{ messageId: "noObjectAssignMutation" }],
    },
  ],
})
