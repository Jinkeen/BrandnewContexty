import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestGroup, inferIntent, relevantCards, replaceSelectedSegment } from './core.mjs';

test('新素材可以按内容归到相关分组', () => {
  const group = { id: 'travel', name: '旅行打包', description: '旅行背包清单' };
  assert.equal(suggestGroup({ text: '旅行背包', memo: '打包清单', tags: [] }, [group]), 'travel');
});

test('用户修改后的理解会进入回答上下文，未来选题不会进入', () => {
  const cards = [
    { id: 'a', text: '背包有 20 L 容量', memo: '广告段', intent: '用户确认只引用容量', tags: [], groupId: 'g', status: 'current' },
    { id: 'b', text: '背包旅行城市漫游', memo: '下次再写', intent: '未来选题', tags: [], groupId: 'g', status: 'future' }
  ];
  const result = relevantCards('背包', cards, [{ id: 'g', name: '旅行' }]);
  assert.deepEqual(result.map(card => card.id), ['a']);
  assert.equal(result[0].intent, '用户确认只引用容量');
});

test('未来使用意图得到明确提示', () => {
  assert.match(inferIntent('未来再做一个城市漫游选题'), /未来选题/);
});

test('采用 AI 建议只替换选中的段落，源文变化且定位不唯一时拒绝替换', () => {
  assert.equal(replaceSelectedSegment('开头。旧段落。结尾。', '旧段落', '新段落', 3, 6), '开头。新段落。结尾。');
  assert.equal(replaceSelectedSegment('开头。补充。结尾。', '补充', '更具体的补充', 0, 2), '开头。更具体的补充。结尾。');
  assert.equal(replaceSelectedSegment('重复。重复。', '重复', '新版', 9, 11), null);
});
