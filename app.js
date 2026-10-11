const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const STORAGE_KEY="z_writer_studio_v6";
const defaultSensitive=["自殺","自傷","死にたい","殺害","暴行","拷問","監禁","誘拐","強姦","レイプ","性的虐待","未成年","児童","ドラッグ","覚醒剤","麻薬"];

const storyBlocks={
  hook:`# キャッチコピー\n\n> 一文で惹きつけるフック\n`,
  world:`## 世界観\n\nここに世界観の核を書く。\n`,
  start:`## 物語の始まり\n\n物語開始時点の状況を書く。\n`,
  user:`## {{user}}の立場\n\n{{user}}がこの世界でどんな位置にいるかを書く。\n`,
  experience:`## この作品でできること\n\n- 関係を変えていく\n- 会話で秘密を探る\n- 自由に物語を進める\n`,
  cast:`## 登場人物\n\n主要な人物や関係性を短く紹介する。\n`,
  mystery:`## 気になる違和感\n\nすべてはまだ明かされていない。\n`,
  closing:`この先をどう変えるかは、{{user}}次第。\n`
};

const charBlocks={
  basic:`### Profile\n- 年齢:\n- 身長:\n- 性別:\n- 外見:\n- 性格:\n- 口調:\n- 一人称:\n- 二人称:\n- 好き:\n- 嫌い:\n- 備考:\n`,
  quote:`> 印象的なセリフ\n`,
  first:`### 第一印象\n\n最初にどう見える人物か。\n`,
  personality:`### 性格\n\n普段の振る舞いや価値観を書く。\n`,
  gap:`### 意外な一面\n\n普段とのギャップを書く。\n`,
  romance:`### {{user}}との距離\n\n普段は――\n\nけれど、{{user}}の前では。\n\n**近づくほど見えてくる一面**\n`,
  mystery:`### 気になる違和感\n\n- 周囲から見た印象:\n- {{user}}への態度:\n- なぜか引っかかる点:\n\n**真相は、会話の中で。**\n`,
  conflict:`### 対立\n\n{{user}}とぶつかり得る価値観や立場を書く。\n`,
  relation:`### {{user}}との関係\n\n現在の距離感と、変化し得る余白を書く。\n`,
  closing:`**この人物の本当の顔を知るかどうかは、会話次第。**\n`
};

const state={title:"",story:"",characters:[],sensitiveWords:[...defaultSensitive]};
let activeTextarea=null;
let saveTimer=null;

function escapeHtml(s=""){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function countChars(s=""){return [...s].length}
function inlineMd(t){return escapeHtml(t).replace(/`([^`]+?)`/g,"<code>$1</code>").replace(/~~(.+?)~~/g,"<del>$1</del>").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g,"$1<em>$2</em>")}
function renderMarkdown(src=""){
  const lines=src.replace(/\r\n/g,"\n").split("\n"); let html="",inList=false;
  for(const raw of lines){
    const line=raw.trimEnd();
    if(/^\s*-\s+/.test(line)){if(!inList){html+="<ul>";inList=true}html+=`<li>${inlineMd(line.replace(/^\s*-\s+/,""))}</li>`;continue}
    if(inList){html+="</ul>";inList=false}
    if(/^#\s+/.test(line))html+=`<h1>${inlineMd(line.replace(/^#\s+/,""))}</h1>`;
    else if(/^##\s+/.test(line))html+=`<h2>${inlineMd(line.replace(/^##\s+/,""))}</h2>`;
    else if(/^###\s+/.test(line))html+=`<h3>${inlineMd(line.replace(/^###\s+/,""))}</h3>`;
    else if(/^>\s?/.test(line))html+=`<blockquote>${inlineMd(line.replace(/^>\s?/,""))}</blockquote>`;
    else if(line.trim()==="")html+="<div style='height:.3em'></div>";
    else html+=`<p>${inlineMd(line)}</p>`;
  }
  if(inList)html+="</ul>"; return html;
}
function showToast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(showToast.t);showToast.t=setTimeout(()=>t.classList.remove("show"),1400)}
function setPage(name){$$(".tab").forEach(x=>x.classList.toggle("active",x.dataset.page===name));$$(".page").forEach(x=>x.classList.toggle("active",x.dataset.page===name));history.replaceState(null,"",`#${name}`);window.scrollTo({top:0,behavior:"smooth"})}
function insertAtCursor(ta,text,wrap=null){
  if(!ta)return;
  const start=ta.selectionStart??ta.value.length,end=ta.selectionEnd??start,val=ta.value;
  if(wrap!==null){
    const selected=val.slice(start,end);
    ta.value=val.slice(0,start)+wrap+selected+wrap+val.slice(end);
    ta.setSelectionRange(start+wrap.length,end+wrap.length);
  }else{
    ta.value=val.slice(0,start)+text+val.slice(end);
    const p=start+text.length;ta.setSelectionRange(p,p);
  }
  ta.focus(); syncFromUI();
}
function appendBlock(ta,text){
  const start=ta.selectionStart??ta.value.length,end=ta.selectionEnd??start;
  const prefix=(ta.value && start>0 && !ta.value.slice(0,start).endsWith("\n"))?"\n\n":"";
  insertAtCursor(ta,prefix+text);
}
function load(){
  try{
    const v=JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(v){Object.assign(state,v);if(!Array.isArray(state.characters))state.characters=[];if(!Array.isArray(state.sensitiveWords))state.sensitiveWords=[...defaultSensitive]}
  }catch{}
}
function scheduleSave(){
  $("#saveStatus").textContent="保存中…";
  clearTimeout(saveTimer);saveTimer=setTimeout(()=>{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));$("#saveStatus").textContent="保存済み"},180)
}
function syncFromUI(){
  state.title=$("#projectTitle").value;
  state.story=$("#storyText").value;
  state.characters=$$(".character-card").map(card=>({name:$(".char-name",card).value,text:$(".char-text",card).value}));
  state.sensitiveWords=$("#sensitiveWords").value.split(",").map(x=>x.trim()).filter(Boolean);
  scheduleSave();refresh();
}
function addCharacter(data={name:"",text:""}){
  const frag=$("#characterTemplate").content.cloneNode(true),card=frag.querySelector(".character-card");
  $(".char-name",card).value=data.name||"";$(".char-text",card).value=data.text||"";
  $("#characterList").appendChild(card);refresh();
  return card;
}
function allText(){return [state.story,...state.characters.map(c=>c.text)].join("\n")}
function result(text,level="ok"){return `<div class="result ${level}"><span class="dot"></span><span>${escapeHtml(text)}</span></div>`}
function refresh(){
  const storyN=countChars(state.story),total=storyN+state.characters.reduce((n,c)=>n+countChars(c.text),0);
  $("#storyCount").textContent=storyN;$("#totalCount").textContent=total.toLocaleString();$("#checkTotalCount").textContent=total.toLocaleString();
  $$(".character-card").forEach(card=>$(".char-count",card).textContent=`${countChars($(".char-text",card).value)}文字`);
  $("#meterBar").style.width=Math.min(total/10000,1)*100+"%";
  $("#meterBar").style.background=total>10000?"var(--danger)":total>9000?"var(--warn)":"var(--ok)";
  $("#countMessage").textContent=total>10000?"上限10,000文字を超えています。":total>9000?"上限が近いです。":"文字数には余裕があります。";
  refreshPreview();refreshChecks(total);
}
function refreshPreview(){
  $("#previewTitle").textContent=state.title;
  const sp=$("#storyPreview");
  if(state.story.trim()){sp.classList.remove("empty-state");sp.innerHTML=renderMarkdown(state.story)}else{sp.classList.add("empty-state");sp.textContent="作品紹介のプレビュー"}
  const wrap=$("#charactersPreview");wrap.innerHTML="";
  state.characters.forEach((c,i)=>{
    if(!c.name.trim()&&!c.text.trim())return;
    const card=document.createElement("div");card.className="character-preview-card";
    card.innerHTML=`<div class="character-preview-head"><div class="character-preview-name">${escapeHtml(c.name||`Character ${i+1}`)}</div><button type="button" class="preview-copy-char" data-copy-char-index="${i}">コピー</button></div><div class="markdown-body">${renderMarkdown(c.text)}</div>`;
    wrap.appendChild(card);
  });
  const fv=$("#firstViewPreview"),snippet=state.story.trim().slice(0,420);
  fv.innerHTML=snippet?`${renderMarkdown(snippet)}<div class="first-view-note">冒頭約420文字を表示</div>`:`<span class="empty-state">作品紹介を書き始めると、冒頭だけ確認できます。</span>`;
}
function refreshChecks(total){
  const text=allText(),hits=state.sensitiveWords.filter(w=>w&&text.includes(w)),md=[];
  if(/\[[^\]]+\]\([^)]+\)/.test(text))md.push("Markdownリンク");
  if(/!\[[^\]]*\]\([^)]+\)/.test(text))md.push("Markdown画像");
  if(/```/.test(text))md.push("コードブロック");
  if(/<\/?[a-z][^>]*>/i.test(text))md.push("HTMLタグ");
  if(/^\s*\|.+\|\s*$/m.test(text))md.push("Markdown表");
  $("#sensitiveResults").innerHTML=hits.length?hits.map(w=>result(`「${w}」を検出。文脈を確認してください。`,"warn")).join(""):result("注意対象の語は見つかりませんでした。");
  $("#markdownResults").innerHTML=md.length?md.map(x=>result(`${x}を検出。zeta側の表示を要確認。`,"warn")).join(""):result("基本記法の範囲に収まっています。");
  const paras=text.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean),long=paras.filter(x=>countChars(x)>=240).length,reads=[];
  reads.push(long?result(`240文字以上の長い段落が${long}件あります。`,"warn"):result("極端に長い段落はありません。"));
  if(!state.story.trim())reads.push(result("作品紹介が空です。","warn"));
  reads.push(result(`キャラクター紹介：${state.characters.length}件`));
  $("#readabilityResults").innerHTML=reads.join("");
  const warnings=hits.length+md.length+long+(total>10000?3:0),b=$("#scoreBadge");
  b.className="score-badge "+(warnings===0?"good":warnings<=3?"warn":"bad");b.textContent=warnings===0?"Good":warnings<=3?"Check":"Review";
}
async function copyText(text,label){
  if(!text.trim()){showToast("コピーする文章が空です");return}
  try{await navigator.clipboard.writeText(text.trim());showToast(`${label}をコピーしました`)}
  catch{showToast("コピーに失敗しました")}
}
function exportText(){
  let out=state.title?`【${state.title}】\n\n`:"";out+=`【作品紹介】\n${state.story}\n`;
  state.characters.forEach((c,i)=>out+=`\n\n【キャラクター${i+1}：${c.name||"名称未設定"}】\n${c.text}\n`);
  const blob=new Blob([out],{type:"text/plain;charset=utf-8"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download=`${state.title||"z_writer_studio"}.txt`;a.click();URL.revokeObjectURL(a.href);
}
function closeSheets(){$$(".sheet").forEach(x=>x.hidden=true);activeTextarea=null}

document.addEventListener("click",async e=>{
  const tab=e.target.closest(".tab"); if(tab){setPage(tab.dataset.page);return}
  const add=e.target.closest("#addCharacterBtn"); if(add){const c=addCharacter();syncFromUI();setTimeout(()=>$(".char-name",c).focus(),0);return}
  const fmt=e.target.closest(".format-toolbar button");
  if(fmt){
    const bar=fmt.closest(".format-toolbar");
    const ta=bar.dataset.editor==="storyText"?$("#storyText"):$(".char-text",bar.closest(".character-card"));
    if(fmt.dataset.open==="decor"){activeTextarea=ta;$("#decorPopover").hidden=false;return}
    if(fmt.dataset.wrap!==undefined){insertAtCursor(ta,"",fmt.dataset.wrap);return}
    if(fmt.dataset.insert!==undefined){insertAtCursor(ta,fmt.dataset.insert);return}
  }
  const deco=e.target.closest("[data-decor]");if(deco){if(activeTextarea)insertAtCursor(activeTextarea,deco.dataset.decor);closeSheets();return}
  if(e.target.closest("[data-close-sheet]")){closeSheets();return}
  const sb=e.target.closest("[data-story-block]");if(sb){appendBlock($("#storyText"),storyBlocks[sb.dataset.storyBlock]||"");return}
  const cb=e.target.closest("[data-char-block]");if(cb){const card=cb.closest(".character-card");appendBlock($(".char-text",card),charBlocks[cb.dataset.charBlock]||"");return}
  const copy=e.target.closest(".copy-char");if(copy){const card=copy.closest(".character-card");await copyText($(".char-text",card).value,$(".char-name",card).value||"キャラクター");return}
  const dup=e.target.closest(".duplicate-char");if(dup){const card=dup.closest(".character-card");addCharacter({name:$(".char-name",card).value+" コピー",text:$(".char-text",card).value});syncFromUI();return}
  const del=e.target.closest(".delete-char");if(del){if(confirm("このキャラクター紹介を削除しますか？")){del.closest(".character-card").remove();syncFromUI()}return}
  const pc=e.target.closest("[data-copy-char-index]");if(pc){const c=state.characters[Number(pc.dataset.copyCharIndex)];if(c)await copyText(c.text,c.name||"キャラクター");return}
  if(e.target.id==="copyStoryBtn"){await copyText(state.story,"作品紹介");return}
  if(e.target.id==="exportBtn"){exportText();return}
  if(e.target.id==="resetBtn"){if(confirm("保存中の内容をすべて初期化しますか？")){localStorage.removeItem(STORAGE_KEY);location.reload()}return}
  if(!e.target.closest(".sheet"))closeSheets();
});

document.addEventListener("input",e=>{
  if(e.target.matches("#projectTitle,#storyText,#sensitiveWords,.char-name,.char-text"))syncFromUI();
});

function init(){
  load();$("#projectTitle").value=state.title;$("#storyText").value=state.story;$("#sensitiveWords").value=state.sensitiveWords.join(", ");
  state.characters.forEach(addCharacter);
  const hash=location.hash.replace("#","");if(["story","characters","preview","check"].includes(hash))setPage(hash);
  refresh();
}
init();
