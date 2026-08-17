import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noNanArrayIndexOf } from "../../src/rules/no-nan-array-indexof.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-nan-array-indexof", noNanArrayIndexOf, {
  valid: [
    { code: "amounts.includes(targetAmount)" },
    { code: "amounts.findIndex(Number.isNaN)" },
    { code: "amounts.indexOf(0)" },
    { code: "amounts.indexOf(targetAmount)" },
  ],
  invalid: [
    {
      code: "arr.indexOf(NaN)",
      errors: [{ messageId: "noNanArrayIndexOf" }],
    },
    {
      code: "[1, 2, NaN].indexOf(NaN)",
      errors: [{ messageId: "noNanArrayIndexOf" }],
    },
    {
      code: "const i = list.indexOf(NaN)",
      errors: [{ messageId: "noNanArrayIndexOf" }],
    },
  ],
})
