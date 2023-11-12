import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("Missing preRule", async function () {
    await Fookie.run({
        model: "model",
        method: Fookie.Method.Create,
        body: {
            name: "missing_ls_model_1",
            database: Fookie.Dictionary.Database.store,
            schema: {
                fieid: {
                    type: Fookie.Dictionary.Type.text,
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
        const res = await Fookie.run({
            model: "missing_ls_model_1",
            method: "read",
        })
        throw Error("Missign lifecycle throw error.")
    } catch (error) {}
})

it("Missing modify", async function () {
    await Fookie.run({
        model: "model",
        method: Fookie.Method.Create,
        body: {
            name: "missing_ls_model_2",
            database: Fookie.Dictionary.Database.store,
            schema: {
                fieid: {
                    type: Fookie.Dictionary.Type.text,
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
        const res = await Fookie.run({
            model: "missing_ls_model_2",
            method: "read",
        })
        throw Error("Missign lifecycle throw error.")
    } catch (error) {}
})

it("Missing rule", async function () {
    await Fookie.run({
        model: "model",
        method: Fookie.Method.Create,
        body: {
            name: "missing_ls_model_3",
            database: Fookie.Dictionary.Database.store,
            schema: {
                fieid: {
                    type: Fookie.Dictionary.Type.text,
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
        const res = await Fookie.run({
            model: "missing_ls_model_3",
            method: "read",
        })
        throw Error("Missign ls throw error.")
    } catch (error) {}
})

it("Missing role", async function () {
    await Fookie.run({
        model: "model",
        method: Fookie.Method.Create,
        body: {
            name: "missing_ls_model_4",
            database: Fookie.Dictionary.Database.store,
            schema: {
                fieid: {
                    type: Fookie.Dictionary.Type.text,
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
        const res = await Fookie.run({
            model: "missing_ls_model_4",
            method: "read",
        })
        throw Error("Missign lifecycle throw error.")
    } catch (error) {}
})

it("Missing filter", async function () {
    await Fookie.run({
        model: "model",
        method: Fookie.Method.Create,
        body: {
            name: "missing_ls_model_5",
            database: Fookie.Dictionary.Database.store,
            schema: {
                fieid: {
                    type: Fookie.Dictionary.Type.text,
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
        const res = await Fookie.run({
            model: "missing_ls_model_5",
            method: "read",
        })
        throw Error("Missign lifecycle throw error.")
    } catch (error) {}
})

it("Missing effect", async function () {
    await Fookie.run({
        model: "model",
        method: Fookie.Method.Create,
        body: {
            name: "missing_ls_model_6",
            database: Fookie.Dictionary.Database.store,
            schema: {
                fieid: {
                    type: Fookie.Dictionary.Type.text,
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
        const res = await Fookie.run({
            model: "missing_ls_model_6",
            method: "read",
        })
        throw Error("Missign lifecycle throw error.")
    } catch (error) {}
})
