import { AST_NODE_TYPES, ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "requireReturnType"

function isExported(node: TSESTree.Node): boolean {
  const parent = node.parent
  if (!parent) return false
  if (parent.type === AST_NODE_TYPES.ExportNamedDeclaration) return true
  if (parent.type === AST_NODE_TYPES.ExportDefaultDeclaration) return true
  return false
}

export const requireExplicitReturnType = createRule<Options, MessageIds>({
  name: "require-explicit-return-type",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require explicit return type on exported functions and class methods",
    },
    schema: [],
    messages: {
      requireReturnType:
        "Exported functions and class methods must have an explicit return type annotation.",
    },
  },
  defaultOptions: [],
  create(context) {
    function check(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ) {
      if (node.returnType) return

      if (isExported(node)) {
        context.report({ node, messageId: "requireReturnType" })
        return
      }

      const parent = node.parent

      if (parent.type === AST_NODE_TYPES.MethodDefinition) {
        if (
          parent.accessibility !== "private" &&
          parent.accessibility !== "protected"
        ) {
          context.report({ node, messageId: "requireReturnType" })
        }
        return
      }

      if (parent.type === AST_NODE_TYPES.PropertyDefinition) {
        if (
          parent.accessibility !== "private" &&
          parent.accessibility !== "protected"
        ) {
          context.report({ node, messageId: "requireReturnType" })
        }
        return
      }

      if (parent.type === AST_NODE_TYPES.VariableDeclarator) {
        const grandParent = parent.parent
        if (grandParent.type === AST_NODE_TYPES.VariableDeclaration) {
          const greatGrandParent = grandParent.parent
          if (greatGrandParent.type === AST_NODE_TYPES.ExportNamedDeclaration) {
            context.report({ node, messageId: "requireReturnType" })
          }
        }
      }
    }

    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
    }
  },
})
