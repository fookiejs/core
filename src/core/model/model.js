module.exports = {
    name: "model",
    database: "store",
    schema: {
        name: {
            required: true,
            type: "string",
        },
        database: {
            required: true,
            type: "string",
            default: "store",
        },
        schema: {
            required: true,
            type: "object",
        },
        lifecycle: {
            required: true,
            type: "object",
        },
        methods: {
            type: "object",
            required: true,
            default: {},
        },
        mixins: {
            type: "array",
            default: [],
            required: true,
        },
    },
    lifecycle: {
        read: {
            role: ["everybody"],
            filter: [],
        },
        update: {
            modify: [],
            role: ["system"],
            rule: [],
            preRule: [],
            effect: [],
        },
        create: {
            modify: ["set_mixin", "fix_schema", "database_modify"],
            role: ["system"],
            rule: ["has_database"],
            preRule: ["has_database", "has_mixin"]
        },
        delete: {
            role: ["system"],
        },
        count: {
            role: ["everybody"],
        },
    },
    methods: {},
    mixins: [],
}
