import { expect } from "jsr:@std/expect"
import { CoreTypes } from "../../src/defaults/type/types.ts"

Deno.test("Type Validation Tests", () => {
	Deno.test("Integer Type", () => {
		Deno.test("should validate a valid integer", () => {
			const validValue = 123
			expect(CoreTypes.Integer.validate(validValue)).toBe(true)
		})
		Deno.test("should invalidate an invalid integer", () => {
			const invalidValue = "123"
			expect(CoreTypes.Integer.validate(invalidValue)).toBe(false)
		})
	})
	Deno.test("Float Type", () => {
		Deno.test("should validate a valid float", () => {
			const validValue = 123.45
			expect(CoreTypes.Float.validate(validValue)).toBe(true)
		})
		Deno.test("should invalidate an invalid float", () => {
			const invalidValue = "123.45"
			expect(CoreTypes.Float.validate(invalidValue)).toBe(false)
		})
	})
	Deno.test("Text Type", () => {
		Deno.test("should validate a valid text", () => {
			const validValue = "hello world"
			expect(CoreTypes.String.validate(validValue)).toBe(true)
		})
		Deno.test("should invalidate an invalid text", () => {
			const invalidValue = 12345
			expect(CoreTypes.String.validate(invalidValue)).toBe(false)
		})
	})
	Deno.test("Date Type", () => {
		Deno.test("should validate a valid date", () => {
			const validValue = "2024-05-14"
			expect(CoreTypes.Date.validate(validValue)).toBe(true)
		})
		Deno.test("should invalidate an invalid date", () => {
			const invalidValue = "14-05-2024"
			expect(CoreTypes.Date.validate(invalidValue)).toBe(false)
		})
		Deno.test("should invalidate an incorrectly formatted date", () => {
			const invalidValue = "2024/05/14"
			expect(CoreTypes.Date.validate(invalidValue)).toBe(false)
		})
		Deno.test("should invalidate a non-date string", () => {
			const invalidValue = "invalid-date"
			expect(CoreTypes.Date.validate(invalidValue)).toBe(false)
		})
	})
	Deno.test("JSON Type", () => {
		Deno.test("should validate a valid object", () => {
			const validValue = { name: "Test", value: 42 }
			expect(CoreTypes.JSON.validate(validValue)).toBe(true)
		})
		Deno.test("should invalidate a non-object", () => {
			const invalidValue = "not an object"
			expect(CoreTypes.JSON.validate(invalidValue)).toBe(false)
		})
		Deno.test("should invalidate null", () => {
			expect(CoreTypes.JSON.validate(null)).toBe(false)
		})
	})
	Deno.test("Boolean Type", () => {
		Deno.test("should validate a valid boolean", () => {
			expect(CoreTypes.Boolean.validate(true)).toBe(true)
			expect(CoreTypes.Boolean.validate(false)).toBe(true)
		})
		Deno.test("should invalidate a non-boolean", () => {
			expect(CoreTypes.Boolean.validate("true")).toBe(false)
			expect(CoreTypes.Boolean.validate(1)).toBe(false)
			expect(CoreTypes.Boolean.validate(null)).toBe(false)
		})
	})
})
