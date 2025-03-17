import { BaseClass } from "../base-class.ts";
import type { BindsType } from "../model/model.ts";
export * from "./binds/after.ts";
export * from "./binds/before.ts";
export * from "./binds/global.ts";

export class Mixin extends BaseClass {
  binds!: BindsType;
}
