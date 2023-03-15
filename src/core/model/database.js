module.exports = async function (ctx) {
    await ctx.model({
        name: "database",
        database: "store",
        schema: {
            name: {
                type: "string",
                required: true,
                uniqueGroup: ["flow"],
            },
            pk: {
                type: "string",
                required: true,
            },
            types: {
                type: "array",
            },
            connect: {
                type: "function",
            },
            modify: {
                type: "function",
                required: true,
            },
            disconnect: {
                type: "function",
            },
            tag: {
                type: "string",
                default: "core"
            },
        },
        lifecycle: {
            read: {
                role: ["system"],
            },
            update: {
                role: ["system"],
            },
            create: {
                preRule: ["valid_types"],
                role: ["system"],
            },
            delete: {
                role: ["system"],
            },
            count: {
                role: ["system"],
            },
        },
        mixins: [],
    })
}
