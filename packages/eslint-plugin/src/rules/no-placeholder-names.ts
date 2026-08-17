import { AST_NODE_TYPES, ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

const DEFAULT_BLOCKLIST: readonly string[] = [
  "foo", "bar", "baz", "qux", "quux", "foobar", "foobaz", "fooqux",
  "asdf", "qwerty", "aaa", "bbb", "ccc", "ddd", "eee",
  "abc", "abcd", "zzz",
  "temp1", "temp2", "temp3", "test1", "test2",
  "var1", "var2", "val1", "val2",
  "dummy", "placeholder", "lorem",
]

const LOOP_LETTERS = new Set(["i", "j", "k", "n", "m", "l"])
const MATH_LETTERS = new Set(["x", "y", "z", "w", "r", "t", "s", "u", "v"])

type Options = [
  {
    blocklist?: string[]
    allowSingleLetterInLoops?: boolean
  }?,
]

type MessageIds = "placeholderName"

const LOOP_NODE_TYPES = new Set([
  AST_NODE_TYPES.ForStatement,
  AST_NODE_TYPES.ForInStatement,
  AST_NODE_TYPES.ForOfStatement,
  AST_NODE_TYPES.WhileStatement,
  AST_NODE_TYPES.DoWhileStatement,
])

function isInsideLoop(node: TSESTree.Node): boolean {
  let current: TSESTree.Node | null | undefined = node.parent as TSESTree.Node | null | undefined
  while (current) {
    if (LOOP_NODE_TYPES.has(current.type)) return true
    current = current.parent as TSESTree.Node | null | undefined
  }
  return false
}

function isDeclarationSite(node: TSESTree.Identifier): boolean {
  const p = node.parent
  if (!p) return false

  if (p.type === AST_NODE_TYPES.VariableDeclarator && p.id === node) return true

  if (p.type === AST_NODE_TYPES.FunctionDeclaration && p.id === node) return true

  if (p.type === AST_NODE_TYPES.ClassDeclaration && p.id === node) return true

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

export const noPlaceholderNames = createRule<Options, MessageIds>({
  name: "no-placeholder-names",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow placeholder or meaningless identifier names",
    },
    schema: [
      {
        type: "object",
        properties: {
          blocklist: {
            type: "array",
            items: { type: "string" },
          },
          allowSingleLetterInLoops: {
            type: "boolean",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      placeholderName:
        "'{{name}}' is a placeholder name. Use a meaningful, descriptive name.",
    },
  },
  defaultOptions: [{}],
  create(context) {
    const [opts = {}] = context.options
    const { blocklist: extraBlocklist = [], allowSingleLetterInLoops: allowLoops = true } = opts
    const blocklist = new Set([
      ...DEFAULT_BLOCKLIST.map((n) => n.toLowerCase()),
      ...extraBlocklist.map((n) => n.toLowerCase()),
    ])

    return {
      Identifier(node: TSESTree.Identifier) {
        if (!isDeclarationSite(node)) return

        const lower = node.name.toLowerCase()

        if (node.name.length === 1) {
          if (MATH_LETTERS.has(lower)) return
          if (allowLoops && LOOP_LETTERS.has(lower) && isInsideLoop(node)) return
        }

        if (blocklist.has(lower)) {
          context.report({
            node,
            messageId: "placeholderName",
            data: { name: node.name },
          })
        }
      },
    }
  },
})
