import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noDefaultExport"

export const noDefaultExport = createRule<Options, MessageIds>({
  name: "no-default-export",
  meta: {
    type: "suggestion",
    docs: { description: "Disallow default exports. Use named exports instead." },
    schema: [],
    messages: {
      noDefaultExport:
        "Do not use default exports. Use named exports so imports stay stable across refactors.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      ExportDefaultDeclaration(node: TSESTree.ExportDefaultDeclaration) {
        context.report({ node, messageId: "noDefaultExport" })
      },
    }
  },
})
