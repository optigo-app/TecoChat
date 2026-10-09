const fs = require("fs");
const path = require("path");

const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (!["node_modules", ".next", ".git"].includes(e.name)) walk(p);
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      files.push(p);
    }
  }
};
walk("src");
walk("app");

const contents = new Map(files.map((f) => [f, fs.readFileSync(f, "utf8")]));

const report = [];
for (const [f, src] of contents) {
  const re = /export\s+(?:async\s+)?(?:const|function|class|interface|type|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  // also: export { a, b } — capture names
  const braceRe = /export\s*\{([^}]+)\}/g;
  const syms = new Set();
  let m;
  while ((m = re.exec(src))) syms.add(m[1]);
  while ((m = braceRe.exec(src))) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) syms.add(name);
    }
  }
  for (const sym of syms) {
    const wordRe = new RegExp("\\b" + sym.replace(/[$]/g, "\\$") + "\\b");
    let used = false;
    for (const [f2, src2] of contents) {
      if (f2 === f) continue;
      if (wordRe.test(src2)) {
        used = true;
        break;
      }
    }
    if (!used) report.push(f + " :: " + sym);
  }
}
console.log(report.join("\n") || "none");
