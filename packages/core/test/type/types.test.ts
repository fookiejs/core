import { expect } from "jsr:@std/expect"
import { defaults } from "@fookiejs/core"
Deno.test("Type Validation Tests", () => {
	Deno.test("Integer Type", () => {
		Deno.test("should validate a valid integer", () => {
			const validValue = 123
			expect(defaults.type.integer.validate(validValue)).toBe(true)
		})
		Deno.test("should invalidate an invalid integer", () => {
			const invalidValue = "123"
			expect(defaults.type.integer.validate(invalidValue)).toBe(false)
		})
	})
	Deno.test("Float Type", () => {
		Deno.test("should validate a valid float", () => {
			const validValue = 123.45
			expect(defaults.type.float.validate(validValue)).toBe(true)
		})
		Deno.test("should invalidate an invalid float", () => {
			const invalidValue = "123.45"
			expect(defaults.type.float.validate(invalidValue)).toBe(false)
		})
	})
	Deno.test("Text Type", () => {
		Deno.test("should validate a valid text", () => {
			const validValue = "hello world"
			expect(defaults.type.text.validate(validValue)).toBe(true)
		})
		Deno.test("should invalidate an invalid text", () => {
			const invalidValue = 12345
			expect(defaults.type.text.validate(invalidValue)).toBe(false)
		})
	})
	Deno.test("Date Type", () => {
		Deno.test("should validate a valid date", () => {
			const validValue = "2024-05-14"
			expect(defaults.type.date.validate(validValue)).toBe(true)
		})
		Deno.test("should invalidate an invalid date", () => {
			const invalidValue = "14-05-2024"
			expect(defaults.type.date.validate(invalidValue)).toBe(false)
		})
		Deno.test("should invalidate an incorrectly formatted date", () => {
			const invalidValue = "2024/05/14"
			expect(defaults.type.date.validate(invalidValue)).toBe(false)
		})
		Deno.test("should invalidate a non-date string", () => {
			const invalidValue = "invalid-date"
			expect(defaults.type.date.validate(invalidValue)).toBe(false)
		})
	})
	Deno.test("JSON Type", () => {
		Deno.test("should validate a valid object", () => {
			const validValue = { name: "Test", value: 42 }
			expect(defaults.type.json.validate(validValue)).toBe(true)
		})
		Deno.test("should invalidate a non-object", () => {
			const invalidValue = "not an object"
			expect(defaults.type.json.validate(invalidValue)).toBe(false)
		})
		Deno.test("should invalidate null", () => {
			expect(defaults.type.json.validate(null)).toBe(false)
		})
	})
	Deno.test("Boolean Type", () => {
		Deno.test("should validate a valid boolean", () => {
			expect(defaults.type.boolean.validate(true)).toBe(true)
			expect(defaults.type.boolean.validate(false)).toBe(true)
		})
		Deno.test("should invalidate a non-boolean", () => {
			expect(defaults.type.boolean.validate("true")).toBe(false)
			expect(defaults.type.boolean.validate(1)).toBe(false)
			expect(defaults.type.boolean.validate(null)).toBe(false)
		})
	})
})
