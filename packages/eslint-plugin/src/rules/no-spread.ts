import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noSpread" | "noRest"

export const noSpread = createRule<Options, MessageIds>({
  name: "no-spread",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow spread and rest (...). Reshape through Model methods instead of bag copying.",
    },
    schema: [],
    messages: {
      noSpread:
        "Do not use spread (...). Return a new Model instance with an explicit method instead of copying bags.",
      noRest:
        "Do not use rest (...). Name the fields you keep or return a new Model without the removed field.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      SpreadElement(node: TSESTree.SpreadElement) {
        context.report({ node, messageId: "noSpread" })
      },
      RestElement(node: TSESTree.RestElement) {
        context.report({ node, messageId: "noRest" })
      },
    }
  },
})
