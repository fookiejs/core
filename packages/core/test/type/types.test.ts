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
			expect(defaults.type.integer.validate(validValue)).toBe(true)
		})

		Deno.test("should invalidate an invalid float", () => {
			const invalidValue = "123.45"
			expect(defaults.type.integer.validate(invalidValue)).toBe(false)
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
			expect(defaults.type.timestamp.validate(validValue)).toBe(true)
		})

		Deno.test("should invalidate an invalid date", () => {
			const invalidValue = "14-05-2024"
			expect(defaults.type.timestamp.validate(invalidValue)).toBe(false)
		})

		Deno.test("should invalidate an incorrectly formatted date", () => {
			const invalidValue = "2024/05/14"
			expect(defaults.type.timestamp.validate(invalidValue)).toBe(false)
		})

		Deno.test("should invalidate a non-date string", () => {
			const invalidValue = "invalid-date"
			expect(defaults.type.timestamp.validate(invalidValue)).toBe(false)
		})
	})
})
