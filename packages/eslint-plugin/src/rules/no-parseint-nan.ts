import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noParseIntNan"

const ARITHMETIC_OPS = new Set(["+", "-", "*", "/", "%", "**"])

function isParseCall(node: TSESTree.Node): boolean {
  if (node.type !== "CallExpression") return false
  const callee = node.callee
  if (callee.type === "Identifier") {
    return callee.name === "parseInt" || callee.name === "parseFloat"
  }
  if (callee.type === "MemberExpression") {
    const prop = callee.property
    return (
      prop.type === "Identifier" &&
      (prop.name === "parseInt" || prop.name === "parseFloat")
    )
  }
  return false
}

export const noParseIntNan = createRule<Options, MessageIds>({
  name: "no-parseint-nan",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow using parseInt/parseFloat results directly in arithmetic without a NaN guard",
    },
    schema: [],
    messages: {
      noParseIntNan:
        "{{fn}}() can return NaN for invalid input. Guard with Number.isNaN() before using in arithmetic.",
    },
  },
  defaultOptions: [],
  create(context) {
    function getFnName(node: TSESTree.CallExpression): string {
      const callee = node.callee
      if (callee.type === "Identifier") return callee.name
      if (
        callee.type === "MemberExpression" &&
        callee.property.type === "Identifier"
      ) {
        return callee.property.name
      }
      return "parseInt/parseFloat"
    }

    return {
      BinaryExpression(node: TSESTree.BinaryExpression) {
        if (!ARITHMETIC_OPS.has(node.operator)) return

        if (isParseCall(node.left)) {
          context.report({
            node: node.left,
            messageId: "noParseIntNan",
            data: { fn: getFnName(node.left as TSESTree.CallExpression) },
          })
        }
        if (isParseCall(node.right)) {
          context.report({
            node: node.right,
            messageId: "noParseIntNan",
            data: { fn: getFnName(node.right as TSESTree.CallExpression) },
          })
        }
      },
    }
  },
})
