import { Config } from "@fookiejs/core";
import { expect } from "jsr:@std/expect";

Deno.test("Config", async () => {
  Deno.test("t1", async () => {
    Config.SYSTEM_TOKEN;
  });

  Deno.test("t2", async () => {
    try {
      Config.get("INVALID_ENV");
    } catch (error) {
      return;
    }

    expect(false).toBeTruthy();
  });
});
