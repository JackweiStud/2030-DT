# BF-005 Case2：Initial 加载失败无界面说明

- Status: open
- Severity: P1
- Area: `code/web` Case2
- 一次只修这一条

## 现象

进页后热力空槽、启动按钮灰色，徽标仍是「等待启动测试」。操作员不知道是 Initial 六文件读失败。

## 关键代码

- `code/web/src/cases/case2/state/case2Reducer.ts`：`initialError` 已写入；`statusFeedbackText` 无此分支
- `code/web/src/cases/case2/Case2Page.tsx`：不渲染 `state.initialError`
- `code/web/src/cases/case2/case2.css`：已有未使用的 `.initial-error`
- 对照：Case3 `CASE3_INIT_DATA_ERROR_BADGE` = 「case3初始化数据异常」

## 建议修法

`statusFeedbackText` 在非 `adapterError` 且存在 `initialError` 时显示「case2初始化数据异常」（或同等短文案），徽标走 `is-error`。不要把后端 `execute fail` 和 Initial 失败混成「执行命令失败」。

## 验收

- [ ] Initial GET 失败：徽标错误态 + 启动不可点。
- [ ] 探活补拉 Initial 成功后徽标回到「等待启动测试」。
- [ ] 有单测覆盖文案选择器。
