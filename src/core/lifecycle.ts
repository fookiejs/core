export type Lifecycle = "preRule" | "modify" | "role" | "rule" | "method" | "filter" | "effect";
export const lifecycles = [
    "preRule",
    "modify",
    "role",
    "rule",
    "method",
    "filter",
    "effect",
] as const;
