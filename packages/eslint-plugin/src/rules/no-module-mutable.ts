import { AST_NODE_TYPES, ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "moduleMutable"

function isModuleDeclaration(node: TSESTree.VariableDeclaration): boolean {
  const parent = node.parent
  if (parent.type === AST_NODE_TYPES.Program) {
    return true
  }
  if (
    parent.type === AST_NODE_TYPES.ExportNamedDeclaration &&
    parent.parent.type === AST_NODE_TYPES.Program
  ) {
    return true
  }
  return false
}

export const noModuleMutable = createRule<Options, MessageIds>({
  name: "no-module-mutable",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow let and var at module scope. Module bindings must be const.",
    },
    schema: [],
    messages: {
      moduleMutable:
        "Do not declare '{{kind}}' at module scope. Module bindings must be const.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      VariableDeclaration(node: TSESTree.VariableDeclaration) {
        if (node.kind === "const") {
          return
        }
        if (isModuleDeclaration(node) === false) {
          return
        }
        context.report({
          node,
          messageId: "moduleMutable",
          data: { kind: node.kind },
        })
      },
    }
  },
})
