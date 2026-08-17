import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noMutableExport"

export const noMutableExports = createRule<Options, MessageIds>({
  name: "no-mutable-exports",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow exporting mutable let variables",
    },
    schema: [],
    messages: {
      noMutableExport:
        "Do not export mutable 'let' variables. Use 'const' instead.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      ExportNamedDeclaration(node: TSESTree.ExportNamedDeclaration) {
        const decl = node.declaration
        if (!decl || decl.type !== "VariableDeclaration") return
        if (decl.kind === "let") {
          context.report({ node: decl, messageId: "noMutableExport" })
        }
      },
    }
  },
})
