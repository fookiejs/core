import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noForIn } from "../../src/rules/no-for-in.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-for-in", noForIn, {
  valid: [
    {
      code: "for (const configKey of Object.keys(config)) { useKey(configKey) }",
    },
    {
      code: "for (const orderLine of orderLines) { processOrderLine(orderLine) }",
    },
  ],
  invalid: [
    {
      code: "for (const configKey in config) { useKey(configKey) }",
      errors: [{ messageId: "noForIn" }],
    },
  ],
})
