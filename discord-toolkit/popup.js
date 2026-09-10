const $=id=>document.getElementById(id);
const tabs=[...document.querySelectorAll('aside button[data-tab]')];
const panels=[...document.querySelectorAll('.tab')];
const title=$('title');

tabs.forEach(b=>b.onclick=()=>{tabs.forEach(x=>x.classList.remove('active'));b.classList.add('active');panels.forEach(p=>p.classList.toggle('hidden',p.id!==b.dataset.tab));title.textContent=b.textContent.replace(/^[^A-Za-z✦◈▣⌂⌕◫✎⚙＋]+/,'').trim();if(['chats','servers','search','dashboard'].includes(b.dataset.tab))discover()});
$('openCustomize').onclick=()=>document.querySelector('aside button[data-tab="customize"]').click();
const box=$('notesBox'),count=$('noteCount');
chrome.storage.local.get({notes:''},r=>{box.value=r.notes;updateCount()});
function updateCount(){const n=box.value.trim()?box.value.split(/\n/).filter(Boolean).length:0;count.textContent=n;$('aNotes').textContent=n}
$('save').onclick=()=>{chrome.storage.local.set({notes:box.value});updateCount()};
$('addNote').onclick=()=>{box.value+=(box.value?'\n':'')+'New note';chrome.storage.local.set({notes:box.value});updateCount();document.querySelector('aside button[data-tab="notes"]').click()};

let discovered=[];let discordTabId=null;
async function findDiscordTab(){const tabs=await chrome.tabs.query({});return tabs.find(t=>/^https:\/\/(www\.)?(discord\.com|discordapp\.com)\//.test(t.url||''))||null}
async function discover(){try{const tab=await findDiscordTab();discordTabId=tab?.id||null;if(!discordTabId)throw new Error('Discord tab not found');const data=await chrome.tabs.sendMessage(discordTabId,{type:'discover'});discovered=data?.channels||[];renderDiscovery()}catch(e){discovered=[];renderDiscovery()}}
function renderDiscovery(){const q=($('chatFilter')?.value||'').toLowerCase();const arr=discovered.filter(x=>x.name.toLowerCase().includes(q));const servers=[...new Set(discovered.map(x=>x.server).filter(Boolean))];$('chatCount').textContent=discovered.length;$('aChats').textContent=discovered.length;$('serverCount').textContent=servers.length;$('aServers').textContent=servers.length;$('chatList').innerHTML=arr.length?arr.map((x,i)=>`<button class="chatItem" data-index="${i}">▣ ${escapeHtml(x.name)}<br><small>${escapeHtml(x.server||'Discord')}</small></button>`).join(''):'<div class="empty">Öffne Discord im Browser. Sichtbare Channels werden automatisch gefunden.</div>';$('serverList').innerHTML=servers.map(x=>`<div>⌂ ${escapeHtml(x)}</div>`).join('')||'<div class="empty">Keine Server erkannt.</div>';document.querySelectorAll('.chatItem').forEach((b,i)=>b.onclick=()=>openChat(arr[i]));}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function openChat(x){if(!discordTabId||!x.href)return;try{await chrome.tabs.update(discordTabId,{url:x.href,active:true});const w=await chrome.tabs.get(discordTabId).then(t=>t.windowId);await chrome.windows.update(w,{focused:true})}catch(e){console.warn(e)}}
$('chatFilter').oninput=renderDiscovery;
$('searchBox').oninput=e=>{const q=e.target.value.toLowerCase();$('results').innerHTML=q?discovered.filter(x=>(x.name+' '+(x.server||'')).toLowerCase().includes(q)).map(x=>`<div class="settingCard">▣ ${escapeHtml(x.name)}<br><small>${escapeHtml(x.server||'Discord')}</small></div>`).join('')||'Keine Treffer.':'Noch keine Suche.'};

const files={avatarFile:'avatar',backgroundFile:'background',callSound:'callSound',messageSound:'messageSound'};
function readFile(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}
function setPreview(key,data,name){if(key==='avatar'){$('avatarPreview').src=data||'';$('avatarName').textContent=name||'Kein Bild'}if(key==='background'){$('backgroundPreview').style.backgroundImage=data?`url("${data}")`:'';$('backgroundPreview').textContent=data?'':'Kein Hintergrund'}if(key==='callSound')$('callName').textContent=name||'Standard';if(key==='messageSound')$('messageName').textContent=name||'Standard'}
Object.entries(files).forEach(([inputId,key])=>$(inputId).addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;if(f.size>8*1024*1024){alert('Datei zu groß. Maximal 8 MB.');e.target.value='';return}const data=await readFile(f);setPreview(key,data,f.name);e.target.dataset.data=data}));
let audio;
async function playStored(key){const r=await chrome.storage.local.get([key]);if(!r[key])return;try{if(audio)audio.pause();audio=new Audio(r[key]);audio.volume=.9;await audio.play()}catch(e){console.warn(e)}}
$('testCall').onclick=()=>{const d=$('callSound').dataset.data;if(d)new Audio(d).play().catch(()=>{});else playStored('callSound')};
$('testMessage').onclick=()=>{const d=$('messageSound').dataset.data;if(d)new Audio(d).play().catch(()=>{});else playStored('messageSound')};
chrome.storage.local.get({avatar:'',background:'',callSound:'',messageSound:'',accent:'#00e5ff',glow:55,look:'neon',compact:false,blur:true,discordEffects:true},r=>{if(r.avatar)setPreview('avatar',r.avatar,'Gespeichert');if(r.background)setPreview('background',r.background,'Gespeichert');if(r.callSound)$('callName').textContent='Gespeichert';if(r.messageSound)$('messageName').textContent='Gespeichert';$('accent').value=r.accent;$('glow').value=r.glow;$('look').value=r.look;$('compact').checked=r.compact;$('blur').checked=r.blur;$('discordEffects').checked=r.discordEffects});
$('saveCustomize').onclick=async()=>{const data={accent:$('accent').value,glow:Number($('glow').value),look:$('look').value,compact:$('compact').checked,blur:$('blur').checked,discordEffects:$('discordEffects').checked};for(const [id,key] of Object.entries(files)){const d=$(id).dataset.data;if(d)data[key]=d}await chrome.storage.local.set(data);try{const tab=await findDiscordTab();if(tab?.id)await chrome.tabs.sendMessage(tab.id,{type:'applySettings'})}catch(e){}$('customStatus').textContent='✓ Gespeichert & angewendet.'};
$('resetCustomize').onclick=async()=>{await chrome.storage.local.remove(['avatar','background','callSound','messageSound','accent','glow','look','compact','blur']);location.reload()};
$('discordEffects').onchange=e=>chrome.storage.local.set({discordEffects:e.target.checked});
setTimeout(discover,700);setInterval(discover,5000);