import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "preferIncludes"

function isIndexOfCall(node: TSESTree.Node): boolean {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "indexOf"
  )
}

function isMinusOne(node: TSESTree.Node): boolean {
  return (
    node.type === "UnaryExpression" &&
    node.operator === "-" &&
    node.argument.type === "Literal" &&
    node.argument.value === 1
  )
}

function isZero(node: TSESTree.Node): boolean {
  return node.type === "Literal" && node.value === 0
}

export const preferIncludes = createRule<Options, MessageIds>({
  name: "prefer-includes",
  meta: {
    type: "suggestion",
    docs: {
      description: "Require .includes() instead of .indexOf() comparisons",
    },
    schema: [],
    messages: {
      preferIncludes:
        "Use '.includes()' instead of '.indexOf()' comparison.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      BinaryExpression(node: TSESTree.BinaryExpression) {
        const { left, right, operator } = node

        const isComparisonWithIndexOf =
          (["!==", "!=", "===", "=="].includes(operator) &&
            isIndexOfCall(left) &&
            isMinusOne(right)) ||
          (operator === ">=" && isIndexOfCall(left) && isZero(right)) ||
          (operator === ">" && isIndexOfCall(left) && isMinusOne(right)) ||
          (["!==", "!=", "===", "=="].includes(operator) &&
            isIndexOfCall(right) &&
            isMinusOne(left))

        if (isComparisonWithIndexOf) {
          context.report({ node, messageId: "preferIncludes" })
        }
      },
    }
  },
})
