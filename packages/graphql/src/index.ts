import * as lodash from "https://raw.githubusercontent.com/lodash/lodash/4.17.21-es/lodash.js"

import { ApolloServer } from "npm:@apollo/server"
import { defaults, models } from "@fookiejs/core"

const filter_types = `
input string_filter {
  equals: String
  notEquals: String
  in: [String]
  notIn: [String]
  like: String
  notLike: String
  isNull: Boolean
  isNotNull: Boolean
  gte: String
  gt: String
  lte: String
  lt: String
}

input int_filter {
  equals: Int
  notEquals: Int
  in: [Int]
  notIn: [Int]
  gte: Int
  gt: Int
  lte: Int
  lt: Int
  isNull: Boolean
  isNotNull: Boolean
}

input float_filter {
  equals: Float
  notEquals: Float
  in: [Float]
  notIn: [Float]
  gte: Float
  gt: Float
  lte: Float
  lt: Float
  isNull: Boolean
  isNotNull: Boolean
}

input boolean_filter {
  equals: Boolean
  notEquals: Boolean
  isNull: Boolean
  isNotNull: Boolean
}

input date_filter {
  equals: String
  notEquals: String
  gte: String
  gt: String
  lte: String
  lt: String
  isNull: Boolean
  isNotNull: Boolean
}
`

// Resolver ve TypeDefs için tip tanımları
type Resolvers = {
	Query: Record<string, any>
	Mutation: Record<string, any>
	[key: string]: Record<string, any> // Dinamik model isimleri için
}

type TypeDefs = {
	input: Record<string, Record<string, any>>
	type: Record<string, Record<string, any>>
	Query: Record<string, any>
	Mutation: Record<string, any>
}

function resolve_type(field: any): string {
	if (!field || !field.type) return "String"

	switch (field.type.key) {
		case "string":
			return "String"
		case "number":
			return "Float"
		case "boolean":
			return "Boolean"
		case "date":
			return "String"
		case "array":
			return "[String]"
		case "object":
			return "String"
		default:
			return "String"
	}
}

// Tip bazlı filtre dönüşümü
function resolve_input(typeStr: string): string {
	if (typeStr === "String") return "string_filter"
	if (typeStr === "Int") return "int_filter"
	if (typeStr === "Float") return "float_filter"
	if (typeStr === "Boolean") return "boolean_filter"
	if (typeStr === "Date") return "date_filter"
	return "string_filter" // Varsayılan
}

export function create(): ApolloServer {
	const typeDefs: TypeDefs = {
		input: {},
		type: {},
		Query: {},
		Mutation: {},
	}

	const resolvers: Resolvers = {
		Query: {},
		Mutation: {},
	}

	for (const model of models) {
		if (model.getName() === "Query") {
			throw Error("Model name can not be 'Query'")
		}

		const typeFields: Record<string, any> = {}
		const inputFields: Record<string, any> = {}

		const pk_field = {
			type: defaults.type.string,
			required: true,
		}

		typeFields["id"] = {
			value: resolve_type(pk_field),
			field: pk_field,
			is_pk: true,
		}

		const schema = model.schema() as Record<string, any>
		for (const field of lodash.keys(schema)) {
			const fieldConfig = schema[field] as any
			const temp_type = resolve_type(fieldConfig)
			const temp_input = temp_type

			if ((schema[field] as any).relation) {
				typeFields[`${field}_entity`] = {
					value: `${(schema[field] as any).relation.getName()}`,
				}
			}

			typeFields[field] = { value: temp_type, field: fieldConfig }
			inputFields[field] = { value: temp_input, field: fieldConfig }

			if ((schema[field] as any).relation) {
				if (!resolvers[model.getName()]) {
					resolvers[model.getName()] = {}
				}

				resolvers[model.getName()][field + "_entity"] = async function (
					parent: any,
					_: any,
					context: any,
				) {
					if (!parent[field]) return null

					const response = await fieldConfig.relation.read(
						{
							filter: {
								id: { equals: parent[field] },
							},
						},
						{ token: context.token || "" },
					)

					return Array.isArray(response) ? response[0] : null
				}
			}
		}

		typeDefs.input[model.getName()] = inputFields
		typeDefs.type[model.getName()] = typeFields
		typeDefs.Query[model.getName()] = { value: `${model.getName()}_query` }

		resolvers.Query[model.getName()] = async function (
			_: any,
			{ query }: any,
			context: any,
		) {
			const response = await model.read(query || {}, {
				token: context.token || "",
			})
			return Array.isArray(response) ? response : []
		}
	}

	for (const model of models) {
		const schema = model.schema() as Record<string, any>

		for (const field of lodash.keys(schema)) {
			if ((schema[field] as any).relation) {
				const relatedModel = (schema[field] as any).relation

				if (!typeDefs.type[relatedModel.getName()]) continue

				typeDefs.type[relatedModel.getName()]["all_" + model.getName()] = {
					value: `[${model.getName()}]`,
					all: true,
					model: model,
				}

				typeDefs.type[relatedModel.getName()]["sum_" + model.getName()] = {
					sum: true,
					model: model,
				}

				typeDefs.type[relatedModel.getName()]["count_" + model.getName()] = {
					count: true,
					model: model,
				}

				if (!resolvers[relatedModel.getName()]) {
					resolvers[relatedModel.getName()] = {}
				}

				resolvers[relatedModel.getName()]["all_" + model.getName()] = async function (
					parent: any,
					payload: any,
					context: any,
				) {
					const query: any = lodash.omit(payload.query, field)
					if (!query.filter) {
						query.filter = {}
					}

					query.filter[field] = { equals: parent.id }

					const response = await model.read(query, {
						token: context.token || "",
					})
					return Array.isArray(response) ? response : []
				}

				resolvers[relatedModel.getName()]["sum_" + model.getName()] = async function (
					parent: any,
					payload: any,
					context: any,
				) {
					if (!payload.field) return 0

					const query: any = lodash.omit(payload.query, field)
					if (!query.filter) {
						query.filter = {}
					}

					query.filter[field] = { equals: parent.id }

					let sum = 0
					const items = await model.read(query, {
						token: context.token || "",
					})

					if (Array.isArray(items)) {
						sum = items.reduce(
							(total, item: any) => total + (Number((item as any)[payload.field]) || 0),
							0,
						)
					}

					return sum
				}

				resolvers[relatedModel.getName()]["count_" + model.getName()] = async function (
					parent: any,
					payload: any,
					context: any,
				) {
					const query: any = lodash.omit(payload.query, field)
					if (!query.filter) {
						query.filter = {}
					}

					query.filter[field] = { equals: parent.id }

					const items = await model.read(query, {
						token: context.token || "",
					})
					return Array.isArray(items) ? items.length : 0
				}
			}
		}
	}

	let result = "\n"

	//QUERY
	result += "type Query {\n"

	for (const typeName in typeDefs.Query) {
		result += `  ${typeName}(query: ${typeDefs.Query[typeName].value}): [${typeName}]\n`
	}
	result += "}\n"

	//TYPE
	for (const typeName in typeDefs.type) {
		result += `type ${typeName} {\n`

		for (const field in typeDefs.type[typeName]) {
			if (typeDefs.type[typeName][field].all) {
				const model = typeDefs.type[typeName][field].model
				result += `  ${field}(query: ${model.getName()}_query): ${typeDefs.type[typeName][field].value}\n`
			} else if (typeDefs.type[typeName][field].sum) {
				const model = typeDefs.type[typeName][field].model
				result += `  ${field}(query: ${model.getName()}_query, field:String): Float\n`
			} else if (typeDefs.type[typeName][field].count) {
				const model = typeDefs.type[typeName][field].model
				result += `  ${field}(query: ${model.getName()}_query): Int\n`
			} else {
				result += `  ${field}: ${typeDefs.type[typeName][field].value}\n`
			}
		}

		result += "}\n"
	}

	// FILTER INPUT
	for (const typeName in typeDefs.type) {
		result += `input ${typeName}_filter {\n`

		for (const field in typeDefs.type[typeName]) {
			result += `  ${field}: ${
				resolve_input(
					typeDefs.type[typeName][field].value,
				)
			}\n`
		}

		result += "}\n"
	}

	// FILTER QUERY
	for (const typeName in typeDefs.input) {
		result += `input ${typeName}_query {
    offset: Int,
    limit: Int,
    filter: ${typeName}_filter
        }\n`
	}

	// CREATE INPUT
	for (const typeName in typeDefs.input) {
		result += `input ${typeName}_input {\n`

		for (const field in typeDefs.input[typeName]) {
			if (field === "id") continue

			result += `  ${field}: ${typeDefs.input[typeName][field].value}\n`
		}

		result += "}\n"
	}

	// Mutations type
	result += "type Mutation {\n"

	for (const typeName in typeDefs.input) {
		result += `  create_${typeName}(body: ${typeName}_input): ${typeName}\n`
		result += `  update_${typeName}(query: ${typeName}_query, body: ${typeName}_input): Boolean\n`
		result += `  delete_${typeName}(query: ${typeName}_query): Boolean\n`
		result += `  count_${typeName}(query: ${typeName}_query): Int\n`
		result += `  sum_${typeName}(query: ${typeName}_query , field: String): Float\n`

		const modelClass = models.find((m) => m.getName() === typeName)

		if (!modelClass) continue

		resolvers.Mutation[`create_${typeName}`] = async function (
			_: any,
			{ body }: any,
			context: any,
		) {
			try {
				const response = await modelClass.create(body, {
					token: context.token || "",
				})
				return response
			} catch (error: any) {
				// Hata tipini belirt
				throw new Error(error?.message || "Creation failed")
			}
		}

		resolvers.Mutation[`update_${typeName}`] = async function (
			_: any,
			{ query, body }: any,
			context: any,
		) {
			try {
				await modelClass.update(query || {}, body, {
					token: context.token || "",
				})
				return true
			} catch (error: any) {
				throw new Error(error?.message || "Update failed")
			}
		}

		resolvers.Mutation[`delete_${typeName}`] = async function (
			_: any,
			{ query }: any,
			context: any,
		) {
			try {
				await modelClass.delete(query || {}, { token: context.token || "" })
				return true
			} catch (error: any) {
				throw new Error(error?.message || "Delete failed")
			}
		}

		resolvers.Mutation[`count_${typeName}`] = async function (
			_: any,
			{ query }: any,
			context: any,
		) {
			try {
				const items = await modelClass.read(query || {}, {
					token: context.token || "",
				})
				return Array.isArray(items) ? items.length : 0
			} catch (error: any) {
				throw new Error(error?.message || "Count failed")
			}
		}

		resolvers.Mutation[`sum_${typeName}`] = async function (
			_: any,
			{ query, field }: any,
			context: any,
		) {
			if (!field) return 0

			try {
				const items = await modelClass.read(query || {}, {
					token: context.token || "",
				})

				if (!Array.isArray(items)) return 0

				return items.reduce((total, item: any) => {
					return total + (Number((item as any)[field]) || 0)
				}, 0)
			} catch (error: any) {
				throw new Error(error?.message || "Sum failed")
			}
		}
		result += "\n"
	}

	result += "}\n"

	const server = new ApolloServer({
		typeDefs: `
          ${filter_types}
          ${result}
          `,
		resolvers,
	})

	return server
}
