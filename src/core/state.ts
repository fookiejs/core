export class State {
    metrics: {
        start: Date
        end?: Date | null
        lifecycle: {
            name: string
            ms: number
        }[]
    }
    test?: boolean
    todo: (() => void)[]
}
