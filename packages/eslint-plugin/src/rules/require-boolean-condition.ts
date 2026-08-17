import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"
import type * as ts from "typescript"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "requireBoolean"

function isPurelyBoolean(type: ts.Type, checker: ts.TypeChecker): boolean {
  const printed = checker.typeToString(type)
  if (printed === "boolean" || printed === "true" || printed === "false") {
    return true
  }
  if (type.isUnion()) {
    return type.types.every((part) => isPurelyBoolean(part, checker))
  }
  return false
}

export const requireBooleanCondition = createRule<Options, MessageIds>({
  name: "require-boolean-condition",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require conditions in if/while/ternary to be explicitly boolean, not truthy/falsy",
    },
    schema: [],
    messages: {
      requireBoolean:
        "Condition has type '{{type}}'. Use an explicit boolean expression (e.g. flag === true, count > 0).",
    },
  },
  defaultOptions: [],
  create(context) {
    const services = ESLintUtils.getParserServices(context)
    const checker = services.program.getTypeChecker()

    function check(conditionNode: TSESTree.Expression): void {
      const tsNode = services.esTreeNodeToTSNodeMap.get(conditionNode)
      const type = checker.getTypeAtLocation(tsNode)
      const printed = checker.typeToString(type)

      if (printed === "any") {
        return
      }

      if (isPurelyBoolean(type, checker) === false) {
        context.report({
          node: conditionNode,
          messageId: "requireBoolean",
          data: { type: printed },
        })
      }
    }

    return {
      "IfStatement"(node: TSESTree.IfStatement) {
        check(node.test)
      },
      "WhileStatement"(node: TSESTree.WhileStatement) {
        check(node.test)
      },
      "DoWhileStatement"(node: TSESTree.DoWhileStatement) {
        check(node.test)
      },
      "ForStatement"(node: TSESTree.ForStatement) {
        if (node.test !== null) check(node.test)
      },
      "ConditionalExpression"(node: TSESTree.ConditionalExpression) {
        check(node.test)
      },
    }
  },
})
