import { expect } from "jsr:@std/expect"
import { defaults, Field, FookieError, Model } from "@fookiejs/core"

@Model.Decorator({
  database: defaults.database.store,
  binds: {
    create: { role: [] },
  },
})
class UniqueGroupField extends Model {
  @Field.Decorator({
    uniqueGroup: ["groupId", "itemName"],
    type: defaults.type.string,
  })
  itemName?: string

  @Field.Decorator({ type: defaults.type.string })
  groupId?: string
}

const groupId = "group1"

Deno.test("Define a unique group field with Error", async () => {
  const firstResponse = await UniqueGroupField.create({
    groupId,
    itemName: "item1",
  })

  expect(firstResponse instanceof UniqueGroupField).toBe(true)

  try {
    await UniqueGroupField.create({
      groupId,
      itemName: "item1",
    })
  } catch (error) {
    expect(error instanceof FookieError).toBe(true)
    expect(error.name === "uniqueGroup").toBe(true)
  }
})
