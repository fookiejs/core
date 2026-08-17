import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noThrowLiteral } from "../../src/rules/no-throw-literal.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-throw-literal", noThrowLiteral, {
  valid: [
    { code: "throw new Error('something went wrong')" },
    { code: "throw new TypeError('bad type')" },
  ],
  invalid: [
    {
      code: "throw 'something went wrong'",
      errors: [{ messageId: "noThrowLiteral" }],
    },
    {
      code: "throw { message: 'oops' }",
      errors: [{ messageId: "noThrowLiteral" }],
    },
    {
      code: "throw 404",
      errors: [{ messageId: "noThrowLiteral" }],
    },
  ],
})
