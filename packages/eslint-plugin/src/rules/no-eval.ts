import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noEval"

export const noEval = createRule<Options, MessageIds>({
  name: "no-eval",
  meta: {
    type: "problem",
    docs: { description: "Disallow eval() and indirect eval patterns" },
    schema: [],
    messages: {
      noEval: "Do not use eval(). It executes arbitrary code and bypasses the type system.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node: TSESTree.CallExpression) {
        const callee = node.callee
        if (callee.type === "Identifier" && callee.name === "eval") {
          context.report({ node, messageId: "noEval" })
        }
      },
      MemberExpression(node: TSESTree.MemberExpression) {
        const prop = node.property
        if (
          !node.computed &&
          prop.type === "Identifier" &&
          prop.name === "eval"
        ) {
          context.report({ node, messageId: "noEval" })
        }
      },
    }
  },
})
