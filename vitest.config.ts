import { defineConfig } from "vitest/config"
import { resolve } from "path"

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["packages/*/test/**/*.test.ts"],
        exclude: ["node_modules", "dist", "**/*.js"],
        coverage: {
            provider: "v8",
            reporter: ["text", "html"],
        },
    },
    resolve: {
        alias: [
            {
                find: "@fookiejs/core",
                replacement: resolve(__dirname, "./packages/core/src/index.ts"),
            },
        ],
    },
})
