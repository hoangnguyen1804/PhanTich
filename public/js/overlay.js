import { connect } from './client.js';
import { createFighters } from './fighters.js';
import { createSound } from './sound.js';

const $ = id => document.getElementById(id);
const stage=$('stage'),scene=$('arenaScene'),fx=$('combatFx');
const params=new URLSearchParams(location.search),preview=params.has('mute'),showcase=params.get('showcase')==='1';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
if(['0','transparent'].includes(params.get('bg')))document.body.classList.add('clear');
if(preview)document.body.classList.add('preview');
function fit(){const k=Math.min(innerWidth/1080,innerHeight/1920);stage.style.transform=`scale(${k})`;stage.style.left=`${(innerWidth-1080*k)/2}px`;stage.style.top=`${(innerHeight-1920*k)/2}px`;}
fit();addEventListener('resize',fit);
if(window.ResizeObserver)new ResizeObserver(fit).observe(document.body);

// The crowd is deterministic artwork, generated locally rather than using remote images.
const audience=$('audience');
for(let row=0;row<4;row++)for(let i=0;i<35;i++){
 const head=document.createElementNS('http://www.w3.org/2000/svg','circle');
 head.setAttribute('cx',20+i*29+(row%2?10:0));head.setAttribute('cy',258+row*31+Math.sin(i*1.7)*7);head.setAttribute('r',4+((i+row)%3));
 head.setAttribute('fill',(i+row)%13===0?'#f5c9aa':(i+row)%11===0?'#57b4c0':'#293343');head.setAttribute('opacity',String(.2+row*.09));audience.appendChild(head);
}
const fighters=createFighters($('fighters'));
let current=null,connected=false,clockOffset=0,lastMatchId='',lastPhase='',muted=preview,localCaptionAt=0;
const timerHandles=new Set();
const sound=createSound({
 onCaption(text,info={}){
  if(text){$('mcCaption').textContent=text;localCaptionAt=Date.now();}
  $('voiceWave').classList.toggle('speaking',!!info.speaking);$('mcSpeaking').textContent=info.speaking?'● ĐANG BÌNH LUẬN':'● SẴN SÀNG';
 },
 onReady(ready){$('soundUnlock').hidden=ready||muted;}
});
sound.setMuted(preview);
$('soundUnlock').hidden=preview;
$('soundUnlock').addEventListener('click',async()=>{muted=false;sound.setMuted(false);await sound.unlock();});
addEventListener('message',e=>{
 if(e.origin!==location.origin)return;
 if(e.data?.type==='arena.mute'){muted=!!e.data.muted;sound.setMuted(muted);document.body.classList.toggle('preview',muted);$('soundUnlock').hidden=muted||sound.isUnlocked;}
});
if(matchMedia('(pointer:coarse)').matches)document.addEventListener('touchend',()=>{
 if(document.fullscreenElement||preview)return;
 document.documentElement.requestFullscreen?.({navigationUI:'hide'}).catch(()=>{});
},{passive:true});

function safeAvatar(el,url,name){
 const initial=String(name||'?').trim().slice(0,1).toLocaleUpperCase('vi');el.textContent=initial;
 const raw=String(url||'');
 if(/^https:\/\//.test(raw)&&raw.length<800){
  try {const u=new URL(raw);el.style.backgroundImage=`url(${JSON.stringify(u.href)})`;el.textContent='';}catch{el.style.backgroundImage='';}
 }else el.style.backgroundImage='';
}
const number=n=>Math.max(0,Math.round(Number(n)||0)).toLocaleString('vi-VN');
const ratio=(n,max)=>Math.min(1,Math.max(0,(Number(n)||0)/(Number(max)||1)));
function renderFighter(side,f){
 $(''+side+'Name').textContent=f?.name||'ĐANG CHỜ';
 $(''+side+'Hp').textContent=f?`${number(f.hp)} / ${number(f.maxHp)} HP`:'— HP';
 $(''+side+'Streak').textContent=f?.streak?`${number(f.streak)} TRẬN GIỮ ĐÀI`:f?'SẴN SÀNG':'THÁCH ĐẤU';
 safeAvatar($(side+'Avatar'),f?.avatar,f?.name);
 const hp=f?ratio(f.hp,f.maxHp):0;
 $(side+'Health').style.transform=`scaleX(${hp})`;$(side+'Ghost').style.transform=`scaleX(${hp})`;
 $(side+'Stamina').style.transform=`scaleX(${f?ratio(f.stamina,f.maxStamina||100):0})`;
 $(side+'Energy').style.transform=`scaleX(${f?ratio(f.energy,100):0})`;
 $(side+'EnergyText').textContent=`${number(f?.energy)}%`;
 $(side+'Corner').classList.toggle('low-health',!!f&&hp<.25);
}
function listRow(index,name,avatar,value){
 const li=document.createElement('li'),rank=document.createElement('span'),av=document.createElement('span'),nm=document.createElement('span'),val=document.createElement('span');
 rank.className='list-rank';rank.textContent=String(index+1).padStart(2,'0');av.className='list-avatar';safeAvatar(av,avatar,name);nm.className='list-name';nm.textContent=name||'Khách';val.className='list-value';val.textContent=value;
 li.append(rank,av,nm,val);return li;
}
function renderList(id,data,empty,formatter){
 const root=$(id);root.replaceChildren();
 if(!data.length){const li=document.createElement('li');li.className='list-empty';li.textContent=empty;root.appendChild(li);return;}
 data.slice(0,3).forEach((x,i)=>root.appendChild(listRow(i,x.name,x.avatar,formatter(x))));
}
function showCenter(phase,state){
 const box=$('centerState');box.className='center-state';
 if(phase==='fighting') {box.classList.add('hidden');return;}
 if(phase==='countdown') {box.classList.add('countdown');$('centerEyebrow').textContent='VÀO VỊ TRÍ';$('centerTitle').textContent=String(Math.max(1,Math.ceil((state.match.countdownMs||0)/1000)));$('centerNote').textContent='Chuẩn bị tung đòn đầu tiên.';return;}
 if(phase==='finished'){
  box.classList.add('finished');const r=state.match.result;
  $('centerEyebrow').textContent=r?.winner?'NGƯỜI THẮNG GIỮ ĐÀI':'TRẬN ĐẤU KẾT THÚC';
  $('centerTitle').textContent=r?.winner?'WINNER':'HÒA';
  $('centerNote').textContent=r?.name||state.match.fighters?.[r?.winner]?.name||r?.reason||'Một trận đấu đầy nỗ lực.';return;
 }
 if(phase==='paused'){box.classList.add('paused');$('centerEyebrow').textContent='NGHỈ GIỮA HIỆP';$('centerTitle').textContent='TẠM DỪNG';$('centerNote').textContent='Giữ sức. Trận đấu sẽ tiếp tục ngay.';return;}
 $('centerEyebrow').textContent='SÂN KHẤU CỦA BẠN';$('centerTitle').replaceChildren();
 $('centerTitle').append('AI SẼ',document.createElement('br'),'LÀ NHÀ VÔ ĐỊCH?');
 const entry=state.settings?.entryCoins??1;
 $('centerNote').textContent=entry>0?`Tặng từ ${number(entry)} xu để đăng ký lên đài.`:'Bình luận “lên đài” để đăng ký thách đấu.';
}
let giftPage=0,showGift=false,lastGuideSignature='';
const actionLabels={entry:'Vé lên đài',jab:'Đấm thẳng',hook:'Đấm móc',uppercut:'Đấm bốc',kick:'Đá vòng',flurry:'Liên hoàn đấm',ultimate:'Tuyệt kỹ bão quyền',heal:'Hồi máu',shield:'Lá chắn'};
const actionIcons={entry:'↗',jab:'✦',hook:'ϟ',uppercut:'↑',kick:'↗',flurry:'×5',ultimate:'✺',heal:'+',shield:'◇'};
function renderGiftGuide(){
 if(!current)return;
 const menu=Array.isArray(current.giftMenu)?current.giftMenu:Object.entries(current.settings?.giftMap||{}).map(([id,action])=>({id,name:`Quà #${id}`,action,label:actionLabels[action]||action}));
 const commandOn=current.settings?.showCommands!==false,displayGifts=menu.length&&(!commandOn||showGift);
 $('commandGuide').style.visibility=commandOn||menu.length?'visible':'hidden';
 $('commandGrid').hidden=!!displayGifts;$('giftGuide').hidden=!displayGifts;
 $('guideTitle').textContent=displayGifts?'TẶNG QUÀ. TIẾP SỨC. BÙNG NỔ.':'BÀN PHÍM CỦA BẠN LÀ VŨ KHÍ';
 $('guideNote').textContent=displayGifts?'CHỌN ĐỎ / XANH ĐỂ CỔ VŨ':'BÌNH LUẬN ĐỂ RA ĐÒN';
 if(!displayGifts)return;
 const items=menu.slice((giftPage%Math.ceil(menu.length/4))*4,(giftPage%Math.ceil(menu.length/4))*4+4),signature=JSON.stringify(items);
 if(signature===lastGuideSignature)return;lastGuideSignature=signature;
 $('giftGuide').replaceChildren();
 for(const item of items){
  const chip=document.createElement('div'),icon=document.createElement('span'),body=document.createElement('div'),name=document.createElement('strong'),action=document.createElement('small'),price=document.createElement('em');
  chip.className='gift-guide-chip';icon.className='gift-guide-icon';icon.textContent=actionIcons[item.action]||'✦';name.textContent=item.name||`Quà #${item.id}`;action.textContent=item.label||actionLabels[item.action]||'Tiếp sức';price.textContent=item.coins?`${number(item.coins)} XU`:'QUÀ TẶNG';body.append(name,action);chip.append(icon,body,price);$('giftGuide').appendChild(chip);
 }
}
setInterval(()=>{showGift=!showGift;if(showGift)giftPage++;renderGiftGuide();},10000);
function render(state){
 if(!state||!state.match)return;current=state;clockOffset=(state.now||Date.now())-Date.now();
 const phase=state.match.phase||'waiting',id=state.match.id||'';
 if(id!==lastMatchId||(['waiting','countdown'].includes(phase)&&phase!==lastPhase)){fighters.reset();clearFx();}
 lastMatchId=id;lastPhase=phase;
 stage.className=phase;stage.dataset.theme=['electric','ember','ice'].includes(state.settings?.theme)?state.settings.theme:'electric';
 const title=state.settings?.title||'VÕ ĐÀI LIVE';
 if(title==='VÕ ĐÀI LIVE'){$('arenaTitle').style.removeProperty('font-size');$('arenaTitle').replaceChildren(document.createTextNode('VÕ ĐÀI '));const span=document.createElement('span');span.textContent='LIVE';$('arenaTitle').append(span);}
 else{$('arenaTitle').textContent=String(title).slice(0,40);$('arenaTitle').style.fontSize=`${Math.max(34,Math.min(107,1450/title.length))}px`;}
 $('modeBadge').className=`mode-badge ${state.mode==='demo'?'demo':'live'}`;
 $('modeBadge').textContent=showcase?'BẢN XEM GIAO DIỆN':state.mode==='demo'?'CHẠY THỬ · DEMO':state.connection?.status==='connected'?'● TIKTOK LIVE':'SẴN SÀNG LIVE';
 $('matchLabel').textContent=`TRẬN ${String(state.match.number||1).padStart(3,'0')}`;
 $('phaseLabel').textContent={waiting:'CHỜ VÕ SĨ',countdown:'CHUẨN BỊ',fighting:'ĐANG THI ĐẤU',paused:'TẠM DỪNG',finished:'KẾT THÚC'}[phase]||phase;
 $('matchStatus').textContent={waiting:'VÕ ĐÀI ĐANG MỞ',countdown:'SẴN SÀNG GIAO ĐẤU',fighting:'ROUND IN PROGRESS',paused:'TẠM NGHỈ',finished:'CHIẾN THẮNG THUỘC VỀ BẠN'}[phase]||'';
 renderFighter('red',state.match.fighters?.red);renderFighter('blue',state.match.fighters?.blue);
 renderList('queueList',state.queue||[],'Vị trí tiếp theo dành cho bạn.',x=>`${number(x.coins)} XU`);
 $('queueCount').textContent=String(state.queue?.length||0).padStart(2,'0');
 renderList('rankingList',state.leaderboard||[],'Tên bạn sẽ xuất hiện ở đây.',x=>`${number(x.wins)} W`);
 $('entryHint').textContent=(state.settings?.entryCoins??1)>0?`TỪ ${number(state.settings?.entryCoins)} XU · ĐĂNG KÝ LÊN ĐÀI ↗`:'BÌNH LUẬN “LÊN ĐÀI” · THAM GIA MIỄN PHÍ ↗';
 $('sceneStats').textContent=`${number(state.stats?.punches)} CÚ ĐẤM · ${number(state.stats?.matches)} TRẬN`;
 renderGiftGuide();
 fighters.update(state);showCenter(phase,state);sound.settings(state.settings||{});
 if(state.music)sound.event({type:'music',...state.music});
 if(state.audio?.caption&&Date.now()-localCaptionAt>6000)$('mcCaption').textContent=state.audio.caption;
 updateClock();
}
function updateClock(){
 if(!current?.match)return;
 const m=current.match;let remaining=m.phase==='waiting'?(Number(current.settings?.roundSeconds)||120)*1000:(m.remainingMs||0);
 if(m.phase==='fighting'&&connected)remaining=Math.max(0,remaining-(Date.now()+clockOffset-current.now));
 const seconds=Math.ceil(remaining/1000);$('matchClock').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
 document.querySelector('.round-clock').classList.toggle('hot',seconds<=15&&m.phase==='fighting');
 if(m.phase==='countdown'){
  const left=Math.max(0,(m.countdownMs||0)-(Date.now()+clockOffset-current.now));$('centerTitle').textContent=left>0?String(Math.ceil(left/1000)):'FIGHT!';
 }
}
setInterval(updateClock,100);
function later(fn,ms){const id=setTimeout(()=>{timerHandles.delete(id);fn();},ms);timerHandles.add(id);}
function addFx(el,life){
 while(fx.childElementCount>=110)fx.firstElementChild.remove();fx.appendChild(el);later(()=>el.remove(),life);return el;
}
function clearFx(){for(const t of timerHandles)clearTimeout(t);timerHandles.clear();fx.replaceChildren();scene.getAnimations().forEach(a=>a.cancel());$('impactFlash').getAnimations().forEach(a=>a.cancel());}
function element(cls,x,y){const el=document.createElement('div');el.className=cls;if(x!=null)el.style.left=`${x}%`;if(y!=null)el.style.top=`${y}%`;return el;}
function impact(e,index=0){
 const target=e.target||((e.side==='red')?'blue':'red'),x=target==='blue'?65:35,y=e.move==='kick'?55:40;
 const color=e.critical?'#d6f08b':e.side==='blue'?'#7ffff1':'#ffc091';
 if(!reduced.matches){
  const shock=element('impact-ring',x,y);shock.style.setProperty('--fx-color',color);addFx(shock,600);
  const arc=element('punch-arc',x+(e.side==='red'?-6:6),y);arc.style.setProperty('--fx-color',color);arc.style.setProperty('--rotate',e.move==='uppercut'?'95deg':e.side==='red'?'10deg':'190deg');addFx(arc,400);
  const count=e.critical?23:12;
  for(let i=0;i<count;i++){
   const p=element('particle',x,y),angle=Math.random()*Math.PI*2,r=40+Math.random()*(e.critical?190:110);
   p.style.setProperty('--tx',`${Math.cos(angle)*r}px`);p.style.setProperty('--ty',`${Math.sin(angle)*r}px`);p.style.setProperty('--size',`${Math.random()*5+2}px`);p.style.setProperty('--fx-color',color);p.style.setProperty('--duration',`${450+Math.random()*350}ms`);addFx(p,850);
  }
  if(!preview||document.visibilityState==='visible')scene.animate([{transform:'translate(0,0)'},{transform:`translate(${e.side==='red'?5:-5}px,-2px)`},{transform:'translate(-3px,2px)'},{transform:'translate(0,0)'}],{duration:e.critical?260:150});
  if(e.critical)$('impactFlash').animate([{opacity:0},{opacity:.22,offset:.12},{opacity:0}],{duration:240});
 }
 if(index===0){
  const n=element('damage-number',x+(e.side==='red'?4:-4),y-4);n.style.setProperty('--fx-color',color);
  const label=e.dodged?'NÉ!':e.blocked?'ĐỠ!':`−${number(e.damage)}`;n.textContent=label;
  if(e.critical||e.gift){const s=document.createElement('small');s.textContent=e.critical?'CRITICAL HIT':'GIFT POWER';n.appendChild(s);}addFx(n,1000);
 }
}
function onEvent(e){
 if(!e?.type)return;
 if(e.type==='hit'){
  fighters.hit(e);
  if(!e.dodged){const hits=Math.max(1,Math.min(6,Number(e.hits)||1));for(let i=0;i<hits;i++)later(()=>impact(e,i),180+i*150);}
  else impact({...e,damage:0},0);
  if((e.combo||e.hits||0)>1){
   fx.querySelectorAll('.combo-callout').forEach(x=>x.remove());const c=element(`combo-callout ${e.side==='blue'?'blue':''}`);c.append('COMBO');const b=document.createElement('b');b.textContent=`×${Math.min(99,e.combo||e.hits)}`;const small=document.createElement('small');small.textContent=e.move==='ultimate'?'TUYỆT CHIÊU BÙNG NỔ':'KHÔNG THỂ CẢN PHÁ';c.append(b,small);addFx(c,850);
  }
 }else if(e.type==='defend')fighters.defend(e);
 else if(e.type==='ko'){
  fighters.ko(e);fx.querySelectorAll('.ko-stamp').forEach(x=>x.remove());const stamp=element('ko-stamp');stamp.textContent=!e.winner?'DRAW':e.reason==='ko'?'K.O.':'WIN';const small=document.createElement('small');small.textContent=e.winner?'THE CHAMPION STAYS':'NGANG TÀI NGANG SỨC';stamp.appendChild(small);addFx(stamp,2700);
  if(!reduced.matches)for(let i=0;i<40;i++)later(()=>{const p=element('particle',Math.random()*100,15);p.style.setProperty('--tx',`${(Math.random()-.5)*200}px`);p.style.setProperty('--ty',`${300+Math.random()*350}px`);p.style.setProperty('--size',`${4+Math.random()*5}px`);p.style.setProperty('--fx-color',i%2?'#d6f08b':'#f5f2e9');p.style.setProperty('--duration','1800ms');addFx(p,1900);},i*18);
 }else if(e.type==='gift'){
  fx.querySelectorAll('.gift-callout').forEach(x=>x.remove());const g=element('gift-callout'),symbol=document.createElement('span'),wrap=document.createElement('div'),name=document.createElement('strong'),note=document.createElement('small');symbol.className='gift-symbol';symbol.textContent='✦';name.textContent=e.name||'Khán giả';note.textContent=`${number(e.coins)} XU${e.side?` · TIẾP SỨC GÓC ${e.side==='red'?'ĐỎ':'XANH'}`:' · HẸN BẠN TRÊN VÕ ĐÀI'}`;wrap.append(name,note);g.append(symbol,wrap);addFx(g,3300);
 }else if(e.type==='reset'||(e.type==='match'&&['waiting','countdown'].includes(e.phase))){fighters.reset();clearFx();}
 else if(e.type==='connection')updateNetwork();
 sound.event(e);
}
function updateNetwork(){
 const badge=$('networkBadge');badge.classList.toggle('offline',!connected);
 const text=!connected?'MẤT KẾT NỐI · ĐANG THỬ LẠI':current?.mode==='demo'?'MÔ PHỎNG CỤC BỘ':current?.connection?.status==='connected'?'ĐANG NHẬN TIKTOK':'KẾT NỐI VÕ ĐÀI';
 badge.replaceChildren();const dot=document.createElement('i');badge.append(dot,text);
}
if(!showcase)connect({role:'overlay',onState:s=>{render(s);updateNetwork();},onEvent,onStatus:ok=>{connected=ok;updateNetwork();}});
else{
 const f=(uid,name,hp,energy)=>({uid,name,hp,maxHp:1000,stamina:82,maxStamina:100,energy,damage:0,combo:0,wins:4,streak:3});
 render({mode:'demo',now:Date.now(),match:{id:'showcase',number:12,phase:'fighting',remainingMs:87000,countdownMs:0,fighters:{red:f('show-red','HẢI PHÒNG',740,72),blue:f('show-blue','SÀI GÒN',580,91)},result:null},queue:[{name:'Minh Anh',coins:5},{name:'Hoàng Long',coins:10},{name:'Ngọc Hân',coins:3}],leaderboard:[{name:'Hải Phòng',wins:8},{name:'Sài Gòn',wins:6},{name:'Đà Nẵng',wins:4}],settings:{title:'VÕ ĐÀI LIVE',entryCoins:1,showCommands:true,mcEnabled:false,musicEnabled:false,sfxVolume:0},stats:{punches:248,matches:12}});connected=true;updateNetwork();
 globalThis.arenaShowcase={event:onEvent,render};
 $('mcCaption').textContent='BẢN XEM GIAO DIỆN · Hình minh họa, không có giao dịch hay trận LIVE thật.';
}
addEventListener('pagehide',()=>{sound.close();fighters.close();clearFx();});
