import { AST_NODE_TYPES, ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noCatchInstanceof"

function getCatchParam(node: TSESTree.Node): string | false {
  let current = node.parent
  while (current) {
    if (current.type === AST_NODE_TYPES.CatchClause) {
      const param = current.param
      if (param !== null && param.type === AST_NODE_TYPES.Identifier) return param.name
      return false
    }
    if (
      current.type === AST_NODE_TYPES.FunctionDeclaration ||
      current.type === AST_NODE_TYPES.FunctionExpression ||
      current.type === AST_NODE_TYPES.ArrowFunctionExpression
    ) {
      return false
    }
    current = current.parent
  }
  return false
}

export const noCatchInstanceof = createRule<Options, MessageIds>({
  name: "no-catch-instanceof",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow instanceof Error checks inside catch blocks. Pair with no-throw-literal to guarantee the caught value is always an Error.",
    },
    schema: [],
    messages: {
      noCatchInstanceof:
        "Unnecessary 'instanceof Error' check in catch block. Use no-throw-literal to guarantee all thrown values are Error instances.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      BinaryExpression(node: TSESTree.BinaryExpression) {
        if (node.operator !== "instanceof") return

        const right = node.right
        if (right.type !== AST_NODE_TYPES.Identifier || right.name !== "Error") return

        const left = node.left
        if (left.type !== AST_NODE_TYPES.Identifier) return

        const catchParam = getCatchParam(node)
        if (catchParam === false) return
        if (left.name !== catchParam) return

        context.report({ node, messageId: "noCatchInstanceof" })
      },
    }
  },
})
