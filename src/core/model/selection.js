module.exports = async function (ctx) {
    await ctx.model({
        name: "selection",
        database: "store",
        schema: {
            name: {
                type: "string",
                required: true,
            },
            function: {
                required: true,
                type: "function",
            },
        },
        lifecycle: {
            create: {
                role: ["system"],
            },
            read: {
                role: ["system"],
            },
            update: {
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
