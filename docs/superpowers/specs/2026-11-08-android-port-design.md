# 拾光 Android 移植 — 设计文档（待批准）

日期：2026-11-08　状态：待用户批准，批准前不动工

## 已裁决（用户确认）

- **定位：个人自用**（一加 15T 侧载），不上架发布。由此简化：
  - 安装走 `adb install`（Ralph 循环直接装/卸，无商店审核约束）
  - 构建用 debug APK（`npx expo run:android` / prebuild+gradle），不做 release 签名、keystore、隐私政策、商店合规
  - minSdk 按一加 15T 的实际 Android 版本设高，不背旧机型兼容包袱
  - 无遥测/统计需求
- **方案 A**：在原仓库新建 `feat/android` 分支，用 `Platform.OS` 收敛平台差异。
  - 不复制独立新项目（B：代码漂移，违反复用原则）
  - 不 Kotlin/Compose 重写（C：丢失全部既有资产）
- **Ralph 式 agent 验证循环**（Android 端可全自动闭环，iOS 端 agent 缺"眼睛"故此前只能人工验收）：
  领任务 → 改码 → `npx jest` → `adb install` → Maestro E2E → `adb screencap` 截图 → agent 看图验收 → 修复 → commit
- **真机连接**：`adb reverse tcp:8081 tcp:8081` 根治（替代 iOS 隧道方案）。

## 复用度评估

现有代码复用约 85%+：83 个 jest 纯函数、expo-router 路由、主题、db/repo、session、deletion 队列、UI 组件全部跨平台可用。

## Android 适配点

- 媒体 URI：`ph://` → `content://`（expo-media-library Android 侧）
- 删除 iCloud 分支：`getIsInCloud` 守卫在 Android 不适用
- Android 11+ 删除必须走 `MediaStore.createDeleteRequest` 系统确认弹窗——与"回收站确认才真删"的既定设计天然契合
- expo-video `nativeControls` 在 Android 为系统播放器 UI，观感与 iOS 不同，需真机确认

## 留给实现者的决策（builder 自行判断）

- Android SDK/JDK 环境安装位置与版本（需 Android Studio 或 cmdline-tools；一加 15T 需开启开发者模式+USB 调试）
- Maestro _flow 覆盖哪些验收场景（首版建议：Feed 滑动定格起播、♡收藏、🗑删除弹窗、↩撤销、组尾续流）
- Craft Anything（storytold/craft-anything）的 Study/Check 工具可选接入循环；early alpha，不进首版依赖

## 范围外

- iOS 侧 Task 4 真机验收仍挂起（隧道/Expo Go 超时未解，用户暂停），与本设计无关。
