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
function syncMemoNote(card){
  if(!card.image)return;
  const note=state.notes.find(item=>item.cardId===card.id);
  if(!card.memo?.trim()){if(note)state.notes=state.notes.filter(item=>item.id!==note.id);return;}
  if(note){note.text=card.memo;note.groupId=card.groupId||null;return;}
  state.notes.push({id:uid(),cardId:card.id,text:card.memo,x:card.x+310,y:card.y+20,groupId:card.groupId||null});
}
function migrateScreenshotCards(){
  let changed=false;
  for(const card of state.cards){
    if(card.image&&card.memo&&!state.notes.some(note=>note.cardId===card.id)){
      if(card.title===card.memo.slice(0,18))card.title='截图素材';
      syncMemoNote(card);changed=true;
    }
    if(card.image&&card.source==='屏幕截图'){card.source='来源未记录';changed=true;}
  }
  return changed;
}
const migrated=migrateScreenshotCards();
if(migrated)localStorage.setItem(key,JSON.stringify(state));
let selected=null, tool='select', scale=.82, pan={x:20,y:30}, drag=null, editing=null, capture=null;
const undo=[], redo=[];
function snapshot(){undo.push(JSON.stringify(state));if(undo.length>30)undo.shift();redo.length=0;}
function commit(){localStorage.setItem(key,JSON.stringify(state));render();}
function deleteCard(id){
  const card=state.cards.find(item=>item.id===id);
  if(!card||!confirm(`删除“${card.title}”及其关联便签？`))return;
  snapshot();
  state.cards=state.cards.filter(item=>item.id!==id);
  state.notes=state.notes.filter(note=>note.cardId!==id);
  if(selected?.id===id)selected=null;
  if($('editDialog').open&&editing===id)$('editDialog').close();
  commit();
}
function hideCard(id){
  const card=state.cards.find(item=>item.id===id);
  if(!card||card.hidden)return;
  snapshot();card.hidden=true;
  if(selected?.id===id)selected=null;
  commit();
}
function showCard(id){
  const card=state.cards.find(item=>item.id===id);
  if(!card)return;
  if(card.hidden){snapshot();card.hidden=false;commit();}
  focusItem(id);
}
function dissolveGroup(id){
  if(!state.groups.some(group=>group.id===id))return;
  snapshot();
  state.groups=state.groups.filter(group=>group.id!==id);
  for(const card of state.cards)if(card.groupId===id)card.groupId=null;
  for(const note of state.notes)if(note.groupId===id)note.groupId=null;
  if(selected?.id===id)selected=null;
  commit();
}
function statusLabel(status){return {current:'当前脚本',future:'未来选题',unused:'暂不使用'}[status]||'当前脚本';}
function sourceLink(url){
  try{const parsed=new URL(url);return ['http:','https:'].includes(parsed.protocol)?parsed.href:''}
  catch{return ''}
}
function cardHtml(card){
  const url=sourceLink(card.sourceUrl);
  const provenance=card.sourceUrl?(url?`<a href="${clean(url)}" target="_blank" rel="noopener noreferrer" title="${clean(card.sourceUrl)}">${clean(card.sourceUrl)}</a>`:`<small title="${clean(card.sourceUrl)}">${clean(card.sourceUrl)}</small>`):'';
  const tags=(card.tags||[]).map((tag,index)=>`<span class="tag-chip">${clean(tag)}<button type="button" data-remove-tag="${clean(card.id)}" data-tag-index="${index}" title="移除标签">×</button></span>`).join('');
  return `<div class="context-card ${card.status==='future'?'orange':card.status==='unused'?'cyan':''} ${selected?.id===card.id?'selected':''}" data-kind="card" data-id="${clean(card.id)}" style="left:${card.x}px;top:${card.y}px">
    <div class="card-head"><span>◈</span><input class="card-title-input" data-title-input="${clean(card.id)}" value="${clean(card.title)}" aria-label="卡片标题" title="点击修改标题"><div class="card-actions"><button type="button" data-hide-card="${clean(card.id)}" title="隐藏卡片，可从左侧素材结构恢复">隐藏</button><button type="button" data-delete-card="${clean(card.id)}" title="删除卡片及关联便签">删除</button></div></div>
    <div class="provenance"><b>▣ ${clean(card.source||'来源未记录')}</b>${provenance}<small>${clean(new Date(card.createdAt||Date.now()).toLocaleString('zh-CN'))}</small></div>
    ${card.image?`<img class="card-image" src="${card.image}" alt="捕捉的屏幕区域">`:''}
    ${card.text?`<div class="card-body">${clean(card.text)}</div>`:''}
    <div class="card-tags">${tags}<input class="tag-input" data-tag-input="${clean(card.id)}" placeholder="+ 标签" aria-label="添加标签"><span class="status-chip">${statusLabel(card.status)}</span></div>
    <div class="card-ai"><b>◇ ${card.interpretMode==='ai'?'AI 理解':'系统初步理解'}</b><p>${clean(card.intent)}</p></div>
    ${!card.image?`<div class="card-memo">✎ 我的想法：${clean(card.memo||'未填写')}</div>`:''}
  </div>`;
}
function groupHtml(group){return `<div class="canvas-group ${selected?.id===group.id?'selected':''}" data-kind="group" data-id="${clean(group.id)}" style="left:${group.x}px;top:${group.y}px;width:${group.w}px;height:${group.h}px"><div class="group-handle"><span>▣ ${clean(group.name)} · ${state.cards.filter(c=>c.groupId===group.id).length} 条</span><button type="button" data-dissolve-group="${clean(group.id)}" title="解除分组，保留全部素材和便签">解除分组</button></div></div>`;}
function noteHtml(note){return `<div class="sticky-note ${note.cardId?'linked-note':''} ${selected?.id===note.id?'selected':''}" data-kind="note" data-id="${clean(note.id)}" style="left:${note.x}px;top:${note.y}px" title="双击修改想法">${note.cardId?'<small>我的想法</small>':''}<div>${clean(note.text)}</div></div>`;}
function noteLinksHtml(){
  const paths=state.notes.filter(note=>note.cardId).map(note=>{
    const card=state.cards.find(item=>item.id===note.cardId&&!item.hidden);
    if(!card)return '';
    const fromX=Number(note.x)||0,fromY=(Number(note.y)||0)+55,toX=(Number(card.x)||0)+280,toY=(Number(card.y)||0)+95;
    return `<path d="M ${fromX} ${fromY} C ${fromX-35} ${fromY}, ${toX+35} ${toY}, ${toX} ${toY}" marker-end="url(#note-arrow)"/>`;
  }).join('');
  return `<svg class="note-links" viewBox="0 0 2400 1800" aria-hidden="true"><defs><marker id="note-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z"/></marker></defs>${paths}</svg>`;
}
function render(){
  $('world').innerHTML=state.groups.map(groupHtml).join('')+noteLinksHtml()+state.cards.filter(card=>!card.hidden).map(cardHtml).join('')+state.notes.filter(note=>!note.cardId||state.cards.some(card=>card.id===note.cardId&&!card.hidden)).map(noteHtml).join('');
  $('world').style.transform=`translate(${pan.x}px,${pan.y}px) scale(${scale})`;
  $('zoomLabel').textContent=`${Math.round(scale*100)}%`;
  $('overviewCount').textContent=`(${state.cards.length})`;
  $('topic').value=state.topic;
  $('groupOutline').innerHTML=state.groups.map(group=>`<div class="cluster-preview" data-jump="${clean(group.id)}">${clean(group.name)}<small>${clean(group.description||'')} · ${state.cards.filter(c=>c.groupId===group.id).length} 条素材</small></div>`).join('');
  const outlineCard=card=>`<div class="outline-card ${card.hidden?'is-hidden':''}" data-jump="${clean(card.id)}"><span>▣ ${clean(card.title)}</span>${card.hidden?`<button type="button" data-show-card="${clean(card.id)}" title="恢复到画布">显示</button>`:''}</div>`;
  $('outlineItems').innerHTML=state.groups.map(group=>`<div class="outline-group"><b data-jump="${clean(group.id)}">▾ ${clean(group.name)}<span>${state.cards.filter(c=>c.groupId===group.id).length}</span></b>${state.cards.filter(c=>c.groupId===group.id).map(outlineCard).join('')}</div>`).join('')+state.cards.filter(c=>!c.groupId).map(outlineCard).join('');
  document.querySelectorAll('[data-jump]').forEach(el=>el.onclick=()=>focusItem(el.dataset.jump));
  document.querySelectorAll('[data-show-card]').forEach(el=>el.onclick=event=>{event.stopPropagation();showCard(el.dataset.showCard);});
  document.querySelectorAll('[data-hide-card]').forEach(el=>el.onclick=event=>{event.stopPropagation();hideCard(el.dataset.hideCard);});
  document.querySelectorAll('[data-delete-card]').forEach(el=>el.onclick=event=>{event.stopPropagation();deleteCard(el.dataset.deleteCard);});
  document.querySelectorAll('[data-dissolve-group]').forEach(el=>el.onclick=event=>{event.stopPropagation();dissolveGroup(el.dataset.dissolveGroup);});
  document.querySelectorAll('[data-title-input]').forEach(el=>{
    el.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();el.blur();}};
    el.onchange=()=>{const card=state.cards.find(item=>item.id===el.dataset.titleInput);const title=el.value.trim();if(!title){el.value=card.title;return;}if(title!==card.title){snapshot();card.title=title;card.corrections=(card.corrections||0)+1;commit();}};
  });
  document.querySelectorAll('[data-remove-tag]').forEach(el=>el.onclick=event=>{event.stopPropagation();const card=state.cards.find(item=>item.id===el.dataset.removeTag);snapshot();card.tags.splice(Number(el.dataset.tagIndex),1);card.corrections=(card.corrections||0)+1;commit();});
  document.querySelectorAll('[data-tag-input]').forEach(el=>{
    const add=()=>{const card=state.cards.find(item=>item.id===el.dataset.tagInput);const tags=el.value.split(/[,，]/).map(tag=>tag.trim()).filter(Boolean);const fresh=tags.filter(tag=>!card.tags.includes(tag));if(!fresh.length){el.value='';return;}snapshot();card.tags.push(...fresh);card.corrections=(card.corrections||0)+1;commit();};
    el.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();add();}};
    el.onchange=add;
  });
  document.querySelectorAll('[data-kind]').forEach(el=>{el.onpointerdown=startDrag;el.ondblclick=event=>{if(event.target.closest('button,input,textarea,a'))return;if(el.dataset.kind==='card')openEdit(el.dataset.id);if(el.dataset.kind==='note')editNote(el.dataset.id)};});
}
function focusItem(id){const item=[...state.cards,...state.groups,...state.notes].find(v=>v.id===id);if(!item)return;if(state.cards.includes(item)&&item.hidden){showCard(id);return;}selected={id,kind:state.cards.includes(item)?'card':state.groups.includes(item)?'group':'note'};pan={x:Math.max(10,$('viewport').clientWidth/2-item.x*scale-140),y:Math.max(10,$('viewport').clientHeight/2-item.y*scale-100)};render();}
function worldPoint(event){const rect=$('viewport').getBoundingClientRect();return{x:(event.clientX-rect.left-pan.x)/scale,y:(event.clientY-rect.top-pan.y)/scale};}
function startDrag(event){if(event.target.closest('button,input,textarea,a'))return;const kind=event.currentTarget.dataset.kind,id=event.currentTarget.dataset.id;const item=({card:state.cards,group:state.groups,note:state.notes})[kind].find(v=>v.id===id);selected={kind,id};const pos=worldPoint(event);drag={kind,id,startX:pos.x,startY:pos.y,x:item.x,y:item.y,moved:false};event.currentTarget.setPointerCapture(event.pointerId);renderSelection();}
function renderSelection(){document.querySelectorAll('[data-kind]').forEach(el=>el.classList.toggle('selected',el.dataset.id===selected?.id));}
$('viewport').onpointerdown=event=>{if(event.target.closest('[data-kind]'))return;if(tool==='pan'||event.target===$('viewport')||event.target===$('world')){selected=null;drag={kind:'pan',startClientX:event.clientX,startClientY:event.clientY,x:pan.x,y:pan.y,moved:false};$('viewport').setPointerCapture(event.pointerId);$('viewport').classList.add('panning');renderSelection();}};
window.addEventListener('pointermove',event=>{if(!drag)return;if(drag.kind==='pan'){pan.x=drag.x+event.clientX-drag.startClientX;pan.y=drag.y+event.clientY-drag.startClientY;$('world').style.transform=`translate(${pan.x}px,${pan.y}px) scale(${scale})`;return;}const pos=worldPoint(event);const dx=pos.x-drag.startX,dy=pos.y-drag.startY;if(Math.abs(dx)+Math.abs(dy)>2)drag.moved=true;const el=document.querySelector(`[data-kind="${drag.kind}"][data-id="${drag.id}"]`);if(el){el.style.left=`${Math.round(drag.x+dx)}px`;el.style.top=`${Math.round(drag.y+dy)}px`;}});
window.addEventListener('pointerup',event=>{
  if(!drag)return;
  if(drag.kind==='pan'){$('viewport').classList.remove('panning');drag=null;return;}
  if(drag.moved){
    snapshot();
    const pos=worldPoint(event),dx=pos.x-drag.startX,dy=pos.y-drag.startY;
    const item=({card:state.cards,group:state.groups,note:state.notes})[drag.kind].find(v=>v.id===drag.id);
    const nextX=Math.max(0,Math.round(drag.x+dx)),nextY=Math.max(0,Math.round(drag.y+dy));
    const movedX=nextX-item.x,movedY=nextY-item.y;
    item.x=nextX;item.y=nextY;
    if(drag.kind==='group'){
      for(const card of state.cards.filter(c=>c.groupId===item.id)){card.x+=movedX;card.y+=movedY;}
      for(const note of state.notes.filter(n=>n.groupId===item.id)){note.x+=movedX;note.y+=movedY;}
    }
    if(drag.kind==='card'||drag.kind==='note'){
      const cx=item.x+(drag.kind==='card'?140:95),cy=item.y+45;
      const hit=[...state.groups].reverse().find(g=>cx>=g.x&&cx<=g.x+g.w&&cy>=g.y&&cy<=g.y+g.h);
      item.groupId=hit?.id||null;
      if(drag.kind==='card'){
        item.corrections=(item.corrections||0)+1;
        const note=state.notes.find(n=>n.cardId===item.id);
        if(note){note.x+=movedX;note.y+=movedY;note.groupId=item.groupId;}
      }
    }
    commit();
  }
  drag=null;
});
function setTool(next){tool=next;$('selectTool').classList.toggle('active',next==='select');$('panTool').classList.toggle('active',next==='pan');}
$('selectTool').onclick=()=>setTool('select');$('panTool').onclick=()=>setTool('pan');
function zoomTo(next){scale=Math.min(1.7,Math.max(.35,next));render();}
$('zoomIn').onclick=()=>zoomTo(scale*1.2);$('zoomOut').onclick=()=>zoomTo(scale/1.2);$('fitView').onclick=()=>{const visibleCards=state.cards.filter(card=>!card.hidden),visibleNotes=state.notes.filter(note=>!note.cardId||visibleCards.some(card=>card.id===note.cardId));const maxX=Math.max(1100,...state.groups.map(g=>g.x+g.w),...visibleCards.map(c=>c.x+300),...visibleNotes.map(n=>n.x+220));const maxY=Math.max(650,...state.groups.map(g=>g.y+g.h),...visibleNotes.map(n=>n.y+180));scale=Math.min(1,$('viewport').clientWidth/(maxX+50),$('viewport').clientHeight/(maxY+50));pan={x:20,y:20};render()};
$('viewport').addEventListener('wheel',event=>{if(event.ctrlKey){event.preventDefault();zoomTo(scale*(event.deltaY<0?1.1:.9))}},{passive:false});
$('addGroup').onclick=()=>{const name=prompt('新分组名称');if(!name?.trim())return;snapshot();state.groups.push({id:uid(),name:name.trim(),description:'',x:150-pan.x/scale,y:130-pan.y/scale,w:440,h:440});commit()};
$('addNote').onclick=()=>{const text=prompt('写下对素材的想法');if(!text?.trim())return;snapshot();state.notes.push({id:uid(),text:text.trim(),x:200-pan.x/scale,y:180-pan.y/scale,groupId:null});commit()};
function editNote(id){const note=state.notes.find(n=>n.id===id),text=prompt('修改便签，留空可删除',note.text);if(text===null)return;snapshot();const card=state.cards.find(c=>c.id===note.cardId);if(text.trim())note.text=text.trim();else state.notes=state.notes.filter(n=>n.id!==id);if(card){card.memo=text.trim();card.corrections=(card.corrections||0)+1;}commit()}
function openEdit(id){editing=id;const card=state.cards.find(c=>c.id===id);$('editTitle').value=card.title;$('editText').value=card.text;$('editSource').value=card.source;$('editSourceUrl').value=card.sourceUrl||'';$('editMemo').value=card.memo;$('editTags').value=card.tags.join('，');$('editIntent').value=card.intent;$('editGroup').innerHTML='<option value="">未分组</option>'+state.groups.map(g=>`<option value="${clean(g.id)}">${clean(g.name)}</option>`).join('');$('editGroup').value=card.groupId||'';$('editStatus').value=card.status;$('editDialog').showModal()}
$('editClose').onclick=()=>$('editDialog').close();
$('editDelete').onclick=()=>deleteCard(editing);
$('editForm').onsubmit=event=>{event.preventDefault();snapshot();const card=state.cards.find(c=>c.id===editing);card.title=$('editTitle').value.trim();card.text=$('editText').value.trim();card.source=$('editSource').value.trim();card.sourceUrl=$('editSourceUrl').value.trim();card.memo=$('editMemo').value.trim();card.tags=$('editTags').value.split(/[,，]/).map(t=>t.trim()).filter(Boolean);card.intent=$('editIntent').value.trim();card.groupId=$('editGroup').value||null;card.status=$('editStatus').value;card.corrections=(card.corrections||0)+1;syncMemoNote(card);$('editDialog').close();commit()};
$('topic').onchange=()=>{snapshot();state.topic=$('topic').value.trim();commit()};
$('undoBtn').onclick=()=>{if(!undo.length)return;redo.push(JSON.stringify(state));state=JSON.parse(undo.pop());commit()};
$('redoBtn').onclick=()=>{if(!redo.length)return;undo.push(JSON.stringify(state));state=JSON.parse(redo.pop());commit()};
$('exportData').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='contexty-canvas.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
$('importData').onclick=()=>$('importFile').click();
$('importFile').onchange=async event=>{try{const data=JSON.parse(await event.target.files[0].text());if(!Array.isArray(data.groups)||!Array.isArray(data.cards))throw Error('格式不正确');snapshot();state={...data,notes:data.notes||[]};migrateScreenshotCards();commit()}catch(error){alert(error.message)}};
function startCapture(text='',image=null,source='手动添加'){capture={text,image,source};$('capturePreview').innerHTML=image?`<img src="${image}" alt="捕捉的屏幕区域">`:clean(text||'空白素材卡片');$('captureMemo').value='';$('captureDialog').showModal()}
$('captureCancel').onclick=()=>$('captureDialog').close();
$('addCard').onclick=()=>startCapture();
$('captureText').onclick=async()=>{try{const text=await navigator.clipboard.readText();if(!text.trim())throw Error('剪贴板里没有文字');startCapture(text,null,'剪贴板选中文字')}catch(error){alert(`读取剪贴板失败：${error.message}。请使用画布底部的“＋”手动添加。`)}};
async function saveCapture(item,memo,closeDialog=false){
  if(!memo)return;
  snapshot();const tags=[...new Set((state.topic.match(/[\p{Script=Han}]{2,4}/gu)||[]).slice(0,2))];
  const sourceTitle=String(item.sourceTitle||'').replace(/\s+[-–|]\s+(Google Chrome|Microsoft Edge|Brave|Mozilla Firefox)$/i,'').trim();
  const title=(item.text?.trim()||sourceTitle||(item.image?'截图素材':'新素材')).slice(0,60);
  const card={id:uid(),title,text:item.text||'',source:item.source||'来源未记录',sourceTitle:item.sourceTitle||'',sourceUrl:item.sourceUrl||'',memo,tags,intent:inferIntent(memo),interpretMode:'rule',groupId:null,status:/以后|未来|下次/.test(memo)?'future':'current',image:item.image,x:Math.max(30,160-pan.x/scale)+state.cards.length*30,y:Math.max(70,150-pan.y/scale)+state.cards.length*20,createdAt:item.createdAt||Date.now(),corrections:0};
  card.groupId=suggestGroup(card,state.groups);
  if(card.groupId){const group=state.groups.find(g=>g.id===card.groupId);card.x=group.x+30+(state.cards.filter(c=>c.groupId===group.id).length%2)*295;card.y=group.y+55+Math.floor(state.cards.filter(c=>c.groupId===group.id).length/2)*280}
  state.cards.push(card);syncMemoNote(card);if(closeDialog)$('captureDialog').close();commit();focusItem(card.id);
  try{
    const response=await fetch('/api/interpret',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:card.text,memo:card.memo,image:card.image,topic:state.topic,groups:state.groups})});
    const result=await response.json();if(!response.ok)throw Error(result.error);
    if(result.mode==='ai'&&state.cards.includes(card)&&card.corrections===0){snapshot();card.title=result.title;card.intent=result.intent;card.tags=result.tags;card.interpretMode='ai';if(result.groupId){card.groupId=result.groupId;const group=state.groups.find(g=>g.id===result.groupId);const oldX=card.x,oldY=card.y;card.x=group.x+25;card.y=group.y+60+state.cards.filter(c=>c.groupId===group.id&&c.id!==card.id).length*170;const note=state.notes.find(n=>n.cardId===card.id);if(note){note.x+=card.x-oldX;note.y+=card.y-oldY;note.groupId=card.groupId;}}commit()}
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
