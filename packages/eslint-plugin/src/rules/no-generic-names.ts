import { AST_NODE_TYPES, ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

const DEFAULT_GENERIC: readonly string[] = [
  "data", "result", "response",
  "obj", "arr",
  "info", "stuff", "things", "thing",
  "value", "val",
  "item", "element", "entry",
  "str", "num", "bool",
]

type Options = [
  {
    allow?: string[]
    additionalNames?: string[]
  }?,
]

type MessageIds = "genericName"

function isDeclarationSite(node: TSESTree.Identifier): boolean {
  const p = node.parent
  if (!p) return false

  if (p.type === AST_NODE_TYPES.VariableDeclarator && p.id === node) return true

  if (
    p.type === AST_NODE_TYPES.FunctionDeclaration ||
    p.type === AST_NODE_TYPES.FunctionExpression ||
    p.type === AST_NODE_TYPES.ArrowFunctionExpression
  ) {
    if (p.params.some((param) => param === node)) return true
  }

  if (p.type === AST_NODE_TYPES.Property && p.value === node) {
    if (p.parent.type === AST_NODE_TYPES.ObjectPattern) return true
  }

  return false
}

export const noGenericNames = createRule<Options, MessageIds>({
  name: "no-generic-names",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Warn when identifiers use overly generic names that carry no domain information",
    },
    schema: [
      {
        type: "object",
        properties: {
          allow: {
            type: "array",
            items: { type: "string" },
            description: "Names to allow despite being generic",
          },
          additionalNames: {
            type: "array",
            items: { type: "string" },
            description: "Extra names to treat as generic",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      genericName:
        "'{{name}}' is too generic. Use a name that describes the domain concept (e.g. '{{suggestion}}').",
    },
  },
  defaultOptions: [{}],
  create(context) {
    const [opts = {}] = context.options
    const { allow = [], additionalNames = [] } = opts
    const allowed = new Set(allow.map((n) => n.toLowerCase()))

    const genericNames = new Set([
      ...DEFAULT_GENERIC.map((n) => n.toLowerCase()),
      ...additionalNames.map((n) => n.toLowerCase()),
    ])
    for (const a of allowed) genericNames.delete(a)

    const SUGGESTIONS: Record<string, string> = {
      data: "userData / orderData / pageData",
      result: "parseResult / searchResult / queryResult",
      response: "apiResponse / httpResponse / authResponse",
      obj: "use a typed variable name",
      arr: "use a typed variable name",
      info: "userInfo / sessionInfo / connectionInfo",
      stuff: "use a descriptive name",
      thing: "use a descriptive name",
      value: "fieldValue / inputValue / selectedValue",
      val: "fieldValue / inputValue",
      item: "menuItem / listItem / orderItem",
      element: "formElement / domElement",
      entry: "logEntry / cacheEntry / registryEntry",
      str: "label / message / key",
      num: "count / index / amount",
      bool: "isEnabled / hasAccess / isVisible",
    }

    return {
      Identifier(node: TSESTree.Identifier) {
        if (!isDeclarationSite(node)) return

        const lower = node.name.toLowerCase()
        if (!genericNames.has(lower)) return

        const { [lower]: suggestion = "a domain-specific name" } = SUGGESTIONS

        context.report({
          node,
          messageId: "genericName",
          data: { name: node.name, suggestion },
        })
      },
    }
  },
})
