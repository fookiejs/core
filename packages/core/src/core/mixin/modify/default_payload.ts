import * as lodash from "https://raw.githubusercontent.com/lodash/lodash/4.17.21-es/lodash.js"
import { Rule } from "../../lifecycle-function.ts"
import { v4 } from "uuid"

export default Rule.create({
  key: "defalut_payload",
  execute: async function (payload) {
    const newPayload = lodash.merge(payload, {
      options: {},
      body: {},
      query: {
        attributes: [],
      },
      runId: "run:" + v4().replace("-", ""),
    })

    if (!lodash.has(newPayload.query, "filter")) {
      newPayload.query.filter = {}
    }

    for (const key in newPayload) {
      ;(payload as Record<string, any>)[key] = (
        newPayload as Record<string, any>
      )[key]
    }

    if (!lodash.has(payload.query, "offset")) {
      payload.query.offset = 0
    }
    if (!lodash.has(payload.query, "limit")) {
      payload.query.limit = Infinity
    }

    if ((payload.query.attributes || []).length == 0) {
      payload.query.attributes = lodash.keys(payload.model.schema())
    }
    return true
  },
})
