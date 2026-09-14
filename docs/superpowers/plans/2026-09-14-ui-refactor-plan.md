# UI 重构实现计划（2026-09-14）

设计文档：`docs/superpowers/specs/2026-09-14-ui-refactor-design.md`（对抗验证后修订版，以下步骤以其为准）

每阶段：实现 → 运行验证门禁 → git commit。失败则修复后重跑门禁，禁止带病提交。

## S0 脚手架（改动：.gitignore、tauri.conf.json、src-ui/ 重建）

1. `.gitignore` += `node_modules/`、`src-ui/dist/`
2. 删除 src-ui/{index.html,main.js,style.css}，新建：
   - `src-ui/package.json`（react@18, antd@^5, @ant-design/icons, @tauri-apps/api@^2, @tauri-apps/plugin-dialog@^2；dev: vite, @vitejs/plugin-react, typescript, @types/react*）
   - `src-ui/vite.config.ts`（port 5173 strictPort, clearScreen false, envPrefix）
   - `src-ui/tsconfig.json`（严格模式）
   - `src-ui/index.html`、`src-ui/src/main.tsx`、`src-ui/src/App.tsx`（AntD ConfigProvider + Button hello）
3. `tauri.conf.json`：devUrl/beforeDevCommand(带 cwd)/beforeBuildCommand(带 cwd)/frontendDist=`./src-ui/dist`，删 withGlobalTauri
4. 门禁：`npm install` → `npm run build` 通过 → `cargo tauri dev`（caffeinate 包裹）devUrl 200 + 窗口出现

## S1 框架与主题

1. `src/theme.ts`：light/dark token；`src/lib/types.ts`：AppConfig 等 TS 类型（snake_case）
2. `src/lib/backend.ts`：isTauri() 检测、invoke/listen/dialog 的统一封装；`?mock=1` 时路由到 `src/lib/mock.ts`（模拟 7 命令 + drag 事件 + 进度自动推进）
3. `App.tsx`：Layout + Sider（品牌区 SVG、Menu 三项、底部暗色开关）+ 内容区容器 + 视图 state 切换
4. 三视图骨架文件
5. 门禁：build 通过；浏览器 `?mock=1` 截图浅/暗两版

## S2 设置页

1. SettingsPage：三 Card + Form（字段与契约逐字段对照 spec 第 6 条）；provider→默认模型联动；测试按钮（表单现值构造 config，翻译测试 oss:null）；保存（oss 折叠、空串转 null）；加载回填含 api_key
2. 门禁：build；mock 截图；Tauri 窗口（computer-use）打开设置改一项保存 → message 成功 → 重载回填正确
3. 对照旧 main.js saveConfig/loadConfig/testAsr/testTranslate 逐行为核对

## S3 文件页

1. Dropzone 组件（tauri://drag-* 事件、点击 dialog.open、mock 点击假选文件）；语言 Select + 开始按钮（禁用态）；任务卡（Tag/Progress/文案/导出按钮组）；1s 轮询（ref 防重、unmount 清理）；失败 error 展示
2. 门禁：build；mock 截图全状态（拖入→处理中→完成→导出、失败）；Tauri 窗口验证拖拽监听注册 + dialog 弹出
3. 对照旧 main.js handleFilePath/startProgressPolling/updateProgress/exportSubtitle 逐行为核对

## S4 打磨

1. 实时字幕占位页（Empty+说明）；空态细节；hover 过渡；字体微调；暗色全页走查
2. 门禁：mock 全页面浅/暗截图走查（自评清单：留白/对齐/层次/一致性）

## S5 收尾

1. `cargo tauri icon icons/icon.png` → 回填 bundle.icon → `cargo tauri build` 通过
2. README.md / README.en.md 技术栈与开发说明更新（React+AntD+Vite、npm install 步骤）
3. 最终对抗评审（subagent 读 diff 攻击）+ 修复
4. 总结：变更清单 + 晨间 3 步人工冒烟（真实拖拽→处理→导出）
