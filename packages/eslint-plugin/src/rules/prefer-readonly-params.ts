import { AST_NODE_TYPES, ESLintUtils, TSESTree } from "@typescript-eslint/utils"

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/fookiejs/eslint-plugin-fookie/blob/main/README.md`,
)

type Options = []
type MessageIds = "preferReadonlyParams"

function hasReadonlyModifier(typeAnnotation: TSESTree.TSTypeAnnotation): boolean {
  const t = typeAnnotation.typeAnnotation
  if (t.type === AST_NODE_TYPES.TSTypeOperator && t.operator === "readonly") return true
  return false
}

function isArrayType(t: TSESTree.TypeNode): boolean {
  return t.type === AST_NODE_TYPES.TSArrayType || t.type === AST_NODE_TYPES.TSTupleType
}

function isGenericArray(t: TSESTree.TypeNode): t is TSESTree.TSTypeReference {
  if (t.type !== AST_NODE_TYPES.TSTypeReference) return false
  const name = t.typeName
  if (name.type !== AST_NODE_TYPES.Identifier) return false
  return name.name === "Array" || name.name === "ReadonlyArray"
}

export const preferReadonlyParams = createRule<Options, MessageIds>({
  name: "prefer-readonly-params",
  meta: {
    type: "suggestion",
    docs: {
      description: "Require array function parameters to be typed as readonly",
    },
    schema: [],
    messages: {
      preferReadonlyParams:
        "Array parameter '{{name}}' should be typed as readonly: 'readonly {{type}}'.",
    },
  },
  defaultOptions: [],
  create(context) {
    function checkParam(param: TSESTree.Parameter) {
      if (param.type !== AST_NODE_TYPES.Identifier) return
      const ann = param.typeAnnotation
      if (!ann) return

      const t = ann.typeAnnotation

      if (isArrayType(t)) {
        context.report({
          node: param,
          messageId: "preferReadonlyParams",
          data: {
            name: param.name,
            type: context.sourceCode.getText(t),
          },
        })
        return
      }

      if (isGenericArray(t) && t.typeName.type === AST_NODE_TYPES.Identifier) {
        const typeName = t.typeName
        if (typeName.name === "Array") {
          context.report({
            node: param,
            messageId: "preferReadonlyParams",
            data: {
              name: param.name,
              type: context.sourceCode.getText(t),
            },
          })
        }
      }
    }

    function checkFunction(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ) {
      for (const param of node.params) {
        if (param.type === AST_NODE_TYPES.RestElement) {
          const inner = param.argument
          if (inner.type === AST_NODE_TYPES.Identifier) {
            const ann = inner.typeAnnotation
            if (!ann) continue
            const t = ann.typeAnnotation
            if (isArrayType(t) || isGenericArray(t)) {
              if (!hasReadonlyModifier(ann)) {
                context.report({
                  node: param,
                  messageId: "preferReadonlyParams",
                  data: {
                    name: inner.name,
                    type: context.sourceCode.getText(t),
                  },
                })
              }
            }
          }
          continue
        }
        checkParam(param)
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    }
  },
})
