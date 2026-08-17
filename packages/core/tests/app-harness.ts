import type { App } from "../src/index.ts";

export class LiveApps {
  instances: App[] = [];

  track<T extends App>(instance: T): T {
    this.instances.push(instance);
    return instance;
  }

  async shutdown(): Promise<void> {
    const stopping = this.instances.slice();
    this.instances = [];
    await Promise.all(stopping.map((instance) => instance.stop()));
  }
}

export async function serveApp(instance: App): Promise<number> {
  const started = instance.run();
  if (started === false) {
    throw new Error("the app refused to start its http server");
  }
  const bound = await instance.listening();
  for (const port of bound) {
    return port;
  }
  throw new Error("the app never reported a listening port");
}
