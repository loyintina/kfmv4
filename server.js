// KFM v4 后端服务
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const ROOT_DIR = '/root';

// 列出目录内容
app.post('/api/files/list', (req, res) => {
  try {
    const targetPath = req.body.path || ROOT_DIR;
    const resolvedPath = targetPath === '~' ? ROOT_DIR : targetPath;
    
    if (!fs.existsSync(resolvedPath)) {
      return res.json({ error: '路径不存在', path: resolvedPath });
    }
    
    const items = fs.readdirSync(resolvedPath)
      .filter(name => !name.startsWith('.') || req.body.showHidden)
      .map(name => {
        const fullPath = path.join(resolvedPath, name);
        try {
          const stats = fs.statSync(fullPath);
          return {
            name,
            path: fullPath,
            isDir: stats.isDirectory(),
            size: stats.size,
            modified: stats.mtime.toISOString()
          };        } catch (e) {
          return null;
        }      })
      .filter(item => item !== null)
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    
    res.json({ path: resolvedPath, items });
  } catch (error) {
    res.json({ error: error.message });
  }});

// 读取文件
app.post('/api/files/read', (req, res) => {
  try {
    const targetPath = req.body.path;
    if (!fs.existsSync(targetPath)) {
      return res.json({ error: '文件不存在' });
    }
    const content = fs.readFileSync(targetPath, 'utf-8');
    res.json({ path: targetPath, content });
  } catch (error) {
    res.json({ error: error.message });
  }});

// 写入文件
app.post('/api/files/write', (req, res) => {
  try {
    const targetPath = req.body.path;
    const content = req.body.content;
        if(req.body.append){
      fs.appendFileSync(targetPath, content, 'utf-8');
    } else {
      fs.writeFileSync(targetPath, content, 'utf-8');
    }
    res.json({ success: true, path: targetPath });
  } catch (error) {
    res.json({ error: error.message });
  }});

// 系统信息
app.get('/api/system/info', (req, res) => {
  res.json({
    user: process.env.USER || 'root',
    home: ROOT_DIR,
    cwd: process.cwd()
  });
});

const PORT = 8021;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`KFM v4 server running at http://localhost:${PORT}`);
});