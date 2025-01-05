export class Rule {
    key: string
    func: () => true
}

export class Role {
    key: string
    func: () => true
}

export class Modify {
    key: string
    func: () => void
}

export class Effect {
    key: string
    func: () => void
}

export class Filter {
    key: string
    func: () => void
}

export const Lifecycle = {
    Rule: Symbol(),
    Role: Symbol(),
    Modify: Symbol(),
    Effect: Symbol(),
    Filter: Symbol(),
}
