import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noEmptyString"

export const noEmptyString = createRule<Options, MessageIds>({
  name: "no-empty-string",
  meta: {
    type: "problem",
    docs: { description: "Disallow empty string literals (\"\") as values" },
    schema: [],
    messages: {
      noEmptyString:
        "Do not use empty string (\"\"). Use a named constant or a more explicit sentinel value.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      Literal(node: TSESTree.Literal) {
        if (typeof node.value === "string" && node.value === "") {
          context.report({ node, messageId: "noEmptyString" })
        }
      },
      CallExpression(node: TSESTree.CallExpression) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "String" &&
          node.arguments.length === 0
        ) {
          context.report({ node, messageId: "noEmptyString" })
        }
      },
      NewExpression(node: TSESTree.NewExpression) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "String" &&
          node.arguments.length === 0
        ) {
          context.report({ node, messageId: "noEmptyString" })
        }
      },
    }
  },
})
