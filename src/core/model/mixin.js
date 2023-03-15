module.exports = module.exports = async function (ctx) {
    await ctx.model({
        name: "mixin",
        database: "store",
        schema: {
            name: {
                type: "string",
                required: true,
                unique: true,
            },
            object: {
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
                effect: ["update_models"],
            },
            create: {
                role: ["system"],
            },
            delete: {
                role: ["system"],
                rule: ["in_mixin_use"],
            },
            count: {
                role: ["system"],
            },
        },
        mixins: [],
    })
}
