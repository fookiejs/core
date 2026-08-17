import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noTypeAssertion"

export const noTypeAssertion = createRule<Options, MessageIds>({
  name: "no-type-assertion",
  meta: {
    type: "problem",
    docs: { description: "Disallow type assertions (as X and <X>)" },
    schema: [],
    messages: {
      noTypeAssertion:
        "Do not use type assertions. Structure your types so assertions are unnecessary.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      TSAsExpression(node: TSESTree.TSAsExpression) {
        context.report({ node, messageId: "noTypeAssertion" })
      },
      TSTypeAssertion(node: TSESTree.TSTypeAssertion) {
        context.report({ node, messageId: "noTypeAssertion" })
      },
    }
  },
})
