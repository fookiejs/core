import { string } from "../../../defaults/type/string"
import * as lodash from "lodash"
import { Field } from "../field"

export function fillSchema(field: Field): Field {
    if (!lodash.has(field, "type")) {
        field.type = string
    }

    if (!lodash.has(field, "read")) {
        field.read = []
    }

    if (!lodash.has(field, "write")) {
        field.write = []
    }

    if (!lodash.has(field, "features")) {
        field.features = []
    }

    if (field.relation) {
        field.type = string
    }

    return field
}
