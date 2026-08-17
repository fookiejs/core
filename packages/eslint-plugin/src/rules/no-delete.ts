import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noDelete"

export const noDelete = createRule<Options, MessageIds>({
  name: "no-delete",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow the delete operator",
    },
    schema: [],
    messages: {
      noDelete:
        "Do not use 'delete'. Return a new value without '{{key}}' (e.g. a Model method), do not reshape with rest/spread.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      UnaryExpression(node: TSESTree.UnaryExpression) {
        if (node.operator !== "delete") return

        let key = "key"
        const arg = node.argument
        if (arg.type === "MemberExpression") {
          const prop = arg.property
          if (prop.type === "Identifier") key = prop.name
          else if (prop.type === "Literal") key = String(prop.value)
        }

        context.report({ node, messageId: "noDelete", data: { key } })
      },
    }
  },
})
