import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noUnionType"

export const noUnionType = createRule<Options, MessageIds>({
  name: "no-union-type",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow TypeScript union types",
    },
    schema: [],
    messages: {
      noUnionType:
        "Do not use union types (A | B). Use a single named type or Result/false sentinel pattern instead.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      TSUnionType(node: TSESTree.TSUnionType) {
        context.report({ node, messageId: "noUnionType" })
      },
    }
  },
})
