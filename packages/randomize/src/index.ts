import { type BindsType, type Database, Field, Lifecycle, Method, Model, Type } from "@fookiejs/core"
import { v4 } from "uuid"
import * as lodash from "https://raw.githubusercontent.com/lodash/lodash/4.17.21-es/lodash.js"

export class Randomize {
  static generateRandomModel(database: Database, fieldCount = 5): typeof Model {
    const fieldTypes = Type.list()

    const binds: BindsType = {
      [Method.CREATE]: {
        [Lifecycle.RULE]: [],
        [Lifecycle.ROLE]: [],
        [Lifecycle.MODIFY]: [],
        [Lifecycle.FILTER]: [],
        [Lifecycle.EFFECT]: [],
      },
      [Method.READ]: {
        [Lifecycle.RULE]: [],
        [Lifecycle.ROLE]: [],
        [Lifecycle.MODIFY]: [],
        [Lifecycle.FILTER]: [],
      },
      [Method.UPDATE]: {
        [Lifecycle.RULE]: [],
        [Lifecycle.ROLE]: [],
        [Lifecycle.MODIFY]: [],
        [Lifecycle.FILTER]: [],
        [Lifecycle.EFFECT]: [],
      },
      [Method.DELETE]: {
        [Lifecycle.RULE]: [],
        [Lifecycle.ROLE]: [],
        [Lifecycle.MODIFY]: [],
        [Lifecycle.FILTER]: [],
        [Lifecycle.EFFECT]: [],
      },
    }

    @Model.Decorator({ name: "RandomModel_" + v4(), database, binds })
    class RandomModel extends Model {}

    for (let i = 0; i < fieldCount; i++) {
      const fieldName = `field_${i}`
      const fieldType = lodash.sample(fieldTypes)

      Field.Decorator({
        type: fieldType,
      })(RandomModel.prototype, fieldName)
    }

    return RandomModel
  }

  static generateRandomRequest(): void {
    return
  }
}
