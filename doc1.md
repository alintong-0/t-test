你好！我是资深游戏前端开发工程师。为了让 AI（如 Claude 3.5 Sonnet、GPT-4o 或 GitHub Copilot）能够精准地为你生成高质量、低 Bug 的代码，我将策划文档转化为了这份**《AI 驱动开发（AIDD）技术规格说明书》**。

这份文档采用了**面向对象设计（OOD）与组件化思维**，并为 AI 准备了可以直接读取的“逻辑 Prompt”。

---

# AI 驱动开发技术规格说明书：消除大龙 (Wool Crush)

## 1. 核心开发环境设定

* **目标平台**：微信小游戏 / 移动端 (Cocos Creator 3.x 或 Unity 2022+)
* **编程语言**：TypeScript / C#
* **坐标系**：2D 笛卡尔坐标系
* **关键依赖**：Tween 动画库 (如 GSAP, DOTween 或引擎内置 Tween)

---

## 2. 数据结构定义 (Data Schema)

### 2.1 毛线球实体 (Ball Entity)

```typescript
enum Direction { UP, DOWN, LEFT, RIGHT }

interface Ball {
    id: string;
    color: string;      // 颜色标识
    points: number;     // 对冲点数
    dir: Direction;     // 箭头方向
    isMoving: boolean;  // 状态锁，防止位移中被点击
}

```

### 2.2 大龙段实体 (Dragon Segment)

```typescript
interface DragonSegment {
    color: string;
    currentHP: number;
    maxHP: number;
    node: Node;         // 渲染节点
}

```

---

## 3. 核心模块逻辑实现 (Prompt-Ready)

### 3.1 射线碰撞检测算法 (Raycast Check)

这是游戏最核心的限制逻辑。AI 需要实现一个非物理系统的“逻辑射线”。

> **AI 编写指令 (Prompt)**：
> “请实现一个函数 `checkPathClear(selectedBall, allBalls)`。逻辑如下：根据 `selectedBall.dir` 的方向，在二维空间内检查是否有其他球的坐标处于该射线上。返回 `true` 表示路径无阻挡。注意：需设置一个微小的 `threshold`（阈值）来处理浮点数坐标偏差。”

### 3.2 槽位管理与解锁逻辑 (Slot Controller)

处理 4+3 动态槽位。

> **AI 编写指令 (Prompt)**：
> “创建一个 `SlotManager` 类。初始化一个长度为 7 的数组。前 4 个元素状态为 `Active`，后 3 个为 `Locked`。提供 `addBall(ball)` 方法：
> 1. 检查是否有空余的 `Active` 槽位。
> 2. 若无空位但点击了 `Locked` 槽位，触发 `onShowAd` 回调。
> 3. 广告成功后，将 `Locked` 改为 `Active` 并存入球。”
> 
> 

### 3.3 大龙动态推进与后退补位 (Dragon Recoil System)

这是最复杂的动画逻辑，涉及链表操作。

> **AI 编写指令 (Prompt)**：
> “实现大龙的位移系统：
> 1. **推进**：每帧根据 `baseSpeed` 增加大龙所有节点的 X 坐标。
> 2. **对冲**：当球进入槽位，对比 `DragonSegments[0]` 的颜色。匹配则 `HP -= ball.points`。
> 3. **后退与重排**：若 `HP <= 0`，移除该 Segment。大龙整体 X 坐标减少 `recoilDistance`。关键点：后续所有 Segment 需通过 Tween 动画平滑移动到前一个 Segment 的位置，消除间隙。”
> 
> 

---

## 4. 关键 API 接口设计

| 函数名 | 输入参数 | 返回值 | 说明 |
| --- | --- | --- | --- |
| `onBallClick` | `ballEntity` | `void` | 入口函数，先调射线检测，再调入槽逻辑。 |
| `executeMatch` | `ball, segment` | `boolean` | 处理对冲数值计算，返回该段是否被销毁。 |
| `updateDragonPos` | `deltaTime` | `void` | 处理大龙向终点线推进的物理位移。 |
| `checkGameOver` | `dragonHeadPos` | `void` | 判定是否触碰 `FinishLine`。 |

---

## 5. 极端情况状态机 (Edge Case Handling)

1. **Input Lock (输入锁)**：
* 在 `Ball` 执行 `moveToSlot` 的 Tween 期间，设置 `globalInputInteractable = false`。
* 防止玩家快速点击多个球导致射线检测在球体移动过程中失效。


2. **Visual Buffer (表现缓冲)**：
* 大龙后退与补位应采用 `Sequence` 动画。先执行整体后退（Recoil），再执行局部补位（Fill Gap），确保玩家视觉清晰。


3. **Last Chance (最后机会)**：
* 当 `Dragon.Head.X >= FinishLine.X` 时，启动 0.5 秒倒计时。若此期间槽位内有球正在消除且导致大龙后退，则取消失败逻辑。



---

## 6. 给 AI 的集成 Prompt 示例

如果你想让 AI 直接生成核心控制器，请使用以下 Prompt：

> "你是一个高级游戏开发工程师。请根据以下规则使用 [TypeScript/C#] 编写 `GameCoreController`：
> 1. 维护一个 `List<Ball>` 场景集合和一个 `List<Segment>` 大龙集合。
> 2. 实现基于方向的射线检测逻辑。
> 3. 实现大龙的匀速推进逻辑，速度随时间 $V = V_0 \times (1 + t/60)$ 增加。
> 4. 实现对冲后大龙的后退（Recoil）和节点补位（Tween Shift）逻辑。
> 5. 槽位初始解锁 4 个，广告回调解锁剩余 3 个。
> 请确保代码结构清晰，解耦动画表现与数值逻辑。"
> 
> 

---

**下一步建议：**
你需要我为你生成具体的**前端 UI 预制体结构建议**，还是直接针对某个模块（如**大龙补位算法**）输出**完整的代码实现**？