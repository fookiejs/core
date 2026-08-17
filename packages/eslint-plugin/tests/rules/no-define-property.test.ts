import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noDefineProperty } from "../../src/rules/no-define-property.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-define-property", noDefineProperty, {
  valid: [
    { code: "const obj = { key: 'value' }" },
    { code: "obj.key = 'value'" },
    { code: "Object.assign({}, obj)" },
    { code: "Object.keys(obj)" },
  ],
  invalid: [
    {
      code: "Object.defineProperty(obj, 'key', { value: 1 })",
      errors: [{ messageId: "noDefineProperty" }],
    },
    {
      code: "Object.defineProperties(obj, { key: { value: 1 } })",
      errors: [{ messageId: "noDefineProperty" }],
    },
  ],
})
