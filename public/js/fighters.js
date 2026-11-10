// Original anatomical athlete illustrations; no downloaded likenesses or viewer text in SVG markup.
const NS='http://www.w3.org/2000/svg';
const sides=['red','blue'];
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function glove(side,x,y,angle=0){return `<g transform="translate(${x} ${y}) rotate(${angle})"><path d="M-17 2H17L16 24H-17Z" fill="#efeee7" stroke="#534d49" stroke-width="1.5"/><path d="M-14 9H14M-13 15H13" stroke="#babbb4" stroke-width="2"/><path d="M-20 7C-28-3-29-22-18-32-10-42 10-43 20-32 29-23 29-7 20 5L9 13-9 12Z" fill="url(#glove-${side})" stroke="#1a1920" stroke-width="2"/><path d="M-19-12C-23-4-22 4-15 8L-7 6-9-9Z" fill="url(#leather-${side})"/><path d="M-16-23Q-1-34 14-24" fill="none" stroke="#ffffff" stroke-opacity=".6" stroke-width="3" stroke-linecap="round"/><path d="M-7 2H10" stroke="#e5e7df" stroke-opacity=".75" stroke-width="2"/><path d="M-23-3Q-10-10-10 6M13-31 17-16" fill="none" stroke="#12131c" stroke-opacity=".3" stroke-width="1.3"/></g>`;}
function athlete(side){
 const blue=side==='blue',accent=blue?'#37c9df':'#f34b45',dark=blue?'#064656':'#6d172b',x=blue?665:335;
 return `<g class="boxer boxer-${side}" data-side="${side}" transform="translate(${x} 716) scale(${blue?-1:1} 1)">
 <ellipse class="fighter-shadow" cx="0" cy="12" rx="111" ry="19" fill="#000713" opacity=".78"/>
 <g class="athlete-sway"><g class="boxer-body">
  <g class="leg leg-back" transform="translate(-27 -191)"><g class="limb-motion">
   <path d="M-24-9C-48 0-66 49-68 89L-91 164Q-85 177-64 174L-38 107C-22 87-10 53 4 20Z" fill="url(#skin-${side})" stroke="#261c22" stroke-width="1.8"/>
   <path d="M-34 4Q-56 49-52 78L-38 88-62 121-72 158" fill="none" stroke="#4d292b" stroke-opacity=".38" stroke-width="10"/>
   <path d="M-42 6Q-60 49-59 70M-67 112-80 151" fill="none" stroke="#ffe4c0" stroke-opacity=".3" stroke-width="3"/>
   <ellipse cx="-53" cy="92" rx="12" ry="10" fill="#714538" opacity=".26"/>
   <path d="M-90 153-63 158-57 179-43 190Q-43 201-60 202H-118Q-130 195-124 185L-103 174Z" fill="url(#leather-${side})" stroke="#0e1520" stroke-width="2"/>
   <path d="M-123 193H-48" stroke="#d8ded9" stroke-width="7"/><path d="m-89 169 22 7m-27 0 24 6m-30 1 26 6" stroke="#d4d8d2" stroke-width="2.2"/><path d="M-112 184-99 176" stroke="${accent}" stroke-width="5"/>
  </g></g>
  <g class="leg leg-front" transform="translate(28 -193)"><g class="limb-motion">
   <path d="M-14-10C19-13 38 17 43 61L54 105 76 167Q67 180 47 175L18 118Q9 105 4 90L-27 31Z" fill="url(#skin-${side})" stroke="#251c23" stroke-width="1.8"/>
   <path d="M-7 5Q22 16 26 59L29 92Q38 102 47 105L58 154" fill="none" stroke="#ffe7c5" stroke-opacity=".27" stroke-width="8"/>
   <path d="M20 9Q44 58 35 92L22 101M53 119 66 159" fill="none" stroke="#593130" stroke-opacity=".38" stroke-width="8"/>
   <ellipse cx="36" cy="98" rx="15" ry="10" fill="#805645" opacity=".25"/>
   <path d="M46 154 75 153 83 173 110 183Q121 190 113 202H40L31 190Z" fill="url(#leather-${side})" stroke="#111721" stroke-width="2"/>
   <path d="M37 195H116" stroke="#e3e5dd" stroke-width="7"/><path d="m54 168 22-1m-20 8 24-1m-21 8 27-1" stroke="#d8ded9" stroke-width="2.2"/><path d="m84 181 22 6" stroke="${accent}" stroke-width="5"/>
  </g></g>
  <g class="arm arm-back" transform="translate(-53 -356)"><g class="limb-motion">
   <path d="M0-16C-15-21-30-6-34 13L-43 53Q-40 73-24 76-8 73-7 54L13 9Z" fill="url(#skin-${side})" stroke="#322126" stroke-width="1.6"/>
   <path d="M-19-4Q-35 11-31 43" fill="none" stroke="#ffe7c5" stroke-opacity=".3" stroke-width="5"/><path d="M-14 12-20 48" stroke="#573331" stroke-opacity=".5" stroke-width="5"/>
   <g class="elbow" transform="translate(-28 63)"><g class="forearm"><path d="M-13 7Q-3-14 17-33L51-65 69-48 35-5Q15 24-1 22Z" fill="url(#skin-${side})" stroke="#332127" stroke-width="1.5"/><path d="M2 8 53-52" stroke="#ffe9cb" stroke-opacity=".23" stroke-width="5"/>${glove(side,59,-63,16)}</g></g>
  </g></g>
  <path d="M-26-381Q-45-376-60-355L-63-316Q-55-277-43-250L-36-194H38L44-252Q61-281 64-316L59-354Q40-378 25-381Z" fill="url(#torso-${side})" stroke="#302026" stroke-width="1.9"/>
  <path d="M-25-379Q-35-359-57-351L-47-318-12-323-2-345 6-324 48-318 59-352Q34-360 24-380Z" fill="#44262b" opacity=".26"/>
  <path d="M-54-340C-44-351-24-351-7-339L-5-309Q-27-292-49-310ZM8-339Q31-353 54-338L48-309Q28-294 8-310Z" fill="url(#pec-${side})"/>
  <path d="M-47-332Q-28-345-13-333M15-333Q33-345 47-332" stroke="#ffe6c4" stroke-opacity=".24" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M0-341V-208M-46-307Q-19-298-7-309M8-309Q32-295 49-307" stroke="#512e2e" stroke-opacity=".47" stroke-width="2.4" fill="none"/>
  <g fill="#4b2b2d" opacity=".23"><path d="M-27-293Q-15-300-7-290L-7-269Q-19-267-28-274Z"/><path d="M8-291Q22-299 30-289L28-274Q18-267 8-269Z"/><path d="M-25-264Q-15-269-6-260V-240L-23-242Z"/><path d="M7-260Q18-269 27-262L24-242 7-240Z"/><path d="M-20-235-6-232-5-212-17-215Z"/><path d="M7-232 22-235 18-215 7-213Z"/></g>
  <path d="m-44-286 13 9m-9 5 9 5m-7 5 7 5m71-32-13 10m10 5-9 5m7 5-7 5" stroke="#f3be98" stroke-opacity=".28" stroke-width="2.5" fill="none"/>
  <path d="M-42-249Q-26-231-28-205M43-247Q25-230 29-204" fill="none" stroke="#42292b" stroke-opacity=".35" stroke-width="8"/>
  <circle cx="0" cy="-222" r="2" fill="#72483e" opacity=".65"/>
  <path d="M-39-202H40L52-145 14-130 0-160-17-130-53-145Z" fill="url(#shorts-${side})" stroke="#141b27" stroke-width="2"/>
  <path d="M-40-202H41V-186H-41Z" fill="#141b25"/><path d="M-33-185-43-149M33-185 43-149" stroke="${accent}" stroke-width="8"/><path d="M-11-184H12L17-171-15-170Z" fill="#d6d0ba"/><text x="0" y="-174" text-anchor="middle" fill="${dark}" font-size="6" font-weight="900" font-family="Arial">VÕ ĐÀI</text><path d="m-20-176-7 31m47-30 6 30" stroke="#f5efdf" stroke-opacity=".3" stroke-width="1.5"/>
  <path d="M-21-405-22-373Q-10-360 1-362 15-361 24-375L20-405Z" fill="url(#skin-${side})" stroke="#39262a" stroke-width="1.3"/><path d="M-15-399Q0-384 17-398L10-375H-7Z" fill="#593830" opacity=".3"/><path d="M-17-378-8-365M16-377 8-364" stroke="#f8d6b3" stroke-opacity=".25" stroke-width="2"/>
  <g class="boxer-head">
   <path d="M-29-441Q-25-468-4-471 22-473 30-447L28-416 18-398Q4-387-9-395L-23-408Z" fill="url(#face-${side})" stroke="#302027" stroke-width="1.7"/>
   <path d="M-27-432Q-40-439-35-425L-28-416M28-435Q39-441 34-425L27-419" fill="url(#skin-${side})" stroke="#54342f" stroke-width="1.3"/>
   <path d="M-30-437Q-35-457-21-472-5-485 17-476 35-470 32-445L21-455 9-462-6-456-21-457-25-437Z" fill="#171a21"/>
   <path d="M-21-469Q-4-480 15-470M-19-464Q0-475 21-464" fill="none" stroke="#3b3a3a" stroke-width="2"/>
   <path d="M-23-434Q-11-441-3-434M7-434Q16-441 25-434" fill="none" stroke="#2a2327" stroke-width="3" stroke-linecap="round"/>
   <path d="M-21-430Q-12-434-5-429M9-429Q16-433 23-429" fill="none" stroke="#f1dfca" stroke-width="2"/><ellipse cx="-10" cy="-430" rx="2.5" ry="2" fill="#22232a"/><ellipse cx="16" cy="-430" rx="2.5" ry="2" fill="#22232a"/>
   <path d="M2-432-1-416 6-414M-2-413 3-411 9-414" fill="none" stroke="#7c4b3f" stroke-width="1.7" stroke-linecap="round"/>
   <path d="M-18-417-12-410M16-416 21-411M-11-402Q3-405 15-401" fill="none" stroke="#925a4c" stroke-width="1.5"/><path d="M-9-402H13" stroke="#462c2d" stroke-width="1.5"/>
   <path d="M-22-409Q-12-395 2-396 17-395 24-411L19-399Q4-388-10-397Z" fill="#322b2c" opacity=".34"/>
   <path d="M-24-428-20-415M19-423 22-417" stroke="#ffe8ca" stroke-opacity=".33" stroke-width="2" stroke-linecap="round"/>
   <path d="M-20-411-16-408" stroke="${accent}" stroke-opacity=".6" stroke-width="2"/>
  </g>
  <g class="arm arm-front" transform="translate(53 -354)"><g class="limb-motion">
   <path d="M-11-15C10-22 27-6 29 14L37 57Q29 78 12 75-2 66-3 48L-19 10Z" fill="url(#skin-${side})" stroke="#302127" stroke-width="1.7"/>
   <path d="M5-8Q21-2 20 18L27 46" fill="none" stroke="#ffe3bf" stroke-opacity=".38" stroke-width="5" stroke-linecap="round"/><path d="M13 18 8 48" stroke="#56312c" stroke-opacity=".34" stroke-width="6"/>
   <g class="elbow" transform="translate(24 62)"><g class="forearm"><path d="M-13 6Q-5-16 1-35L12-75 34-69 27-25Q24 7 10 22-5 25-13 6Z" fill="url(#skin-${side})" stroke="#322027" stroke-width="1.5"/><path d="M0 5 21-62" stroke="#ffe6bf" stroke-opacity=".35" stroke-width="4"/>${glove(side,24,-80,5)}</g></g>
  </g></g>
 </g></g>
 <g class="guard-shield" opacity="0"><path d="M117-470Q225-327 115-205" fill="none" stroke="${accent}" stroke-width="7"/><path d="M136-479Q253-326 131-190" fill="none" stroke="${accent}" stroke-opacity=".32" stroke-width="3"/></g>
 </g>`;
}
function champion(side){const x=side==='red'?335:665;return `<g class="champion-plaque" data-champion="${side}" transform="translate(${x} 166)" visibility="hidden"><path d="M-118-21-105 20H105L118-21 82-6 61-35 27-13 0-42-27-13-61-35-82-6Z" fill="url(#championGold)" stroke="#fff1b5" stroke-width="1.5"/><path d="M-131 17H131L119 71H-119Z" fill="#1f1720" stroke="#dca95a" stroke-width="2"/><path d="M-121 23H121L112 64H-112Z" fill="url(#championGold)" fill-opacity=".17"/><text class="champion-label" x="0" y="42" text-anchor="middle" fill="#ffeab4" font-size="20" font-weight="900" font-family="Segoe UI,Arial">VUA VÕ ĐÀI</text><text class="champion-streak" x="0" y="60" text-anchor="middle" fill="#deb56e" font-size="10" font-weight="700" letter-spacing="2" font-family="Segoe UI,Arial">NGƯỜI THẮNG GIỮ ĐÀI</text></g>`;}
export function createFighters(mount){
 mount.innerHTML=`<svg viewBox="0 0 1000 800" aria-label="Hai võ sĩ trưởng thành trên võ đài" class="fighter-svg" xmlns="${NS}"><defs>${sides.map(side=>{
 const b=side==='blue';return `<linearGradient id="skin-${side}" x1="0" y1="0" x2="1" y2=".3"><stop stop-color="${b?'#815440':'#925540'}"/><stop offset=".32" stop-color="${b?'#ba8664':'#e1ac7f'}"/><stop offset=".57" stop-color="${b?'#d6a47b':'#f3c99b'}"/><stop offset="1" stop-color="${b?'#745044':'#a66a50'}"/></linearGradient><radialGradient id="torso-${side}" cx=".4" cy=".25" r=".85"><stop stop-color="${b?'#cc9b72':'#edc092'}"/><stop offset=".5" stop-color="${b?'#ac795b':'#d39c73'}"/><stop offset="1" stop-color="${b?'#624035':'#87503f'}"/></radialGradient><linearGradient id="pec-${side}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${b?'#e0b38b':'#ffe0b5'}" stop-opacity=".34"/><stop offset=".6" stop-color="${b?'#a36e53':'#c68d65'}" stop-opacity=".13"/><stop offset="1" stop-color="#53312e" stop-opacity=".46"/></linearGradient><linearGradient id="face-${side}" x1="0" y1="0" x2="1" y2=".3"><stop stop-color="${b?'#996649':'#ba7e58'}"/><stop offset=".5" stop-color="${b?'#d5a17a':'#f4c69b'}"/><stop offset="1" stop-color="${b?'#9b6a51':'#c49170'}"/></linearGradient><linearGradient id="glove-${side}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${b?'#9bf5f1':'#ffae86'}"/><stop offset=".35" stop-color="${b?'#21c2d6':'#ee524a'}"/><stop offset="1" stop-color="${b?'#06495c':'#701d31'}"/></linearGradient><linearGradient id="leather-${side}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${b?'#2c7e92':'#ae3c40'}"/><stop offset="1" stop-color="#111825"/></linearGradient><linearGradient id="shorts-${side}" x1="0" y1="0" x2="1" y2=".3"><stop stop-color="${b?'#084552':'#661c29'}"/><stop offset=".4" stop-color="${b?'#197c8b':'#ac3742'}"/><stop offset=".65" stop-color="${b?'#124d5b':'#782633'}"/><stop offset="1" stop-color="#131c27"/></linearGradient>`;
 }).join('')}<linearGradient id="championGold" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff3c8"/><stop offset=".35" stop-color="#f1ce7b"/><stop offset=".7" stop-color="#bc8235"/><stop offset="1" stop-color="#f6d98d"/></linearGradient><filter id="athleteShadow" x="-45%" y="-30%" width="190%" height="170%"><feDropShadow dx="0" dy="10" stdDeviation="7" flood-color="#02040a" flood-opacity=".65"/></filter></defs><g class="fighter-layer" filter="url(#athleteShadow)">${athlete('red')}${athlete('blue')}</g><g class="champion-layer">${champion('red')}${champion('blue')}</g></svg>`;
 const nodes=Object.fromEntries(sides.map(s=>[s,mount.querySelector(`[data-side="${s}"]`)]));
 const timers=new Set(),animations=new Set(),active=new Map();let phase='waiting',matchId='';
 function schedule(task){task.due=performance.now()+task.remaining;task.id=setTimeout(()=>{timers.delete(task);task.fn();},task.remaining);}
 function later(fn,ms){const task={fn,remaining:Math.max(0,ms),id:null,due:0};timers.add(task);if(!['paused','rest'].includes(phase))schedule(task);return task;}
 function anim(node,frames,opts={}){if(!node||reduced())return;const a=node.animate(frames,{duration:400,easing:'cubic-bezier(.22,.75,.25,1)',...opts});animations.add(a);a.onfinish=()=>{if(opts.fill!=='forwards')animations.delete(a);};a.oncancel=()=>animations.delete(a);return a;}
 const part=(side,selector)=>nodes[side]?.querySelector(selector);
 function recoil(target,heavy=false){const n=nodes[target];if(!n)return;anim(part(target,'.boxer-body'),[{transform:'translate(0,0) rotate(0deg)'},{transform:`translate(-${heavy?27:12}px,3px) rotate(-${heavy?9:4}deg)`,offset:.23},{transform:'translate(5px,0) rotate(1deg)',offset:.7},{transform:'translate(0,0) rotate(0deg)'}],{duration:heavy?570:300});n.classList.add('taking-hit');later(()=>n.classList.remove('taking-hit'),120);}
 function strike(side,move='jab',duration=420){
  const n=nodes[side];if(!n)return;n.parentNode.appendChild(n);
  const front=part(side,'.arm-front .limb-motion'),back=part(side,'.arm-back .limb-motion'),body=part(side,'.boxer-body'),head=part(side,'.boxer-head'),forearm=part(side,'.arm-front .forearm');
  if(move==='kick'){
   anim(part(side,'.leg-front .limb-motion'),[{transform:'rotate(0deg)'},{transform:'translate(-10px,-10px) rotate(26deg)',offset:.24},{transform:'translate(8px,-22px) rotate(-75deg)',offset:.58},{transform:'rotate(0deg)'}],{duration:650});
   anim(body,[{transform:'translate(0,0) rotate(0deg)'},{transform:'translate(-10px,-2px) rotate(-8deg)'},{transform:'translate(0,0) rotate(0deg)'}],{duration:650});return;
  }
  const arm=move==='hook'?back:front;
  const frames=move==='uppercut'?[{transform:'rotate(0deg)'},{transform:'translate(-12px,16px) rotate(35deg)',offset:.26},{transform:'translate(85px,-35px) rotate(-95deg)',offset:.64},{transform:'rotate(0deg)'}]:move==='hook'?[{transform:'rotate(0deg)'},{transform:'translate(-20px,0) rotate(34deg)',offset:.25},{transform:'translate(78px,-24px) rotate(-76deg)',offset:.6},{transform:'rotate(0deg)'}]:[{transform:'rotate(0deg)'},{transform:'translate(-5px,0) rotate(8deg)',offset:.18},{transform:'translate(63px,-9px) rotate(-57deg)',offset:.49},{transform:'translate(69px,-7px) rotate(-59deg)',offset:.6},{transform:'rotate(0deg)'}];
  anim(arm,frames,{duration});if(move!=='hook')anim(forearm,[{transform:'rotate(0deg)'},{transform:move==='uppercut'?'rotate(-22deg)':'rotate(63deg)',offset:.52},{transform:'rotate(0deg)'}],{duration});
  anim(body,[{transform:'translate(0,0) rotate(0deg)'},{transform:'translate(-6px,2px) rotate(-3deg)',offset:.2},{transform:'translate(16px,-2px) rotate(5deg)',offset:.55},{transform:'translate(0,0) rotate(0deg)'}],{duration});
  anim(head,[{transform:'rotate(0deg)'},{transform:'translate(-1px,2px) rotate(-3deg)'},{transform:'rotate(0deg)'}],{duration});
 }
 function attack(e){
  const side=e.side==='blue'?'blue':'red',duration=Math.max(600,Math.min(5000,Number(e.durationMs)|| (e.move==='ultimate'?2400:1400)));
  const n=nodes[side];if(!n)return;
  active.set(e.sequenceId||side,side);n.classList.add('charging');
  const body=part(side,'.boxer-body'),front=part(side,'.arm-front .limb-motion'),back=part(side,'.arm-back .limb-motion');
  const ultimate=e.move==='ultimate',windup=ultimate?Math.round(duration*.3):Math.round(duration*.17);
  anim(body,[{transform:'translate(0,0) rotate(0deg)'},{transform:'translate(-19px,14px) rotate(-8deg)',offset:.7},{transform:'translate(0,0) rotate(0deg)'}],{duration:windup});
  anim(front,[{transform:'rotate(0deg)'},{transform:'translate(-17px,-6px) rotate(-16deg)'},{transform:'rotate(0deg)'}],{duration:windup});
  anim(back,[{transform:'rotate(0deg)'},{transform:'translate(8px,-12px) rotate(-24deg)'},{transform:'rotate(0deg)'}],{duration:windup});
  const count=ultimate?7:5,windowMs=duration-windup-300,spacing=windowMs/count;
  for(let i=0;i<count;i++)later(()=>{if(phase!=='fighting')return;strike(side,i===count-1?'uppercut':i%3===1?'hook':'jab',Math.min(350,spacing+110));if(i<count-1)recoil(side==='red'?'blue':'red',false);},windup+i*spacing);
  later(()=>{n.classList.remove('charging');active.delete(e.sequenceId||side);},duration+100);
 }
 function hit(e){const side=e.side==='blue'?'blue':'red',target=e.target==='red'?'red':'blue';if(!e.choreographed)strike(side,e.move||'jab');if(e.dodged)defend({side:target,move:'dodge'});else recoil(target,e.move==='ultimate'||e.critical);}
 function defend(e){const n=nodes[e.side];if(!n)return;if(e.move==='dodge')anim(part(e.side,'.boxer-body'),[{transform:'translate(0,0) rotate(0deg)'},{transform:'translate(-26px,22px) rotate(-11deg)',offset:.45},{transform:'translate(0,0) rotate(0deg)'}],{duration:650});else{anim(part(e.side,'.arm-front .limb-motion'),[{transform:'rotate(0deg)'},{transform:'translate(-8px,-21px) rotate(-17deg)'},{transform:'rotate(0deg)'}],{duration:550});anim(part(e.side,'.guard-shield'),[{opacity:0},{opacity:.8,offset:.15},{opacity:.5,offset:.65},{opacity:0}],{duration:900});}}
 function ko(e){const loser=e.loser||(e.winner==='red'?'blue':'red');if(e.reason==='ko'&&nodes[loser]){nodes[loser].classList.add('knocked-out');anim(part(loser,'.boxer-body'),[{transform:'translate(0,0) rotate(0deg)'},{transform:'translate(-10px,3px) rotate(-12deg)',offset:.2},{transform:'translate(-30px,8px) rotate(-83deg)',offset:1}],{duration:1200,fill:'forwards',easing:'cubic-bezier(.45,0,.9,.45)'});}if(nodes[e.winner]){nodes[e.winner].classList.add('victorious');anim(part(e.winner,'.arm-front .limb-motion'),[{transform:'rotate(0deg)'},{transform:'translate(-7px,-44px) rotate(-126deg)'}],{duration:800,fill:'forwards'});showChampion(e.winner,1,true);}}
 function showChampion(side,streak,won=false){const badge=mount.querySelector(`[data-champion="${side}"]`);if(!badge)return;badge.setAttribute('visibility',streak>0||won?'visible':'hidden');badge.querySelector('.champion-label').textContent=streak>=10?'HUYỀN THOẠI BẤT BẠI':streak>=5?'ĐỘC CÔ CẦU BẠI':streak>=3?'BÁ CHỦ VÕ ĐÀI':'VUA VÕ ĐÀI';badge.querySelector('.champion-streak').textContent=streak>0?`${streak} TRẬN THẮNG LIÊN TIẾP`:'NGƯỜI THẮNG GIỮ ĐÀI';badge.classList.toggle('crowned-now',won);}
 function reset(){for(const t of timers)clearTimeout(t.id);timers.clear();for(const a of [...animations])a.cancel();animations.clear();active.clear();for(const n of Object.values(nodes)){n.classList.remove('knocked-out','victorious','taking-hit','charging');}for(const b of mount.querySelectorAll('.champion-plaque'))b.setAttribute('visibility','hidden');}
 function update(state){const m=state.match||{},p=m.phase||'waiting',wasPaused=['paused','rest'].includes(phase);if(m.id!==matchId){reset();matchId=m.id;}if((p==='waiting'||p==='countdown')&&p!==phase)reset();phase=p;
  for(const side of sides){const f=m.fighters?.[side],n=nodes[side];n.classList.toggle('fighter-absent',!f);n.classList.toggle('fighter-active',!!f&&p==='fighting');n.classList.toggle('power-boosted',!!f&&(f.boostUntil>state.now||f.powerUntil>state.now||f.powerMultiplier>1));showChampion(side,f?.streak||0,p==='finished'&&m.result?.winner===side);}
  const paused=['paused','rest'].includes(p);if(paused&&!wasPaused){for(const task of timers){task.remaining=Math.max(0,task.due-performance.now());clearTimeout(task.id);task.id=null;}}else if(!paused&&wasPaused){for(const task of timers)if(task.id===null)schedule(task);}mount.classList.toggle('match-paused',paused);for(const a of animations){if(paused)a.pause();else if(a.playState==='paused')a.play();}
 }
 return{attack,hit,defend,ko,reset,update,close:reset};
}
