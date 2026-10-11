const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

const STORAGE_KEY = "z_writer_studio_v1";

const defaultSensitive = [
  "自殺","自傷","死にたい","殺す","殺害","暴行","拷問",
  "監禁","誘拐","強姦","レイプ","性的虐待","未成年",
  "児童","ドラッグ","覚醒剤","麻薬"
];

const state = {
  title: "",
  story: "",
  characters: [],
  sensitiveWords: [...defaultSensitive]
};

function escapeHtml(str=""){
  return str.replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

// z_Writer Studio deliberately supports only a small, predictable Markdown subset.
function renderMarkdown(src=""){
  const lines = src.replace(/\r\n/g,"\n").split("\n");
  let html = "";
  let inList = false;

  const inline = (text) => escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>");

  for (let raw of lines){
    const line = raw.trimEnd();

    if (/^\s*-\s+/.test(line)){
      if(!inList){ html += "<ul>"; inList = true; }
      html += `<li>${inline(line.replace(/^\s*-\s+/,""))}</li>`;
      continue;
    }
    if(inList){ html += "</ul>"; inList = false; }

    if (/^###\s+/.test(line)) html += `<h3>${inline(line.replace(/^###\s+/,""))}</h3>`;
    else if (/^##\s+/.test(line)) html += `<h2>${inline(line.replace(/^##\s+/,""))}</h2>`;
    else if (/^>\s?/.test(line)) html += `<blockquote>${inline(line.replace(/^>\s?/,""))}</blockquote>`;
    else if (/^(---+|___+)$/.test(line.trim())) html += "<hr>";
    else if (line.trim() === "") html += "<div style='height:.35em'></div>";
    else html += `<p>${inline(line)}</p>`;
  }
  if(inList) html += "</ul>";
  return html;
}

function load(){
  try{
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(saved){
      Object.assign(state, saved);
      if(!Array.isArray(state.characters)) state.characters = [];
      if(!Array.isArray(state.sensitiveWords)) state.sensitiveWords = [...defaultSensitive];
    }
  }catch(e){}
}

let saveTimer;
function save(){
  $("#saveStatus").textContent = "保存中…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=>{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    $("#saveStatus").textContent = "保存済み";
  }, 220);
}

function countChars(text=""){ return [...text].length; }

function syncFromUI(){
  state.title = $("#projectTitle").value;
  state.story = $("#storyText").value;
  state.characters = $$(".character-card").map(card => ({
    name: $(".char-name",card).value,
    text: $(".char-text",card).value
  }));
  state.sensitiveWords = $("#sensitiveWords").value
    .split(",")
    .map(s=>s.trim())
    .filter(Boolean);
  save();
  refresh();
}

function addCharacter(data={name:"",text:""}){
  const frag = $("#characterTemplate").content.cloneNode(true);
  const card = frag.querySelector(".character-card");
  $(".char-name",card).value = data.name || "";
  $(".char-text",card).value = data.text || "";
  $("#characterList").appendChild(card);
  bindCharacterCard(card);
  refresh();
}

function bindToolbar(toolbar, textarea){
  $$("button",toolbar).filter(btn=>!btn.classList.contains("decor-picker-btn")).forEach(btn=>{
    btn.addEventListener("click",()=>{
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      const selected = value.slice(start,end);
      const ins = btn.dataset.insert;
      const wrap = btn.dataset.wrap;

      if(ins !== undefined){
        textarea.value = value.slice(0,start) + ins + value.slice(end);
        const pos = start + ins.length;
        textarea.setSelectionRange(pos,pos);
      }else if(wrap){
        textarea.value = value.slice(0,start) + wrap + selected + wrap + value.slice(end);
        textarea.setSelectionRange(start+wrap.length, end+wrap.length);
      }
      textarea.focus();
      syncFromUI();
    });
  });
}


let activeDecorTextarea = null;
let activeDecorButton = null;

function closeDecorPopover(){
  const pop = $("#decorPopover");
  pop.hidden = true;
  activeDecorTextarea = null;
  activeDecorButton = null;
}

function openDecorPopover(button, textarea){
  const pop = $("#decorPopover");
  activeDecorTextarea = textarea;
  activeDecorButton = button;
  pop.hidden = false;

  requestAnimationFrame(()=>{
    const rect = button.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    const margin = 10;

    let left = rect.left;
    if(left + popRect.width > window.innerWidth - margin){
      left = window.innerWidth - popRect.width - margin;
    }
    left = Math.max(margin, left);

    let top = rect.bottom + 8;
    if(top + popRect.height > window.innerHeight - margin){
      top = rect.top - popRect.height - 8;
    }
    top = Math.max(margin, top);

    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  });
}

function bindDecorPicker(toolbar, textarea){
  const btn = $(".decor-picker-btn", toolbar);
  if(!btn) return;

  btn.addEventListener("click",(e)=>{
    e.stopPropagation();
    const pop = $("#decorPopover");
    if(!pop.hidden && activeDecorButton === btn){
      closeDecorPopover();
      return;
    }
    openDecorPopover(btn, textarea);
  });
}

function bindCharacterCard(card){
  const ta = $(".char-text",card);
  bindToolbar($(".format-toolbar",card), ta);
  bindDecorPicker($(".format-toolbar",card), ta);

  ["input","change"].forEach(evt=>{
    $(".char-name",card).addEventListener(evt,syncFromUI);
    ta.addEventListener(evt,syncFromUI);
  });

  $(".delete-char",card).addEventListener("click",()=>{
    if(confirm("このキャラクター紹介を削除しますか？")){
      card.remove();
      syncFromUI();
    }
  });

  $(".duplicate-char",card).addEventListener("click",()=>{
    addCharacter({
      name:$(".char-name",card).value + " コピー",
      text:ta.value
    });
    syncFromUI();
  });
}

function refreshCounts(){
  const storyCount = countChars(state.story);
  $("#storyCount").textContent = storyCount;

  $$(".character-card").forEach(card=>{
    $(".char-count",card).textContent = `${countChars($(".char-text",card).value)}文字`;
  });

  const total = storyCount + state.characters.reduce((sum,c)=>sum+countChars(c.text),0);
  $("#totalCount").textContent = total.toLocaleString();
  $("#checkTotalCount").textContent = total.toLocaleString();

  const ratio = Math.min(total/10000,1)*100;
  $("#meterBar").style.width = ratio+"%";
  $("#meterBar").style.background =
    total > 10000 ? "var(--danger)" :
    total > 9000 ? "var(--warn)" : "var(--ok)";

  $("#countMessage").textContent =
    total > 10000 ? "上限10,000文字を超えています。" :
    total > 9000 ? "上限が近いです。余白を残して調整するのがおすすめです。" :
    "文字数には余裕があります。";

  return total;
}

function refreshPreview(){
  $("#previewTitle").textContent = state.title;
  const storyPrev = $("#storyPreview");
  if(state.story.trim()){
    storyPrev.classList.remove("empty-state");
    storyPrev.innerHTML = renderMarkdown(state.story);
  }else{
    storyPrev.classList.add("empty-state");
    storyPrev.textContent = "全体紹介文のプレビュー";
  }

  const wrap = $("#charactersPreview");
  wrap.innerHTML = "";
  state.characters.forEach((c,i)=>{
    if(!c.name.trim() && !c.text.trim()) return;
    const sec = document.createElement("section");
    sec.className = "character-preview";
    sec.innerHTML = `
      <div class="character-preview-name">${escapeHtml(c.name || `Character ${i+1}`)}</div>
      <div class="markdown-body">${renderMarkdown(c.text)}</div>
    `;
    wrap.appendChild(sec);
  });
}

function result(text, level="ok"){
  return `<div class="result ${level}"><span class="dot"></span><span>${escapeHtml(text)}</span></div>`;
}

function allText(){
  return [state.story, ...state.characters.map(c=>c.text)].join("\n");
}

function refreshChecks(total){
  const text = allText();

  // Sensitive expressions
  const hits = state.sensitiveWords.filter(w=>w && text.includes(w));
  $("#sensitiveResults").innerHTML = hits.length
    ? hits.map(w=>result(`「${w}」を検出。文脈を確認してください。`,"warn")).join("")
    : result("注意対象として登録された語は見つかりませんでした。");

  // Unsupported / unconfirmed Markdown
  const mdWarnings = [];
  if (/~~.+?~~/.test(text)) mdWarnings.push("取り消し線（~~ ~~）");
  if (/\[[^\]]+\]\([^)]+\)/.test(text)) mdWarnings.push("Markdownリンク");
  if (/!\[[^\]]*\]\([^)]+\)/.test(text)) mdWarnings.push("Markdown画像");
  if (/```/.test(text)) mdWarnings.push("コードブロック");
  if (/`[^`]+`/.test(text)) mdWarnings.push("インラインコード");
  if (/<\/?[a-z][^>]*>/i.test(text)) mdWarnings.push("HTMLタグ");
  if (/^\s*\|.+\|\s*$/m.test(text)) mdWarnings.push("Markdown表");
  $("#markdownResults").innerHTML = mdWarnings.length
    ? mdWarnings.map(x=>result(`${x}を検出。zeta側の表示を要確認。`,"warn")).join("")
    : result("基本記法の範囲に収まっています。");

  // Readability
  const read = [];
  const paragraphs = text.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);
  const longParas = paragraphs.filter(p=>countChars(p) >= 240).length;
  if(longParas) read.push(result(`240文字以上の長い段落が${longParas}件あります。スマホ表示で分割を検討。`,"warn"));
  else read.push(result("極端に長い段落は見つかりませんでした。"));

  if(!state.story.trim()) read.push(result("全体紹介文が空です。","warn"));
  if(state.characters.length === 0) read.push(result("キャラクター紹介がまだありません。","warn"));
  else read.push(result(`キャラクター紹介：${state.characters.length}件`));

  $("#readabilityResults").innerHTML = read.join("");

  const warnings = hits.length + mdWarnings.length + longParas + (total>10000 ? 3 : 0);
  const badge = $("#scoreBadge");
  badge.className = "score-badge " + (warnings === 0 ? "good" : warnings <= 3 ? "warn" : "bad");
  badge.textContent = warnings === 0 ? "Good" : warnings <= 3 ? "Check" : "Review";
}

function refresh(){
  const total = refreshCounts();
  refreshPreview();
  refreshChecks(total);
}

function setPage(name){
  $$(".tab").forEach(t=>t.classList.toggle("active", t.dataset.page===name));
  $$(".page").forEach(p=>p.classList.toggle("active", p.dataset.page===name));
  history.replaceState(null,"",`#${name}`);
  window.scrollTo({top:0,behavior:"smooth"});
}

function showToast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(()=>t.classList.remove("show"),1500);
}

async function copyAll(){
  let out = state.story.trim();
  for(const c of state.characters){
    if(!c.name.trim() && !c.text.trim()) continue;
    out += `\n\n━━━━━━━━━━\n${c.name || "Character"}\n\n${c.text.trim()}`;
  }
  await navigator.clipboard.writeText(out.trim());
  showToast("コピーしました");
}

function exportText(){
  let out = "";
  if(state.title) out += `【${state.title}】\n\n`;
  out += `【全体紹介文】\n${state.story}\n`;
  state.characters.forEach((c,i)=>{
    out += `\n\n【キャラクター${i+1}：${c.name || "名称未設定"}】\n${c.text}\n`;
  });
  const blob = new Blob([out],{type:"text/plain;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${state.title || "z_writer_studio"}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function initSwipe(){
  let startX=0, startY=0;
  const order=["story","characters","preview","check"];
  $("#pages").addEventListener("touchstart",e=>{
    if(e.touches.length!==1) return;
    startX=e.touches[0].clientX;
    startY=e.touches[0].clientY;
  },{passive:true});

  $("#pages").addEventListener("touchend",e=>{
    if(!startX) return;
    const dx=e.changedTouches[0].clientX-startX;
    const dy=e.changedTouches[0].clientY-startY;
    startX=0;
    if(Math.abs(dx)<70 || Math.abs(dx)<Math.abs(dy)*1.35) return;
    const current=$(".tab.active").dataset.page;
    const i=order.indexOf(current);
    if(dx<0 && i<order.length-1) setPage(order[i+1]);
    if(dx>0 && i>0) setPage(order[i-1]);
  },{passive:true});
}

function init(){
  load();

  $("#projectTitle").value = state.title;
  $("#storyText").value = state.story;
  $("#sensitiveWords").value = state.sensitiveWords.join(", ");

  if(state.characters.length){
    state.characters.forEach(addCharacter);
  }

  bindToolbar($(".page[data-page='story'] .format-toolbar"), $("#storyText"));
  bindDecorPicker($(".page[data-page='story'] .format-toolbar"), $("#storyText"));

  ["input","change"].forEach(evt=>{
    $("#projectTitle").addEventListener(evt,syncFromUI);
    $("#storyText").addEventListener(evt,syncFromUI);
    $("#sensitiveWords").addEventListener(evt,syncFromUI);
  });

  $("#addCharacterBtn").addEventListener("click",()=>{
    addCharacter();
    syncFromUI();
    setTimeout(()=>{
      const cards=$$(".character-card");
      cards.at(-1)?.scrollIntoView({behavior:"smooth",block:"center"});
      $(".char-name", cards.at(-1))?.focus();
    },50);
  });

  $$(".tab").forEach(tab=>tab.addEventListener("click",()=>setPage(tab.dataset.page)));

  $("#copyAllBtn").addEventListener("click",copyAll);
  $("#exportBtn").addEventListener("click",exportText);

  $("#resetBtn").addEventListener("click",()=>{
    if(!confirm("保存中の内容をすべて初期化しますか？")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });

  $$("[data-template]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const ta=$("#storyText");
      const templates={
        hook:"\n## キャッチコピー\n> 一文で惹きつけるフック\n\n",
        experience:"\n## この世界でできること\n- 関係を変えていく\n- 会話で秘密を探る\n- 自由に物語を進める\n\n",
        closing:"\nこの先をどう変えるかは、{{user}}次第。\n"
      };
      ta.value += templates[btn.dataset.template] || "";
      syncFromUI();
      ta.focus();
      ta.setSelectionRange(ta.value.length,ta.value.length);
    });
  });


  $$("#decorPopover [data-decor]").forEach(btn=>{
    btn.addEventListener("click",(e)=>{
      e.stopPropagation();
      if(!activeDecorTextarea) return;
      const decor = btn.dataset.decor || "";
      const ta = activeDecorTextarea;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const value = ta.value;
      ta.value = value.slice(0,start) + decor + value.slice(end);
      const pos = start + decor.length;
      ta.setSelectionRange(pos,pos);
      ta.focus();
      closeDecorPopover();
      syncFromUI();
    });
  });

  $("#closeDecorPopover").addEventListener("click",(e)=>{
    e.stopPropagation();
    closeDecorPopover();
  });

  document.addEventListener("click",(e)=>{
    const pop = $("#decorPopover");
    if(pop.hidden) return;
    if(pop.contains(e.target)) return;
    if(e.target.closest(".decor-picker-btn")) return;
    closeDecorPopover();
  });

  window.addEventListener("resize", closeDecorPopover);
  window.addEventListener("scroll", closeDecorPopover, {passive:true});

  initSwipe();

  const hash = location.hash.replace("#","");
  if(["story","characters","preview","check"].includes(hash)) setPage(hash);

  refresh();
}

init();
