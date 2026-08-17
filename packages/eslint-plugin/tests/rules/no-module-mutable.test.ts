import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noModuleMutable } from "../../src/rules/no-module-mutable.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-module-mutable", noModuleMutable, {
  valid: [
    { code: "export const listenPort = 3000" },
    { code: "const accountRepository = AccountRepository.create()" },
    {
      code: `function loadAccount(accountId: string): Account {
  let attempt = 0
  attempt = attempt + 1
  return accountRepository.loadByIdOrThrow(accountId)
}`,
    },
  ],
  invalid: [
    {
      code: "let liveApps = []",
      errors: [{ messageId: "moduleMutable" }],
    },
    {
      code: "var liveApps = []",
      errors: [{ messageId: "moduleMutable" }],
    },
    {
      code: "export let listenPort = 3000",
      errors: [{ messageId: "moduleMutable" }],
    },
  ],
})
