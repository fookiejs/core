import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noUnionType } from "../../src/rules/no-union-type.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-union-type", noUnionType, {
  valid: [
    {
      code: "function loadEntity(entityId: string): string { return entityId }",
    },
    {
      code: "type LoadEntityResult = { ok: true; value: string }",
    },
    {
      code: "interface EntityRecord { title: string }",
    },
    {
      code: "const amount: number = 1",
    },
    {
      code: "type Flags = string & { brand: 'flags' }",
    },
  ],
  invalid: [
    {
      code: "function normalize(value: string | false): string { return '' }",
      errors: [{ messageId: "noUnionType" }],
    },
    {
      code: "function load(): string | false { return false }",
      errors: [{ messageId: "noUnionType" }],
    },
    {
      code: "interface Entity { title: string | number }",
      errors: [{ messageId: "noUnionType" }],
    },
    {
      code: "type IdOrMissing = string | false",
      errors: [{ messageId: "noUnionType" }],
    },
    {
      code: "const flag: boolean | string = true",
      errors: [{ messageId: "noUnionType" }],
    },
    {
      code: "type Wide = string | number | boolean",
      errors: [{ messageId: "noUnionType" }],
    },
    {
      code: "type LoadResult = { ok: true; value: string } | { ok: false }",
      errors: [{ messageId: "noUnionType" }],
    },
  ],
})

