export enum Lifecycle {
    MODIFY = "modify",
    ROLE = "role",
    RULE = "rule",
    METHOD = "method",
    FILTER = "filter",
    EFFECT = "effect",
}

export const lifecycles: Lifecycle[] = [
    Lifecycle.MODIFY,
    Lifecycle.ROLE,
    Lifecycle.RULE,
    Lifecycle.METHOD,
    Lifecycle.FILTER,
    Lifecycle.EFFECT,
] as const
