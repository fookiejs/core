import { ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "noMapSetMutation"

const MAP_MUTATING_METHODS = new Set(["set", "delete", "clear"])
const SET_MUTATING_METHODS = new Set(["add", "delete", "clear"])
const ALL_MUTATING_METHODS = new Set([...MAP_MUTATING_METHODS, ...SET_MUTATING_METHODS])

export const noMapSetMutation = createRule<Options, MessageIds>({
  name: "no-map-set-mutation",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow mutating Map and Set instances created with new Map() or new Set().",
    },
    schema: [],
    messages: {
      noMapSetMutation:
        ".{{method}}() mutates the {{collection}}. Use a new {{collection}} instance instead.",
    },
  },
  defaultOptions: [],
  create(context) {
    const mutatingRefs = new Set<TSESTree.Node>()

    return {
      VariableDeclarator(node: TSESTree.VariableDeclarator) {
        if (
          node.init &&
          node.init.type === "NewExpression" &&
          node.init.callee.type === "Identifier" &&
          (node.init.callee.name === "Map" || node.init.callee.name === "Set")
        ) {
          mutatingRefs.add(node.id)
        }
      },

      CallExpression(node: TSESTree.CallExpression) {
        if (node.callee.type !== "MemberExpression") return

        const prop = node.callee.property
        if (prop.type !== "Identifier") return
        if (!ALL_MUTATING_METHODS.has(prop.name)) return

        const obj = node.callee.object
        if (obj.type !== "Identifier") return

        const scope = context.sourceCode.getScope(node)
        let currentScope: typeof scope | null = scope

        while (currentScope) {
          const variable = currentScope.variables.find(
            (v) => v.name === obj.name,
          )
          if (variable) {
            for (const def of variable.defs) {
              if (
                def.node.type === "VariableDeclarator" &&
                def.node.init?.type === "NewExpression" &&
                def.node.init.callee.type === "Identifier"
              ) {
                const collectionName = def.node.init.callee.name
                if (collectionName === "Map" || collectionName === "Set") {
                  context.report({
                    node,
                    messageId: "noMapSetMutation",
                    data: { method: prop.name, collection: collectionName },
                  })
                  return
                }
              }
            }
            break
          }
          currentScope = currentScope.upper
        }
      },
    }
  },
})
