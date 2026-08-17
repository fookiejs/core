import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noUnaryPlus" | "noDoubleNegation"

export const noImplicitCoercion = createRule<Options, MessageIds>({
  name: "no-implicit-coercion",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow implicit type coercion: unary + for numbers and !! for booleans",
    },
    schema: [],
    messages: {
      noUnaryPlus:
        "Do not use unary + for number conversion. Use Number(x) instead.",
      noDoubleNegation:
        "Do not use !! for boolean coercion. Use an explicit boolean expression instead.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      UnaryExpression(node: TSESTree.UnaryExpression) {
        if (node.operator === "+") {
          context.report({ node, messageId: "noUnaryPlus" })
          return
        }

        if (
          node.operator === "!" &&
          node.argument.type === "UnaryExpression" &&
          node.argument.operator === "!"
        ) {
          context.report({ node, messageId: "noDoubleNegation" })
        }
      },
    }
  },
})
