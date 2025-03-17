export enum Lifecycle {
	MODIFY = "modify",
	ROLE = "role",
	RULE = "rule",
	FILTER = "filter",
	EFFECT = "effect",
}

export const lifecycles: Lifecycle[] = [
	Lifecycle.MODIFY,
	Lifecycle.ROLE,
	Lifecycle.RULE,
	Lifecycle.FILTER,
	Lifecycle.EFFECT,
] as const
