import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noTypeof"

export const noTypeof = createRule<Options, MessageIds>({
  name: "no-typeof",
  meta: {
    type: "problem",
    docs: { description: "Disallow the typeof operator" },
    schema: [],
    messages: {
      noTypeof:
        "Do not use typeof. Validate with Zod (safeParse); narrow from validated Models.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      UnaryExpression(node: TSESTree.UnaryExpression) {
        if (node.operator === "typeof") {
          context.report({ node, messageId: "noTypeof" })
        }
      },
    }
  },
})
