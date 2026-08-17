import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noDefineProperty"

export const noDefineProperty = createRule<Options, MessageIds>({
  name: "no-define-property",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Object.defineProperty and Object.defineProperties. They silently redefine property descriptors and produce invisible mutations.",
    },
    schema: [],
    messages: {
      noDefineProperty:
        "Do not use Object.{{method}}(). It produces invisible property mutations. Use plain property assignment or class syntax instead.",
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
          node.callee.property.type !== "Identifier"
        ) {
          return
        }

        const method = node.callee.property.name
        if (method === "defineProperty" || method === "defineProperties") {
          context.report({
            node,
            messageId: "noDefineProperty",
            data: { method },
          })
        }
      },
    }
  },
})
