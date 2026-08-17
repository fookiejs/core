import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { noArrayMutatingMethods } from "../../src/rules/no-array-mutating-methods.js"

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

tester.run("no-array-mutating-methods", noArrayMutatingMethods, {
  valid: [
    {
      code: "const orderLines: string[] = []; const next = orderLines.toSorted()",
    },
    {
      code: "const orderLines: string[] = []; const next = orderLines.filter(() => true)",
    },
    {
      code: "const orderLines: string[] = []; const next = [...orderLines]",
    },
  ],
  invalid: [
    {
      code: "const orderLines: string[] = []; orderLines.sort()",
      errors: [{ messageId: "noArrayMutatingMethod" }],
    },
    {
      code: "const orderLines: string[] = []; ;[...orderLines].sort()",
      errors: [{ messageId: "noArrayMutatingMethod" }],
    },
    {
      code: "const orderLines: string[] = []; orderLines.reverse()",
      errors: [{ messageId: "noArrayMutatingMethod" }],
    },
    {
      code: "const orderLines: string[] = []; orderLines.splice(0, 1)",
      errors: [{ messageId: "noArrayMutatingMethod" }],
    },
  ],
})
