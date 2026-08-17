import { AST_NODE_TYPES, ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noHasOwnProperty"

function isHasOwnPropertyName(node: TSESTree.Expression | TSESTree.PrivateIdentifier): boolean {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return node.name === "hasOwnProperty"
  }
  if (node.type === AST_NODE_TYPES.Literal) {
    return node.value === "hasOwnProperty"
  }
  return false
}

export const noHasOwnProperty = createRule<Options, MessageIds>({
  name: "no-hasownproperty",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow hasOwnProperty and Object.hasOwn. Walk entries, Zod-validate, or use Model fields.",
    },
    schema: [],
    messages: {
      noHasOwnProperty:
        "Do not use hasOwnProperty or Object.hasOwn. Walk Object.entries, validate with Zod, or use Model fields.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      MemberExpression(node: TSESTree.MemberExpression) {
        if (isHasOwnPropertyName(node.property) === true) {
          context.report({ node, messageId: "noHasOwnProperty" })
          return
        }
        if (
          node.object.type === AST_NODE_TYPES.Identifier &&
          node.object.name === "Object" &&
          node.property.type === AST_NODE_TYPES.Identifier &&
          node.property.name === "hasOwn"
        ) {
          context.report({ node, messageId: "noHasOwnProperty" })
        }
      },
    }
  },
})
