import * as lodash from "https://raw.githubusercontent.com/lodash/lodash/4.17.21-es/lodash.js"
import { Rule } from "../../lifecycle-function.ts"
import { Config } from "../../config.ts"
import type { Model } from "../../model/model.ts"
import type { Method } from "../../method.ts"

export default Rule.create<Model, Method>({
  key: "uniqueGroup",
  execute: async function (payload) {
    const schema = payload.model.schema()
    const fields = lodash.keys(payload.body) as (keyof Model)[]
    let groups: string[] = []

    for (const field of fields) {
      const fieldSchema = schema[field as keyof typeof schema]
      if (fieldSchema?.uniqueGroup) {
        groups = lodash.uniq(groups.concat(fieldSchema.uniqueGroup))
      }
    }

    for (const group of groups) {
      const filter: Record<string, { equals: unknown }> = {}

      for (const field of Object.keys(schema)) {
        const fieldSchema = schema[field as keyof typeof schema]
        if (
          fieldSchema?.uniqueGroup?.includes(group) &&
          field in payload.body
        ) {
          filter[field] = { equals: payload.body[field as keyof Model] }
        }
      }

      const res = await payload.model.read(
        { filter },
        { sub: Config.SYSTEM_TOKEN },
      )

      return Array.isArray(res) && res.length == 0
    }

    return true
  },
})
