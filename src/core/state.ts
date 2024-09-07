export class State {
    metrics: {
        start: Date
        end?: Date
        lifecycle: {
            name: string
            ms: number
        }[]
    }
    test?: boolean
    todo: (() => void)[]
}
