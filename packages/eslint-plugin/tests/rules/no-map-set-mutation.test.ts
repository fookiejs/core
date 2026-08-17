import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noMapSetMutation } from "../../src/rules/no-map-set-mutation.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-map-set-mutation", noMapSetMutation, {
  valid: [
    { code: "const m = new Map(); m.get('key')" },
    { code: "const m = new Map(); m.has('key')" },
    { code: "const s = new Set(); s.has(1)" },
    { code: "someObj.set('key', 'val')" },
  ],
  invalid: [
    {
      code: "const m = new Map(); m.set('key', 1)",
      errors: [{ messageId: "noMapSetMutation" }],
    },
    {
      code: "const m = new Map(); m.delete('key')",
      errors: [{ messageId: "noMapSetMutation" }],
    },
    {
      code: "const m = new Map(); m.clear()",
      errors: [{ messageId: "noMapSetMutation" }],
    },
    {
      code: "const s = new Set(); s.add(1)",
      errors: [{ messageId: "noMapSetMutation" }],
    },
    {
      code: "const s = new Set(); s.delete(1)",
      errors: [{ messageId: "noMapSetMutation" }],
    },
  ],
})
