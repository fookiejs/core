export enum Method {
    CREATE = "create",
    READ = "read",
    UPDATE = "update",
    DELETE = "delete",
    COUNT = "count",
    SUM = "sum",
}

export const methods: Method[] = [
    Method.CREATE,
    Method.READ,
    Method.UPDATE,
    Method.DELETE,
    Method.COUNT,
    Method.SUM,
] as const
