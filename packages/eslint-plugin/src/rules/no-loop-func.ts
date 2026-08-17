import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noLoopFunc"

const LOOP_TYPES = new Set([
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "WhileStatement",
  "DoWhileStatement",
])

function isInsideLoop(node: TSESTree.Node): boolean {
  let current = node.parent
  while (current) {
    if (LOOP_TYPES.has(current.type)) return true
    if (
      current.type === "FunctionDeclaration" ||
      current.type === "FunctionExpression" ||
      current.type === "ArrowFunctionExpression"
    ) {
      return false
    }
    current = current.parent
  }
  return false
}

export const noLoopFunc = createRule<Options, MessageIds>({
  name: "no-loop-func",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow function definitions inside loops",
    },
    schema: [],
    messages: {
      noLoopFunc:
        "Do not define functions inside loops. The function closes over the loop variable and may capture unexpected values.",
    },
  },
  defaultOptions: [],
  create(context) {
    function check(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ) {
      if (isInsideLoop(node)) {
        context.report({ node, messageId: "noLoopFunc" })
      }
    }

    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
    }
  },
})
