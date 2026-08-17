import { AST_NODE_TYPES, ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "moduleNew"

type FnNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression

function isFn(node: TSESTree.Node): node is FnNode {
  return (
    node.type === AST_NODE_TYPES.FunctionDeclaration ||
    node.type === AST_NODE_TYPES.FunctionExpression ||
    node.type === AST_NODE_TYPES.ArrowFunctionExpression
  )
}

function isInsideFunction(node: TSESTree.Node): boolean {
  let current = node.parent
  while (current) {
    if (isFn(current)) {
      return true
    }
    current = current.parent
  }
  return false
}

function isInstanceFieldInit(node: TSESTree.Node): boolean {
  let current = node.parent
  while (current) {
    if (isFn(current)) {
      return false
    }
    if (
      current.type === AST_NODE_TYPES.PropertyDefinition &&
      current.static === false
    ) {
      return true
    }
    current = current.parent
  }
  return false
}

export const noModuleNew = createRule<Options, MessageIds>({
  name: "no-module-new",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow new at module scope. Instances are created inside functions or factories.",
    },
    schema: [],
    messages: {
      moduleNew:
        "Do not construct values at module scope. Create instances inside functions or factories.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      NewExpression(node: TSESTree.NewExpression) {
        if (isInsideFunction(node)) {
          return
        }
        if (isInstanceFieldInit(node)) {
          return
        }
        context.report({ node, messageId: "moduleNew" })
      },
    }
  },
})
