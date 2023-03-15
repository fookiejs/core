module.exports = module.exports = async function (ctx) {
    await ctx.model({
        name: "type",
        database: "store",
        schema: {
            name: {
                type: "string",
                required: true,
                unique: true,
            },
            controller: {
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
        mixins: [],
    })
}
