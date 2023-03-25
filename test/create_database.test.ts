import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle, type, database, mixin } from "../packages/core"
import { Store } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { After, Before } from "../packages/mixin"

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
})
