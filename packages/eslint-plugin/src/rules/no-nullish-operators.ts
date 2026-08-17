import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noNullish" | "noOptionalChain"

export const noNullishOperators = createRule<Options, MessageIds>({
  name: "no-nullish-operators",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow nullish coalescing (??) and optional chaining (?.) operators",
    },
    schema: [],
    messages: {
      noNullish:
        "Do not use the nullish coalescing operator (??). null and undefined are forbidden — design types that don't need this.",
      noOptionalChain:
        "Do not use optional chaining (?.). null and undefined are forbidden — design types that guarantee presence.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      "LogicalExpression[operator='??']"(node: TSESTree.LogicalExpression) {
        context.report({ node, messageId: "noNullish" })
      },
      "MemberExpression[optional=true]"(node: TSESTree.MemberExpression) {
        context.report({ node, messageId: "noOptionalChain" })
      },
      "CallExpression[optional=true]"(node: TSESTree.CallExpression) {
        context.report({ node, messageId: "noOptionalChain" })
      },
    }
  },
})
