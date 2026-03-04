# Wool Crush 核心逻辑实现

根据仓库中的策划文档（`doc.md`、`doc1.md`）与视频示意，完成了一个可测试的 TypeScript 核心逻辑版本，覆盖：

- 方向射线阻挡检测（`checkPathClear`）
- 4+3 动态槽位（`SlotManager`，含广告解锁回调）
- 大龙推进 / 对冲 / 后退补位（`DragonSystem`）
- 游戏入口控制器（`GameCoreController`）

## 快速开始

```bash
npm install
npm test
npm run build
```

## 文件说明

- `src/gameCore.ts`: 核心数据结构与系统实现
- `src/gameCore.test.ts`: 单元测试与集成测试
