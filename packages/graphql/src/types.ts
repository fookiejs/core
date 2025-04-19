import { Model } from "@fookiejs/core"
import { TypeStandartization } from "@fookiejs/core"

export type ScalarOperations = {
	equals?: boolean
	notEquals?: boolean
	gt?: boolean
	gte?: boolean
	lt?: boolean
	lte?: boolean
	in?: boolean
	notIn?: boolean
	like?: boolean
	isNull?: boolean
}

export interface TypeField {
	value: TypeStandartization | string
	field?: any
	is_pk?: boolean
	all?: boolean
	sum?: boolean
	count?: boolean
	model?: typeof Model
	operations?: ScalarOperations
	isArray?: boolean
	args?: Record<string, TypeField>
}

export interface QueryField {
	value: string
	args?: Record<string, TypeField>
}

export interface MutationField {
	value: string
	args?: Record<string, TypeField>
}

export interface SubscriptionField {
	value: string
	args?: Record<string, TypeField>
}

export interface TypeDefs {
	input: Record<string, Record<string, TypeField>>
	type: Record<string, Record<string, TypeField>>
	Query: Record<string, QueryField>
	Mutation: Record<string, MutationField>
	Subscription: Record<string, SubscriptionField>
}

export interface AsyncIteratorLike<T> {
	next(): Promise<{ value: T; done: boolean }>
	return?(value?: T): Promise<{ value: T; done: boolean }>
	throw?(error: any): Promise<{ value: T; done: boolean }>
}

export interface SubscriptionResolver<TPayload = any> {
	subscribe: (
		parent: any,
		args: any,
		context: any,
	) => Promise<AsyncIteratorLike<TPayload>> | AsyncIteratorLike<TPayload>
	resolve?: (payload: TPayload) => any
}

export interface Resolvers {
	Query: Record<string, (parent: any, args: any, context: any) => Promise<any> | any>
	Mutation: Record<string, (parent: any, args: any, context: any) => Promise<any> | any>
	Subscription: Record<string, SubscriptionResolver>
	[key: string]: any
}

export type CreateTypeDefsOptions = {
	excludeFields?: string[]
	includeFields?: string[]
	operations?: ScalarOperations
	isInput?: boolean
}

export interface GraphQLTypeBuilder {
	createTypeDefs(model: typeof Model, options?: CreateTypeDefsOptions): Partial<TypeDefs>
	createResolvers(model: typeof Model): Partial<Resolvers>
}
