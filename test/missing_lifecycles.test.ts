import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "@fookie/core"
import { Store, database } from "@fookie/database"
import { Model, Field } from "@fookie/decorator"
import { Create, Read, Count, Delete, Test, Update } from "@fookie/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "@fookie/type"
import { mixin, After, Before } from "@fookie/mixin"

it("Missing preRule", async function () {
    await run({
        model: "model",
        method: Create,
        body: {
            name: "missing_ls_model_1",
            database: Store,
            schema: {
                fieid: {
                    type: Text,
                },
            },
            lifecycle: {
                read: {
                    preRule: ["not_existed_ls_1"],
                },
            },
        },
    })

    try {
        const res = await run({
            model: "missing_ls_model_1",
            method: "read",
        })
        throw Error("Missign lifecycle throw error.")
    } catch (error) {}
})

it("Missing modify", async function () {
    await run({
        model: "model",
        method: Create,
        body: {
            name: "missing_ls_model_2",
            database: Store,
            schema: {
                fieid: {
                    type: Text,
                },
            },
            lifecycle: {
                read: {
                    modify: ["not_existed_ls_1"],
                },
            },
        },
    })

    try {
        const res = await run({
            model: "missing_ls_model_2",
            method: "read",
        })
        throw Error("Missign lifecycle throw error.")
    } catch (error) {}
})

it("Missing rule", async function () {
    await run({
        model: "model",
        method: Create,
        body: {
            name: "missing_ls_model_3",
            database: Store,
            schema: {
                fieid: {
                    type: Text,
                },
            },
            lifecycle: {
                read: {
                    rule: ["not_existed_ls_1"],
                },
            },
        },
    })

    try {
        const res = await run({
            model: "missing_ls_model_3",
            method: "read",
        })
        throw Error("Missign ls throw error.")
    } catch (error) {}
})

it("Missing role", async function () {
    await run({
        model: "model",
        method: Create,
        body: {
            name: "missing_ls_model_4",
            database: Store,
            schema: {
                fieid: {
                    type: Text,
                },
            },
            lifecycle: {
                read: {
                    role: ["not_existed_ls_1"],
                },
            },
        },
    })

    try {
        const res = await run({
            model: "missing_ls_model_4",
            method: "read",
        })
        throw Error("Missign lifecycle throw error.")
    } catch (error) {}
})

it("Missing filter", async function () {
    await run({
        model: "model",
        method: Create,
        body: {
            name: "missing_ls_model_5",
            database: Store,
            schema: {
                fieid: {
                    type: Text,
                },
            },
            lifecycle: {
                read: {
                    filter: ["not_existed_ls_1"],
                },
            },
        },
    })

    try {
        const res = await run({
            model: "missing_ls_model_5",
            method: "read",
        })
        throw Error("Missign lifecycle throw error.")
    } catch (error) {}
})

it("Missing effect", async function () {
    await await run({
        model: "model",
        method: Create,
        body: {
            name: "missing_ls_model_6",
            database: Store,
            schema: {
                fieid: {
                    type: Text,
                },
            },
            lifecycle: {
                read: {
                    effect: ["not_existed_ls_1"],
                },
            },
        },
    })

    try {
        const res = await run({
            model: "missing_ls_model_6",
            method: "read",
        })
        throw Error("Missign lifecycle throw error.")
    } catch (error) {}
})
