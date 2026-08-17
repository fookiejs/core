import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = [{ min: number }]
type MessageIds = "tooShort"

export const minFunctionLines = createRule<Options, MessageIds>({
  name: "min-function-lines",
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce a minimum number of lines in function bodies.",
    },
    schema: [
      {
        type: "object",
        properties: {
          min: { type: "number", minimum: 1 },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      tooShort:
        "Function body is too short ({{actual}} lines). Minimum is {{min}} lines.",
    },
  },
  defaultOptions: [{ min: 7 }],
  create(context, [{ min }]) {
    function check(body: TSESTree.BlockStatement | TSESTree.Expression | null): void {
      if (!body || body.type !== "BlockStatement") return
      const lines = body.loc.end.line - body.loc.start.line - 1
      if (lines < min) {
        context.report({
          node: body,
          messageId: "tooShort",
          data: { actual: lines, min },
        })
      }
    }

    return {
      FunctionDeclaration(node) { check(node.body) },
      FunctionExpression(node) { check(node.body) },
      ArrowFunctionExpression(node) { check(node.body) },
    }
  },
})
