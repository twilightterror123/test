const $=id=>document.getElementById(id);
const tabs=[...document.querySelectorAll('aside button[data-tab]')];
const panels=[...document.querySelectorAll('.tab')];
const title=$('title');

tabs.forEach(b=>b.onclick=()=>{tabs.forEach(x=>x.classList.remove('active'));b.classList.add('active');panels.forEach(p=>p.classList.toggle('hidden',p.id!==b.dataset.tab));title.textContent=b.textContent.replace(/^[^A-Za-z]+/,'').trim()});
$('openCustomize').onclick=()=>document.querySelector('aside button[data-tab="customize"]').click();

const box=$('notesBox'),count=$('noteCount');
chrome.storage.local.get(['notes'],r=>{box.value=r.notes||'';updateCount()});
function updateCount(){count.textContent=box.value.trim()?box.value.split(/\n/).filter(Boolean).length:0}
$('save').onclick=()=>{chrome.storage.local.set({notes:box.value});updateCount()};
$('addNote').onclick=()=>{box.value+=(box.value?'\n':'')+'New note';chrome.storage.local.set({notes:box.value});updateCount();document.querySelector('aside button[data-tab="notes"]').click()};
$('searchBox').oninput=e=>$('results').textContent=e.target.value?'Search ready for authorized Discord data: '+e.target.value:'Nothing searched yet.';

const files={avatarFile:'avatar',backgroundFile:'background',callSound:'callSound',messageSound:'messageSound'};
function readFile(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}
function setPreview(key,data,name){
  if(key==='avatar'){$('avatarPreview').src=data||'';$('avatarName').textContent=name||'Kein Bild gewählt'}
  if(key==='background'){$('backgroundPreview').style.backgroundImage=data?`url("${data}")`:'';$('backgroundPreview').textContent=data?'':'Kein Hintergrund gewählt'}
  if(key==='callSound')$('callName').textContent=name||'Standard';
  if(key==='messageSound')$('messageName').textContent=name||'Standard';
}

Object.entries(files).forEach(([inputId,key])=>{$(inputId).addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;if(f.size>8*1024*1024){alert('Datei zu groß. Maximal 8 MB.');e.target.value='';return}const data=await readFile(f);setPreview(key,data,f.name);$(inputId).dataset.data=data;$(inputId).dataset.name=f.name})});

let audio;
async function playStored(key){const r=await chrome.storage.local.get([key]);if(!r[key])return;try{if(audio)audio.pause();audio=new Audio(r[key]);audio.volume=.9;await audio.play()}catch(e){console.warn('Audio konnte nicht abgespielt werden',e)}}
$('testCall').onclick=()=>{const input=$('callSound');input.dataset.data?new Audio(input.dataset.data).play():playStored('callSound')};
$('testMessage').onclick=()=>{const input=$('messageSound');input.dataset.data?new Audio(input.dataset.data).play():playStored('messageSound')};

chrome.storage.local.get(['avatar','background','callSound','messageSound','accent','glow','look','compact','blur','discordEffects'],r=>{
  if(r.avatar)setPreview('avatar',r.avatar,'Gespeichert');
  if(r.background)setPreview('background',r.background,'Gespeichert');
  if(r.callSound)$('callName').textContent='Gespeichert';
  if(r.messageSound)$('messageName').textContent='Gespeichert';
  if(r.accent)$('accent').value=r.accent;
  if(r.glow!==undefined)$('glow').value=r.glow;
  if(r.look)$('look').value=r.look;
  $('compact').checked=!!r.compact;
  $('blur').checked=r.blur!==false;
  $('discordEffects').checked=r.discordEffects!==false;
});

$('saveCustomize').onclick=async()=>{
  const data={accent:$('accent').value,glow:Number($('glow').value),look:$('look').value,compact:$('compact').checked,blur:$('blur').checked,discordEffects:$('discordEffects').checked};
  for(const [id,key] of Object.entries(files)){const input=$(id);if(input.dataset.data){data[key]=input.dataset.data}}
  await chrome.storage.local.set(data);
  chrome.runtime.sendMessage({type:'applySettings'});
  $('customStatus').textContent='✓ Gespeichert & angewendet. Öffne Discord neu, falls ein visueller Effekt noch nicht sichtbar ist.';
};
$('resetCustomize').onclick=async()=>{await chrome.storage.local.remove(['avatar','background','callSound','messageSound','accent','glow','look','compact','blur']);location.reload()};