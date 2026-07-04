import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const projectRoot = process.cwd();
const nativeRequire = createRequire(import.meta.url);
const ts = nativeRequire("typescript");
const moduleCache = new Map();

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function resolveCandidate(request, parentDir) {
  const direct = request.startsWith("@/")
    ? path.join(projectRoot, "src", request.slice(2))
    : request.startsWith(".")
      ? path.resolve(parentDir, request)
      : null;

  if (!direct) return null;

  const attempts = [
    direct,
    `${direct}.ts`,
    `${direct}.tsx`,
    `${direct}.mts`,
    `${direct}.cts`,
    `${direct}.js`,
    `${direct}.mjs`,
    `${direct}.cjs`,
    `${direct}.json`,
    path.join(direct, "index.ts"),
    path.join(direct, "index.tsx"),
    path.join(direct, "index.mts"),
    path.join(direct, "index.js"),
    path.join(direct, "index.json"),
  ];

  return attempts.find((candidate) => fileExists(candidate)) ?? null;
}

function transpileTs(sourceText, filename) {
  return ts.transpileModule(sourceText, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      resolveJsonModule: true,
      jsx: ts.JsxEmit.ReactJSX,
      allowJs: true,
    },
    fileName: filename,
  }).outputText;
}

function loadModule(resolvedPath) {
  if (moduleCache.has(resolvedPath)) {
    return moduleCache.get(resolvedPath).exports;
  }

  if (resolvedPath.endsWith(".json")) {
    const value = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
    moduleCache.set(resolvedPath, { exports: value });
    return value;
  }

  const sourceText = fs.readFileSync(resolvedPath, "utf8");
  const compiled = transpileTs(sourceText, resolvedPath);
  const compiledModule = { exports: {} };
  moduleCache.set(resolvedPath, compiledModule);

  const localRequire = (request) => {
    const resolved = resolveCandidate(request, path.dirname(resolvedPath));
    if (resolved) return loadModule(resolved);
    return nativeRequire(request);
  };

  const wrapped = new Function("require", "module", "exports", "__filename", "__dirname", compiled);
  wrapped(localRequire, compiledModule, compiledModule.exports, resolvedPath, path.dirname(resolvedPath));
  return compiledModule.exports;
}

export function loadTsModule(relativePath) {
  const resolved = resolveCandidate(relativePath, projectRoot);
  if (!resolved) {
    throw new Error(`Cannot resolve module: ${relativePath}`);
  }
  return loadModule(resolved);
}
