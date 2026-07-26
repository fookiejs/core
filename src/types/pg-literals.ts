import { z } from "zod";
import type { Coordinate } from "../values.ts";

export const coordinateSchema: z.ZodType<Coordinate, Coordinate> = z.tuple([
  z.number().finite(),
  z.number().finite(),
]);

export const uuidSchema = z.string().uuid();

export const bigintSchema = z.string().regex(/^-?\d+$/);

export const decimalSchema = z.string().regex(/^-?\d+(\.\d+)?$/);

export const dateSchema = z.iso.date();

export const timeSchema = z.iso.time();

export const timetzSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3])(?::[0-5]\d)?)$/);

export const intervalSchema = z
  .string()
  .regex(
    /^-?\d+ (years?|months?|mons?|days?|hours?|minutes?|mins?|seconds?|secs?)( -?\d+ (years?|months?|mons?|days?|hours?|minutes?|mins?|seconds?|secs?))*$/,
  );

export function ipv4HostOk(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) {
    return false;
  }
  for (const part of parts) {
    if (/^\d{1,3}$/.test(part) === false) {
      return false;
    }
    if (part.length > 1 && part.startsWith("0") === true) {
      return false;
    }
    const n = Number(part);
    if (n < 0 || n > 255) {
      return false;
    }
  }
  return true;
}

export function ipv6HostOk(host: string): boolean {
  if (host.includes(":") === false) {
    return false;
  }
  if (/[^0-9a-fA-F:]/.test(host) === true) {
    return false;
  }
  const sides = host.split("::");
  if (sides.length > 2) {
    return false;
  }
  let groupCount = 0;
  for (const side of sides) {
    if (side.length < 1) {
      continue;
    }
    const groups = side.split(":");
    for (const group of groups) {
      if (group.length < 1 || group.length > 4) {
        return false;
      }
      if (/^[0-9a-fA-F]+$/.test(group) === false) {
        return false;
      }
      groupCount += 1;
    }
  }
  if (sides.length === 1) {
    return groupCount === 8;
  }
  return groupCount <= 7;
}

export function prefixLenOk(text: string, max: number): boolean {
  if (/^\d+$/.test(text) === false) {
    return false;
  }
  if (text.length > 1 && text.startsWith("0") === true) {
    return false;
  }
  const prefix = Number(text);
  return Number.isInteger(prefix) === true && prefix >= 0 && prefix <= max;
}

export function ipv4ToUint(host: string): readonly number[] {
  const parts = host.split(".");
  if (parts.length !== 4) {
    return [];
  }
  let packed = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (Number.isInteger(octet) === false || octet < 0 || octet > 255) {
      return [];
    }
    packed = (packed << 8) + octet;
  }
  return [packed >>> 0];
}

export function ipv4CidrNetworkOk(host: string, prefix: number): boolean {
  for (const addr of ipv4ToUint(host)) {
    if (prefix === 0) {
      return addr === 0;
    }
    if (prefix < 1 || prefix > 32) {
      return false;
    }
    const mask = (0xffffffff << (32 - prefix)) >>> 0;
    return (addr & ~mask) === 0;
  }
  return false;
}

export function inetValueOk(inetLiteral: string): boolean {
  const slash = inetLiteral.indexOf("/");
  let host = inetLiteral;
  let prefixHits: readonly string[] = [];
  if (slash !== -1) {
    host = inetLiteral.slice(0, slash);
    prefixHits = [inetLiteral.slice(slash + 1)];
  }
  if (ipv4HostOk(host) === true) {
    for (const prefixText of prefixHits) {
      return prefixLenOk(prefixText, 32);
    }
    return true;
  }
  if (ipv6HostOk(host) === true) {
    for (const prefixText of prefixHits) {
      return prefixLenOk(prefixText, 128);
    }
    return true;
  }
  return false;
}

export function cidrValueOk(cidrLiteral: string): boolean {
  const slash = cidrLiteral.indexOf("/");
  if (slash === -1) {
    return false;
  }
  const host = cidrLiteral.slice(0, slash);
  const prefixText = cidrLiteral.slice(slash + 1);
  if (ipv4HostOk(host) === true) {
    if (prefixLenOk(prefixText, 32) === false) {
      return false;
    }
    return ipv4CidrNetworkOk(host, Number(prefixText));
  }
  if (ipv6HostOk(host) === true) {
    return prefixLenOk(prefixText, 128);
  }
  return false;
}

export function macaddrValueOk(macaddrText: string): boolean {
  if (/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(macaddrText) === true) {
    return true;
  }
  if (/^([0-9a-fA-F]{2}-){5}[0-9a-fA-F]{2}$/.test(macaddrText) === true) {
    return true;
  }
  return /^[0-9a-fA-F]{12}$/.test(macaddrText) === true;
}

export const inetSchema = z.string().refine(inetValueOk);

export const cidrSchema = z.string().refine(cidrValueOk);

export const macaddrSchema = z.string().refine(macaddrValueOk);

export const byteaSchema = z.string().regex(/^\\x(?:[0-9a-fA-F]{2})*$/);

export const geometricFloat = "[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?";

export const geometricPoint = `\\(${geometricFloat},${geometricFloat}\\)`;

export const lineSchema = z
  .string()
  .regex(new RegExp(`^\\{${geometricFloat},${geometricFloat},${geometricFloat}\\}$`));

export const lsegSchema = z
  .string()
  .regex(new RegExp(`^\\[${geometricPoint},${geometricPoint}\\]$`));

export const boxSchema = z.string().regex(new RegExp(`^${geometricPoint},${geometricPoint}$`));

export const pathSchema = z
  .string()
  .regex(new RegExp(`^[\\[\\(](?:${geometricPoint},)*${geometricPoint}[\\]\\)]$`));

export const polygonSchema = z
  .string()
  .regex(new RegExp(`^\\((?:${geometricPoint},)+${geometricPoint}\\)$`));

export const circleSchema = z.string().regex(new RegExp(`^<${geometricPoint},${geometricFloat}>$`));

export const geometricValueSchema = z.union([
  lineSchema,
  lsegSchema,
  boxSchema,
  pathSchema,
  polygonSchema,
  circleSchema,
]);

export const xmlSchema = z.string().refine((xmlText) => {
  const trimmed = xmlText.trim();
  if (trimmed.length < 3) {
    return false;
  }
  if (trimmed.startsWith("<") === false) {
    return false;
  }
  if (trimmed.endsWith(">") === false) {
    return false;
  }
  if (/<[A-Za-z_?]/.test(trimmed) === false) {
    return false;
  }
  return true;
});

export const jsonSchema = z.string().refine((jsonText) => {
  if (jsonText.trim().length < 1) {
    return false;
  }
  try {
    JSON.parse(jsonText);
    return true;
  } catch {
    return false;
  }
});

export const temporalFilterValue = z.union([
  dateSchema,
  timeSchema,
  timetzSchema,
  z.iso.datetime(),
  intervalSchema,
]);
