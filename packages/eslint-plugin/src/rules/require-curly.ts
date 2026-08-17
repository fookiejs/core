import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "requireCurly"

function isBlock(node: TSESTree.Node): boolean {
  return node.type === "BlockStatement"
}

export const requireCurly = createRule<Options, MessageIds>({
  name: "require-curly",
  meta: {
    type: "suggestion",
    docs: { description: "Require curly braces for all control flow statements" },
    schema: [],
    messages: {
      requireCurly: "Always use curly braces after '{{keyword}}'.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      IfStatement(node: TSESTree.IfStatement) {
        if (!isBlock(node.consequent)) {
          context.report({ node, messageId: "requireCurly", data: { keyword: "if" } })
        }
        if (node.alternate && !isBlock(node.alternate) && node.alternate.type !== "IfStatement") {
          context.report({ node: node.alternate, messageId: "requireCurly", data: { keyword: "else" } })
        }
      },
      ForStatement(node: TSESTree.ForStatement) {
        if (!isBlock(node.body)) {
          context.report({ node, messageId: "requireCurly", data: { keyword: "for" } })
        }
      },
      ForOfStatement(node: TSESTree.ForOfStatement) {
        if (!isBlock(node.body)) {
          context.report({ node, messageId: "requireCurly", data: { keyword: "for...of" } })
        }
      },
      ForInStatement(node: TSESTree.ForInStatement) {
        if (!isBlock(node.body)) {
          context.report({ node, messageId: "requireCurly", data: { keyword: "for...in" } })
        }
      },
      WhileStatement(node: TSESTree.WhileStatement) {
        if (!isBlock(node.body)) {
          context.report({ node, messageId: "requireCurly", data: { keyword: "while" } })
        }
      },
      DoWhileStatement(node: TSESTree.DoWhileStatement) {
        if (!isBlock(node.body)) {
          context.report({ node, messageId: "requireCurly", data: { keyword: "do...while" } })
        }
      },
    }
  },
})
