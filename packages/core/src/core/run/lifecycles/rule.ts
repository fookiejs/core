import { FookieError } from "../../error.ts";
import { after } from "../../mixin/binds/after.ts";
import { before } from "../../mixin/binds/before.ts";
import type { Payload } from "../../payload.ts";
import type { Method } from "../../method.ts";
import type { Model } from "../../model/model.ts";

const rule = async function (
  payload: Payload<Model, Method>
): Promise<boolean> {
  const rules = [
    ...before[payload.method]!.rule!,
    ...payload.model.binds()![payload.method]!.rule!,
    ...after[payload.method]!.rule!,
  ];

  for (const rule of rules) {
    const res = await rule.execute(payload);

    if (res !== true) {
      throw FookieError.create({
        name: rule.key,
        validationErrors: {},
        message: "rule error",
      });
    }
  }
  return true;
};

export default rule;
