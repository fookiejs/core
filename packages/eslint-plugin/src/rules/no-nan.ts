import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noNaN"

export const noNan = createRule<Options, MessageIds>({
  name: "no-nan",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow the use of NaN keyword",
    },
    schema: [],
    messages: {
      noNaN:
        "Do not use NaN directly. Use Number.isNaN() to check for NaN values.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      Identifier(node: TSESTree.Identifier) {
        if (node.name === "NaN") {
          context.report({ node, messageId: "noNaN" })
        }
      },
    }
  },
})
