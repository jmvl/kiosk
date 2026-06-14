#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { validatePackageManifest } from '../dist/index.js';

function usage() {
  console.error('Usage: validate-manifest <manifest.json> [--root <package-root>]');
}

const args = process.argv.slice(2);
const manifestArg = args[0];
if (!manifestArg) {
  usage();
  process.exit(2);
}

let root;
for (let i = 1; i < args.length; i += 1) {
  if (args[i] === '--root') {
    root = args[i + 1];
    i += 1;
    continue;
  }
  console.error(`Unknown argument: ${args[i]}`);
  usage();
  process.exit(2);
}

const manifestPath = resolve(manifestArg);
const packageRoot = resolve(root ?? dirname(manifestPath));
const raw = readFileSync(manifestPath, 'utf8');
const parsed = JSON.parse(raw);
const result = validatePackageManifest(parsed);

if (!result.ok) {
  for (const error of result.errors) {
    console.error(`${error.path}: ${error.message}`);
  }
  process.exit(1);
}

const digestErrors = [];
for (const file of result.manifest.files) {
  const filePath = resolve(packageRoot, file.path);
  if (!filePath.startsWith(`${packageRoot}/`) && filePath !== packageRoot) {
    digestErrors.push(`${file.path}: resolves outside package root`);
    continue;
  }
  let stat;
  try {
    stat = statSync(filePath);
  } catch (error) {
    digestErrors.push(`${file.path}: ${(error instanceof Error ? error.message : String(error))}`);
    continue;
  }
  if (!stat.isFile()) {
    digestErrors.push(`${file.path}: not a file`);
    continue;
  }
  if (stat.size !== file.size_bytes) {
    digestErrors.push(`${file.path}: size ${stat.size} !== manifest ${file.size_bytes}`);
  }
  const digest = createHash('sha256').update(readFileSync(filePath)).digest('hex');
  if (digest !== file.sha256) {
    digestErrors.push(`${file.path}: sha256 ${digest} !== manifest ${file.sha256}`);
  }
}

if (digestErrors.length > 0) {
  for (const error of digestErrors) {
    console.error(error);
  }
  process.exit(1);
}

console.log(`valid package manifest: ${result.manifest.package_id}@${result.manifest.version}`);
