import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"

it("Missing preRule", async function () {
    await run({
        model: "model",
        method: Create,
        body: {
            name: "missing_ls_model_1",
            database: Database.Store,
            schema: {
                fieid: {
                    type: Type.Text,
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
            database: Database.Store,
            schema: {
                fieid: {
                    type: Type.Text,
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
            database: Database.Store,
            schema: {
                fieid: {
                    type: Type.Text,
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
            database: Database.Store,
            schema: {
                fieid: {
                    type: Type.Text,
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
            database: Database.Store,
            schema: {
                fieid: {
                    type: Type.Text,
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
            database: Database.Store,
            schema: {
                fieid: {
                    type: Type.Text,
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
