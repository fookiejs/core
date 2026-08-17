import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"
import * as ts from "typescript"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noStringConcat"

function isStringType(type: ts.Type): boolean {
  return (type.flags & (ts.TypeFlags.String | ts.TypeFlags.StringLiteral)) !== 0
}

export const noStringConcat = createRule<Options, MessageIds>({
  name: "no-string-concat",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow string concatenation with +. Use template literals instead.",
    },
    schema: [],
    messages: {
      noStringConcat:
        "Do not concatenate strings with +. Use a template literal instead.",
    },
  },
  defaultOptions: [],
  create(context) {
    const services = ESLintUtils.getParserServices(context)
    const checker = services.program.getTypeChecker()

    return {
      BinaryExpression(node: TSESTree.BinaryExpression) {
        if (node.operator !== "+") return

        const leftType = checker.getTypeAtLocation(
          services.esTreeNodeToTSNodeMap.get(node.left),
        )
        const rightType = checker.getTypeAtLocation(
          services.esTreeNodeToTSNodeMap.get(node.right),
        )

        if (isStringType(leftType) || isStringType(rightType)) {
          context.report({ node, messageId: "noStringConcat" })
        }
      },
    }
  },
})
