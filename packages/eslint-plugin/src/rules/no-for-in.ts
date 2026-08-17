import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noForIn"

export const noForIn = createRule<Options, MessageIds>({
  name: "no-for-in",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow for...in loops",
    },
    schema: [],
    messages: {
      noForIn:
        "Do not use for...in. It iterates over the prototype chain. Use for...of with Object.keys() or Object.entries() instead.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      ForInStatement(node: TSESTree.ForInStatement) {
        context.report({ node, messageId: "noForIn" })
      },
    }
  },
})
