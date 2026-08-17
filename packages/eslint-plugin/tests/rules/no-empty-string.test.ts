import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noEmptyString } from "../../src/rules/no-empty-string.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-empty-string", noEmptyString, {
  valid: [
    { code: "const label = DEFAULT_LABEL" },
    { code: "const label = 'ready'" },
    { code: "appRoot.replaceChildren()" },
  ],
  invalid: [
    {
      code: "const label = ''",
      errors: [{ messageId: "noEmptyString" }],
    },
    {
      code: 'const label = ""',
      errors: [{ messageId: "noEmptyString" }],
    },
    {
      code: "String()",
      errors: [{ messageId: "noEmptyString" }],
    },
    {
      code: "new String()",
      errors: [{ messageId: "noEmptyString" }],
    },
  ],
})
