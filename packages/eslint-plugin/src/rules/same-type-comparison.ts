import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"
import * as ts from "typescript"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "mismatchedTypes"

function isStringBased(type: ts.Type): boolean {
  if ((type.flags & ts.TypeFlags.String) !== 0) return true
  if ((type.flags & ts.TypeFlags.StringLiteral) !== 0) return true
  if (type.isUnion()) return type.types.every(isStringBased)
  return false
}

function isNumberBased(type: ts.Type): boolean {
  if ((type.flags & ts.TypeFlags.Number) !== 0) return true
  if ((type.flags & ts.TypeFlags.NumberLiteral) !== 0) return true
  if (type.isUnion()) return type.types.every(isNumberBased)
  return false
}

function areCompatible(a: ts.Type, b: ts.Type, checker: ts.TypeChecker): boolean {
  if ((a.flags & ts.TypeFlags.Any) !== 0 || (b.flags & ts.TypeFlags.Any) !== 0) return true
  if (isStringBased(a) && isStringBased(b)) return true
  if (isNumberBased(a) && isNumberBased(b)) return true
  return checker.isTypeAssignableTo(a, b) || checker.isTypeAssignableTo(b, a)
}

export const sameTypeComparison = createRule<Options, MessageIds>({
  name: "same-type-comparison",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require both sides of === and !== to have the same TypeScript type",
    },
    schema: [],
    messages: {
      mismatchedTypes:
        "Comparing '{{left}}' with '{{right}}' — both sides must be the same type.",
    },
  },
  defaultOptions: [],
  create(context) {
    const services = ESLintUtils.getParserServices(context)
    const checker = services.program.getTypeChecker()

    return {
      BinaryExpression(node: TSESTree.BinaryExpression) {
        const op = node.operator
        if (op !== "===" && op !== "!==" && op !== "==" && op !== "!=") {
          return
        }

        const leftTsNode = services.esTreeNodeToTSNodeMap.get(node.left)
        const rightTsNode = services.esTreeNodeToTSNodeMap.get(node.right)

        const leftType = checker.getTypeAtLocation(leftTsNode)
        const rightType = checker.getTypeAtLocation(rightTsNode)

        if (!areCompatible(leftType, rightType, checker)) {
          context.report({
            node,
            messageId: "mismatchedTypes",
            data: {
              left: checker.typeToString(leftType),
              right: checker.typeToString(rightType),
            },
          })
        }
      },
    }
  },
})
