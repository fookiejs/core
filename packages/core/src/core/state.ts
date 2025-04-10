import { Role } from "./lifecycle-function.ts"

export class State {
	cachedResponse?: string
	acceptedRoles: Role[] = []
	rejectedRoles: Role[] = []
}
