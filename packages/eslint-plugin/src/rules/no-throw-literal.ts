import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noThrowLiteral"

export const noThrowLiteral = createRule<Options, MessageIds>({
  name: "no-throw-literal",
  meta: {
    type: "problem",
    docs: { description: "Disallow throwing non-Error values" },
    schema: [],
    messages: {
      noThrowLiteral:
        "Only throw Error instances. Throwing literals or plain objects loses the stack trace.",
    },
  },
  defaultOptions: [],
  create(context) {
    const BANNED = new Set([
      "Literal",
      "TemplateLiteral",
      "ObjectExpression",
      "ArrayExpression",
    ])

    return {
      ThrowStatement(node: TSESTree.ThrowStatement) {
        const arg = node.argument
        if (!arg) return
        if (BANNED.has(arg.type)) {
          context.report({ node, messageId: "noThrowLiteral" })
        }
      },
    }
  },
})
