import { BaseClass } from "./base-class"
import { Model } from "./model"

export class Query<Entity extends Model> extends BaseClass {
    filter: {
        [key in keyof Entity]?: {
            eq?: Entity[key]
            ne?: Entity[key]
            gte?: Entity[key]
            lte?: Entity[key]
            gt?: Entity[key]
            lt?: Entity[key]
            in?: Entity[key][]
            notIn?: Entity[key][]
        }
    } = {}
}
