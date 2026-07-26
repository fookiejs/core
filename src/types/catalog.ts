import { z } from "zod";
import { ModelFieldError } from "../errors.ts";
import { appendItem } from "../slot.ts";
import {
  bigintSchema,
  boxSchema,
  byteaSchema,
  cidrSchema,
  circleSchema,
  coordinateSchema,
  dateSchema,
  decimalSchema,
  inetSchema,
  intervalSchema,
  jsonSchema,
  lineSchema,
  lsegSchema,
  macaddrSchema,
  pathSchema,
  polygonSchema,
  timeSchema,
  timetzSchema,
  uuidSchema,
  xmlSchema,
} from "./pg-literals.ts";
import { NumericType, PlainType } from "./type.ts";

export const Types = {
  smallint: NumericType.create(z.number().int().min(-32768).max(32767), "smallint"),
  integer: NumericType.create(z.number().int(), "integer"),
  int: NumericType.create(z.number().int(), "integer"),
  bigint: PlainType.create(bigintSchema, "bigint", "bigint"),
  numeric: PlainType.create(decimalSchema, "numeric", "decimal"),
  real: NumericType.create(z.number().finite(), "real"),
  float: NumericType.create(z.number().finite(), "real"),
  doublePrecision: NumericType.create(z.number().finite(), "doublePrecision"),
  serial: NumericType.create(z.number().int().positive(), "serial"),
  bigserial: PlainType.create(bigintSchema, "bigserial", "bigint"),
  text: PlainType.create(z.string(), "text", "string"),
  string: PlainType.create(z.string(), "text", "string"),
  varchar: (length: number) => {
    if (Number.isInteger(length) === false || length < 1) {
      return PlainType.create(
        z.string().refine(() => false),
        `varchar(${length})`,
        "string",
      );
    }
    return PlainType.create(z.string().max(length), `varchar(${length})`, "string");
  },
  char: (length: number) => {
    if (Number.isInteger(length) === false || length < 1) {
      return PlainType.create(
        z.string().refine(() => false),
        `char(${length})`,
        "string",
      );
    }
    return PlainType.create(z.string().length(length), `char(${length})`, "string");
  },
  boolean: PlainType.create(z.boolean(), "boolean", "boolean"),
  bool: PlainType.create(z.boolean(), "boolean", "boolean"),
  uuid: PlainType.create(uuidSchema, "uuid", "uuid"),
  id: PlainType.create(uuidSchema, "id", "uuid"),
  date: PlainType.create(dateSchema, "date", "temporal"),
  time: PlainType.create(timeSchema, "time", "temporal"),
  timetz: PlainType.create(timetzSchema, "timetz", "temporal"),
  timestamp: PlainType.create(z.iso.datetime({ local: true }), "timestamp", "temporal"),
  timestamptz: PlainType.create(z.iso.datetime({ offset: true }), "timestamptz", "temporal"),
  datetime: PlainType.create(z.iso.datetime({ local: true }), "timestamp", "temporal"),
  interval: PlainType.create(intervalSchema, "interval", "temporal"),
  json: PlainType.create(jsonSchema, "json", "json"),
  jsonb: PlainType.create(jsonSchema, "jsonb", "json"),
  bytea: PlainType.create(byteaSchema, "bytea", "binary"),
  inet: PlainType.create(inetSchema, "inet", "string"),
  cidr: PlainType.create(cidrSchema, "cidr", "string"),
  macaddr: PlainType.create(macaddrSchema, "macaddr", "string"),
  money: PlainType.create(decimalSchema, "money", "decimal"),
  currency: NumericType.create(z.number().finite().nonnegative(), "currency"),
  point: PlainType.create(coordinateSchema, "point", "coordinate"),
  coordinate: PlainType.create(coordinateSchema, "point", "coordinate"),
  line: PlainType.create(lineSchema, "line", "geometric"),
  lseg: PlainType.create(lsegSchema, "lseg", "geometric"),
  box: PlainType.create(boxSchema, "box", "geometric"),
  path: PlainType.create(pathSchema, "path", "geometric"),
  polygon: PlainType.create(polygonSchema, "polygon", "geometric"),
  circle: PlainType.create(circleSchema, "circle", "geometric"),
  xml: PlainType.create(xmlSchema, "xml", "string"),
  email: PlainType.create(z.string().refine(emailValueOk), "email", "string"),
  url: PlainType.create(z.string().refine(urlValueOk), "url", "string"),
  enum(
    first: string,
    second?: string,
    third?: string,
    fourth?: string,
    fifth?: string,
    sixth?: string,
    seventh?: string,
    eighth?: string,
    ninth?: string,
    tenth?: string,
  ): PlainType<string, "string"> {
    let values: readonly string[] = [];
    const candidates = [first, second, third, fourth, fifth, sixth, seventh, eighth, ninth, tenth];
    for (const candidate of candidates) {
      const candidateParsed = z.string().min(1).safeParse(candidate);
      if (candidateParsed.success === false) {
        continue;
      }
      values = appendItem(values, candidateParsed.data);
    }
    if (values.length < 1) {
      throw ModelFieldError.create("enum requires at least one value");
    }
    const enumSchema = z.string().refine((candidate) => {
      if (z.string().min(1).safeParse(candidate).success === false) {
        return false;
      }
      for (const enumMember of values) {
        if (candidate === enumMember) {
          return true;
        }
      }
      return false;
    });
    const enumType = PlainType.create(enumSchema, "enum", "string");
    return enumType;
  },
  relation<T extends { name: string }>(model: T): PlainType<string, "uuid"> {
    if (z.looseObject({}).safeParse(model).success === false) {
      throw ModelFieldError.create("relation model required");
    }
    if (z.string().min(1).safeParse(model.name).success === false) {
      throw ModelFieldError.create("relation model name required");
    }
    const kind = `relation:${model.name}`;
    const relationType = PlainType.create(uuidSchema, kind, "uuid");
    return relationType;
  },
};

export function emailValueOk(emailText: string): boolean {
  if (z.string().email().safeParse(emailText).success === false) {
    return false;
  }
  const at = emailText.lastIndexOf("@");
  if (at < 0) {
    return false;
  }
  const domain = emailText.slice(at + 1);
  for (const label of domain.split(".")) {
    if (label.length < 1) {
      return false;
    }
    if (label.startsWith("-") === true || label.endsWith("-") === true) {
      return false;
    }
  }
  return true;
}

export function urlValueOk(urlText: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlText);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }
  if (parsed.hostname.length < 1) {
    return false;
  }
  if (parsed.hostname === ".") {
    return false;
  }
  return true;
}
