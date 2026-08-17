import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noNanArrayIndexOf"

function isNaNNode(node: TSESTree.Node): boolean {
  return node.type === "Identifier" && node.name === "NaN"
}

export const noNanArrayIndexOf = createRule<Options, MessageIds>({
  name: "no-nan-array-indexof",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow array.indexOf(NaN) which always returns -1. Do not put NaN in arrays; model numeric absence with domain types instead.",
    },
    schema: [],
    messages: {
      noNanArrayIndexOf:
        "array.indexOf(NaN) always returns -1 because NaN !== NaN. Do not use NaN; redesign the Model so numeric absence is not NaN.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.property.type === "Identifier" &&
          node.callee.property.name === "indexOf" &&
          node.arguments.length >= 1 &&
          isNaNNode(node.arguments[0]!)
        ) {
          context.report({ node, messageId: "noNanArrayIndexOf" })
        }
      },
    }
  },
})
