import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noNonNull"

export const noNonNullAssertion = createRule<Options, MessageIds>({
  name: "no-non-null-assertion",
  meta: {
    type: "problem",
    docs: { description: "Disallow the non-null assertion operator (!)" },
    schema: [],
    messages: {
      noNonNull:
        "Do not use the non-null assertion operator (!). Narrow the type properly instead.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      TSNonNullExpression(node: TSESTree.TSNonNullExpression) {
        context.report({ node, messageId: "noNonNull" })
      },
    }
  },
})
