export enum Method {
    CREATE = "create",
    READ = "read",
    UPDATE = "update",
    DELETE = "delete",
}

export const methods: Method[] = [Method.CREATE, Method.READ, Method.UPDATE, Method.DELETE] as const
