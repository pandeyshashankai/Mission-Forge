const fs = require("node:fs");
const path = require("node:path");
const babel = require("@babel/core");
const original = require.extensions[".js"];
const sourceRoot = path.resolve(__dirname, "../src") + path.sep;
require.extensions[".js"] = (mod, filename) => {
  if (!filename.startsWith(sourceRoot)) return original(mod, filename);
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename,
    babelrc: false,
    configFile: false,
    plugins: [require.resolve("@babel/plugin-transform-modules-commonjs")],
  });
  mod._compile(code, filename);
};
