import { BorshCoder, EventParser, type Idl } from "@coral-xyz/anchor";
import { idl } from "./idl";
import { PROGRAM_ID } from "./constants";

export interface ParsedEvent {
  name: string;
  data: Record<string, unknown>;
}

function lowerFirst(name: string): string {
  if (!name) return name;
  return name[0].toLowerCase() + name.slice(1);
}

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function camelizeKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelizeKeys);
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[snakeToCamel(k)] = camelizeKeys(v);
    }
    return out;
  }
  return value;
}

export function parseLogs(logs: string[]): ParsedEvent[] {
  const coder = new BorshCoder(idl as unknown as Idl);
  const parser = new EventParser(PROGRAM_ID, coder);
  const out: ParsedEvent[] = [];
  for (const ev of parser.parseLogs(logs)) {
    out.push({
      name: lowerFirst(ev.name),
      data: camelizeKeys(ev.data) as Record<string, unknown>,
    });
  }
  return out;
}
