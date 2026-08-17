import { AST_NODE_TYPES, ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "enclosingCapture" | "enclosingThis"

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

function enclosingFunction(node: TSESTree.Node): FnNode | null {
  let current = node.parent
  while (current) {
    if (isFn(current)) {
      return current
    }
    current = current.parent
  }
  return null
}

function isReceiverFunction(fn: FnNode): boolean {
  const parent = fn.parent
  if (parent === undefined) {
    return false
  }
  if (parent.type === AST_NODE_TYPES.MethodDefinition && parent.value === fn) {
    return true
  }
  if (parent.type === AST_NODE_TYPES.PropertyDefinition && parent.value === fn) {
    return true
  }
  if (
    parent.type === AST_NODE_TYPES.Property &&
    parent.value === fn &&
    fn.type !== AST_NODE_TYPES.ArrowFunctionExpression
  ) {
    return true
  }
  return false
}

function isTypeName(node: TSESTree.Identifier): boolean {
  const parentType = node.parent.type
  if (parentType === "TSTypeReference") {
    return true
  }
  if (parentType === "TSQualifiedName") {
    return true
  }
  if (parentType === "TSTypeAnnotation") {
    return true
  }
  if (parentType === "TSInterfaceHeritage") {
    return true
  }
  if (parentType === "TSClassImplements") {
    return true
  }
  return false
}

function isDefiningOrProperty(node: TSESTree.Identifier): boolean {
  const parent = node.parent
  if (parent.type === AST_NODE_TYPES.VariableDeclarator && parent.id === node) {
    return true
  }
  if (parent.type === AST_NODE_TYPES.FunctionDeclaration && parent.id === node) {
    return true
  }
  if (parent.type === AST_NODE_TYPES.FunctionExpression && parent.id === node) {
    return true
  }
  if (parent.type === AST_NODE_TYPES.ClassDeclaration && parent.id === node) {
    return true
  }
  if (parent.type === AST_NODE_TYPES.ClassExpression && parent.id === node) {
    return true
  }
  if (parent.type === AST_NODE_TYPES.CatchClause && parent.param === node) {
    return true
  }
  if (
    isFn(parent) &&
    parent.params.some((param) => param === node)
  ) {
    return true
  }
  if (
    parent.type === AST_NODE_TYPES.Property &&
    parent.key === node &&
    parent.computed === false
  ) {
    return true
  }
  if (
    parent.type === AST_NODE_TYPES.MemberExpression &&
    parent.property === node &&
    parent.computed === false
  ) {
    return true
  }
  if (parent.type === AST_NODE_TYPES.MethodDefinition && parent.key === node) {
    return true
  }
  if (parent.type === AST_NODE_TYPES.PropertyDefinition && parent.key === node) {
    return true
  }
  if (parent.type === AST_NODE_TYPES.ImportSpecifier) {
    return true
  }
  if (parent.type === AST_NODE_TYPES.ImportDefaultSpecifier) {
    return true
  }
  if (parent.type === AST_NODE_TYPES.ImportNamespaceSpecifier) {
    return true
  }
  return false
}

function isHeldScope(
  held: unknown,
): held is { block: unknown; type: string; upper: unknown } {
  if (held === null || held === undefined) {
    return false
  }
  if (typeof held !== "object") {
    return false
  }
  if ("block" in held === false) {
    return false
  }
  if ("type" in held === false) {
    return false
  }
  if ("upper" in held === false) {
    return false
  }
  return true
}

function scopeOwnsFunction(
  scope: { block: unknown; upper: unknown; type: string },
  fn: FnNode,
): boolean {
  let current: { block: unknown; upper: unknown; type: string } | null = scope
  while (current !== null) {
    if (current.block === fn) {
      return true
    }
    if (current.type === "global" || current.type === "module") {
      return false
    }
    if (isHeldScope(current.upper) === false) {
      return false
    }
    current = current.upper
  }
  return false
}

export const noEnclosingCapture = createRule<Options, MessageIds>({
  name: "no-enclosing-capture",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow reading bindings from an enclosing function. Nested functions take parameters; methods read this.",
    },
    schema: [],
    messages: {
      enclosingCapture:
        "Do not read '{{name}}' from an enclosing function. Pass it as a parameter or read it from this.",
      enclosingThis:
        "Do not use 'this' outside a method. Nested functions must receive the receiver as a parameter.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      ThisExpression(node: TSESTree.ThisExpression) {
        const fn = enclosingFunction(node)
        if (fn === null) {
          context.report({ node, messageId: "enclosingThis" })
          return
        }
        if (isReceiverFunction(fn) === false) {
          context.report({ node, messageId: "enclosingThis" })
        }
      },

      Identifier(node: TSESTree.Identifier) {
        if (isTypeName(node)) {
          return
        }
        if (isDefiningOrProperty(node)) {
          return
        }
        const currentFn = enclosingFunction(node)
        if (currentFn === null) {
          return
        }
        const scope = context.sourceCode.getScope(node)
        let currentScope: ReturnType<typeof context.sourceCode.getScope> | null = scope
        let variable: (typeof scope.variables)[number] | null = null
        while (currentScope) {
          const found = currentScope.variables.find((held) => held.name === node.name)
          if (found) {
            variable = found
            break
          }
          currentScope = currentScope.upper
        }
        if (variable === null) {
          return
        }
        if (scopeOwnsFunction(variable.scope, currentFn)) {
          return
        }
        if (variable.scope.type === "module" || variable.scope.type === "global") {
          return
        }
        if (variable.scope.type === "class") {
          return
        }
        context.report({
          node,
          messageId: "enclosingCapture",
          data: { name: node.name },
        })
      },
    }
  },
})
