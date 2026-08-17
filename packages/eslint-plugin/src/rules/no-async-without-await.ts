import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noAsyncWithoutAwait"

type FunctionNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression

interface FrameInfo {
  node: FunctionNode
  hasAwait: boolean
}

export const noAsyncWithoutAwait = createRule<Options, MessageIds>({
  name: "no-async-without-await",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow async functions that contain no await expression",
    },
    schema: [],
    messages: {
      noAsyncWithoutAwait:
        "Async function has no await expression. Remove the async keyword or add an await.",
    },
  },
  defaultOptions: [],
  create(context) {
    const stack: FrameInfo[] = []

    function enter(node: FunctionNode) {
      if (node.async) stack.push({ node, hasAwait: false })
    }

    function exit(node: FunctionNode) {
      if (!node.async) return
      const frame = stack.pop()
      if (frame && !frame.hasAwait) {
        context.report({ node, messageId: "noAsyncWithoutAwait" })
      }
    }

    return {
      FunctionDeclaration: enter,
      FunctionExpression: enter,
      ArrowFunctionExpression: enter,
      "FunctionDeclaration:exit": exit,
      "FunctionExpression:exit": exit,
      "ArrowFunctionExpression:exit": exit,

      AwaitExpression() {
        if (stack.length > 0) {
          stack[stack.length - 1]!.hasAwait = true
        }
      },
    }
  },
})
