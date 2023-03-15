module.exports = async function (ctx) {
    await ctx.model({
        name: "setting",
        database: "store",
        schema: {
            name: {
                type: "string",
                required: true,
                unique: true,
            },
            description: {
                type: "string",
            },
            value: {
                type: "object",
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
