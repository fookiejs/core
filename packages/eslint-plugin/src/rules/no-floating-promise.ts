import { AST_NODE_TYPES, ESLintUtils, TSESTree } from "@typescript-eslint/utils"
import * as ts from "typescript"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noFloatingPromise"

function isPromiseLike(type: ts.Type, checker: ts.TypeChecker): boolean {
  if (type.isUnion()) {
    return type.types.some((t) => isPromiseLike(t, checker))
  }
  const symbol = type.getSymbol()
  if (symbol !== undefined && ["Promise", "PromiseLike"].includes(symbol.getName())) {
    return true
  }
  const thenProp = checker.getPropertyOfType(type, "then")
  if (thenProp !== undefined) {
    const valueDecl = thenProp.valueDeclaration
    if (valueDecl !== undefined) {
      const thenType = checker.getTypeOfSymbolAtLocation(thenProp, valueDecl)
      if (thenType.getCallSignatures().length > 0) return true
    }
  }
  return false
}

export const noFloatingPromise = createRule<Options, MessageIds>({
  name: "no-floating-promise",
  meta: {
    type: "problem",
    docs: { description: "Disallow unhandled floating promises" },
    schema: [],
    messages: {
      noFloatingPromise:
        "Promise is not handled. Use await, return, or .catch() to handle it.",
    },
  },
  defaultOptions: [],
  create(context) {
    const services = ESLintUtils.getParserServices(context)
    const checker = services.program.getTypeChecker()

    function isChainHandled(node: TSESTree.Node): boolean {
      if (node.type !== AST_NODE_TYPES.CallExpression) return false
      const callee = node.callee
      if (callee.type === AST_NODE_TYPES.MemberExpression) {
        const prop = callee.property
        if (
          prop.type === AST_NODE_TYPES.Identifier &&
          ["catch", "finally"].includes(prop.name)
        ) {
          return true
        }
        if (prop.type === AST_NODE_TYPES.Identifier && prop.name === "then") {
          const args = node.arguments
          if (args.length >= 2) {
            const secondArg = args[1]
            if (secondArg !== undefined && secondArg.type !== AST_NODE_TYPES.Literal) return true
          }
        }
      }
      return false
    }

    return {
      ExpressionStatement(node: TSESTree.ExpressionStatement) {
        const expr = node.expression
        if (expr.type !== AST_NODE_TYPES.CallExpression) return
        if (isChainHandled(expr)) return

        const tsNode = services.esTreeNodeToTSNodeMap.get(expr)
        const type = checker.getTypeAtLocation(tsNode)

        if (isPromiseLike(type, checker)) {
          context.report({ node, messageId: "noFloatingPromise" })
        }
      },
    }
  },
})
