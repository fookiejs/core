import { defineConfig, loadEnv } from "vite"

export default ({ mode }) => {
    process.env.SYSTEM_TOKEN = "test"
    return defineConfig({
        test: {
            coverage: {
                provider: "istanbul", // or 'c8'
            },
        },
    })
}
