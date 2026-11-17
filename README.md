# Brandnew Contexty

面向自媒体脚本创作的 Contexty 功能原型。依据 Contexty 公开网站、论文及演示视频实现带想法的素材卡片、自动归组、人工纠偏，以及基于修正后画布的问答。此仓库与 Contexty 原团队无关联，也未使用其未公开源码。

## 运行

需要 Node.js 20 或更新版本，无需安装依赖。

```powershell
npm start
```

打开 `http://127.0.0.1:4173`。

启用 AI 综合回答时，在启动前设置环境变量 `OPENAI_API_KEY`。可选设置 `OPENAI_MODEL`，默认 `gpt-4.1-mini`。密钥只由本地服务器读取，不写入网页或浏览器存储。未配置密钥时，系统进入无模型演示模式，按照当前画布素材展示引用结果。

```powershell
$env:OPENAI_API_KEY = '你的密钥'
npm start
```

## 功能与边界

可以添加或粘贴文字片段，记录来源与个人想法，编辑标签、AI 意图理解、分组和使用状态。系统会根据关键词匹配推荐一个分组。用户可以拖动卡片纠正分组。当前脚本卡片与人工修正后的字段会送入问答；未来选题和暂不使用的卡片不会进入回答上下文。画布保存在浏览器本地，也可导入导出 JSON。

屏幕捕获目前保存画面图片，用户需手动补充可供模型使用的文字描述。浏览器端无法可靠读取其他应用中的选中文字，需先复制到剪贴板。自动分组与初始意图建议采用本地规则，人工修改始终优先。完整 Contexty 应用没有公开操作入口，因此界面及实现细节是根据公开材料重建的原型。

## 验证

```powershell
npm test
```

参考资料：[Contexty 网站](https://contexty.kixlab.org/) · [论文](https://contexty.kixlab.org/assets/contexty_paper.pdf) · [REA](https://github.com/morluto/rea)
