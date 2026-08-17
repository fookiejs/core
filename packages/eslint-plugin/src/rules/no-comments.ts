import { ESLintUtils } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noComment"

export const noComments = createRule<Options, MessageIds>({
  name: "no-comments",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow all comments — both line (//) and block (/* */)",
    },
    schema: [],
    messages: {
      noComment: "Comments are not allowed. Let the code speak for itself.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      Program() {
        const comments = context.sourceCode.getAllComments()
        for (const comment of comments) {
          context.report({ loc: comment.loc, messageId: "noComment" })
        }
      },
    }
  },
})
