# 即梦图片下载

一个用于 `https://jimeng.jianying.com` 的 Chrome 扩展。

![插件效果预览](./img.png)

插件会在页面指定位置插入一个“下载图片”按钮，点击后可直接下载当前目标图片，并自动完成以下处理：

- 使用浏览器默认下载目录保存文件
- 按网页标题创建文件夹
- 将图片统一转换为 `JPG` 格式
- 使用图片内容的 `MD5` 值作为文件名

## 功能说明

- 仅在 `https://jimeng.jianying.com/*` 页面生效
- 在页面按钮区域插入一个蓝色“下载图片”按钮
- 点击按钮后，提取目标图片地址并发起下载
- 下载记录显示为由扩展发起
- 文件保存格式为：`页面标题/MD5.jpg`

## 下载后的目录结构

示例：

```text
下载目录/
  页面标题/
    d41d8cd98f00b204e9800998ecf8427e.jpg
```

## 安装方式

1. 打开 Chrome 浏览器
2. 进入 `chrome://extensions/`
3. 打开右上角“开发者模式”
4. 点击“加载已解压的扩展程序”
5. 选择当前目录：

```text
/Users/flyeyas/items/my-script/jimeng-image-downloader
```

## 使用方法

1. 打开 `https://jimeng.jianying.com`
2. 进入包含目标图片的页面
3. 等待页面加载完成
4. 点击页面上的“下载图片”按钮
5. 插件会自动下载图片到浏览器默认下载目录

## 运行逻辑

插件当前使用以下页面定位规则：

- 按钮插入位置：

```xpath
//div[@class="publish-button-R3RwZe"]
```

- 图片地址提取规则：

```xpath
//div[@class="image-player-content-rLWQU_"]/div/img/@src
```

## 文件说明

- `manifest.json`：扩展配置
- `content.js`：页面按钮注入与点击交互
- `background.js`：图片抓取、转 JPG、MD5 命名、下载处理
- `popup.html` / `popup.js`：扩展弹出页相关文件

## 注意事项

- 本插件依赖当前页面的类名和 DOM 结构
- 如果即梦页面更新了类名，按钮可能不显示，或者无法提取图片
- 如果浏览器开启了“下载前询问每个文件的保存位置”，可能仍会弹出保存提示
- 如果安装了第三方下载接管工具，实际下载行为可能受浏览器环境影响
- 转换为 JPG 后，原图透明区域会自动填充为白色背景
