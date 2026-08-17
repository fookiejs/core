import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noAny" | "noObject" | "noObjectConstructorType" | "noEmptyObjectType"

export const noAny = createRule<Options, MessageIds>({
  name: "no-any",
  meta: {
    type: "problem",
    docs: { description: "Disallow the any and object types" },
    schema: [],
    messages: {
      noAny: "Do not use 'any'. Use a specific type instead.",
      noObject: "Do not use 'object'. It is nearly as broad as 'any' — use a specific interface or Record<K, V> instead.",
      noObjectConstructorType: "Do not use 'Object' as a type. Use a specific interface or Record<K, V> instead. (Object.keys() etc. are fine.)",
      noEmptyObjectType: "Do not use '{}' as a type. Use a specific interface or Record<K, V> instead.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      TSAnyKeyword(node: TSESTree.TSAnyKeyword) {
        context.report({ node, messageId: "noAny" })
      },
      TSObjectKeyword(node: TSESTree.TSObjectKeyword) {
        context.report({ node, messageId: "noObject" })
      },
      TSTypeReference(node: TSESTree.TSTypeReference) {
        if (node.typeName.type === "Identifier" && node.typeName.name === "Object") {
          context.report({ node, messageId: "noObjectConstructorType" })
        }
      },
      TSTypeLiteral(node: TSESTree.TSTypeLiteral) {
        if (node.members.length === 0) {
          context.report({ node, messageId: "noEmptyObjectType" })
        }
      },
    }
  },
})
