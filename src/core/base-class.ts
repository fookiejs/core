import { plainToClass } from "class-transformer"

export class BaseClass {
    static new<T extends BaseClass>(this: new () => T, data: T): T {
        return plainToClass(this, data)
    }
}
