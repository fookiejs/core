import { nativeTypes } from "./native-types.ts"
import { advancedTypes } from "./advanced-types.ts"
import { utilTypes } from "./util-types.ts"

export const types = {
	...nativeTypes,
	...advancedTypes,
	...utilTypes,
}
