import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noHasOwnProperty } from "../../src/rules/no-hasownproperty.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-hasownproperty", noHasOwnProperty, {
  valid: [
    {
      code: "for (const [fieldKey, fieldValue] of Object.entries(record)) { usePair(fieldKey, fieldValue) }",
    },
    {
      code: 'if ("email" in accountFields) { useEmail(accountFields.email) }',
    },
  ],
  invalid: [
    {
      code: "Object.prototype.hasOwnProperty.call(record, key)",
      errors: [{ messageId: "noHasOwnProperty" }],
    },
    {
      code: "record.hasOwnProperty(key)",
      errors: [{ messageId: "noHasOwnProperty" }],
    },
    {
      code: "Object.hasOwn(record, key)",
      errors: [{ messageId: "noHasOwnProperty" }],
    },
  ],
})
