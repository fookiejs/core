import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { noEnclosingCapture } from "../../src/rules/no-enclosing-capture.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("no-enclosing-capture", noEnclosingCapture, {
  valid: [
    {
      code: `function loadAccount(accountId: string): Account {
  return accountRepository.loadByIdOrThrow(accountId)
}`,
    },
    {
      code: `function openOwned(url: string, context: OpenContext): StoreBinding {
  return wrapOwned(url, context)
}
function Redis(url: string): Database {
  return {
    key: url,
    open(context: OpenContext): StoreBinding {
      return openOwned(this.key, context)
    },
  }
}`,
    },
    {
      code: `class StoreRegistry {
  private constructor(readonly key: string) {}
  static create(key: string): StoreRegistry {
    return new StoreRegistry(key)
  }
  require(): string {
    return this.key
  }
}`,
    },
    {
      code: `function factorial(n: number): number {
  if (n < 2) {
    return 1
  }
  return n * factorial(n - 1)
}`,
    },
    {
      code: `const tally = (left: number, right: number): number => left + right`,
    },
    {
      code: `function outer(amount: number): number {
  function inner(addend: number): number {
    return addend + 1
  }
  return inner(amount)
}`,
    },
  ],
  invalid: [
    {
      code: `function Redis(url: string): Database {
  return {
    open(context: OpenContext): StoreBinding {
      return openOwned(url, context)
    },
  }
}`,
      errors: [{ messageId: "enclosingCapture" }],
    },
    {
      code: `function Redis(url: string, injected: readonly RedisDriver[]): Database {
  return {
    open(context: OpenContext): StoreBinding {
      return openOwned(url, context, injected)
    },
  }
}`,
      errors: [{ messageId: "enclosingCapture" }, { messageId: "enclosingCapture" }],
    },
    {
      code: `class ScoreBoard {
  constructor(readonly score: number) {}
  render(): void {
    const paint = (): number => this.score
    paint()
  }
}`,
      errors: [{ messageId: "enclosingThis" }],
    },
    {
      code: `function trackApps(): void {
  const liveApps: App[] = []
  function shutdown(): void {
    liveApps.length
  }
  shutdown()
}`,
      errors: [{ messageId: "enclosingCapture" }],
    },
    {
      code: `function makeClient(): Client {
  const self = this
  return {
    send(): void {
      self.send()
    },
  }
}`,
      errors: [{ messageId: "enclosingThis" }, { messageId: "enclosingCapture" }],
    },
  ],
})
