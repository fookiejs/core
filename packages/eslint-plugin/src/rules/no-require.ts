import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noRequire"

export const noRequire = createRule<Options, MessageIds>({
  name: "no-require",
  meta: {
    type: "problem",
    docs: { description: "Disallow require() calls. Use ES module import instead." },
    schema: [],
    messages: {
      noRequire: "Do not use require(). Use 'import' instead.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node: TSESTree.CallExpression) {
        const callee = node.callee
        if (callee.type === "Identifier" && callee.name === "require") {
          context.report({ node, messageId: "noRequire" })
        }
        if (
          callee.type === "MemberExpression" &&
          callee.object.type === "Identifier" &&
          callee.object.name === "require"
        ) {
          context.report({ node, messageId: "noRequire" })
        }
      },
      MemberExpression(node: TSESTree.MemberExpression) {
        if (
          node.object.type === "Identifier" &&
          node.object.name === "require" &&
          node.parent?.type !== "CallExpression"
        ) {
          context.report({ node, messageId: "noRequire" })
        }
      },
    }
  },
})
