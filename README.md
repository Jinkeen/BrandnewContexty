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

点击画布右下角的方框按钮会在视野中央新建空白便签并直接进入输入状态。便签可直接编辑。选中其中一段文字后，可选择“补充素材”“优化表达”或输入自己的要求。AI 在旁边生成一张可编辑的建议便签；点“采用这版”会替换原便签中选中的文字，点“舍弃”会保留原文。

如需调用千问 AI 平台提供的 DeepSeek 模型，请在启动桌面版前设置 `QIANWEN_API_KEY`。默认使用 `deepseek-v4.1-flash-1017`，支持读取关联素材的截图。可用 `AI_MODEL` 和 `AI_BASE_URL` 覆盖模型及接口地址。密钥只由本地服务器读取，不写入画布、浏览器存储或 Git 仓库。未配置密钥时，卡片信息使用本地规则生成初稿，便签的 AI 建议会提示先配置密钥。

```powershell
$env:QIANWEN_API_KEY = '你的密钥'
npm run desktop
```

## 功能与边界

桌面版支持系统快捷键截取屏幕区域，也可以从剪贴板读取文字，再写下当时的想法。卡片在画布上保留截图、来源、标签、与当前脚本主题的相关度及简短理由、个人想法。已有卡片可点“重新评估”，修改左侧主题后旧评估会提示更新。画布中左键点选卡片，右键拖动框选多个卡片，松开右键后可批量隐藏、删除或分组；按住空格并用左键拖动可平移画布。标题、标签、相关度、理由和便签内容均可修改。左侧概览同步展示分组和卡片。画布保存在应用本地，也可导入导出 JSON。

浏览器端无法可靠读取其他应用中的选中文字，需先复制到剪贴板。没有配置模型密钥时，截图内容不会自动识别。桌面截图会尝试读取来源应用及浏览器网址，无法读取时保留来源未记录状态。右侧聊天栏已移除，AI 从便签中的选中文字触发。完整 Contexty 应用没有公开操作入口，因此界面及实现细节依据公开材料与用户截图重建。

## 验证

```powershell
npm test
```

参考资料：[Contexty 网站](https://contexty.kixlab.org/) · [论文](https://contexty.kixlab.org/assets/contexty_paper.pdf) · [REA](https://github.com/morluto/rea)
