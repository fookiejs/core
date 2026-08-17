import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noPlaceholderNames } from "../../src/rules/no-placeholder-names.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-placeholder-names", noPlaceholderNames, {
  valid: [
    { code: "const userId = '123'" },
    { code: "const userData = { name: 'John' }" },
    { code: "function calculateTotal(price, quantity) { return price * quantity }" },
    { code: "class UserRepository {}" },
    { code: "for (let i = 0; i < 10; i++) {}" },
    { code: "for (let j = 0; j < arr.length; j++) {}" },
    { code: "const x = Math.cos(angle)" },
    { code: "const y = Math.sin(angle)" },
    { code: "const testUser = { id: 1 }" },
  ],
  invalid: [
    {
      code: "const lorem = 'value'",
      errors: [{ messageId: "placeholderName", data: { name: "lorem" } }],
    },
    {
      code: "const foo = 123",
      errors: [{ messageId: "placeholderName", data: { name: "foo" } }],
    },
    {
      code: "function bar() { return 1 }",
      errors: [{ messageId: "placeholderName", data: { name: "bar" } }],
    },
    {
      code: "const asdf = true",
      errors: [{ messageId: "placeholderName", data: { name: "asdf" } }],
    },
    {
      code: "const qwerty = []",
      errors: [{ messageId: "placeholderName", data: { name: "qwerty" } }],
    },
    {
      code: "function fn(baz) { return baz }",
      errors: [{ messageId: "placeholderName", data: { name: "baz" } }],
    },
    {
      code: "class Foo {}",
      errors: [{ messageId: "placeholderName", data: { name: "Foo" } }],
    },
    {
      code: "const toxic = 1",
      options: [{ blocklist: ["toxic"] }],
      errors: [{ messageId: "placeholderName", data: { name: "toxic" } }],
    },
  ],
})
