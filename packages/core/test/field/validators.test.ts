import { expect } from "jsr:@std/expect"
import { defaults, Field, FookieError, Model } from "@fookiejs/core"

Deno.test("Field with a validator passing validation", async () => {
  @Model.Decorator({
    database: defaults.database.store,
    binds: {
      create: { role: [] },
    },
  })
  class ValidatorModel extends Model {
    @Field.Decorator({
      type: defaults.type.number,
      validators: [
        (value: any) => {
          return value >= 10 && value <= 20
        },
      ],
    })
    myNumber?: number
  }

  const validResponse = await ValidatorModel.create({ myNumber: 15 })
  expect(validResponse instanceof ValidatorModel).toBe(true)
})

Deno.test("Field with a validator failing validation", async () => {
  @Model.Decorator({
    database: defaults.database.store,
    binds: {
      create: { role: [] },
    },
  })
  class ValidatorModel2 extends Model {
    @Field.Decorator({
      type: defaults.type.number,
      validators: [
        (value: any) => {
          const isValid = value >= 10 && value <= 20
          return isValid === true || "number_not_in_range"
        },
      ],
    })
    myNumber?: number
  }

  try {
    await ValidatorModel2.create({ myNumber: 25 })
    expect(false).toBe(true)
  } catch (error) {
    expect(error instanceof FookieError).toBe(true)
    expect(error.name === "validate_body").toBe(true)
    expect(error.validationErrors.myNumber[0] === "number_not_in_range").toBe(
      true,
    )
  }
})
