import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noCatchUnknown } from "../../src/rules/no-catch-unknown.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-catch-unknown", noCatchUnknown, {
  valid: [
    {
      code: "try { run() } catch (caughtError) { reportFailure(caughtError) }",
    },
  ],
  invalid: [
    {
      code: "try { run() } catch (caughtError: unknown) { reportFailure(caughtError) }",
      errors: [{ messageId: "noCatchUnknown" }],
    },
  ],
})
