import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noNull" | "noUndefined" | "noVoidExpr"

export const noNullUndefined = createRule<Options, MessageIds>({
  name: "no-null-undefined",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow null, undefined, and void expressions as values. Avoid nullish APIs; return a present value or throw.",
    },
    schema: [],
    messages: {
      noNull:
        "Do not use null. Avoid null-returning APIs. Return a present value or throw.",
      noUndefined:
        "Do not use undefined. Do not write the undefined identifier. Return a present value or throw.",
      noVoidExpr:
        "Do not use void expressions. Return a present value or throw instead.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      "Literal[value=null]"(node: TSESTree.Literal) {
        context.report({ node, messageId: "noNull" })
      },

      TSNullKeyword(node: TSESTree.TSNullKeyword) {
        context.report({ node, messageId: "noNull" })
      },

      "Identifier[name='undefined']"(node: TSESTree.Identifier) {
        context.report({ node, messageId: "noUndefined" })
      },

      TSUndefinedKeyword(node: TSESTree.TSUndefinedKeyword) {
        context.report({ node, messageId: "noUndefined" })
      },

      UnaryExpression(node: TSESTree.UnaryExpression) {
        if (node.operator === "void") {
          context.report({ node, messageId: "noVoidExpr" })
        }
      },
    }
  },
})
