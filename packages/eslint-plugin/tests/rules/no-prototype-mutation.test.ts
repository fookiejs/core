import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noPrototypeMutation } from "../../src/rules/no-prototype-mutation.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-prototype-mutation", noPrototypeMutation, {
  valid: [
    { code: "class Foo { bar() {} }" },
    { code: "const obj = { method() {} }" },
    { code: "const x = Foo.prototype.method" },
  ],
  invalid: [
    {
      code: "Foo.prototype.greet = function() {}",
      errors: [{ messageId: "noPrototypeMutation" }],
    },
    {
      code: "Array.prototype.last = function() { return this[this.length - 1] }",
      errors: [{ messageId: "noPrototypeMutation" }],
    },
    {
      code: "MyClass.prototype.newMethod = () => {}",
      errors: [{ messageId: "noPrototypeMutation" }],
    },
  ],
})
