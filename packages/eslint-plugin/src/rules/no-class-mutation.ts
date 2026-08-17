import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noClassMutation"

function isInsideConstructor(node: TSESTree.Node): boolean {
  let current = node.parent
  while (current) {
    if (
      current.type === "MethodDefinition" &&
      current.kind === "constructor"
    ) {
      return true
    }
    if (
      current.type === "ClassDeclaration" ||
      current.type === "ClassExpression"
    ) {
      return false
    }
    current = current.parent
  }
  return false
}

export const noClassMutation = createRule<Options, MessageIds>({
  name: "no-class-mutation",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow this.property assignments outside of the constructor",
    },
    schema: [],
    messages: {
      noClassMutation:
        "Do not mutate class properties outside the constructor. Use readonly fields or return new instances.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      AssignmentExpression(node: TSESTree.AssignmentExpression) {
        const left = node.left
        if (
          left.type === "MemberExpression" &&
          left.object.type === "ThisExpression" &&
          !isInsideConstructor(node)
        ) {
          context.report({ node, messageId: "noClassMutation" })
        }
      },
    }
  },
})
