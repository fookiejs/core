import { ModelInterface, FieldInterface } from "@fookie/core"

export type Selection = (model: ModelInterface, field: FieldInterface) => Promise<any>
