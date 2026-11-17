# Brandnew Contexty

面向自媒体脚本创作的 Contexty 功能原型。依据 Contexty 公开网站、论文及用户提供的运行截图，实现带想法的素材卡片、自由画布、自动归组和人工纠偏。此仓库与 Contexty 原团队无关联，也未使用其未公开源码。

## 运行

需要 Node.js 20 或更新版本。首次运行先安装依赖。

```powershell
npm install
```

如果 Electron 下载失败，可使用其官方文档列出的镜像后重试安装：

```powershell
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
npm install
npx install-electron
```

推荐启动桌面版：

```powershell
npm run desktop
```

桌面版会在 `http://127.0.0.1:4174` 启动画布。在 Chrome、PDF 页面或其他应用中按 `Ctrl+Shift+S`，拖动框选屏幕区域，在弹窗中写下想法并发送。截图会成为画布中的素材卡片。也可以点击桌面版画布底部的“截屏”按钮。按 `Esc` 可取消截图。目前每次截取鼠标所在的显示器。

如只需查看画布，也可以单独启动网页服务：

```powershell
npm start
```

打开 `http://127.0.0.1:4173`。

如需让 AI 分析新捕捉的图片与文字，可在启动前设置 `OPENAI_API_KEY`。可选设置 `OPENAI_MODEL`，默认 `gpt-4.1-mini`。密钥只由本地服务器读取，不写入网页或浏览器存储。未配置密钥时，卡片标题、意图和分组使用本地规则生成初稿。

```powershell
$env:OPENAI_API_KEY = '你的密钥'
npm start
```

## 功能与边界

桌面版支持系统快捷键截取屏幕区域，也可以从剪贴板读取文字，再写下当时的想法。卡片在画布上保留截图、来源、标签、系统理解和个人想法。画布可拖拽、缩放、创建分组和便签；把卡片拖进分组或移到空白处可纠正归组，也可在编辑窗口直接修改标题、标签和理解。左侧概览同步展示分组和卡片。画布保存在应用本地，也可导入导出 JSON。

浏览器端无法可靠读取其他应用中的选中文字，需先复制到剪贴板。没有配置模型密钥时，截图内容不会自动识别。桌面截图目前只记录截图与想法，尚未自动读取来源应用和网址。基于画布的聊天功能按本轮需求暂缓实现。完整 Contexty 应用没有公开操作入口，因此界面及实现细节依据公开材料与用户截图重建。

## 验证

```powershell
npm test
```

参考资料：[Contexty 网站](https://contexty.kixlab.org/) · [论文](https://contexty.kixlab.org/assets/contexty_paper.pdf) · [REA](https://github.com/morluto/rea)
