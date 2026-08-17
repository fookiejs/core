import { AST_NODE_TYPES, ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noShadow"

type ScopeFrame = Set<string>

function getNamesFromPattern(node: TSESTree.Node): string[] {
  if (node.type === AST_NODE_TYPES.Identifier) return [node.name]
  if (node.type === AST_NODE_TYPES.ObjectPattern) {
    return node.properties.flatMap((p) => {
      if (p.type === AST_NODE_TYPES.RestElement) return getNamesFromPattern(p.argument)
      return getNamesFromPattern(p.value)
    })
  }
  if (node.type === AST_NODE_TYPES.ArrayPattern) {
    return node.elements.flatMap((el) =>
      el !== null ? getNamesFromPattern(el) : [],
    )
  }
  if (node.type === AST_NODE_TYPES.AssignmentPattern) {
    return getNamesFromPattern(node.left)
  }
  if (node.type === AST_NODE_TYPES.RestElement) {
    return getNamesFromPattern(node.argument)
  }
  return []
}

export const noShadow = createRule<Options, MessageIds>({
  name: "no-shadow",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow variable declarations that shadow outer scope variables",
    },
    schema: [],
    messages: {
      noShadow:
        "'{{name}}' shadows a variable declared in an outer scope.",
    },
  },
  defaultOptions: [],
  create(context) {
    let scopeStack: ReadonlyArray<ScopeFrame> = []

    function currentScope(): ScopeFrame {
      return scopeStack[scopeStack.length - 1]!
    }

    function isDeclaredInOuterScope(name: string): boolean {
      for (let i = scopeStack.length - 2; i >= 0; i--) {
        if (scopeStack[i]!.has(name)) return true
      }
      return false
    }

    function declareAndCheck(name: string, node: TSESTree.Node) {
      if (isDeclaredInOuterScope(name)) {
        context.report({ node, messageId: "noShadow", data: { name } })
      }
      currentScope().add(name)
    }

    function pushScope() {
      scopeStack = [...scopeStack, new Set()]
    }

    function popScope() {
      scopeStack = scopeStack.slice(0, -1)
    }

    return {
      Program: pushScope,
      "Program:exit": popScope,

      BlockStatement: pushScope,
      "BlockStatement:exit": popScope,

      FunctionDeclaration(node: TSESTree.FunctionDeclaration) {
        if (node.id !== null) declareAndCheck(node.id.name, node.id)
        pushScope()
        for (const param of node.params) {
          for (const name of getNamesFromPattern(param)) {
            currentScope().add(name)
          }
        }
      },
      "FunctionDeclaration:exit": popScope,

      FunctionExpression(node: TSESTree.FunctionExpression) {
        pushScope()
        for (const param of node.params) {
          for (const name of getNamesFromPattern(param)) {
            currentScope().add(name)
          }
        }
      },
      "FunctionExpression:exit": popScope,

      ArrowFunctionExpression(node: TSESTree.ArrowFunctionExpression) {
        pushScope()
        for (const param of node.params) {
          for (const name of getNamesFromPattern(param)) {
            currentScope().add(name)
          }
        }
      },
      "ArrowFunctionExpression:exit": popScope,

      VariableDeclarator(node: TSESTree.VariableDeclarator) {
        for (const name of getNamesFromPattern(node.id)) {
          declareAndCheck(name, node.id)
        }
      },
    }
  },
})
