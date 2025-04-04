export interface TypeField {
	value: string
	field?: any
	is_pk?: boolean
	all?: boolean
	sum?: boolean
	count?: boolean
	model?: any
}

interface QueryField {
	value: string
}

export interface TypeDefs {
	input: Record<string, Record<string, TypeField>>
	type: Record<string, Record<string, TypeField>>
	Query: Record<string, QueryField>
	Mutation: Record<string, string>
	Subscription: Record<string, string>
}

export interface Resolvers {
	Query: Record<string, any>
	Mutation: Record<string, any>
	Subscription: Record<string, any>
	[key: string]: any
}
