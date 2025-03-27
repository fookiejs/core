import { ApolloServer } from "npm:@apollo/server@4.11"
import { defaults, models, Utils } from "@fookiejs/core"
import * as collections from "@std/collections"
import { FookieDataLoader } from "./dataloader.ts"
import { Resolvers, TypeDefs } from "./types.ts"

const graphqlNativeTypes = ["String", "Int", "Float", "Boolean", "ID"]

const filterTypeMap: Record<string, string> = {
	"String": "string_filter",
	"Int": "int_filter",
	"Float": "float_filter",
	"Boolean": "boolean_filter",
	"DateTime": "date_filter",
}

function generate_filter_types(): string {
	const fookieTypes = Object.values(defaults.type)
		.filter((t) => typeof t === "object" && t !== null && "key" in t && "queryController" in t)

	let result = ""

	const filterableTypes = graphqlNativeTypes.filter((type) => type !== "ID")

	const typeMapping = {
		"String": fookieTypes.filter((t) => resolve_type({ type: t }) === "String")[0],
		"Int": fookieTypes.filter((t) => resolve_type({ type: t }) === "Int")[0],
		"Float": fookieTypes.filter((t) => resolve_type({ type: t }) === "Float")[0],
		"Boolean": fookieTypes.filter((t) => resolve_type({ type: t }) === "Boolean")[0],
		"DateTime": fookieTypes.filter((t) => resolve_type({ type: t }) === "DateTime")[0],
	}

	const filterConfigs = filterableTypes.map((graphqlType) => {
		const name = graphqlType.toLowerCase() + "_filter"
		const fookieType = typeMapping[graphqlType]
		const fields = []

		fields.push({ name: "isNull", type: "Boolean" })
		fields.push({ name: "notIsNull", type: "Boolean" })

		if (fookieType && fookieType.queryController && Object.keys(fookieType.queryController).length > 0) {
			for (const opName of Object.keys(fookieType.queryController)) {
				if (opName === "isNull") continue
				const validator = fookieType.queryController[opName]
				if (validator && typeof validator === "object" && validator.isArray) {
					fields.push({ name: opName, type: `[${graphqlType}]` })
				} else {
					fields.push({ name: opName, type: graphqlType })
				}
			}
		} else {
			fields.push({ name: "equals", type: graphqlType })
			fields.push({ name: "notEquals", type: graphqlType })
		}

		return {
			name,
			baseType: graphqlType,
			fields,
		}
	})

	for (const config of filterConfigs) {
		result += `\ninput ${config.name} {\n`
		for (const field of config.fields) {
			result += `  ${field.name}: ${field.type}\n`
		}
		result += `}\n`
	}

	return result
}

const filter_types = generate_filter_types()

function resolve_type(field: any): string {
	if (!field || !field.type) return "String"

	if (field.type && field.type.key) {
		const key = field.type.key.toLowerCase()
		const aliases = field.type.alias || []

		if (key.includes("[]")) {
			return `[${resolve_type({ type: { key: key.replace("[]", "") } })}]`
		}

		for (const graphqlType of graphqlNativeTypes) {
			const lowerGraphqlType = graphqlType.toLowerCase()
			if (key.includes(lowerGraphqlType) || aliases.some((a) => a.toLowerCase().includes(lowerGraphqlType))) {
				return graphqlType
			}
		}

		if (key.includes("date") || key.includes("timestamp") || aliases.some((a) => a.toLowerCase().includes("date"))) {
			return "DateTime"
		}
	}

	return "String"
}

function resolve_input(typeStr: string, field: any = null): string {
	if (!typeStr) return "string_filter"

	if (field && field.field && field.field.type && field.field.type.queryController) {
		const queryController = field.field.type.queryController
		const queryControllerKeys = Object.keys(queryController)

		if (queryControllerKeys.length > 0) {
			const resolvedType = resolve_type(field.field)
			if (filterTypeMap[resolvedType]) {
				return filterTypeMap[resolvedType]
			}
		}
	}

	if (filterTypeMap[typeStr]) {
		return filterTypeMap[typeStr]
	}

	if (typeStr && typeStr.startsWith("[") && typeStr.endsWith("]")) {
		const innerType = typeStr.substring(1, typeStr.length - 1)
		return resolve_input(innerType)
	}

	return "string_filter"
}

export function createServer(): ApolloServer {
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
			type: defaults.type.text,
			required: true,
		}

		typeFields["id"] = {
			value: resolve_type(pk_field),
			field: pk_field,
			is_pk: true,
		}

		const schema = model.schema() as Record<string, any>
		for (const field of Utils.keys(schema)) {
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

					try {
						const relatedModel = fieldConfig.relation

						return await relatedModel.read({ filter: { id: { equals: parent[field] } } }, { sub: context.sub || "" })
							.then((results) => Array.isArray(results) && results.length > 0 ? results[0] : null)
					} catch (error) {
						console.error("RELATION ERROR:", error)
						return null
					}
				}

				if (field.startsWith("all_")) {
					if (!resolvers[model.getName()]) {
						resolvers[model.getName()] = {}
					}

					resolvers[model.getName()][field] = async function (
						parent: any,
						{ query = {} }: any,
						context: any,
					) {
						const sub = context.token || ""

						const queryObj: any = collections.omit(query, [field] as unknown as [])
						if (!queryObj.filter) {
							queryObj.filter = {}
						}

						queryObj.filter[field] = { equals: parent.id }

						const response = await model.read(queryObj, { sub })
						return Array.isArray(response) ? response : []
					}
				}
			}
		}

		typeDefs.input[model.getName()] = inputFields
		typeDefs.type[model.getName()] = typeFields
		typeDefs.Query[model.getName()] = { value: `${model.getName()}_query` }

		resolvers.Query[model.getName()] = async function (
			_: any,
			{ query = {} }: any,
			context: any,
		) {
			const sub = context.token || ""
			const response = await model.read(query, { sub })
			return Array.isArray(response) ? response : []
		}
	}

	for (const model of models) {
		const schema = model.schema() as Record<string, any>

		for (const field of Utils.keys(schema)) {
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
					{ query = {} }: any,
					context: any,
				) {
					const queryObj: any = collections.omit(query, [field] as unknown as [])
					if (!queryObj.filter) {
						queryObj.filter = {}
					}

					queryObj.filter[field] = { equals: parent.id }

					const response = await model.read(queryObj, {
						sub: context.sub || "",
					})
					return Array.isArray(response) ? response : []
				}

				resolvers[relatedModel.getName()]["sum_" + model.getName()] = async function (
					parent: any,
					{ query = {}, field }: any,
					context: any,
				) {
					if (!field) return 0

					const queryObj: any = collections.omit(query, [field] as unknown as [])
					if (!queryObj.filter) {
						queryObj.filter = {}
					}

					queryObj.filter[field] = { equals: parent.id }

					let sum = 0
					const items = await model.read(queryObj, {
						sub: context.sub || "",
					})

					if (Array.isArray(items)) {
						sum = items.reduce(
							(total, item: any) => total + (Number((item as any)[field]) || 0),
							0,
						)
					}

					return sum
				}

				resolvers[relatedModel.getName()]["count_" + model.getName()] = async function (
					parent: any,
					{ query = {} }: any,
					context: any,
				) {
					const queryObj: any = collections.omit(query, [field] as unknown as [])
					if (!queryObj.filter) {
						queryObj.filter = {}
					}

					queryObj.filter[field] = { equals: parent.id }

					const items = await model.read(queryObj, {
						sub: context.sub || "",
					})
					return Array.isArray(items) ? items.length : 0
				}
			}
		}
	}

	let result = "\n"

	result += "type Query {\n"

	for (const typeName in typeDefs.Query) {
		result += `  ${typeName}(query: ${typeDefs.Query[typeName].value}): [${typeName}]\n`
	}
	result += "}\n"

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

	for (const typeName in typeDefs.type) {
		result += `input ${typeName}_filter {\n`

		for (const field in typeDefs.type[typeName]) {
			result += `  ${field}: ${
				resolve_input(
					typeDefs.type[typeName][field].value,
					typeDefs.type[typeName][field].field,
				)
			}\n`
		}

		result += "}\n"
	}

	for (const typeName in typeDefs.input) {
		result += `input ${typeName}_query {
    offset: Int,
    limit: Int,
    filter: ${typeName}_filter
        }\n`
	}

	for (const typeName in typeDefs.input) {
		result += `input ${typeName}_input {\n`

		for (const field in typeDefs.input[typeName]) {
			if (field === "id") continue

			result += `  ${field}: ${typeDefs.input[typeName][field].value}\n`
		}

		result += "}\n"
	}

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
					sub: context.sub || "",
				})
				return response
			} catch (error: any) {
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
					sub: context.sub || "",
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
				await modelClass.delete(query || {}, { sub: context.sub || "" })
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
					sub: context.sub || "",
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
					sub: context.sub || "",
				})

				if (!Array.isArray(items)) return 0

				return items.reduce((total, item: any) => {
					return total + (Number((item as any)[field]) || 0)
				}, 0)
			} catch (error: any) {
				throw new Error(error?.message || "Sum failed")
			}
		}
	}

	result += "}\n"

	const server = new ApolloServer({
		typeDefs: `
		scalar DateTime
		input date_filter {
			equals: DateTime
			notEquals: DateTime
			gt: DateTime
			gte: DateTime
			lt: DateTime
			lte: DateTime
			isNull: Boolean
			notIsNull: Boolean
		}
		${filter_types}
		${result}
		`,
		resolvers: {
			...resolvers,
			DateTime: {
				serialize: (value: any) => {
					if (value instanceof Date) {
						return value.toISOString()
					}
					return value
				},
				parseValue: (value: any) => {
					return new Date(value)
				},
			},
		},
		includeStacktraceInErrorResponses: false,
	})

	return server
}

export function createDataLoader(sub: string = ""): FookieDataLoader {
	return new FookieDataLoader(async (model: any, ids) => {
		const response = await model.read(
			{
				filter: {
					id: { in: ids },
				},
			},
			{ sub },
		)
		return Array.isArray(response) ? response : []
	})
}

export function createContext(req: any): { sub: string; dataLoader: FookieDataLoader } {
	const sub = req?.headers?.authorization || ""
	return {
		sub,
		dataLoader: createDataLoader(sub),
	}
}
