import { EOL } from "node:os";
import { isAbsolute, join, normalize, parse, relative, dirname } from "node:path";
import { writeFile } from "node:fs";
import camelCase from "camelcase";
import { globbySync } from "globby";
function camelCaseName(name, filePath, transformName) {
  if (transformName) {
    switch (typeof transformName) {
      case "boolean":
        return camelCase(name);
      case "function":
        return transformName(name, filePath);
    }
  }
  return name;
}
function namedExport(files, target, transformName) {
  return files.map((file) => {
    const { name, dir } = parse(file);
    const exportName = camelCaseName(name, file, transformName);
    const relativeDir = relative(dirname(target), dir);
    return `export { default as ${exportName} } from '${`./${join(relativeDir, name)}`}';`;
  }).join(EOL);
}
function defaultExport(files, target, transformName) {
  const importDeclare = [];
  const exportDeclare = [];
  let exportName;
  for (const file of files) {
    const { name, dir } = parse(file);
    exportName = camelCaseName(name, file, transformName);
    const relativeDir = relative(dirname(target), dir);
    importDeclare[importDeclare.length] = `import ${exportName} from '${`./${join(relativeDir, name)}`}';`;
    exportDeclare[exportDeclare.length] = exportName;
  }
  return exportDeclare.length ? `${importDeclare.join(EOL)}${EOL}export default { ${exportDeclare.join(", ")} };${EOL}` : "";
}
function noneExport(files, target) {
  return files.map((file) => {
    const { name, dir } = parse(file);
    const relativeDir = relative(dirname(target), dir);
    return `import '${relativeDir ? join(relativeDir, name) : `./${name}`}';`;
  }).join(EOL);
}
function createPlugin(opts) {
  if (!opts) {
    opts = {};
  }
  const { src, transformName, dts } = opts;
  const exportsType = opts.exports || "named";
  let target = opts.target || "index.js";
  const cwd = opts.cwd || process.cwd();
  if (!isAbsolute(target)) {
    target = join(cwd, target);
  }
  target = normalize(target);
  const files = globbySync(src, { cwd, absolute: true });
  let mainCode = "";
  return {
    name: "vite-plugin-combine",
    config(config) {
      var _a;
      const { build } = config;
      if (!build || !(build.lib && build.lib.entry) && !((_a = build.rollupOptions) == null ? void 0 : _a.input)) {
        return {
          build: {
            lib: {
              entry: files.concat(target)
            }
          }
        };
      }
    },
    resolveId(id) {
      if (id === target) {
        return target;
      }
    },
    load(id) {
      if (id === target) {
        if (!files.length) {
          return "";
        }
        switch (exportsType) {
          case "named":
            mainCode = namedExport(files, id, transformName);
            break;
          case "default": {
            mainCode = defaultExport(files, id, transformName);
            break;
          }
          default:
            mainCode = noneExport(files, id);
        }
        return mainCode;
      }
    },
    closeBundle() {
      if (dts) {
        let dtsPath = dts;
        if (!isAbsolute(dtsPath)) {
          dtsPath = join(cwd, dtsPath);
        }
        if (mainCode) {
          writeFile(join(dtsPath, "index.d.ts"), mainCode, (err) => {
            if (err) {
              console.error(err);
            }
          });
        }
      }
    }
  };
}
export {
  createPlugin as default
};
