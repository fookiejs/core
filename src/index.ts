export const models: ModelInterface[] = [];

export function model(model: ModelInterface) {
  models.push(model);
  return model;
}

export function database(database: DatabaseInterface) {
  return database;
}

export function type(type: Type) {
  return type;
}

export function lifecycle(lifecycle: LifecycleFunction) {
  return lifecycle;
}

export function mixin(mixin: MixinInterface) {
  return mixin;
}

export async function run(
  payload:
    | PayloadInterface
    | (Omit<PayloadInterface, "model"> & { model: Function })
    | (Omit<PayloadInterface, "model"> & { model: string }),
  state?: StateInterface
) {
  let model: ModelInterface;
  if (typeof payload.model === "function") {
    const val = payload.model.name;
    model = models.find((model) => model.name === val);
  } else if (typeof payload.model === "string") {
    const val = payload.model;
    model = models.find((model) => model.name === val);
  }

  payload.model = model;
  return await run(payload, state);
}

export async function _run(
  payload: PayloadInterface,
  state?: StateInterface
): Promise<any> {}
