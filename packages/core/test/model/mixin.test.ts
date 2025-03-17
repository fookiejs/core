import { expect } from "jsr:@std/expect"
import { defaults, Field, Mixin, Model, Role } from "@fookiejs/core"

// Mixin tanımlama
let createFlag = false

const sampleMixin = Mixin.create({
  key: "flag",
  binds: {
    create: {
      role: [
        Role.create({
          key: "mixin_flag",
          execute: async function () {
            createFlag = true
            return true
          },
        }),
      ],
    },
  },
})

@Model.Decorator({
  database: defaults.database.store,
  binds: { create: { role: [] } },
  mixins: [sampleMixin],
})
class TestModel extends Model {
  @Field.Decorator({
    type: defaults.type.string,
    features: [defaults.feature.required],
  })
  name!: string
}

Deno.test("should merge mixin binds into model binds correctly", async () => {
  await TestModel.create({ name: "Test Name" })

  expect(createFlag).toBe(true)
})
