module.exports = module.exports = async function (ctx) {
    await ctx.model({
        name: "lifecycle",
        database: "store",
        mixins: [],
        schema: {
            name: {
                type: "string",
                required: true,
                unique: true,
            },
            wait: {
                type: "boolean",
                required: true,
                default: true,
            },
            function: {
                type: "function",
                required: true,
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
                role: ["system"],
            },
            delete: {
                role: ["system"],
            },
            count: {
                role: ["system"],
            },
        },
    })
}
