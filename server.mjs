import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { relevantCards, suggestGroup } from './core.mjs';

const root = resolve('public');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const qianwenBaseUrl = 'https://maas.qianwenaiapi.com/compatible-mode/v1';

function aiConfig() {
  const qianwenKey = process.env.QIANWEN_API_KEY || process.env.DASHSCOPE_API_KEY;
  const key = qianwenKey || process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
  const useQianwen = !!(qianwenKey || process.env.AI_API_KEY);
  return {
    key,
    baseUrl: (process.env.AI_BASE_URL || (useQianwen ? qianwenBaseUrl : 'https://api.openai.com/v1')).replace(/\/$/, ''),
    model: process.env.AI_MODEL || process.env.OPENAI_MODEL || (useQianwen ? 'deepseek-v4.1-flash-1017' : 'gpt-4.1-mini')
  };
}

function outputText(data) {
  return (data.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('\n').trim();
}

async function callAi(input, instructions) {
  const config = aiConfig();
  if (!config.key) throw new Error('请先在启动应用的环境中设置 QIANWEN_API_KEY');
  const response = await fetch(`${config.baseUrl}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model, instructions, input })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `模型请求失败（${response.status}）`);
  const text = outputText(data);
  if (!text) throw new Error('模型没有返回可用文字，请重试');
  return text;
}

function send(res, code, data, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data));
}

async function body(req) {
  let content = '';
  for await (const chunk of req) {
    content += chunk;
    if (content.length > 7_000_000) throw new Error('请求内容过大');
  }
  return JSON.parse(content);
}

async function answer(question, cards, groups) {
  const chosen = relevantCards(question, cards, groups);
  const evidence = chosen.map((card, i) => `[${i + 1}] ${card.text.slice(0, 500)}\n用户想法：${card.memo}\n已确认的理解：${card.intent}\n来源：${card.source || '未记录'}`).join('\n\n');
  if (!aiConfig().key) return {
    mode: 'demo',
    text: chosen.length
      ? `当前处于无模型演示模式。根据画布中用于当前脚本的素材，与你的问题最相关的是：\n\n${chosen.map((card, i) => `[${i + 1}] ${card.intent}。${card.text.slice(0, 100)}${card.text.length > 100 ? '…' : ''}`).join('\n\n')}\n\n配置模型 API Key 后可生成综合回答。`
      : '当前画布没有标为“用于当前脚本”的素材。请先添加或调整卡片。',
    cardIds: chosen.map(card => card.id)
  };
  const text = await callAi(`问题：${question}\n\n当前画布素材：\n${evidence || '无'}`, '你是自媒体脚本素材助手。仅根据提供的当前脚本素材回答。尊重用户亲自修改的意图、标签和分组。引用素材编号。证据不足时明确指出。不要把未来选题素材用于当前脚本。');
  return { mode: 'ai', text, cardIds: chosen.map(card => card.id) };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/interpret') {
      const data = await body(req);
      const text = String(data.text || '').slice(0, 4000);
      const memo = String(data.memo || '').slice(0, 2000);
      const groups = Array.isArray(data.groups) ? data.groups.slice(0, 100) : [];
      if (!memo) return send(res, 400, { error: '请填写当时的想法' });
      if (!aiConfig().key) {
        const card = { text, memo, tags: [] };
        return send(res, 200, { mode: 'rule', title: (text || memo).slice(0, 18), tags: [], groupId: suggestGroup(card, groups) });
      }
      const content = [{ type: 'input_text', text: `当前脚本主题：${String(data.topic || '').slice(0, 1000)}\n素材文字：${text}\n用户当时的想法：${memo}\n现有分组：${groups.map(g => `${g.id}: ${g.name}`).join('; ')}\n请返回 JSON 对象，包含 title、tags（字符串数组）、groupId（现有分组 id 或 null）、relevance（高/中/低）、reason（不超过30个汉字）。根据素材及用户想法判断与当前脚本主题的相关度；理由只说与主题的具体关联或偏离。title 概括素材本身，不要把用户想法当作标题。缺乏依据时给低相关，不得补造素材内容。` }];
      if (typeof data.image === 'string' && /^data:image\/(jpeg|png);base64,/.test(data.image)) content.push({ type: 'input_image', image_url: data.image });
      const output = await callAi([{ role: 'user', content }], '请根据素材和用户想法生成简洁的卡片信息，只返回 JSON 对象，不要附加解释。');
      const parsed = JSON.parse(output.replace(/^```(?:json)?\s*|\s*```$/g, ''));
      const relevance = String(parsed.relevance || '').trim().charAt(0);
      if (!['高', '中', '低'].includes(relevance)) throw new Error('模型未返回有效的主题相关度，请重试');
      const reason = String(parsed.reason || '暂未找到与当前主题的明确关联').trim().slice(0, 30);
      return send(res, 200, { mode: 'ai', title: String(parsed.title || (text || memo).slice(0, 18)).slice(0, 80), relevance, reason, tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 8) : [], groupId: groups.some(g => g.id === parsed.groupId) ? parsed.groupId : null });
    }
    if (req.method === 'POST' && req.url === '/api/rewrite-note') {
      const data = await body(req);
      const selectedText = String(data.selectedText || '').trim().slice(0, 2000);
      const noteText = String(data.noteText || '').slice(0, 4000);
      const instruction = String(data.instruction || '').trim().slice(0, 300);
      const card = data.card && typeof data.card === 'object' ? data.card : {};
      if (!selectedText || !noteText.includes(selectedText) || !instruction) return send(res, 400, { error: '请先选中便签文字并填写要求' });
      if (!aiConfig().key) return send(res, 409, { error: '尚未配置模型 API Key。请在启动应用前设置 QIANWEN_API_KEY。' });
      const content = [{ type: 'input_text', text: `当前脚本主题：${String(data.topic || '').slice(0, 1000)}\n原便签全文：${noteText}\n需要处理的选中文字：${selectedText}\n用户要求：${instruction}\n关联素材标题：${String(card.title || '').slice(0, 100)}\n关联素材文字：${String(card.text || '').slice(0, 4000)}\n素材来源：${String(card.source || '').slice(0, 100)} ${String(card.sourceUrl || '').slice(0, 300)}` }];
      if (typeof card.image === 'string' && /^data:image\/(jpeg|png);base64,/.test(card.image) && card.image.length < 5_000_000) content.push({ type: 'input_image', image_url: card.image });
      const text = await callAi([{ role: 'user', content }], '你协助自媒体博主修改便签中的一小段文字。只返回能够替换选中文字的新版本，不要加标题、引号、前言或修改说明。保留原意和博主的表达风格，严格遵循用户要求。若要求补充素材，保留原段落核心并补入有依据的信息；缺乏依据的具体事实不要编造。');
      return send(res, 200, { text: text.slice(0, 5000) });
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
