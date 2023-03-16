import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("async effect", async function () {
    const c_res = await fookie.remote.create("lifecycle", {
        name: "example_ls_remote",
        function: async function () {},
    })
    assert.equal(true, lodash.isObject(c_res))

    const g_res = await fookie.remote.get("lifecycle", c_res.id)
    assert.equal(true, lodash.isObject(g_res))

    const u_res = await fookie.remote.update("lifecycle", c_res.id, {
        name: "example_ls_remote",
        function: async function () {},
    })
    assert.equal(true, lodash.isBoolean(u_res))

    const r_res = await fookie.remote.random("lifecycle")
    assert.equal(true, lodash.isObject(r_res))
})
