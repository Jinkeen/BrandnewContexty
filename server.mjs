import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { relevantCards, inferIntent, suggestGroup } from './core.mjs';

const root = resolve('public');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

function send(res, code, data, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data));
}

async function body(req) {
  let content = '';
  for await (const chunk of req) {
    content += chunk;
    if (content.length > 5_000_000) throw new Error('请求内容过大');
  }
  return JSON.parse(content);
}

async function answer(question, cards, groups) {
  const chosen = relevantCards(question, cards, groups);
  const evidence = chosen.map((card, i) => `[${i + 1}] ${card.text.slice(0, 500)}\n用户想法：${card.memo}\n已确认的理解：${card.intent}\n来源：${card.source || '未记录'}`).join('\n\n');
  if (!process.env.OPENAI_API_KEY) return {
    mode: 'demo',
    text: chosen.length
      ? `当前处于无模型演示模式。根据画布中用于当前脚本的素材，与你的问题最相关的是：\n\n${chosen.map((card, i) => `[${i + 1}] ${card.intent}。${card.text.slice(0, 100)}${card.text.length > 100 ? '…' : ''}`).join('\n\n')}\n\n配置 OPENAI_API_KEY 后可生成综合回答。`
      : '当前画布没有标为“用于当前脚本”的素材。请先添加或调整卡片。',
    cardIds: chosen.map(card => card.id)
  };
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      instructions: '你是自媒体脚本素材助手。仅根据提供的当前脚本素材回答。尊重用户亲自修改的意图、标签和分组。引用素材编号。证据不足时明确指出。不要把未来选题素材用于当前脚本。',
      input: `问题：${question}\n\n当前画布素材：\n${evidence || '无'}`
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || '模型请求失败');
  return { mode: 'ai', text: (data.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('\n'), cardIds: chosen.map(card => card.id) };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/interpret') {
      const data = await body(req);
      const text = String(data.text || '').slice(0, 4000);
      const memo = String(data.memo || '').slice(0, 2000);
      const groups = Array.isArray(data.groups) ? data.groups.slice(0, 100) : [];
      if (!memo) return send(res, 400, { error: '请填写当时的想法' });
      if (!process.env.OPENAI_API_KEY) {
        const card = { text, memo, tags: [] };
        return send(res, 200, { mode: 'rule', title: (text || memo).slice(0, 18), intent: inferIntent(memo), tags: [], groupId: suggestGroup(card, groups) });
      }
      const content = [{ type: 'input_text', text: `当前脚本主题：${String(data.topic || '').slice(0, 1000)}\n素材文字：${text}\n用户当时的想法：${memo}\n现有分组：${groups.map(g => `${g.id}: ${g.name}`).join('; ')}\n请返回 JSON 对象，包含 title、intent、tags（字符串数组）、groupId（现有分组 id 或 null）。理解用户想法时保留不确定性，不得补造素材内容。` }];
      if (typeof data.image === 'string' && /^data:image\/(jpeg|png);base64,/.test(data.image)) content.push({ type: 'input_image', image_url: data.image });
      const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', input: [{ role: 'user', content }] }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || '模型请求失败');
      const output = (result.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('\n');
      const parsed = JSON.parse(output.replace(/^```(?:json)?\s*|\s*```$/g, ''));
      return send(res, 200, { mode: 'ai', title: String(parsed.title || (text || memo).slice(0, 18)).slice(0, 80), intent: String(parsed.intent || inferIntent(memo)).slice(0, 500), tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 8) : [], groupId: groups.some(g => g.id === parsed.groupId) ? parsed.groupId : null });
    }
    if (req.method === 'POST' && req.url === '/api/answer') {
      const data = await body(req);
      if (typeof data.question !== 'string' || !Array.isArray(data.cards) || !Array.isArray(data.groups)) return send(res, 400, { error: '请求格式不正确' });
      return send(res, 200, await answer(data.question.slice(0, 2000), data.cards.slice(0, 100), data.groups.slice(0, 100)));
    }
    if (req.method !== 'GET') return send(res, 405, { error: '不支持的方法' });
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = pathname === '/core.mjs' ? resolve('core.mjs') : resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (pathname !== '/core.mjs' && !file.startsWith(root)) return send(res, 403, 'Forbidden', 'text/plain');
    try { return send(res, 200, await readFile(file), types[extname(file)] || 'application/octet-stream'); }
    catch { return send(res, 404, 'Not found', 'text/plain'); }
  } catch (error) { send(res, 500, { error: error.message }); }
});

const port = Number(process.env.PORT || 4173);
server.listen(port, '127.0.0.1', () => console.log(`BrandnewContexty: http://127.0.0.1:${port}`));
