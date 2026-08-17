import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noProcessEnv"

export const noProcessEnv = createRule<Options, MessageIds>({
  name: "no-process-env",
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow direct process.env access. Use a typed config object instead.",
    },
    schema: [],
    messages: {
      noProcessEnv:
        "Do not access process.env directly. Centralize environment variables in a typed config module.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      MemberExpression(node: TSESTree.MemberExpression) {
        const objectNode = node.object
        const prop = node.property

        if (
          objectNode.type === "Identifier" &&
          objectNode.name === "process" &&
          prop.type === "Identifier" &&
          prop.name === "env"
        ) {
          context.report({ node, messageId: "noProcessEnv" })
        }
      },
    }
  },
})
