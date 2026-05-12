// src/server/index.ts
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "../../public")));
app.use(express.static(path.join(__dirname, "../..")));
var ROOT_DIR = "/root";
var SAFE_ROOT = path.resolve(ROOT_DIR) + path.sep;
function sanitizePath(userPath) {
  const resolved = path.resolve(SAFE_ROOT, userPath);
  if (resolved !== SAFE_ROOT.slice(0, -1) && !resolved.startsWith(SAFE_ROOT)) return null;
  return resolved;
}
function setupApiRoutes(router) {
  router.post("/files/list", (req, res) => {
    try {
      const targetPath = req.body.path || ROOT_DIR;
      const resolvedPath = sanitizePath(targetPath === "~" ? ROOT_DIR : targetPath);
      if (!resolvedPath) {
        res.json({ error: "\u8DEF\u5F84\u4E0D\u5408\u6CD5" });
        return;
      }
      if (!fs.existsSync(resolvedPath)) {
        res.json({ error: "\u8DEF\u5F84\u4E0D\u5B58\u5728", path: resolvedPath });
        return;
      }
      const items = fs.readdirSync(resolvedPath).filter((name) => !name.startsWith(".") || req.body.showHidden).map((name) => {
        const fullPath = path.join(resolvedPath, name);
        try {
          const stats = fs.statSync(fullPath);
          return { name, path: fullPath, isDir: stats.isDirectory(), size: stats.size, modified: stats.mtime.toISOString() };
        } catch {
          return null;
        }
      }).filter((item) => item !== null).sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      res.json({ path: resolvedPath, items });
    } catch (error) {
      res.json({ error: error.message });
    }
  });
  router.post("/files/list-recursive", (req, res) => {
    try {
      let readDirRecursive2 = function(dirPath, depth) {
        if (depth <= 0) return [];
        try {
          return fs.readdirSync(dirPath).map((name) => {
            const fullPath = path.join(dirPath, name);
            try {
              const stats = fs.statSync(fullPath);
              const node = {
                name,
                path: fullPath,
                isDir: stats.isDirectory(),
                size: stats.size,
                modified: stats.mtime.toISOString()
              };
              if (stats.isDirectory()) {
                const isExpanded = expandedPaths[fullPath] || Object.keys(expandedPaths).some((ep) => ep.startsWith(fullPath + "/"));
                if (isExpanded) {
                  node.children = readDirRecursive2(fullPath, depth - 1);
                }
              }
              return node;
            } catch {
              return null;
            }
          }).filter((item) => item !== null).sort((a, b) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
        } catch {
          return [];
        }
      };
      var readDirRecursive = readDirRecursive2;
      const targetPath = req.body.path || ROOT_DIR;
      const maxDepth = req.body.depth || 20;
      const expandedPaths = req.body.expandedPaths || {};
      const resolvedPath = sanitizePath(targetPath === "~" ? ROOT_DIR : targetPath);
      if (!resolvedPath) {
        res.json({ error: "\u8DEF\u5F84\u4E0D\u5408\u6CD5" });
        return;
      }
      if (!fs.existsSync(resolvedPath)) {
        res.json({ error: "\u8DEF\u5F84\u4E0D\u5B58\u5728", path: resolvedPath });
        return;
      }
      const tree = readDirRecursive2(resolvedPath, maxDepth);
      res.json({ path: resolvedPath, tree });
    } catch (error) {
      res.json({ error: error.message });
    }
  });
  router.post("/files/read", (req, res) => {
    try {
      const targetPath = sanitizePath(req.body.path);
      if (!targetPath) {
        res.json({ error: "\u8DEF\u5F84\u4E0D\u5408\u6CD5" });
        return;
      }
      if (!fs.existsSync(targetPath)) {
        res.json({ error: "\u6587\u4EF6\u4E0D\u5B58\u5728" });
        return;
      }
      res.json({ path: targetPath, content: fs.readFileSync(targetPath, "utf-8") });
    } catch (error) {
      res.json({ error: error.message });
    }
  });
  router.post("/files/write", (req, res) => {
    try {
      const targetPath = sanitizePath(req.body.path);
      if (!targetPath) {
        res.json({ error: "\u8DEF\u5F84\u4E0D\u5408\u6CD5" });
        return;
      }
      const content = req.body.content;
      if (req.body.append) fs.appendFileSync(targetPath, content, "utf-8");
      else fs.writeFileSync(targetPath, content, "utf-8");
      res.json({ success: true, path: targetPath });
    } catch (error) {
      res.json({ error: error.message });
    }
  });
  router.get("/system/info", (_req, res) => {
    res.json({ user: process.env.USER || "root", home: ROOT_DIR, cwd: process.cwd() });
  });
}
setupApiRoutes(app.use("/api", express.Router()) && app);
app.use("/api", (() => {
  const r = express.Router();
  setupApiRoutes(r);
  return r;
})());
app.use("/kfmv4/api", (() => {
  const r = express.Router();
  setupApiRoutes(r);
  return r;
})());
var PORT = 8021;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`KFM v4 server running at http://localhost:${PORT}`);
});
