import { defineConfig, loadEnv } from "vite";

export default () => {
    return defineConfig({
        test: {
            include: ["test/**/*.test.ts"],
            coverage: {
                provider: "v8",
                reporter: ["text", "html"],
            },
        },
    });
};
