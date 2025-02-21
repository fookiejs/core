import { Model } from "./model"

type FieldOperators<T> = T extends string
    ? {
          $eq?: T
          $ne?: T
          $like?: string
          $in?: T[]
          $nin?: T[]
      }
    : T extends number | Date
      ? {
            $eq?: T
            $ne?: T
            $gt?: T
            $lt?: T
            $gte?: T
            $lte?: T
            $in?: T[]
            $nin?: T[]
        }
      : T extends boolean
        ? {
              $eq?: boolean
          }
        : {
              $eq?: T
              $ne?: T
          }

export type QueryFilter<M extends Model> = {
    [K in keyof M]?: FieldOperators<M[K]>
}

export class Query<M extends Model> {
    constructor(
        public filter?: QueryFilter<M>,
        public options?: {
            limit?: number
            offset?: number
            orderBy?: keyof M
            sort?: "asc" | "desc"
        },
    ) {}
}
