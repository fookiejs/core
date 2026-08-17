import { RuleTester } from "@typescript-eslint/rule-tester"
import { after, describe, it } from "node:test"
import { minFunctionLines } from "../../src/rules/min-function-lines.js"

RuleTester.afterAll = after
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
})

tester.run("min-function-lines", minFunctionLines, {
  valid: [
    {
      code: `function chargeOrder(order: Order): Receipt {
  const pricedOrder = priceOrder(order)
  const taxedOrder = applyTax(pricedOrder)
  const paidOrder = capturePayment(taxedOrder)
  const packedOrder = reserveStock(paidOrder)
  const shippedOrder = scheduleShipment(packedOrder)
  const closedOrder = closeOrder(shippedOrder)
  return issueReceipt(closedOrder)
}`,
    },
    {
      code: "const total = amounts.reduce((sum, amount) => sum + amount, 0)",
    },
  ],
  invalid: [
    {
      code: `function loadAccount(): Account {
  return repo.loadOrThrow(id)
}`,
      errors: [{ messageId: "tooShort" }],
    },
    {
      code: `function priceOrder(order: Order): Order {
  const priced = applyPrice(order)
  return priced
}`,
      errors: [{ messageId: "tooShort" }],
    },
  ],
})
