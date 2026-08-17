import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noPrototypeMutation"

export const noPrototypeMutation = createRule<Options, MessageIds>({
  name: "no-prototype-mutation",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow mutating prototypes at runtime. Affects all instances across module boundaries.",
    },
    schema: [],
    messages: {
      noPrototypeMutation:
        "Do not mutate prototypes at runtime. Use class syntax or composition instead.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      AssignmentExpression(node: TSESTree.AssignmentExpression) {
        const left = node.left
        if (
          left.type === "MemberExpression" &&
          left.object.type === "MemberExpression" &&
          left.object.property.type === "Identifier" &&
          left.object.property.name === "prototype"
        ) {
          context.report({ node, messageId: "noPrototypeMutation" })
        }
      },
    }
  },
})
