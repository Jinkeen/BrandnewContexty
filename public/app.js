import { suggestGroup, inferIntent } from '/core.mjs';

const $ = id => document.getElementById(id);
const key = 'brandnew-contexty-canvas-v2';
const uid = () => crypto.randomUUID();
const clean = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const seed = {
  topic:'正在准备一条两天一夜周末旅行的口播脚本，重点是轻装出行与避免遗漏必需品。',
  groups:[
    {id:'g1',name:'出发前的烦恼',description:'行李多，怕忘带东西',x:80,y:90,w:440,h:530},
    {id:'g2',name:'整理与打包方法',description:'清单、分类、收纳',x:550,y:90,w:640,h:530}
  ],
  cards:[
    {id:'c1',title:'反复检查的出发时刻',text:'临出门时反复翻包确认自己有没有带齐必需品。',source:'示例 AI 对话',memo:'这可以作为开头，带出忘东西的焦虑。',tags:['开头','出行痛点'],intent:'用户准备把出门前的焦虑放在脚本开头。',groupId:'g1',status:'current',image:null,x:100,y:145,corrections:0},
    {id:'c2',title:'轻装打包清单',text:'先列出证件、充电设备与换洗衣物，再按使用频率分层收纳。',source:'示例网页',memo:'把清单缩成三点，作为中间的操作建议。',tags:['清单','打包'],intent:'用户希望把分类清单写成简短的实用建议。',groupId:'g2',status:'current',image:null,x:575,y:145,corrections:0},
    {id:'c3',title:'背包广告信息',text:'背包容量为 20 L，设有独立电脑夹层。',source:'示例广告简报',memo:'广告段只写这两项可核实的信息。',tags:['产品信息','背包'],intent:'用户希望准确保留容量和电脑夹层两个要点。',groupId:'g2',status:'current',image:null,x:880,y:145,corrections:0}
  ],
  notes:[{id:'n1',text:'开头先建立出行场景，再引出三条建议。',x:330,y:160,groupId:'g1'}]
};
let state;
try { state = JSON.parse(localStorage.getItem(key)) || structuredClone(seed); if (!Array.isArray(state.notes)) state.notes=[]; } catch { state=structuredClone(seed); }
let selected=null, tool='select', scale=.82, pan={x:20,y:30}, drag=null, editing=null, capture=null;
const undo=[], redo=[];
function snapshot(){undo.push(JSON.stringify(state));if(undo.length>30)undo.shift();redo.length=0;}
function commit(){localStorage.setItem(key,JSON.stringify(state));render();}
function statusLabel(status){return {current:'当前脚本',future:'未来选题',unused:'暂不使用'}[status]||'当前脚本';}
function cardHtml(card){return `<div class="context-card ${card.status==='future'?'orange':card.status==='unused'?'cyan':''} ${selected?.id===card.id?'selected':''}" data-kind="card" data-id="${clean(card.id)}" style="left:${card.x}px;top:${card.y}px"><div class="card-head"><span>◈ ${clean(card.title)}</span><div class="card-actions"><button data-edit="${clean(card.id)}" title="编辑">✎</button></div></div><div class="provenance"><b>▣ ${clean(card.source||'未记录来源')}</b><small>${clean(new Date(card.createdAt||Date.now()).toLocaleString('zh-CN'))}</small></div>${card.image?`<img class="card-image" src="${card.image}" alt="捕捉的屏幕区域">`:''}${card.text?`<div class="card-body">${clean(card.text)}</div>`:''}<div class="card-tags">${card.tags.map(tag=>`<span>${clean(tag)}</span>`).join('')}<span>${statusLabel(card.status)}</span></div><div class="card-ai"><b>◇ ${card.interpretMode==='ai'?'AI 理解':'系统初步理解'}</b><p>${clean(card.intent)}</p></div><div class="card-memo">✎ 我的想法：${clean(card.memo||'未填写')}</div></div>`;}
function groupHtml(group){return `<div class="canvas-group ${selected?.id===group.id?'selected':''}" data-kind="group" data-id="${clean(group.id)}" style="left:${group.x}px;top:${group.y}px;width:${group.w}px;height:${group.h}px"><div class="group-handle"><span>▣ ${clean(group.name)} · ${state.cards.filter(c=>c.groupId===group.id).length} 条</span><button data-group-edit="${clean(group.id)}" title="修改名称">⋯</button></div></div>`;}
function noteHtml(note){return `<div class="sticky-note ${selected?.id===note.id?'selected':''}" data-kind="note" data-id="${clean(note.id)}" style="left:${note.x}px;top:${note.y}px">${clean(note.text)}</div>`;}
function render(){
  $('world').innerHTML=state.groups.map(groupHtml).join('')+state.cards.map(cardHtml).join('')+state.notes.map(noteHtml).join('');
  $('world').style.transform=`translate(${pan.x}px,${pan.y}px) scale(${scale})`;
  $('zoomLabel').textContent=`${Math.round(scale*100)}%`;
  $('overviewCount').textContent=`(${state.cards.length})`;
  $('topic').value=state.topic;
  $('groupOutline').innerHTML=state.groups.map(group=>`<div class="cluster-preview" data-jump="${clean(group.id)}">${clean(group.name)}<small>${clean(group.description||'')} · ${state.cards.filter(c=>c.groupId===group.id).length} 条素材</small></div>`).join('');
  $('outlineItems').innerHTML=state.groups.map(group=>`<div class="outline-group"><b data-jump="${clean(group.id)}">▾ ${clean(group.name)}<span>${state.cards.filter(c=>c.groupId===group.id).length}</span></b>${state.cards.filter(c=>c.groupId===group.id).map(card=>`<div class="outline-card" data-jump="${clean(card.id)}">▣ ${clean(card.title)}</div>`).join('')}</div>`).join('')+state.cards.filter(c=>!c.groupId).map(card=>`<div class="outline-card" data-jump="${clean(card.id)}">▣ ${clean(card.title)}</div>`).join('');
  document.querySelectorAll('[data-jump]').forEach(el=>el.onclick=()=>focusItem(el.dataset.jump));
  document.querySelectorAll('[data-edit]').forEach(el=>el.onclick=event=>{event.stopPropagation();openEdit(el.dataset.edit)});
  document.querySelectorAll('[data-group-edit]').forEach(el=>el.onclick=event=>{event.stopPropagation();const group=state.groups.find(g=>g.id===el.dataset.groupEdit);const name=prompt('分组标题',group.name);if(name?.trim()){snapshot();group.name=name.trim();commit();}});
  document.querySelectorAll('[data-kind]').forEach(el=>{el.onpointerdown=startDrag;el.ondblclick=()=>{if(el.dataset.kind==='card')openEdit(el.dataset.id);if(el.dataset.kind==='note')editNote(el.dataset.id)};});
}
function focusItem(id){const item=[...state.cards,...state.groups,...state.notes].find(v=>v.id===id);if(!item)return;selected={id,kind:state.cards.includes(item)?'card':state.groups.includes(item)?'group':'note'};pan={x:Math.max(10,$('viewport').clientWidth/2-item.x*scale-140),y:Math.max(10,$('viewport').clientHeight/2-item.y*scale-100)};render();}
function worldPoint(event){const rect=$('viewport').getBoundingClientRect();return{x:(event.clientX-rect.left-pan.x)/scale,y:(event.clientY-rect.top-pan.y)/scale};}
function startDrag(event){if(event.target.closest('button'))return;const kind=event.currentTarget.dataset.kind,id=event.currentTarget.dataset.id;const item=({card:state.cards,group:state.groups,note:state.notes})[kind].find(v=>v.id===id);selected={kind,id};const pos=worldPoint(event);drag={kind,id,startX:pos.x,startY:pos.y,x:item.x,y:item.y,moved:false};event.currentTarget.setPointerCapture(event.pointerId);renderSelection();}
function renderSelection(){document.querySelectorAll('[data-kind]').forEach(el=>el.classList.toggle('selected',el.dataset.id===selected?.id));}
$('viewport').onpointerdown=event=>{if(event.target.closest('[data-kind]'))return;if(tool==='pan'||event.target===$('viewport')||event.target===$('world')){selected=null;drag={kind:'pan',startClientX:event.clientX,startClientY:event.clientY,x:pan.x,y:pan.y,moved:false};$('viewport').setPointerCapture(event.pointerId);$('viewport').classList.add('panning');renderSelection();}};
window.addEventListener('pointermove',event=>{if(!drag)return;if(drag.kind==='pan'){pan.x=drag.x+event.clientX-drag.startClientX;pan.y=drag.y+event.clientY-drag.startClientY;$('world').style.transform=`translate(${pan.x}px,${pan.y}px) scale(${scale})`;return;}const pos=worldPoint(event);const dx=pos.x-drag.startX,dy=pos.y-drag.startY;if(Math.abs(dx)+Math.abs(dy)>2)drag.moved=true;const el=document.querySelector(`[data-kind="${drag.kind}"][data-id="${drag.id}"]`);if(el){el.style.left=`${Math.round(drag.x+dx)}px`;el.style.top=`${Math.round(drag.y+dy)}px`;}});
window.addEventListener('pointerup',event=>{if(!drag)return;if(drag.kind==='pan'){$('viewport').classList.remove('panning');drag=null;return;}if(drag.moved){snapshot();const pos=worldPoint(event),dx=pos.x-drag.startX,dy=pos.y-drag.startY;const item=({card:state.cards,group:state.groups,note:state.notes})[drag.kind].find(v=>v.id===drag.id);item.x=Math.max(0,Math.round(drag.x+dx));item.y=Math.max(0,Math.round(drag.y+dy));if(drag.kind==='group'){for(const card of state.cards.filter(c=>c.groupId===item.id)){card.x+=Math.round(dx);card.y+=Math.round(dy)}for(const note of state.notes.filter(n=>n.groupId===item.id)){note.x+=Math.round(dx);note.y+=Math.round(dy)}}if(drag.kind==='card'||drag.kind==='note'){const cx=item.x+(drag.kind==='card'?140:95),cy=item.y+45;const hit=[...state.groups].reverse().find(g=>cx>=g.x&&cx<=g.x+g.w&&cy>=g.y&&cy<=g.y+g.h);item.groupId=hit?.id||null;if(drag.kind==='card')item.corrections=(item.corrections||0)+1;}commit();}drag=null;});
function setTool(next){tool=next;$('selectTool').classList.toggle('active',next==='select');$('panTool').classList.toggle('active',next==='pan');}
$('selectTool').onclick=()=>setTool('select');$('panTool').onclick=()=>setTool('pan');
function zoomTo(next){scale=Math.min(1.7,Math.max(.35,next));render();}
$('zoomIn').onclick=()=>zoomTo(scale*1.2);$('zoomOut').onclick=()=>zoomTo(scale/1.2);$('fitView').onclick=()=>{const maxX=Math.max(1100,...state.groups.map(g=>g.x+g.w),...state.cards.map(c=>c.x+300));const maxY=Math.max(650,...state.groups.map(g=>g.y+g.h));scale=Math.min(1,$('viewport').clientWidth/(maxX+50),$('viewport').clientHeight/(maxY+50));pan={x:20,y:20};render()};
$('viewport').addEventListener('wheel',event=>{if(event.ctrlKey){event.preventDefault();zoomTo(scale*(event.deltaY<0?1.1:.9))}},{passive:false});
$('addGroup').onclick=()=>{const name=prompt('新分组名称');if(!name?.trim())return;snapshot();state.groups.push({id:uid(),name:name.trim(),description:'',x:150-pan.x/scale,y:130-pan.y/scale,w:440,h:440});commit()};
$('addNote').onclick=()=>{const text=prompt('写下对素材的想法');if(!text?.trim())return;snapshot();state.notes.push({id:uid(),text:text.trim(),x:200-pan.x/scale,y:180-pan.y/scale,groupId:null});commit()};
function editNote(id){const note=state.notes.find(n=>n.id===id),text=prompt('修改便签，留空可删除',note.text);if(text===null)return;snapshot();if(text.trim())note.text=text.trim();else state.notes=state.notes.filter(n=>n.id!==id);commit()}
function openEdit(id){editing=id;const card=state.cards.find(c=>c.id===id);$('editTitle').value=card.title;$('editText').value=card.text;$('editSource').value=card.source;$('editMemo').value=card.memo;$('editTags').value=card.tags.join('，');$('editIntent').value=card.intent;$('editGroup').innerHTML='<option value="">未分组</option>'+state.groups.map(g=>`<option value="${clean(g.id)}">${clean(g.name)}</option>`).join('');$('editGroup').value=card.groupId||'';$('editStatus').value=card.status;$('editDialog').showModal()}
$('editClose').onclick=()=>$('editDialog').close();
$('editDelete').onclick=()=>{if(!confirm('删除这张卡片？'))return;snapshot();state.cards=state.cards.filter(c=>c.id!==editing);$('editDialog').close();commit()};
$('editForm').onsubmit=event=>{event.preventDefault();snapshot();const card=state.cards.find(c=>c.id===editing);card.title=$('editTitle').value.trim();card.text=$('editText').value.trim();card.source=$('editSource').value.trim();card.memo=$('editMemo').value.trim();card.tags=$('editTags').value.split(/[,，]/).map(t=>t.trim()).filter(Boolean);card.intent=$('editIntent').value.trim();card.groupId=$('editGroup').value||null;card.status=$('editStatus').value;card.corrections=(card.corrections||0)+1;$('editDialog').close();commit()};
$('topic').onchange=()=>{snapshot();state.topic=$('topic').value.trim();commit()};
$('undoBtn').onclick=()=>{if(!undo.length)return;redo.push(JSON.stringify(state));state=JSON.parse(undo.pop());commit()};
$('redoBtn').onclick=()=>{if(!redo.length)return;undo.push(JSON.stringify(state));state=JSON.parse(redo.pop());commit()};
$('exportData').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='contexty-canvas.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
$('importData').onclick=()=>$('importFile').click();
$('importFile').onchange=async event=>{try{const data=JSON.parse(await event.target.files[0].text());if(!Array.isArray(data.groups)||!Array.isArray(data.cards))throw Error('格式不正确');snapshot();state={...data,notes:data.notes||[]};commit()}catch(error){alert(error.message)}};
function startCapture(text='',image=null,source='手动添加'){capture={text,image,source};$('capturePreview').innerHTML=image?`<img src="${image}" alt="捕捉的屏幕区域">`:clean(text||'空白素材卡片');$('captureMemo').value='';$('captureDialog').showModal()}
$('captureCancel').onclick=()=>$('captureDialog').close();
$('addCard').onclick=()=>startCapture();
$('captureText').onclick=async()=>{try{const text=await navigator.clipboard.readText();if(!text.trim())throw Error('剪贴板里没有文字');startCapture(text,null,'剪贴板选中文字')}catch(error){alert(`读取剪贴板失败：${error.message}。请使用画布底部的“＋”手动添加。`)}};
async function saveCapture(item,memo,closeDialog=false){
  if(!memo)return;
  snapshot();const tags=[...new Set((state.topic.match(/[\p{Script=Han}]{2,4}/gu)||[]).slice(0,2))];
  const card={id:uid(),title:(item.text||memo).slice(0,18),text:item.text||'',source:item.source,memo,tags,intent:inferIntent(memo),interpretMode:'rule',groupId:null,status:/以后|未来|下次/.test(memo)?'future':'current',image:item.image,x:Math.max(30,160-pan.x/scale)+state.cards.length*30,y:Math.max(70,150-pan.y/scale)+state.cards.length*20,createdAt:item.createdAt||Date.now(),corrections:0};
  card.groupId=suggestGroup(card,state.groups);
  if(card.groupId){const group=state.groups.find(g=>g.id===card.groupId);card.x=group.x+30+(state.cards.filter(c=>c.groupId===group.id).length%2)*295;card.y=group.y+55+Math.floor(state.cards.filter(c=>c.groupId===group.id).length/2)*280}
  state.cards.push(card);if(closeDialog)$('captureDialog').close();commit();focusItem(card.id);
  try{
    const response=await fetch('/api/interpret',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:card.text,memo:card.memo,image:card.image,topic:state.topic,groups:state.groups})});
    const result=await response.json();if(!response.ok)throw Error(result.error);
    if(result.mode==='ai'&&state.cards.includes(card)&&card.corrections===0){snapshot();card.title=result.title;card.intent=result.intent;card.tags=result.tags;card.interpretMode='ai';if(result.groupId){card.groupId=result.groupId;const group=state.groups.find(g=>g.id===result.groupId);card.x=group.x+25;card.y=group.y+60+state.cards.filter(c=>c.groupId===group.id&&c.id!==card.id).length*170}commit()}
  }catch(error){console.warn('素材理解暂时不可用',error)}
}
$('captureForm').onsubmit=event=>{event.preventDefault();saveCapture(capture,$('captureMemo').value.trim(),true).catch(error=>alert(`保存素材失败：${error.message}`))};
$('captureScreen').onclick=()=>window.contextyDesktop?window.contextyDesktop.startCapture():alert('请先运行 npm run desktop，再在任意窗口按 Ctrl+Shift+S 框选屏幕区域。');
window.contextyDesktop?.onCapture(item=>{saveCapture(item,item.memo).catch(error=>alert(`保存截图失败：${error.message}`))});
$('newChat').onclick=()=>alert('这一轮先完成素材捕捉和画布整理，聊天功能留到下一轮。');
$('chatForm').onsubmit=event=>{event.preventDefault();alert('这一轮先完成素材画布，聊天功能尚未接入。')};
$('modeNote').textContent='聊天功能将在画布核对后接入。';
$('tabTimeline').onclick=()=>alert('时间线不在本轮功能范围内。');
render();
