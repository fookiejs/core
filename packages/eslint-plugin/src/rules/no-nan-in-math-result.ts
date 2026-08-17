import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noNanInMathResult"

const NAN_PRODUCING_MATH_METHODS = new Set([
  "sqrt",
  "log",
  "log2",
  "log10",
  "asin",
  "acos",
  "atan",
  "acosh",
  "asinh",
  "atanh",
])

function isMathNanCall(node: TSESTree.Node): boolean {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    node.callee.object.type === "Identifier" &&
    node.callee.object.name === "Math" &&
    node.callee.property.type === "Identifier" &&
    NAN_PRODUCING_MATH_METHODS.has(node.callee.property.name)
  )
}

export const noNanInMathResult = createRule<Options, MessageIds>({
  name: "no-nan-in-math-result",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow using Math functions that can return NaN directly in arithmetic or comparisons without a NaN guard",
    },
    schema: [],
    messages: {
      noNanInMathResult:
        "Math.{{method}}() can return NaN for out-of-range inputs. Guard the result with Number.isNaN() before using it.",
    },
  },
  defaultOptions: [],
  create(context) {
    function checkOperand(node: TSESTree.Node): void {
      if (isMathNanCall(node)) {
        const callee = (node as TSESTree.CallExpression)
          .callee as TSESTree.MemberExpression
        context.report({
          node,
          messageId: "noNanInMathResult",
          data: {
            method: (callee.property as TSESTree.Identifier).name,
          },
        })
      }
    }

    return {
      BinaryExpression(node: TSESTree.BinaryExpression) {
        checkOperand(node.left)
        checkOperand(node.right)
      },
    }
  },
})
