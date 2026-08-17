import { AST_NODE_TYPES, ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noNewWrapper"

function getWrapperReplacement(name: string): string | false {
  if (name === "String") return "use a string literal or String(x) without new"
  if (name === "Number") return "use a number literal or Number(x) without new"
  if (name === "Boolean") return "use true / false or Boolean(x) without new"
  if (name === "Object") return "use an object literal {}"
  if (name === "Array") return "use an array literal []"
  return false
}

export const noNewWrappers = createRule<Options, MessageIds>({
  name: "no-new-wrappers",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow primitive wrapper constructors: new String(), new Number(), new Boolean(), new Object(), new Array()",
    },
    schema: [],
    messages: {
      noNewWrapper:
        "Do not use 'new {{name}}()'. Instead: {{replacement}}.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      NewExpression(node: TSESTree.NewExpression) {
        if (node.callee.type !== AST_NODE_TYPES.Identifier) return
        const name = node.callee.name
        const replacement = getWrapperReplacement(name)
        if (replacement !== false) {
          context.report({
            node,
            messageId: "noNewWrapper",
            data: { name, replacement },
          })
        }
      },
    }
  },
})
