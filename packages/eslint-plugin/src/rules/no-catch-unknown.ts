import { AST_NODE_TYPES, ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noCatchUnknown"

export const noCatchUnknown = createRule<Options, MessageIds>({
  name: "no-catch-unknown",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow explicit `unknown` type annotation on catch bindings. Leave catch unannotated; pair with no-throw-literal and useUnknownInCatchVariables false.",
    },
    schema: [],
    messages: {
      noCatchUnknown:
        "Do not annotate catch bindings as `unknown`. Leave the binding unannotated; pair with no-throw-literal and useUnknownInCatchVariables: false.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      CatchClause(node: TSESTree.CatchClause) {
        const param = node.param
        if (!param) return
        if (param.type !== AST_NODE_TYPES.Identifier) return
        const typeAnnotation = param.typeAnnotation
        if (typeAnnotation !== undefined && typeAnnotation.typeAnnotation.type === AST_NODE_TYPES.TSUnknownKeyword) {
          context.report({ node: param, messageId: "noCatchUnknown" })
        }
      },
    }
  },
})
