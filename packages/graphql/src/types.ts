export type Resolvers = {
	Query: Record<string, any>
	Mutation: Record<string, any>
	[key: string]: Record<string, any> // Dinamik model isimleri için
}

export type TypeDefs = {
	input: Record<string, Record<string, any>>
	type: Record<string, Record<string, any>>
	Query: Record<string, any>
	Mutation: Record<string, any>
}
