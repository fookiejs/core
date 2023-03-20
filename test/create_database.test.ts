import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "@fookie/core"
import { Store, database } from "@fookie/database"
import { Model, Field } from "@fookie/decorator"
import { Create, Read, Count, Delete, Test, Update } from "@fookie/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "@fookie/type"
import { mixin, After, Before } from "@fookie/mixin"

it("database", async function () {
    let res = database({
        pk: "id",
        types: [Text],
        pk_type: Text,
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
