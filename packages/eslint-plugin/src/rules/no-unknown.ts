import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noUnknown"

export const noUnknown = createRule<Options, MessageIds>({
  name: "no-unknown",
  meta: {
    type: "problem",
    docs: { description: "Disallow the unknown type" },
    schema: [],
    messages: {
      noUnknown: "Do not use 'unknown'. Use a specific type instead.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      TSUnknownKeyword(node: TSESTree.TSUnknownKeyword) {
        context.report({ node, messageId: "noUnknown" })
      },
    }
  },
})
