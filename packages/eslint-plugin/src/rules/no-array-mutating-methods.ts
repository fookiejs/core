import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"
import * as ts from "typescript"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noArrayMutatingMethod"

const MUTATING_METHODS = new Set([
  "sort",
  "reverse",
  "splice",
  "push",
  "pop",
  "shift",
  "unshift",
  "fill",
  "copyWithin",
])

function isArrayType(type: ts.Type): boolean {
  if (type.isUnion()) return type.types.some(isArrayType)
  const symbol = type.getSymbol()
  if (symbol) {
    const name = symbol.getName()
    if (name === "Array" || name === "ReadonlyArray") return true
  }
  return false
}

export const noArrayMutatingMethods = createRule<Options, MessageIds>({
  name: "no-array-mutating-methods",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow in-place array mutation methods. Use non-mutating alternatives such as toSorted, toReversed, toSpliced, filter, or map.",
    },
    schema: [],
    messages: {
      noArrayMutatingMethod:
        "'{{method}}' mutates the array in place. Use a non-mutating alternative such as toSorted(), toReversed(), toSpliced(), filter, or map.",
    },
  },
  defaultOptions: [],
  create(context) {
    const services = ESLintUtils.getParserServices(context)
    const checker = services.program.getTypeChecker()

    return {
      CallExpression(node: TSESTree.CallExpression) {
        const callee = node.callee
        if (callee.type !== "MemberExpression") return
        const prop = callee.property
        if (prop.type !== "Identifier") return
        if (!MUTATING_METHODS.has(prop.name)) return

        const objTsNode = services.esTreeNodeToTSNodeMap.get(callee.object)
        const objType = checker.getTypeAtLocation(objTsNode)

        if (isArrayType(objType)) {
          context.report({
            node,
            messageId: "noArrayMutatingMethod",
            data: { method: prop.name },
          })
        }
      },
    }
  },
})
