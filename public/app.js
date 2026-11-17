import { suggestGroup, inferIntent } from '/core.mjs';

const $ = id => document.getElementById(id);
const KEY = 'brandnew-contexty-v1';
const id = () => crypto.randomUUID();
const demo = {
  topic: '两天一夜的周末旅行，怎样轻装出行又不遗漏必需品？',
  groups: [
    { id: 'g1', name: '开头与痛点', description: '出行时行李过多、忘带东西' },
    { id: 'g2', name: '打包方法', description: '清单、分类、轻装、收纳方法' },
    { id: 'g3', name: '产品信息', description: '背包容量、电脑夹层、广告信息' }
  ],
  cards: [
    { id: 'c1', text: '出门前把证件、充电设备和换洗衣物分别核对一次。', source: '示例网页', memo: '这里可以作为第二条打包建议，不要写成完整清单。', tags: ['清单', '建议'], groupId: 'g2', status: 'current', intent: '用户考虑把核对必需品作为脚本中的第二条建议', image: null, corrections: 0 },
    { id: 'c2', text: '一款 20 L 的多隔层背包，设有独立电脑夹层。', source: '示例广告简报', memo: '只保留这两个可核实的产品信息，放在广告段。', tags: ['背包', '产品信息'], groupId: 'g3', status: 'current', intent: '用户希望在广告段准确说明容量与电脑夹层', image: null, corrections: 0 },
    { id: 'c3', text: '周末旅行也可以围绕城市散步设计系列内容。', source: '示例 AI 对话', memo: '这是下次城市漫游选题，当前打包脚本先不用。', tags: ['未来选题'], groupId: null, status: 'future', intent: '用户希望保留素材，用于未来的城市漫游选题', image: null, corrections: 0 }
  ]
};
let state;
try { state = JSON.parse(localStorage.getItem(KEY)) || structuredClone(demo); } catch { state = structuredClone(demo); }
let editing = null;
let pendingImage = null;
let filter = 'all';
let cropSource = null;
let cropRect = null;
let cropStart = null;

function save() { localStorage.setItem(KEY, JSON.stringify(state)); render(); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }
function cardHtml(card) {
  return `<article class="card" draggable="true" data-id="${esc(card.id)}"><div class="card-title">${esc(card.text.slice(0, 55))}${card.text.length > 55 ? '…' : ''}</div><div class="card-source">${esc(card.source || '未记录来源')}</div>${card.image ? `<img class="card-image" src="${card.image}" alt="素材截图">` : ''}<div class="card-text">${esc(card.text)}</div><div class="card-memo"><b>我的想法</b>${esc(card.memo || '尚未填写')}</div><div class="card-intent"><b>系统理解 ${card.corrections ? '· 已人工纠正' : '· 可纠正'}</b>${esc(card.intent)}</div><div class="tags"><span class="status ${esc(card.status)}">${{current:'当前脚本',future:'未来选题',unused:'暂不使用'}[card.status]}</span>${card.tags.map(tag => `<span class="tag">${esc(tag)}</span>`).join('')}</div></article>`;
}
function render() {
  $('topic').value = state.topic;
  $('cardCount').textContent = `${state.cards.length} 条素材`;
  $('groupCount').textContent = `${state.groups.length} 个分组`;
  const visible = state.cards.filter(card => filter === 'all' || card.status === filter);
  const columns = [{ id: null, name: '待整理', description: '' }, ...state.groups];
  $('canvas').innerHTML = columns.map(group => {
    const cards = visible.filter(card => card.groupId === group.id);
    return `<section class="group" data-group="${esc(group.id || '')}"><div class="group-head"><div><h3>${esc(group.name)}</h3><small>${cards.length} 条素材</small></div>${group.id ? `<div class="group-actions"><button data-rename="${esc(group.id)}" title="重命名">✎</button></div>` : ''}</div><div class="cards">${cards.length ? cards.map(cardHtml).join('') : '<div class="empty">拖入素材，或添加新卡片</div>'}</div></section>`;
  }).join('');
  document.querySelectorAll('.card').forEach(el => {
    el.addEventListener('click', () => openCard(el.dataset.id));
    el.addEventListener('dragstart', event => event.dataTransfer.setData('text/plain', el.dataset.id));
  });
  document.querySelectorAll('.group').forEach(el => {
    el.addEventListener('dragover', event => event.preventDefault());
    el.addEventListener('drop', event => { event.preventDefault(); const card = state.cards.find(item => item.id === event.dataTransfer.getData('text/plain')); if (card) { card.groupId = el.dataset.group || null; card.corrections++; save(); } });
  });
  document.querySelectorAll('[data-rename]').forEach(el => el.addEventListener('click', () => { const group = state.groups.find(g => g.id === el.dataset.rename); const name = prompt('分组名称', group.name); if (name?.trim()) { group.name = name.trim(); save(); } }));
}

function openCard(cardId = null, text = '', source = '', image = null) {
  editing = cardId;
  const card = state.cards.find(c => c.id === cardId);
  pendingImage = image || card?.image || null;
  $('dialogTitle').textContent = card ? '修改素材与系统理解' : '添加素材';
  $('cardText').value = card?.text || text;
  $('cardSource').value = card?.source || source;
  $('cardMemo').value = card?.memo || '';
  $('cardTags').value = card?.tags.join('，') || '';
  $('cardStatus').value = card?.status || 'current';
  $('cardGroup').innerHTML = '<option value="">待整理</option>' + state.groups.map(group => `<option value="${esc(group.id)}">${esc(group.name)}</option>`).join('');
  $('cardGroup').value = card?.groupId || '';
  $('cardIntent').value = card?.intent || '';
  $('deleteCard').style.visibility = card ? 'visible' : 'hidden';
  $('imagePreview').innerHTML = pendingImage ? `<img src="${pendingImage}" alt="素材截图">` : '';
  $('cardDialog').showModal();
}

$('addCard').onclick = () => openCard();
$('closeDialog').onclick = () => $('cardDialog').close();
$('deleteCard').onclick = () => { if (editing && confirm('删除这张素材卡片？')) { state.cards = state.cards.filter(card => card.id !== editing); $('cardDialog').close(); save(); } };
$('cardMemo').addEventListener('blur', () => { if (!$('cardIntent').value.trim()) $('cardIntent').value = inferIntent($('cardMemo').value); });
$('cardForm').addEventListener('submit', event => {
  event.preventDefault();
  const old = state.cards.find(card => card.id === editing);
  const memo = $('cardMemo').value.trim();
  const generatedIntent = inferIntent(memo);
  const intent = $('cardIntent').value.trim() || generatedIntent;
  const card = { id: old?.id || id(), text: $('cardText').value.trim(), source: $('cardSource').value.trim(), memo, tags: $('cardTags').value.split(/[,，]/).map(t => t.trim()).filter(Boolean), groupId: $('cardGroup').value || null, status: $('cardStatus').value, intent, image: pendingImage, corrections: (old?.corrections || 0) + (old && (old.intent !== intent || old.groupId !== ($('cardGroup').value || null) || old.tags.join() !== $('cardTags').value.split(/[,，]/).map(t => t.trim()).filter(Boolean).join()) ? 1 : 0) };
  if (!card.text) return;
  if (!old && !card.groupId) card.groupId = suggestGroup(card, state.groups);
  if (old) Object.assign(old, card); else state.cards.push(card);
  $('cardDialog').close(); save();
});
$('addGroup').onclick = () => { const name = prompt('新分组名称'); if (name?.trim()) { state.groups.push({ id: id(), name: name.trim(), description: name.trim() }); save(); } };
$('topic').addEventListener('change', () => { state.topic = $('topic').value.trim(); save(); });
document.querySelectorAll('.filter').forEach(el => el.onclick = () => { filter = el.dataset.filter; document.querySelectorAll('.filter').forEach(btn => btn.classList.toggle('active', btn === el)); render(); });
$('captureText').onclick = async () => { try { const text = await navigator.clipboard.readText(); if (!text.trim()) throw new Error('剪贴板没有文字'); openCard(null, text, '剪贴板选中文字'); } catch (error) { alert(`读取失败：${error.message}。也可以点“添加素材卡片”粘贴。`); } };
$('captureScreen').onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const video = document.createElement('video'); video.srcObject = stream; await video.play();
    const canvas = document.createElement('canvas'); canvas.width = Math.min(1200, video.videoWidth); canvas.height = Math.round(video.videoHeight * canvas.width / video.videoWidth);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    stream.getTracks().forEach(track => track.stop());
    cropSource = canvas;
    cropRect = null;
    const preview = $('cropCanvas'); preview.width = canvas.width; preview.height = canvas.height;
    drawCrop(); $('cropDialog').showModal();
  } catch (error) { if (error.name !== 'NotAllowedError') alert(`截图失败：${error.message}`); }
};
function cropPoint(event) { const bounds = $('cropCanvas').getBoundingClientRect(); return { x: Math.round((event.clientX - bounds.left) * $('cropCanvas').width / bounds.width), y: Math.round((event.clientY - bounds.top) * $('cropCanvas').height / bounds.height) }; }
function drawCrop() { const canvas = $('cropCanvas'); const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(cropSource, 0, 0); if (cropRect) { ctx.fillStyle = '#163b3866'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(cropSource, cropRect.x, cropRect.y, cropRect.w, cropRect.h, cropRect.x, cropRect.y, cropRect.w, cropRect.h); ctx.strokeStyle = '#d8ffea'; ctx.lineWidth = 3; ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h); } }
$('cropCanvas').onpointerdown = event => { cropStart = cropPoint(event); $('cropCanvas').setPointerCapture(event.pointerId); };
$('cropCanvas').onpointermove = event => { if (!cropStart) return; const point = cropPoint(event); cropRect = { x: Math.min(cropStart.x, point.x), y: Math.min(cropStart.y, point.y), w: Math.abs(point.x - cropStart.x), h: Math.abs(point.y - cropStart.y) }; drawCrop(); };
$('cropCanvas').onpointerup = () => { cropStart = null; };
$('cancelCrop').onclick = () => $('cropDialog').close();
$('confirmCrop').onclick = () => { const rect = cropRect?.w > 10 && cropRect?.h > 10 ? cropRect : { x:0, y:0, w:cropSource.width, h:cropSource.height }; const canvas = document.createElement('canvas'); canvas.width = rect.w; canvas.height = rect.h; canvas.getContext('2d').drawImage(cropSource, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h); $('cropDialog').close(); openCard(null, '', '屏幕截图', canvas.toDataURL('image/jpeg', .75)); };
$('exportData').onclick = () => { const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'brandnew-contexty.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
$('importData').onclick = () => $('importFile').click();
$('importFile').onchange = async event => { try { const next = JSON.parse(await event.target.files[0].text()); if (!Array.isArray(next.cards) || !Array.isArray(next.groups)) throw new Error('文件格式不正确'); state = next; save(); } catch (error) { alert(error.message); } };
function message(kind, text, cardIds = []) { const el = document.createElement('div'); el.className = `message ${kind}`; el.textContent = text; if (cardIds.length) { const ref = document.createElement('span'); ref.className = 'refs'; ref.textContent = `使用素材：${cardIds.map(cardId => state.cards.findIndex(c => c.id === cardId) + 1).join('、')}`; el.append(ref); } $('messages').append(el); $('messages').scrollTop = $('messages').scrollHeight; }
$('chatForm').onsubmit = async event => { event.preventDefault(); const question = $('question').value.trim(); if (!question) return; message('user', question); $('question').value = ''; const btn = event.target.querySelector('button'); btn.disabled = true; try { const res = await fetch('/api/answer', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ question:`当前脚本主题：${state.topic}\n${question}`, cards:state.cards.map(({image, ...card}) => card), groups:state.groups }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); message('assistant', data.text, data.cardIds); $('modeNote').textContent = data.mode === 'ai' ? '已连接 AI，回答基于当前画布' : '无模型演示模式。配置 OPENAI_API_KEY 可启用 AI 综合回答。'; } catch (error) { message('assistant', `回答失败：${error.message}`); } finally { btn.disabled = false; } };
$('modeNote').textContent = '无模型时可演示素材筛选与引用。配置 OPENAI_API_KEY 启用 AI。';
render();
