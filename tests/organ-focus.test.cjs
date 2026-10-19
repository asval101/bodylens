const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mergeBounds, fitCamera } = require('../organ-focus.js');

test('分组器官以全部可见图层的并集聚焦，不丢失另一侧肺', () => {
  assert.deepEqual(mergeBounds([
    { x: 154, y: 150, width: 40, height: 97 },
    { x: 206, y: 153, width: 41, height: 94 },
    { x: 0, y: 0, width: 0, height: 0 },
    { x: NaN, y: 0, width: 10, height: 10 }
  ]), { x: 154, y: 150, width: 93, height: 97 });
  assert.equal(mergeBounds([]), null);
});

test('不同宽度与高矮器官均完整落在标题和说明卡之间', () => {
  for (const width of [626, 425, 342, 280]) {
    for (const bounds of [
      { x: 89, y: 115, width: 93, height: 127 },
      { x: 128, y: 70, width: 14, height: 260 },
      { x: -25, y: 55, width: 290, height: 80 }
    ]) {
      const camera = fitCamera({ width, height: 540 }, bounds);
      const left = camera.x + bounds.x * camera.scale;
      const top = camera.y + bounds.y * camera.scale;
      assert.ok(left >= 26 - 1e-9);
      assert.ok(top >= 82 - 1e-9);
      assert.ok(left + bounds.width * camera.scale <= width - 26 + 1e-9);
      assert.ok(top + bounds.height * camera.scale <= 540 - 184 + 1e-9);
    }
  }
});

test('无尺寸或非有限几何数据拒绝进入镜头，避免无穷缩放与空白视图', () => {
  const frame = { width: 400, height: 540 }, bounds = { x: 20, y: 30, width: 70, height: 90 };
  assert.equal(fitCamera(frame, { ...bounds, width: 0 }), null);
  assert.equal(fitCamera(frame, { ...bounds, x: Infinity }), null);
  assert.equal(fitCamera({ width: 0, height: 540 }, bounds), null);
  assert.equal(fitCamera({ width: 400, height: 100 }, bounds), null);
  assert.equal(fitCamera(null, bounds), null);
});

test('小器官限制放大倍率，且仍居中于可用视野', () => {
  const camera = fitCamera({ width: 600, height: 600 }, { x: 110, y: 30, width: 3, height: 4 });
  assert.equal(camera.scale, 9);
  assert.equal(camera.x + 111.5 * camera.scale, 300);
  assert.equal(camera.y + 32 * camera.scale, 82 + (600 - 82 - 184) / 2);
});
