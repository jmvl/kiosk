import { randomBytes } from 'node:crypto';

const crockfordAlphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

let lastTime = 0;
let lastRandom: number[] = [];

function encodeTime(timeMs: number): string {
  let value = BigInt(timeMs);
  let output = '';
  for (let index = 0; index < 10; index += 1) {
    output = crockfordAlphabet[Number(value & 31n)] + output;
    value >>= 5n;
  }
  return output;
}

function incrementRandom(bytes: number[]): number[] {
  const next = [...bytes];
  for (let index = next.length - 1; index >= 0; index -= 1) {
    next[index] = ((next[index] ?? 0) + 1) & 31;
    if ((next[index] ?? 0) !== 0) break;
  }
  return next;
}

function randomCrockford(length: number): number[] {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => byte & 31);
}

export function generateUlid(now = Date.now()): string {
  const time = now;
  if (time === lastTime && lastRandom.length === 16) {
    lastRandom = incrementRandom(lastRandom);
  } else {
    lastTime = time;
    lastRandom = randomCrockford(16);
  }
  return `${encodeTime(time)}${lastRandom.map((value) => crockfordAlphabet[value]).join('')}`;
}

export function crockfordFromBytes(bytes: Uint8Array, length: number): string {
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5 && output.length < length) {
      bits -= 5;
      output += crockfordAlphabet[(buffer >> bits) & 31];
    }
    if (output.length === length) return output;
  }
  if (output.length < length && bits > 0) {
    output += crockfordAlphabet[(buffer << (5 - bits)) & 31];
  }
  return output.padEnd(length, '0');
}
