import { AST_NODE_TYPES, ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noParamReassign"

function getParamNames(params: TSESTree.Parameter[]): Set<string> {
  const names = new Set<string>()
  for (const param of params) {
    collectBindingNames(param, names)
  }
  return names
}

function collectBindingNames(node: TSESTree.Node, names: Set<string>): void {
  switch (node.type) {
    case AST_NODE_TYPES.Identifier:
      names.add(node.name)
      break
    case AST_NODE_TYPES.AssignmentPattern:
      collectBindingNames(node.left, names)
      break
    case AST_NODE_TYPES.RestElement:
      collectBindingNames(node.argument, names)
      break
    case AST_NODE_TYPES.ObjectPattern:
      for (const prop of node.properties) {
        collectBindingNames(prop, names)
      }
      break
    case AST_NODE_TYPES.ArrayPattern:
      for (const el of node.elements) {
        if (el !== null) collectBindingNames(el, names)
      }
      break
    case AST_NODE_TYPES.Property:
      collectBindingNames(node.value, names)
      break
  }
}

export const noParamReassign = createRule<Options, MessageIds>({
  name: "no-param-reassign",
  meta: {
    type: "problem",
    docs: { description: "Disallow reassignment of function parameters" },
    schema: [],
    messages: {
      noParamReassign:
        "Do not reassign parameter '{{name}}'. Mutating parameters makes data flow harder to reason about.",
    },
  },
  defaultOptions: [],
  create(context) {
    let paramScopeStack: ReadonlyArray<Set<string>> = []

    function enterFunction(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ) {
      paramScopeStack = [...paramScopeStack, getParamNames(node.params)]
    }

    function exitFunction() {
      paramScopeStack = paramScopeStack.slice(0, -1)
    }

    function currentParams(): Set<string> {
      return paramScopeStack[paramScopeStack.length - 1] ?? new Set()
    }

    return {
      FunctionDeclaration: enterFunction,
      FunctionExpression: enterFunction,
      ArrowFunctionExpression: enterFunction,
      "FunctionDeclaration:exit": exitFunction,
      "FunctionExpression:exit": exitFunction,
      "ArrowFunctionExpression:exit": exitFunction,

      AssignmentExpression(node: TSESTree.AssignmentExpression) {
        const left = node.left
        if (left.type === AST_NODE_TYPES.Identifier && currentParams().has(left.name)) {
          context.report({
            node,
            messageId: "noParamReassign",
            data: { name: left.name },
          })
        }
      },

      UpdateExpression(node: TSESTree.UpdateExpression) {
        const arg = node.argument
        if (arg.type === AST_NODE_TYPES.Identifier && currentParams().has(arg.name)) {
          context.report({
            node,
            messageId: "noParamReassign",
            data: { name: arg.name },
          })
        }
      },
    }
  },
})
