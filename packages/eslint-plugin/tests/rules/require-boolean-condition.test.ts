import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { requireBooleanCondition } from "../../src/rules/require-boolean-condition.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tsconfigRootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")

const tester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: {
        allowDefaultProject: ["*.ts"],
      },
      tsconfigRootDir,
    },
  },
})

tester.run("require-boolean-condition", requireBooleanCondition, {
  valid: [
    {
      code: "const flag: boolean = true; if (flag === true) { flag.toString() }",
    },
    {
      code: "const n = 1; if (n !== 4) { n.toString() }",
    },
    {
      code: 'const part = "01"; if (/^\\d$/.test(part) === false) { part.toString() }',
    },
    {
      code: "const n = 1; if (n < 0 || n > 255) { n.toString() }",
    },
    {
      code: "const flag: boolean = false; if (flag) { flag.toString() }",
    },
  ],
  invalid: [
    {
      code: "const user: object = {}; if (user) { Object.keys(user) }",
      errors: [{ messageId: "requireBoolean" }],
    },
    {
      code: "const lines: string[] = []; if (lines.length) { lines.push(\"\") }",
      errors: [{ messageId: "requireBoolean" }],
    },
  ],
})
