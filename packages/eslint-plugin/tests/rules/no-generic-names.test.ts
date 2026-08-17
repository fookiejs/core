import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noGenericNames } from "../../src/rules/no-generic-names.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-generic-names", noGenericNames, {
  valid: [
    { code: "const userData = {}" },
    { code: "const searchResult = []" },
    { code: "const apiResponse = await fetch(url)" },
    { code: "const orderItem = cart[0]" },
    { code: "const isEnabled = true" },
    {
      code: "const data = raw",
      options: [{ allow: ["data"] }],
    },
    { code: "console.log(data)" },
    { code: "return result" },
    { code: "const x = obj.data" },
  ],
  invalid: [
    {
      code: "const data = await fetchUser()",
      errors: [{ messageId: "genericName" }],
    },
    {
      code: "const result = compute()",
      errors: [{ messageId: "genericName" }],
    },
    {
      code: "const response = await api.call()",
      errors: [{ messageId: "genericName" }],
    },
    {
      code: "function process(obj) { return obj }",
      errors: [{ messageId: "genericName" }],
    },
    {
      code: "const val = input.trim()",
      errors: [{ messageId: "genericName" }],
    },
    {
      code: "const info = getMetadata()",
      errors: [{ messageId: "genericName" }],
    },
    {
      code: "const payload = request.body",
      options: [{ additionalNames: ["payload"] }],
      errors: [{ messageId: "genericName" }],
    },
  ],
})
