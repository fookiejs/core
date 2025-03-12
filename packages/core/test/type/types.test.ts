import { describe, it, expect } from "vitest"
import { defaults } from "@fookiejs/core" // Tipleri doğru yoldan import edin

describe("Type Validation Tests", () => {
    // Integer type tests
    describe("Integer Type", () => {
        it("should validate a valid integer", () => {
            const validValue = 123
            expect(defaults.type.number.validate(validValue)).toBe(true)
        })

        it("should invalidate an invalid integer", () => {
            const invalidValue = "123"
            expect(defaults.type.number.validate(invalidValue)).toBe(false)
        })
    })

    // Float type tests
    describe("Float Type", () => {
        it("should validate a valid float", () => {
            const validValue = 123.45
            expect(defaults.type.number.validate(validValue)).toBe(true)
        })

        it("should invalidate an invalid float", () => {
            const invalidValue = "123.45"
            expect(defaults.type.number.validate(invalidValue)).toBe(false)
        })
    })

    // Text type tests
    describe("Text Type", () => {
        it("should validate a valid text", () => {
            const validValue = "hello world"
            expect(defaults.type.string.validate(validValue)).toBe(true)
        })

        it("should invalidate an invalid text", () => {
            const invalidValue = 12345
            expect(defaults.type.string.validate(invalidValue)).toBe(false)
        })
    })

    // Date type tests
    describe("Date Type", () => {
        it("should validate a valid date", () => {
            const validValue = "2024-05-14"
            expect(defaults.type.date.validate(validValue)).toBe(true)
        })

        it("should invalidate an invalid date", () => {
            const invalidValue = "14-05-2024"
            expect(defaults.type.date.validate(invalidValue)).toBe(false)
        })

        it("should invalidate an incorrectly formatted date", () => {
            const invalidValue = "2024/05/14"
            expect(defaults.type.date.validate(invalidValue)).toBe(false)
        })

        it("should invalidate a non-date string", () => {
            const invalidValue = "invalid-date"
            expect(defaults.type.date.validate(invalidValue)).toBe(false)
        })
    })
})
