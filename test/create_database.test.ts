import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("databae", async function () {
    await fookie.init()
    let res = await fookie.database({
        name: "example_db",
        pk: "id",
        types: ["object", "string", "number", "boolean", "function", "buffer", "array"],
        connect: async function () {},
        disconnect: async function () {},
        modify: async function (model, ctx, state) {
            model.methods.read = async function (_payload, _ctx, _state) {
                return []
            }

            model.methods.create = async function (_payload, _ctx, _state) {
                return {}
            }

            model.methods.update = async function (_payload, _ctx, _state) {
                return true
            }

            model.methods.delete = async function (_payload, _ctx, _state) {
                return true
            }

            model.methods.count = async function (_payload, _ctx, _state) {
                return 1
            }
        },
    })
    assert.equal(res.status, true)
})
