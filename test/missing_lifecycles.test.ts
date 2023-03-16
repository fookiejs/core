import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("Missing preRule", async function () {
    await init
    await run({
        token: "system_token",
        model: "model",
        method: "create",
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
    await init
    await run({
        token: "system_token",
        model: "model",
        method: "create",
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
    await init
    await run({
        token: "system_token",
        model: "model",
        method: "create",
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
    await init
    await run({
        token: "system_token",
        model: "model",
        method: "create",
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
    await init
    await run({
        token: "system_token",
        model: "model",
        method: "create",
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
        token: "system_token",
        model: "model",
        method: "create",
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
