const STYLE_ID='twilight-ultimate-style';
const PANEL_ID='twilight-tweeror-panel';
const BUTTON_ID='twilight-tweeror-button';

const getSettings=()=>chrome.storage.local.get({accent:'#00e5ff',glow:55,background:'',avatar:'',callSound:'',messageSound:'',look:'neon',compact:false,blur:true,discordEffects:true});

function escapeUrl(v){return String(v).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\)/g,'\\)')}
function applySettings(s){
  if(s.discordEffects===false){document.getElementById(STYLE_ID)?.remove();return;}
  let style=document.getElementById(STYLE_ID);
  if(!style){style=document.createElement('style');style.id=STYLE_ID;document.documentElement.appendChild(style)}
  const accent=s.accent||'#00e5ff';
  const glow=Math.max(0,Math.min(100,Number(s.glow??55)))/100;
  const bg=s.background?`url("${escapeUrl(s.background)}")`:'none';
  style.textContent=`
:root{--tw-accent:${accent};--tw-glow:${glow}}
html::before{content:"";position:fixed;inset:0;z-index:-10;pointer-events:none;background-image:${bg};background-size:cover;background-position:center;filter:blur(${s.blur!==false?'10px':'0px'});transform:scale(1.04);opacity:${s.background?.62:0}}
html::after{content:"";position:fixed;inset:0;z-index:-9;pointer-events:none;background:radial-gradient(circle at 78% 8%,${accent}22,transparent 42%),rgba(3,7,12,.30)}
button:hover,[role="button"]:hover{filter:drop-shadow(0 0 7px ${accent}55)}
[aria-selected="true"]{box-shadow:inset 2px 0 ${accent}66}
${s.look==='glass'?'[class*="container"],[class*="content"],[class*="sidebar"]{backdrop-filter:blur(10px);background-color:rgba(5,10,16,.58)!important}':''}
${s.look==='minimal'?'[class*="container"],[class*="content"],[class*="sidebar"]{box-shadow:none!important}':''}
${s.compact?'[class*="message"],button,[role="button"]{transform:scale(.985);transform-origin:center}':''}
#${BUTTON_ID}{border:1px solid ${accent}66!important;background:linear-gradient(135deg,${accent}22,transparent)!important;color:${accent}!important;border-radius:8px!important;margin:4px 0!important;padding:8px 12px!important;cursor:pointer!important;font-weight:700!important}
#${PANEL_ID}{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.62);backdrop-filter:blur(5px);font-family:Arial,sans-serif}
#${PANEL_ID} .tw-card{width:min(720px,90vw);max-height:88vh;overflow:auto;background:#081019;border:1px solid ${accent}55;border-radius:18px;box-shadow:0 0 45px ${accent}22;color:#eafcff;padding:24px}
#${PANEL_ID} h1{margin:0 0 4px;color:${accent};font-size:24px;letter-spacing:2px}#${PANEL_ID} .tw-sub{color:#71858d;font-size:12px;margin-bottom:20px}
#${PANEL_ID} .tw-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:650px){#${PANEL_ID} .tw-grid{grid-template-columns:1fr}}
#${PANEL_ID} .tw-box{background:#0d1822;border:1px solid #ffffff12;border-radius:12px;padding:14px}#${PANEL_ID} label{display:block;font-weight:700;color:#b8d0d7;margin-bottom:7px}#${PANEL_ID} input,#${PANEL_ID} select{width:100%;box-sizing:border-box;background:#071018;color:#fff;border:1px solid ${accent}44;border-radius:8px;padding:9px}#${PANEL_ID} input[type=color]{height:42px;padding:3px}#${PANEL_ID} input[type=checkbox]{width:auto}#${PANEL_ID} .tw-actions{display:flex;gap:8px;margin-top:16px}#${PANEL_ID} button{border:0;border-radius:8px;padding:10px 14px;cursor:pointer}#${PANEL_ID} .tw-primary{background:${accent};color:#001015;font-weight:800}#${PANEL_ID} .tw-secondary{background:#17232c;color:#d6edf2}#${PANEL_ID} .tw-status{color:#70e6a0;font-size:12px;margin-top:12px}
`;
}

function makeFilePicker(accept, callback){const i=document.createElement('input');i.type='file';i.accept=accept;i.onchange=()=>{const f=i.files?.[0];if(!f)return;if(f.size>8*1024*1024){alert('Maximal 8 MB pro Datei.');return}const r=new FileReader();r.onload=()=>callback(r.result,f.name);r.readAsDataURL(f)};i.click()}
function openPanel(){
  if(document.getElementById(PANEL_ID))return;
  getSettings().then(s=>{
    const wrap=document.createElement('div');wrap.id=PANEL_ID;
    wrap.innerHTML=`<div class="tw-card"><h1>TWILIGHT / TWEЯOR SETTINGS</h1><div class="tw-sub">Deine lokalen Discord-Custom-Settings • bleiben auf diesem Gerät gespeichert</div><div class="tw-grid">
      <div class="tw-box"><label>🖼 Hintergrund</label><button class="tw-secondary" id="tw-bg">Bild auswählen</button><div id="tw-bg-name" class="tw-sub">${s.background?'Gespeichert':'Kein Bild'}</div></div>
      <div class="tw-box"><label>👤 Profilbild-Darstellung</label><button class="tw-secondary" id="tw-avatar">Bild auswählen</button><div id="tw-avatar-name" class="tw-sub">${s.avatar?'Gespeichert':'Kein Bild'}</div></div>
      <div class="tw-box"><label>📞 Anruf-Sound</label><button class="tw-secondary" id="tw-call">Sound auswählen</button><button class="tw-secondary" id="tw-call-test">▶ Test</button><div class="tw-sub">${s.callSound?'Gespeichert':'Standard'}</div></div>
      <div class="tw-box"><label>🔔 Notification-Sound</label><button class="tw-secondary" id="tw-msg">Sound auswählen</button><button class="tw-secondary" id="tw-msg-test">▶ Test</button><div class="tw-sub">${s.messageSound?'Gespeichert':'Standard'}</div></div>
      <div class="tw-box"><label>🎨 Akzentfarbe</label><input id="tw-accent" type="color" value="${s.accent}"></div>
      <div class="tw-box"><label>✨ Glow</label><input id="tw-glow" type="range" min="0" max="100" value="${s.glow}"></div>
      <div class="tw-box"><label>🌌 Look</label><select id="tw-look"><option value="neon">TWILIGHT Neon</option><option value="midnight">Midnight</option><option value="glass">Glass</option><option value="minimal">Minimal Clean</option></select><label style="margin-top:10px"><input id="tw-blur" type="checkbox" ${s.blur!==false?'checked':''}> Background Blur</label><label><input id="tw-compact" type="checkbox" ${s.compact?'checked':''}> Compact Mode</label></div>
      <div class="tw-box"><label>💾 Speicher</label><div class="tw-sub">Einstellungen und ausgewählte Medien werden lokal gespeichert. Keine Discord-Session-Tokens werden gelesen.</div></div>
    </div><div class="tw-actions"><button class="tw-primary" id="tw-save">✓ Speichern & Anwenden</button><button class="tw-secondary" id="tw-close">Schließen</button></div><div id="tw-status" class="tw-status"></div></div>`;
    document.body.appendChild(wrap);
    document.getElementById('tw-look').value=s.look||'neon';
    const set=(key,val)=>chrome.storage.local.set({[key]:val});
    document.getElementById('tw-bg').onclick=()=>makeFilePicker('image/*',(d,n)=>{s.background=d;document.getElementById('tw-bg-name').textContent=n;set('background',d);applySettings(s)});
    document.getElementById('tw-avatar').onclick=()=>makeFilePicker('image/*',(d,n)=>{s.avatar=d;document.getElementById('tw-avatar-name').textContent=n;set('avatar',d);applyAvatar(s.avatar)});
    document.getElementById('tw-call').onclick=()=>makeFilePicker('audio/*',(d,n)=>{s.callSound=d;set('callSound',d)});
    document.getElementById('tw-msg').onclick=()=>makeFilePicker('audio/*',(d,n)=>{s.messageSound=d;set('messageSound',d)});
    document.getElementById('tw-call-test').onclick=()=>s.callSound&&new Audio(s.callSound).play().catch(()=>{});
    document.getElementById('tw-msg-test').onclick=()=>s.messageSound&&new Audio(s.messageSound).play().catch(()=>{});
    document.getElementById('tw-save').onclick=async()=>{s.accent=document.getElementById('tw-accent').value;s.glow=Number(document.getElementById('tw-glow').value);s.look=document.getElementById('tw-look').value;s.blur=document.getElementById('tw-blur').checked;s.compact=document.getElementById('tw-compact').checked;await chrome.storage.local.set(s);applySettings(s);applyAvatar(s.avatar);document.getElementById('tw-status').textContent='✓ TWEЯOR Settings gespeichert.'};
    document.getElementById('tw-close').onclick=()=>wrap.remove();wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove()});
  });
}

function injectSettingsButton(){
  if(document.getElementById(BUTTON_ID))return;
  const candidates=[...document.querySelectorAll('div,button')].filter(e=>{const t=(e.textContent||'').trim();return t==='User Settings'||t==='Benutzereinstellungen'||t==='Settings'});
  const target=candidates.find(e=>e.closest('[role="dialog"]'))||candidates[0];
  if(!target||!target.parentElement)return;
  const b=document.createElement('button');b.id=BUTTON_ID;b.textContent='✦ TWEЯOR Settings';b.title='TWILIGHT customization';b.onclick=openPanel;target.parentElement.insertBefore(b,target.nextSibling);
}
function applyAvatar(data){
  if(!data)return;
  let style=document.getElementById('twilight-avatar-style');if(!style){style=document.createElement('style');style.id='twilight-avatar-style';document.documentElement.appendChild(style)}
  const safe=escapeUrl(data);style.textContent=`img[src*="avatars"],img[class*="avatar"]{}`;
}

getSettings().then(s=>{applySettings(s);applyAvatar(s.avatar)});
const observer=new MutationObserver(()=>{injectSettingsButton()});observer.observe(document.documentElement,{childList:true,subtree:true});
setTimeout(injectSettingsButton,2000);
chrome.runtime.onMessage.addListener(msg=>{if(msg?.type==='applySettings')getSettings().then(s=>{applySettings(s);applyAvatar(s.avatar)})});
console.log('TWILIGHT Ultimate 3.0 active');