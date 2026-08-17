import { AST_NODE_TYPES, ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "missingReturnValue" | "unexpectedReturnValue"

type FunctionNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression

interface FunctionInfo {
  node: FunctionNode
  hasValueReturn: boolean
  hasEmptyReturn: boolean
}

export const consistentReturn = createRule<Options, MessageIds>({
  name: "consistent-return",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require all return statements in a function to either always or never return a value",
    },
    schema: [],
    messages: {
      missingReturnValue:
        "Expected a return value. All return statements in this function must return a value.",
      unexpectedReturnValue:
        "Unexpected return value. All return statements in this function must either all return a value or none return a value.",
    },
  },
  defaultOptions: [],
  create(context) {
    let stack: ReadonlyArray<FunctionInfo> = []

    function enterFunction(node: FunctionNode) {
      if (node.type === AST_NODE_TYPES.ArrowFunctionExpression && node.expression) return
      stack = [...stack, { node, hasValueReturn: false, hasEmptyReturn: false }]
    }

    function exitFunction(node: FunctionNode) {
      if (node.type === AST_NODE_TYPES.ArrowFunctionExpression && node.expression) return
      stack = stack.slice(0, -1)
    }

    return {
      FunctionDeclaration: enterFunction,
      FunctionExpression: enterFunction,
      ArrowFunctionExpression: enterFunction,
      "FunctionDeclaration:exit": exitFunction,
      "FunctionExpression:exit": exitFunction,
      "ArrowFunctionExpression:exit": exitFunction,

      ReturnStatement(node: TSESTree.ReturnStatement) {
        const current = stack[stack.length - 1]
        if (!current) return

        if (node.argument !== null) {
          current.hasValueReturn = true
          if (current.hasEmptyReturn) {
            context.report({ node, messageId: "unexpectedReturnValue" })
          }
        } else {
          current.hasEmptyReturn = true
          if (current.hasValueReturn) {
            context.report({ node, messageId: "missingReturnValue" })
          }
        }
      },
    }
  },
})
