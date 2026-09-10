// TWILIGHT Ultimate Edition — visual customization only.
// Never reads Discord session tokens, passwords or auth headers.
const STYLE_ID='twilight-ultimate-style';
const AUDIO_ID='twilight-ultimate-audio';

function cssEscapeUrl(value){return String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\)/g,'\\)')}
function applySettings(s){
  if(s.discordEffects===false)return;
  let style=document.getElementById(STYLE_ID);
  if(!style){style=document.createElement('style');style.id=STYLE_ID;document.documentElement.appendChild(style)}
  const accent=s.accent||'#00e5ff';
  const glow=Math.max(0,Math.min(100,Number(s.glow??55)))/100;
  const blur=s.blur!==false?'12px':'0px';
  const compact=s.compact?'0.92':'1';
  const bg=s.background?`url("${cssEscapeUrl(s.background)}")`:'none';
  style.textContent=`
:root{--tw-accent:${accent};--tw-glow:${glow};--tw-compact:${compact}}
/* Background layer — intentionally behind Discord's UI */
html::before{content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;background-image:${bg};background-size:cover;background-position:center;filter:blur(${blur});transform:scale(1.04);opacity:${s.background?.65:0};}
html::after{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(circle at 75% 10%,${accent}22,transparent 42%),rgba(3,7,12,.34);}
/* Neon accent helpers; Discord class names change over time, so keep selectors generic */
button:hover,[role="button"]:hover{filter:drop-shadow(0 0 7px ${accent}55)}
[class*="selected"],[aria-selected="true"]{box-shadow:inset 2px 0 ${accent}55}
${s.look==='glass'?'[class*="container"],[class*="content"],[class*="sidebar"]{backdrop-filter:blur(10px);background-color:rgba(5,10,16,.58)!important;}':''}
${s.look==='minimal'?'[class*="container"],[class*="content"],[class*="sidebar"]{box-shadow:none!important;}':''}
${s.compact?'[class*="message"],button,[role="button"]{transform:scale(.98);transform-origin:center;}':''}`;
}

chrome.storage.local.get(['accent','glow','background','blur','compact','look','discordEffects'],applySettings);
chrome.runtime.onMessage.addListener(msg=>{if(msg?.type==='applySettings')chrome.storage.local.get(['accent','glow','background','blur','compact','look','discordEffects'],applySettings)});

// Optional custom message/call sounds are kept local. This observer only detects
// visible Discord UI changes; it does not inspect network traffic or credentials.
let lastTitle=document.title;
setInterval(async()=>{
  const title=document.title;
  if(title!==lastTitle){
    const settings=await chrome.storage.local.get(['messageSound']);
    if(settings.messageSound){try{const a=new Audio(settings.messageSound);a.volume=.75;a.play().catch(()=>{})}catch(e){}}
    lastTitle=title;
  }
},1500);
console.log('TWILIGHT Discord Toolkit Ultimate Edition active');