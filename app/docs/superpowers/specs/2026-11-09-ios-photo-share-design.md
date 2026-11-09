# iOS 照片/视频真实分享 — 设计文档（2026-11-09）

## 意图与背景

拾光 iOS 端两处分享入口（「回到那天」详情页 ↑ 钮、视频 Feed 分享钮）当前调用
`Share.share({ url: ph://… })`，把相册内部协议地址交给系统分享面板。面板能弹出，
但微信/邮件/AirDrop 等接收方无法解析 `ph://`，实际分享内容为空——即"分享不是
实际功能"。本设计让 iOS 分享真正带出**原始媒体文件本身**。

## 目标

- 详情页与视频 Feed 的分享钮在 iOS 上分享原图/原视频文件（接收方拿到完整原始媒体）
- 实况照片（Live Photo）分享其**静态原图**（用户已确认；文件通道无法打包实况对）
- iCloud 优化存储下本地无文件的资产：先触发下载再分享，等待期间给轻量提示
- 全程可在 Expo Go 中验证（仅使用 expo-media-library / expo-sharing，均已在依赖中）

## 非目标

- 不做水印/排版加工分享图（用户已确认分享原文件）
- 不改 review 页纯文案分享（工作正常）
- 不改任何安卓代码路径
- 不分享实况照片的配对视频

## 约束与边界（与安卓侧 agent 隔离）

- `src/lib/share.ts`（shareAssetAndroid）为安卓侧 agent 领地，**只读不动**
- iOS 逻辑放新文件 `src/lib/share.ios.ts`，两个调用点仅替换
  `Platform.OS === 'ios'` 分支内的实现
- 遵循 AGENTS.md：Expo API 以 SDK 58 版本文档为准，不凭记忆写

## 方案对比（用户选定方案 1）

| 方案 | 做法 | 取舍 |
|------|------|------|
| **1. 资产路径直分享（选定）** | `getAssetInfoAsync` 取 `localUri`（相册真实文件路径）→ `expo-sharing.shareAsync(localUri)` | 零拷贝零转码、即点即出；文件名保持相册原名（自用 App 无感） |
| 2. 拷缓存再分享 | 对齐安卓模式复制文件后分享 | iOS 上多一次大文件拷贝，收益仅文件名可控，不值 |
| 3. RN Share.share({url: file://}) | 把 ph:// 换成 localUri 传 RN 分享 | 改动最小但控制力弱（无法设类型/排除目标），且 ph:// 踩坑正是此路产物 |

## 实现要点

`src/lib/share.ios.ts` 导出 `shareAssetIos(assetId: string): Promise<ShareOutcome>`：

1. `MediaLibrary.getAssetInfoAsync(assetId)`（注意 legacy 接口需剥除 `ph://` 前缀，
   项目已有先例）取 `localUri`
2. `localUri` 为空（iCloud 未下载）→ `MediaLibrary`/`Asset.downloadAsync` 触发下载，
   调用点显示"正在准备…"轻量 toast（复用两屏现有 toast 机制），完成后重试取 localUri
3. `Sharing.shareAsync(localUri, { dialogTitle: '分享' })`
4. 错误分类返回：用户取消（静默）/ 下载失败 / 分享失败（toast 提示），调用点据此处理

调用点改造：

- `src/app/day-preview.tsx` `doShare()` iOS 分支 → `shareAssetIos(id)`
- `src/app/(tabs)/(videos)/index.tsx` 分享钮 iOS 分支 → `shareAssetIos(cur.localIdentifier)`

## 留给实现者的判断

- HEIC/HEVC 原格式直接分享，不转码（接收方兼容问题由目标 App 处理）——本设计判断，可推翻
- 分享失败/超时的 toast 文案与时长沿用两屏现有 toast 风格
- 单测：mock expo-media-library / expo-sharing，覆盖 localUri 正常、iCloud 空需下载、
  用户取消、下载失败四类路径（项目 TDD 惯例）

## 验收

- Expo Go（CF 隧道连接）真机：详情页分享照片 → 分享面板出现真实图片预览，
  发给微信/存储到文件后内容为原图
- 实况照片分享出静态原图；视频 Feed 分享出原视频
- iCloud 资产（关 Wi-Fi 或"优化存储"场景）出现准备提示后正常分享
- lint + tsc + jest 全绿；安卓分支零改动（git diff 验证）
