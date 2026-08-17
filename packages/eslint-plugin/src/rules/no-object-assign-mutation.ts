import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noObjectAssignMutation"

export const noObjectAssignMutation = createRule<Options, MessageIds>({
  name: "no-object-assign-mutation",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Object.assign() with an existing object as the first argument. Return a new Model instance instead of mutating or spreading.",
    },
    schema: [],
    messages: {
      noObjectAssignMutation:
        "Object.assign() with an existing reference as target mutates it in place. Return a new Model instance (e.g. account.withPatch(patch)), do not spread.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (
          node.callee.type !== "MemberExpression" ||
          node.callee.object.type !== "Identifier" ||
          node.callee.object.name !== "Object" ||
          node.callee.property.type !== "Identifier" ||
          node.callee.property.name !== "assign"
        ) {
          return
        }

        if (node.arguments.length === 0) return

        const firstArg = node.arguments[0]
        if (firstArg && firstArg.type !== "ObjectExpression") {
          context.report({ node, messageId: "noObjectAssignMutation" })
        }
      },
    }
  },
})
