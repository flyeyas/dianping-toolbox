# 大众点评工具箱

这个 Chrome 扩展合并了当前目录下两个插件的能力：

- 豆包页面：打开美食笔记提示词侧边栏，并支持一键填入豆包输入框。
- 即梦页面：打开图片调整提示词侧边栏，并支持一键填入即梦输入框。
- 即梦页面：保留页面内“下载图片”按钮。

## 授权链接与 UI 切换

- `https://www.doubao.com/*`、`https://doubao.com/*`：点击扩展按钮会打开豆包侧边栏。
- `https://jimeng.jianying.com/*`：点击扩展按钮会打开即梦图片提示词侧边栏。
- 其他页面：点击扩展按钮会显示未匹配授权链接提示。

## 安装方式

1. 打开 Chrome 的 `chrome://extensions/`
2. 开启“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择这个目录：

```text
/Users/flyeyas/items/chrome-extension/doubao-jimeng-toolbox
```

## 文件说明

- `manifest.json`：合并后的扩展配置和授权链接。
- `background.js`：根据当前标签页 URL 切换侧边栏 UI，并处理即梦图片下载。
- `doubao-content.js`：豆包页面输入框填入逻辑。
- `doubao-sidepanel.html` / `doubao-sidepanel.css` / `doubao-sidepanel.js`：豆包侧边栏 UI。
- `jimeng-content.js`：即梦页面“下载图片”按钮注入和输入框填入逻辑。
- `jimeng-sidepanel.html` / `jimeng-sidepanel.css` / `jimeng-sidepanel.js`：即梦图片提示词侧边栏 UI。
- `unsupported-popup.html`：未匹配授权链接时的默认 UI。
