import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noTypeof } from "../../src/rules/no-typeof.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-typeof", noTypeof, {
  valid: [
    {
      code: "if (accountStatusSchema.safeParse(accountStatus).success === true) { useStatus(accountStatus) }",
    },
    {
      code: "const accountStatus = z.string().parse(rawStatus)",
    },
  ],
  invalid: [
    {
      code: 'if (typeof accountStatus === "string") { useStatus(accountStatus) }',
      errors: [{ messageId: "noTypeof" }],
    },
    {
      code: 'if (typeof score !== "number") { return }',
      errors: [{ messageId: "noTypeof" }],
    },
  ],
})
