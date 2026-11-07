/** R2 自动弹抑制水位（T7.3 裁决1）：X 关闭时记录队列长度，仅当队列增长超过水位才再弹 */
let level = 0;

export function getSuppressionLevel(): number {
  return level;
}

export function setSuppressionLevel(n: number): void {
  level = n;
}
