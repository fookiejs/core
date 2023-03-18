import { it, describe, assert } from "vitest"
import { model, run, models, database } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
import * as lodash from "lodash"

it("database", async function () {
    let res = database({
        pk: "id",
        types: [Text],
        connect: async function () {},
        disconnect: async function () {},
        modify: function (model) {
            model.methods.create = async function (_payload, _state) {
                return {}
            }
            model.methods.read = async function (_payload, _state) {
                return []
            }

            model.methods.update = async function (_payload, _state) {
                return true
            }

            model.methods.delete = async function (_payload, _state) {
                return true
            }

            model.methods.count = async function (_payload, _state) {
                return 1
            }
        },
    })
    assert.equal(res.pk, "id")
})
