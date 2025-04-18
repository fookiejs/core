import { plainToClass } from "class-transformer"
const entityMap = new Map<string, BaseClass[]>()
export class BaseClass {
	key!: string
	static create<T extends BaseClass>(this: new () => T, data: T): T {
		const entity = plainToClass(this, data)
		if (!entityMap.has(this.name)) {
			entityMap.set(this.name, [entity])
		} else {
			const list = entityMap.get(this.name) ?? []
			entityMap.set(this.name, [...list, entity])
		}
		return entity
	}
	static list<T extends BaseClass>(this: new () => T): T[] {
		const list = entityMap.has(this.name) ? entityMap.get(this.name) : []
		return list as T[]
	}
}
