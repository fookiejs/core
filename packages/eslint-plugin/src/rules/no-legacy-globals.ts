import { AST_NODE_TYPES, ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "legacyGlobal" | "noArguments"

const BANNED_HOSTS = new Set(["window", "document", "global", "globalThis"])

function getBannedCallReplacement(name: string): string | false {
  if (name === "parseInt") return "Number.parseInt(str, 10)"
  if (name === "parseFloat") return "Number.parseFloat(str)"
  if (name === "isNaN") return "Number.isNaN(x)"
  if (name === "isFinite") return "Number.isFinite(x)"
  if (name === "eval") return "a redesign without eval"
  return false
}

function isPropertyName(node: TSESTree.Identifier): boolean {
  const parent = node.parent
  if (parent.type === AST_NODE_TYPES.MemberExpression && parent.property === node && parent.computed === false) {
    return true
  }
  if (parent.type === AST_NODE_TYPES.Property && parent.key === node && parent.shorthand === false && parent.computed === false) {
    return true
  }
  return false
}

export const noLegacyGlobals = createRule<Options, MessageIds>({
  name: "no-legacy-globals",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow legacy globals: window, document, global, globalThis, parseInt, parseFloat, isNaN, isFinite, eval, arguments",
    },
    schema: [],
    messages: {
      legacyGlobal: "Do not use global '{{name}}'. Use '{{replacement}}' instead.",
      noArguments: "Do not use 'arguments'. Declare named parameters instead.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (node.callee.type !== AST_NODE_TYPES.Identifier) return
        const name = node.callee.name
        const replacement = getBannedCallReplacement(name)
        if (replacement !== false) {
          context.report({
            node: node.callee,
            messageId: "legacyGlobal",
            data: { name, replacement },
          })
        }
      },

      Identifier(node: TSESTree.Identifier) {
        if (node.name === "arguments") {
          if (isPropertyName(node)) return
          context.report({ node, messageId: "noArguments" })
          return
        }

        if (!BANNED_HOSTS.has(node.name)) return
        if (isPropertyName(node)) return

        const replacement =
          node.name === "window" || node.name === "globalThis" || node.name === "global"
            ? "platform APIs without the host global prefix"
            : "platform APIs without the document global"

        context.report({
          node,
          messageId: "legacyGlobal",
          data: { name: node.name, replacement },
        })
      },
    }
  },
})
