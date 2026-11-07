# 视频页跟手 Feed 改造 · 设计稿（2026-11-07）

## 意图与为什么

视频页当前为单播放器整屏切换：滑动后需等待装载、无跟手滚动，进度条被悬浮 tab 胶囊罩住且从未接 seek。用户要求对齐原版（REA IMG_1494）与抖音的体验：画面跟着手指滚动、相邻视频预先载好、滚动中两个视频同屏都在播。

## 目标

1. **跟手垂直分页**：`FlatList pagingEnabled` + `snapToInterval=视口高`，松手吸附；滚动过程中上下视频同屏、都在播。
2. **预加载**：每个视频独立 `useVideoPlayer`，由列表窗口机制天然预挂载/预装载，切换无黑屏等待。
3. **进度条可用**：移到 tab 胶囊上方；支持点按 + 拖动 seek（`player.currentTime`，拖动中即时显示目标位置）。
4. **保留既有能力**：长按 350ms 2x 徽章、右侧 ♡↑🗑↩、左下时间+位置、markSeen（吸附定格时记已读）、iCloud 云端守卫、循环播放、错误 toast。
5. **组尾续拉**：滑到当前组末尾自动**追加**下一组（列表不清空、无感续流）；无可拉时进入"已全部回顾"空态。

## 非目标

- 不做点赞/评论/feed 推荐算法；不改 dev build；不动照片 tab 与回到那天。

## 约束

- 仅 Expo Go 内置模块：expo-video + RN FlatList（FlashList 含原生代码，排除）。
- 视频 URI：DB 的 `localIdentifier` 本身即 `ph://…`，直接作播放器源（构造函数/`replaceAsync` 支持）；`getIsInCloud` 守卫仍需原始 id 剥前缀规则不变。
- RN 0.88：视口尺寸用 `useWindowDimensions`；worklet 调 JS 用 `runOnJS`。

## 方案（用户已选 A）

- **A（选定）**：FlatList 垂直分页 + 每格独立播放器。expo-video 官方 feed 模式，Expo Go 可跑。
- B（弃）：双缓冲手写跟手动画——重造 pager，只支持单向预载。
- C（弃）：FlashList——Expo Go 无原生模块。

## 关键设计决定

1. **结构**：`(videos)/index.tsx` 拆为 Feed（FlatList + 覆盖层）与 `VideoCell`（播放器+装载）。覆盖层（右钮/时间地点/进度条）绝对定位在列表外，由 `currentIndex` 驱动。
2. **当前项判定**：`onMomentumScrollEnd` 吸附定格 → `currentIndex = round(y/视口高)`；定格时对上一条 `markSeen`；非当前 cell `pause()`，当前 cell `play()`。
3. **装载**：cell 挂载即 `replaceAsync(ph uri)` + `audioMuted` 不设、循环开；`statusChange` 错误上报保留。云端视频：cell 显示占位文案，不阻塞列表。
4. **进度条几何**：`bottom = 胶囊顶(12+62) + 8 ≈ 82`，左右 18；高 3pt 轨道 + 白色填充；拖动用 `PanResponder`，松手 `player.currentTime = ratio×duration`。
5. **长按 2x 与列表手势共存**：cell 内 `Gesture.LongPress(350ms, maxDistance 12)`；与 FlatList 滚动的竞争关系实测优先，若冲突则降级为右侧"2x"切换小钮（实现者裁量，以真机为准）。
6. **删除/撤回**：行为不变（入队 + 定格前进）；撤回钮语义不变。

## 留给实现者的

- cell 回收时播放器释放/复用细节、`windowSize` 取值、滚动状态与覆盖层动画（时间/位置文案切换过渡）等实现级选择。

## 验收

真机（隧道 Expo Go）：连续下滑 3+ 视频无等待黑屏、滚动中双画面在播；进度条可点可拖且不被 tab 栏吃掉；长按 2x、收藏、删除撤回正常；组尾自动续下一组。
