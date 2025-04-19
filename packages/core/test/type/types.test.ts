import { expect } from "jsr:@std/expect"
import { defaults } from "@fookiejs/core"
Deno.test("Type Validation Tests", () => {
	Deno.test("Integer Type", () => {
		Deno.test("should validate a valid integer", () => {
			const validValue = 123
			expect(defaults.types.Integer.validate(validValue)).toBe(true)
		})
		Deno.test("should invalidate an invalid integer", () => {
			const invalidValue = "123"
			expect(defaults.types.Integer.validate(invalidValue)).toBe(false)
		})
	})
	Deno.test("Float Type", () => {
		Deno.test("should validate a valid float", () => {
			const validValue = 123.45
			expect(defaults.types.Float.validate(validValue)).toBe(true)
		})
		Deno.test("should invalidate an invalid float", () => {
			const invalidValue = "123.45"
			expect(defaults.types.Float.validate(invalidValue)).toBe(false)
		})
	})
	Deno.test("Text Type", () => {
		Deno.test("should validate a valid text", () => {
			const validValue = "hello world"
			expect(defaults.types.String.validate(validValue)).toBe(true)
		})
		Deno.test("should invalidate an invalid text", () => {
			const invalidValue = 12345
			expect(defaults.types.String.validate(invalidValue)).toBe(false)
		})
	})
	Deno.test("Date Type", () => {
		Deno.test("should validate a valid date", () => {
			const validValue = "2024-05-14"
			expect(defaults.types.Date.validate(validValue)).toBe(true)
		})
		Deno.test("should invalidate an invalid date", () => {
			const invalidValue = "14-05-2024"
			expect(defaults.types.Date.validate(invalidValue)).toBe(false)
		})
		Deno.test("should invalidate an incorrectly formatted date", () => {
			const invalidValue = "2024/05/14"
			expect(defaults.types.Date.validate(invalidValue)).toBe(false)
		})
		Deno.test("should invalidate a non-date string", () => {
			const invalidValue = "invalid-date"
			expect(defaults.types.Date.validate(invalidValue)).toBe(false)
		})
	})
	Deno.test("JSON Type", () => {
		Deno.test("should validate a valid object", () => {
			const validValue = { name: "Test", value: 42 }
			expect(defaults.types.JSON.validate(validValue)).toBe(true)
		})
		Deno.test("should invalidate a non-object", () => {
			const invalidValue = "not an object"
			expect(defaults.types.JSON.validate(invalidValue)).toBe(false)
		})
		Deno.test("should invalidate null", () => {
			expect(defaults.types.JSON.validate(null)).toBe(false)
		})
	})
	Deno.test("Boolean Type", () => {
		Deno.test("should validate a valid boolean", () => {
			expect(defaults.types.Boolean.validate(true)).toBe(true)
			expect(defaults.types.Boolean.validate(false)).toBe(true)
		})
		Deno.test("should invalidate a non-boolean", () => {
			expect(defaults.types.Boolean.validate("true")).toBe(false)
			expect(defaults.types.Boolean.validate(1)).toBe(false)
			expect(defaults.types.Boolean.validate(null)).toBe(false)
		})
	})
})
