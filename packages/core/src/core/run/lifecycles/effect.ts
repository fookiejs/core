import { after } from "../../mixin/binds/after.ts";
import { before } from "../../mixin/binds/before.ts";
import type { Payload } from "../../payload.ts";
import type { Model } from "../../model/model.ts";
import type { Method } from "../../method.ts";
import type { MethodResponse } from "../../response.ts";

export default async function effect<T extends Model, M extends Method>(
  payload: Payload<T, M>,
  response: MethodResponse<T>[M]
) {
  const effects = [
    ...(before[payload.method]!.effect || []),
    ...(payload.model.binds()![payload.method]!.effect || []),
    ...(after[payload.method]!.effect || []),
  ];

  const promises = effects.map(async (effect) => {
    await effect.execute(payload, response);
  });

  await Promise.all(promises);
}
