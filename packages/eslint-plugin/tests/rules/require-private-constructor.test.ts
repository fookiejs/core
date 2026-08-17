import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { requirePrivateConstructor } from "../../src/rules/require-private-constructor.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("require-private-constructor", requirePrivateConstructor, {
  valid: [
    {
      code: `
        class User {
          private constructor(readonly name: string) {}
          static create(name: string): User {
            return new User(name)
          }
        }
      `,
    },
    {
      code: `
        class FookieError extends Error {
          protected constructor(message: string) {
            super(message)
          }
          static create(message: string): FookieError {
            return new FookieError(message)
          }
        }
        class PgEncodeError extends FookieError {
          private constructor(message: string) {
            super(message)
          }
          static create(message: string): PgEncodeError {
            return new PgEncodeError(message)
          }
        }
      `,
    },
  ],
  invalid: [
    {
      code: `
        class User {
          constructor(readonly name: string) {}
        }
      `,
      errors: [{ messageId: "requirePrivateConstructor" }],
    },
    {
      code: `
        class User {
          public constructor(readonly name: string) {}
        }
      `,
      errors: [{ messageId: "requirePrivateConstructor" }],
    },
  ],
})
