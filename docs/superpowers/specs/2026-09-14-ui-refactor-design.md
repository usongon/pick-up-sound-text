# 拾言（Shiyane）前端整体重构设计

日期：2026-09-14 · 分支：`ui-redesign` · 状态：已过对抗验证（红队评审后修订）

## 目标

用 Vite + React 18 + Ant Design 5 替换 `src-ui/` 下 780 行手搓 vanilla 前端，界面焕然一新、美观优雅；全部 7 个 Tauri 命令与拖拽/导出行为保持等价；Rust 后端零改动。

## 选型结论

- **React 18 + antd@^5 + @ant-design/icons + Vite**。antd v6 已发布但 v5 是最稳组合；夜间无人值守选最稳。锁 `antd@^5`，实现时严禁混抄 v6 文档。
- **@tauri-apps/api@^2 + @tauri-apps/plugin-dialog@^2**（npm 包，与 Cargo.lock 中 tauri 2.11.5 / plugin-dialog 2.7.3 同代兼容），关闭 `withGlobalTauri`。
- 不引入路由库（三视图 state 切换）、不引入状态管理库（组件局部 state + hook 足够）。

## 关键决策（对抗验证修订后）

1. **构建配置**（tauri.conf.json 在仓库根，无 src-tauri/）：
   - `build.devUrl: "http://localhost:5173"`
   - `beforeDevCommand: { "script": "npm run dev", "cwd": "src-ui" }`（HookCommand 对象带 cwd）
   - `beforeBuildCommand: { "script": "npm run build", "cwd": "src-ui" }`
   - `frontendDist: "./src-ui/dist"`（相对配置文件解析；`../dist` 会越出仓库）
   - 删除 `withGlobalTauri`
2. **Vite**：`server.port: 5173, strictPort: true`（防端口漂移白屏）、`clearScreen: false`、`envPrefix: ['VITE_', 'TAURI_']`。
3. **.gitignore**：补 `node_modules/`、`src-ui/dist/`。
4. **拖拽**：`dragDropEnabled: true` 会禁用 webview 内 HTML5 drop（tauri#14373），**不用** `<Upload.Dragger>` 的文件逻辑；自绘 dropzone UI，事件源为 `tauri://drag-enter/leave/drop`（payload.paths），点击路径走 `dialog.open`。capabilities 现有 `dialog:allow-open/save` 够用，不改。
5. **浏览器 mock 验证**：dev 浏览器无 `__TAURI_INTERNALS__`，invoke 全 reject 会造成假阴性。`?mock=1` 时启用 mock 层（模拟 invoke/listen/dialog 与进度推进），用于视觉截图与交互验证；Tauri 窗口不带参数走真实通道。
6. **数据契约**（保持与 `src/config/mod.rs` 完全一致）：
   - AppConfig JSON 字段全 snake_case：`file_model / realtime_model / workspace_id / target_lang / access_key_id / access_key_secret / path_prefix / api_key`
   - `oss` 四项全空 → 存 `null`；`workspace_id`/`path_prefix` 空串 → `null`
   - `get_config` 返回解密后的 api_key，表单回填；保存时原样带回（漏带会清空密钥）
   - invoke 命令参数 camelCase：`videoPath / sourceLanguage / config / format`
7. **React 18 StrictMode**：`listen()` 返回 Promise\<UnlistenFn\>，cleanup 必须 await 后 unlisten；进度轮询用 ref 防双 interval。
8. **应用图标**：`bundle.icon` 为空会导致 `cargo tauri build` 失败；先 `cargo tauri icon icons/icon.png` 并回填。
9. **长命令**（cargo build/dev）用 `caffeinate -is` 包裹防系统睡眠。
10. **productName 保持 ASCII "Shiyane"**。

## UI 设计

### 布局

- AntD `Layout`：左侧固定 Sider（240px，暗色 `#0e1116` 系）+ 右侧内容区。
- Sider：顶部品牌区（自绘 SVG 标记 + 「拾言」+ 副题 "把声音变成字幕"），中部 Menu（文件转字幕 / 实时字幕 / 设置），底部主题切换 + 版本号。
- 内容区：内边距 32px，内容 `max-width: 880px` 居中；浅色底 `#f7f8fa`；暗色模式全 darkAlgorithm。

### 视觉主题（ConfigProvider token）

- 品牌主色 teal 系 `#0d9488`（声音的清透感，避开"后台蓝"）；`colorInfo` 同步；`borderRadius: 10`；`fontSize: 14`；`controlHeight` 默认；字体栈 `-apple-system, "PingFang SC", "HarmonicOS Sans SC", "Microsoft YaHei", sans-serif`。
- 暗色：`theme.darkAlgorithm` + 微调 token，与 Sider 融为一体。
- 强调质感：任务卡 hover 阴影过渡、进度条圆角胶囊、状态用 AntD Tag/Progress 自带色系，整体克制留白。

### 三个视图

1. **文件转字幕**（默认）
   - 大拖拽卡（min-height 260px）：虚线边框、中心 Upload 图标（teal 渐变圆底）、主文案"拖入视频文件"、副文案格式提示；dragover 高亮；选中后变为文件卡（文件名/类型图标/"重新选择"）。
   - 语言选择（Select，自动识别/中/英/日/韩）+ 「开始转字幕」主按钮（未选文件禁用）。
   - 任务卡：文件名 + 状态 Tag（处理中/已完成/失败）+ Progress（0-100%）+ 状态文案；完成后浮现「导出 SRT / 导出 VTT」按钮组；失败红色展示 error。
   - 无任务时整页空态不刺眼（拖拽卡即空态）。
2. **实时字幕**：优雅占位——Empty + 说明 + "开发中" Tag；不造假功能。
3. **设置**：三个分区 Card（ASR / 翻译 / OSS）+ Form：
   - provider 切换自动填默认模型（保留现有行为）
   - API Key 用 `Input.Password`
   - 每分区「测试连通性」按钮：读**当前表单值**构造完整 config（测试翻译时 oss 传 null），loading + message 结果
   - 底部「保存配置」主按钮；保存成功 message
   - 加载失败/空配置给默认值兜底

### 反馈升级

`alert()` / 手写 status div 全部替换为 AntD `message` / `Result` / 内联错误文本。

## 验证策略（无人值守门禁）

1. `npm run build`（tsc + vite build）通过
2. `cargo tauri dev`：devUrl HTTP 200、窗口进程存活、computer-use 截图确认真实渲染
3. 浏览器 `?mock=1`：三视图全状态截图（含进度推进→完成→导出按钮、设置校验、暗色）
4. `cargo tauri build` 生产构建通过
5. 真实拖拽文件冒烟：无法自动化，留晨间人工（在总结中给出 3 步冒烟清单）
6. Rust 测试不受影响（前端不碰 Rust）

## 阶段划分

- **S0 脚手架**：.gitignore、package.json、vite、tsconfig、tauri.conf.json、入口跑通（AntD hello）→ build + dev 双验证
- **S1 框架与主题**：Layout/Sider/暗色切换/三视图骨架 + mock 层 → 截图
- **S2 设置页**：Form + 契约 + 测试/保存 → Tauri 窗口实测
- **S3 文件页**：拖拽 + 轮询 + 任务卡 + 导出 → mock 全状态截图 + Tauri 窗口实测 dialog
- **S4 打磨**：实时页、空态、细节动效 → 截图评审
- **S5 收尾**：icon + `cargo tauri build` + README 更新 + 最终对抗评审

每阶段一次 commit；每阶段完成后按本设计的验证门禁自查。
