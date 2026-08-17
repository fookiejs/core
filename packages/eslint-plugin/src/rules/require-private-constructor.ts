import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "requirePrivateConstructor"

export const requirePrivateConstructor = createRule<Options, MessageIds>({
  name: "require-private-constructor",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require class constructors to be private or protected. Forces use of static factory methods.",
    },
    schema: [],
    messages: {
      requirePrivateConstructor:
        "Constructor must be private. Use a static factory method like '{{name}}.create(...)' instead of 'new {{name}}(...)'.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      MethodDefinition(node: TSESTree.MethodDefinition) {
        if (node.kind !== "constructor") return
        if (node.accessibility === "private") return
        if (node.accessibility === "protected") return

        const classNode = node.parent.parent as
          | TSESTree.ClassDeclaration
          | TSESTree.ClassExpression

        const name =
          classNode.id?.name ?? "Class"

        context.report({
          node,
          messageId: "requirePrivateConstructor",
          data: { name },
        })
      },
    }
  },
})
