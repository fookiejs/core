import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noModuleNew } from "../../src/rules/no-module-new.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-module-new", noModuleNew, {
  valid: [
    {
      code: `function openRegistry(): StoreRegistry {
  return new StoreRegistry()
}`,
    },
    {
      code: `class StoreRegistry {
  private constructor() {}
  static create(): StoreRegistry {
    return new StoreRegistry()
  }
}`,
    },
    { code: "export const listenPort = 3000" },
  ],
  invalid: [
    {
      code: "const liveApps = new Set()",
      errors: [{ messageId: "moduleNew" }],
    },
    {
      code: "export const bindings = new Map()",
      errors: [{ messageId: "moduleNew" }],
    },
  ],
})
