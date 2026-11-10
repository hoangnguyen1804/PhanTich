// Original articulated SVG fighters. All viewer data stays outside the SVG markup.
const NS = 'http://www.w3.org/2000/svg';
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function fighterSvg(side) {
  const blue = side === 'blue', c = blue ? '#44e8e1' : '#ff714e', dark = blue ? '#0b6579' : '#8e2436';
  return `<g class="boxer boxer-${side}" data-side="${side}" transform="translate(${blue ? 655 : 345} 570) scale(${blue ? '-1.15' : '1.15'} 1.15)">
  <ellipse class="fighter-shadow" cx="5" cy="141" rx="102" ry="22" fill="#01040b" opacity=".7"/>
  <g class="boxer-body">
    <g class="leg leg-back" transform="translate(-33 12)">
      <path d="M-5-4 Q-53 14-55 65L-73 124  -36 132 -11 75 30 34Z" fill="url(#skin-${side})" stroke="#1b1723" stroke-width="5"/>
      <path d="M-72 112-36 121-27 143-92 146-96 133Z" fill="${dark}" stroke="#101624" stroke-width="5"/>
      <path d="M-94 138-26 137" stroke="#e3f1ed" stroke-width="7"/><path d="M-66 123-48 128M-71 130-54 135" stroke="white" stroke-width="3"/>
    </g>
    <g class="leg leg-front" transform="translate(32 10)">
      <path d="M-14-5 Q40-2 43 50L49 118 12 130-5 68-32 35Z" fill="url(#skin-${side})" stroke="#1b1723" stroke-width="5"/>
      <path d="M11 112 49 111 64 128 85 134 83 146 15 147 4 133Z" fill="${dark}" stroke="#101624" stroke-width="5"/>
      <path d="M12 140 83 140" stroke="#e3f1ed" stroke-width="7"/><path d="M27 122 48 121M30 130 54 130" stroke="white" stroke-width="3"/>
    </g>
    <g class="arm arm-back" transform="translate(-57 -137)">
      <path d="M0-6 C-34-2-53 16-44 48L-11 83 10 59-16 26 15 14Z" fill="url(#skin-${side})" stroke="#1b1723" stroke-width="5"/>
      <g transform="translate(-4 62) rotate(-30)"><rect x="-22" y="-7" width="39" height="23" rx="8" fill="#efe6da"/><path d="M-29-12 Q-32-45-5-48 24-48 30-26L29-2Q9 17-13 10Z" fill="${dark}" stroke="#1b1723" stroke-width="5"/><path d="M-15-36 7-36" stroke="${c}" stroke-width="5" stroke-linecap="round"/></g>
    </g>
    <path d="M-59-156 Q-28-172 1-168 33-174 60-152L69-90 44-23-42-23-68-88Z" fill="url(#skin-${side})" stroke="#1b1723" stroke-width="5"/>
    <path d="M-57-134 Q-31-155-4-137L-4-94Q-29-84-58-104M5-137Q32-151 58-129L55-99Q25-87 5-96M-3-85V-34M-32-78Q-18-86-8-76M6-76Q22-86 32-75M-27-57Q-13-65-7-57M7-57Q19-65 28-55" fill="none" stroke="#965c4f" stroke-opacity=".55" stroke-width="4" stroke-linecap="round"/>
    <path d="M-47-27 47-27 63 20 16 39 0 13-20 40-65 17Z" fill="${dark}" stroke="#141828" stroke-width="5"/>
    <path d="M-50-28H50V-10H-52Z" fill="${c}"/><path d="M-48-6-44 19M43-5 46 17" stroke="${c}" stroke-width="5"/>
    <path d="M-23-14H23L19 5H-19Z" fill="#f5f0e6"/><path d="M-7-6H7" stroke="${dark}" stroke-width="4"/>
    <path d="M-24-169-22-192 23-193 24-166Q0-151-24-169Z" fill="#c3866b" stroke="#1b1723" stroke-width="4"/>
    <g class="boxer-head">
      <path d="M-40-220Q-44-263-11-272 27-281 44-248L42-216 29-190 8-179-19-185-37-202Z" fill="url(#skin-${side})" stroke="#191522" stroke-width="5"/>
      <path d="M-43-231Q-56-257-26-277 6-294 34-271L45-246 24-249 11-262-6-252-36-249-36-227Z" fill="#151725"/>
      <path d="M8-226 30-223M-29-228-12-230" stroke="#211925" stroke-width="5" stroke-linecap="round"/>
      <path d="M11-219 10-205 21-204M-3-192 19-192" fill="none" stroke="#7c493f" stroke-width="4" stroke-linecap="round"/>
      <path d="M33-224 39-223" stroke="#faf5e8" stroke-width="4"/><path d="M-24-222-17-223" stroke="#faf5e8" stroke-width="3"/>
      <path d="M-34-213-24-207" stroke="${c}" stroke-width="5"/>
    </g>
    <g class="arm arm-front" transform="translate(53 -140)">
      <path d="M-1-12 C21-19 36-4 40 17L61 43 48 68 17 44 5 18-14 16Z" fill="url(#skin-${side})" stroke="#1b1723" stroke-width="5"/>
      <g class="forearm" transform="translate(48 43)">
        <path d="M-9 17 12-22 33-59 7-71-20-30-27 0Z" fill="url(#skin-${side})" stroke="#1b1723" stroke-width="5"/>
        <g class="glove" transform="translate(23 -66) rotate(15)">
          <rect x="-23" y="-1" width="42" height="22" rx="7" fill="#f6ede1" stroke="#242032" stroke-width="3"/>
          <path d="M-27 0Q-37-23-26-42-8-61 17-49 35-40 34-13L23 7Q0 18-27 0Z" fill="url(#glove-${side})" stroke="#191626" stroke-width="5"/>
          <path d="M-21-30Q-9-45 13-35" stroke="#fff" stroke-opacity=".56" stroke-width="5" fill="none" stroke-linecap="round"/>
          <path d="M-12-9H15" stroke="${dark}" stroke-width="5"/>
        </g>
      </g>
    </g>
  </g>
  <g class="guard-shield" opacity="0"><path d="M80-245Q165-160 80-57" fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round"/><path d="M100-258Q194-160 100-47" fill="none" stroke="${c}" stroke-opacity=".4" stroke-width="3"/></g>
  </g>`;
}

export function createFighters(mount) {
  mount.innerHTML = `<svg viewBox="0 0 1000 800" aria-label="Hai võ sĩ trong võ đài" class="fighter-svg" xmlns="${NS}"><defs>
    <linearGradient id="skin-red" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f9cfaa"/><stop offset=".5" stop-color="#daa27e"/><stop offset="1" stop-color="#9e6255"/></linearGradient>
    <linearGradient id="skin-blue" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#cba383"/><stop offset=".5" stop-color="#a57663"/><stop offset="1" stop-color="#664a49"/></linearGradient>
    <linearGradient id="glove-red" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffae77"/><stop offset=".35" stop-color="#ff6847"/><stop offset="1" stop-color="#bc2945"/></linearGradient>
    <linearGradient id="glove-blue" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b5fff0"/><stop offset=".35" stop-color="#45e6dc"/><stop offset="1" stop-color="#0d7793"/></linearGradient>
    <filter id="fighterGlow" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="16" stdDeviation="10" flood-color="#000" flood-opacity=".8"/></filter>
  </defs><g class="fighter-layer" filter="url(#fighterGlow)">${fighterSvg('red')}${fighterSvg('blue')}</g></svg>`;
  for (const el of mount.querySelectorAll('.arm-front,.arm-back,.leg-front,.leg-back')) { const motion=document.createElementNS(NS,'g'); motion.classList.add('limb-motion'); while(el.firstChild)motion.appendChild(el.firstChild); el.appendChild(motion); }
  const nodes = Object.fromEntries(['red', 'blue'].map(s => [s, mount.querySelector(`[data-side="${s}"]`)]));
  const timers = new Set(), animations = new Set();
  let phase='waiting';
  const later=(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);};
  const animate=(node,frames,options)=>{
    if (!node || reduceMotion()) return;
    const a=node.animate(frames,options);animations.add(a);a.onfinish=()=>{if(options?.fill!=='forwards')animations.delete(a);};return a;
  };
  function hit(e) {
    const side=e.side==='blue'?'blue':'red',target=e.target==='red'?'red':'blue',n=nodes[side],t=nodes[target];
    if(!n||!t)return;
    n.parentNode.appendChild(n);
    const move=e.move||'jab';
    const front=n.querySelector('.arm-front .limb-motion'),back=n.querySelector('.arm-back .limb-motion'),body=n.querySelector('.boxer-body');
    front.style.transformOrigin='0px 0px';back.style.transformOrigin='0px 0px';body.style.transformOrigin='0px 30px';
    if (move==='kick') {
      const leg=n.querySelector('.leg-front .limb-motion');leg.style.transformOrigin='0px 0px';
      animate(leg,[{transform:'rotate(0deg)'},{transform:'rotate(-78deg)',offset:.42},{transform:'rotate(-84deg)',offset:.6},{transform:'rotate(0deg)'}],{duration:650,easing:'cubic-bezier(.2,.8,.3,1)'});
      animate(body,[{transform:'rotate(0deg)'},{transform:'translate(-15px,0) rotate(-10deg)'},{transform:'rotate(0deg)'}],{duration:650});
    } else {
      const count=move==='flurry'?Math.min(6,Math.max(3,e.hits||4)):move==='ultimate'?6:1;
      for(let i=0;i<count;i++)later(()=>{
        const arm=i%2?back:front;
        const frames=move==='uppercut'?[{transform:'translate(0,0) rotate(0deg)'},{transform:'translate(46px,34px) rotate(30deg)',offset:.25},{transform:'translate(104px,-65px) rotate(-76deg)',offset:.6},{transform:'translate(0,0) rotate(0deg)'}]:move==='hook'?[{transform:'translate(0,0) rotate(0deg)'},{transform:'translate(-22px,8px) rotate(25deg)',offset:.25},{transform:'translate(105px,-10px) rotate(-58deg)',offset:.6},{transform:'translate(0,0) rotate(0deg)'}]:[{transform:'translate(0,0) rotate(0deg)'},{transform:'translate(95px,-10px) rotate(-35deg)',offset:.4},{transform:'translate(108px,-8px) rotate(-39deg)',offset:.55},{transform:'translate(0,0) rotate(0deg)'}];
        animate(arm,frames,{duration:count>1?260:420,easing:'cubic-bezier(.18,.85,.3,1)'});
      },i*170);
      animate(body,[{transform:'translate(0,0) rotate(0deg)'},{transform:'translate(15px,0) rotate(6deg)'},{transform:'translate(0,0) rotate(0deg)'}],{duration:count>1?count*170+200:420});
    }
    if(!e.dodged){
      later(()=>{
        const tbody=t.querySelector('.boxer-body');tbody.style.transformOrigin='0px 35px';
        animate(tbody,[{transform:'translate(0,0)'},{transform:'translate(-22px,1px) rotate(-9deg)'},{transform:'translate(10px,0) rotate(3deg)'},{transform:'translate(0,0)'}],{duration:e.critical?550:320});
        t.classList.add('taking-hit');later(()=>t.classList.remove('taking-hit'),150);
      },180);
    } else defend({side:target,move:'dodge'});
  }
  function defend(e){
    const n=nodes[e.side];if(!n)return;
    const body=n.querySelector('.boxer-body');body.style.transformOrigin='0px 20px';
    if(e.move==='dodge')animate(body,[{transform:'translate(0,0)'},{transform:'translate(-18px,35px) rotate(-12deg)'},{transform:'translate(0,0)'}],{duration:550});
    else {const shield=n.querySelector('.guard-shield');animate(shield,[{opacity:0},{opacity:.9,offset:.15},{opacity:.7,offset:.7},{opacity:0}],{duration:850});}
  }
  function ko(e){
    if(e.reason && e.reason!=='ko'){if(e.winner)nodes[e.winner]?.classList.add('victorious');return;}
    const loser=e.loser||((e.winner==='red')?'blue':'red'),n=nodes[loser];if(!n)return;
    n.classList.add('knocked-out');
    const body=n.querySelector('.boxer-body');body.style.transformOrigin='0px 120px';
    animate(body,[{transform:'rotate(0deg)'},{transform:'translate(-15px,0) rotate(-18deg)',offset:.25},{transform:'translate(-40px,10px) rotate(-82deg)',offset:1}],{duration:1100,fill:'forwards',easing:'cubic-bezier(.5,0,.9,.5)'});
    if(e.winner) nodes[e.winner]?.classList.add('victorious');
  }
  function reset(){for(const t of timers)clearTimeout(t);timers.clear();for(const a of animations)a.cancel();animations.clear();for(const n of Object.values(nodes)){n.classList.remove('knocked-out','victorious','taking-hit');for(const el of n.querySelectorAll('[style]'))el.removeAttribute('style');}}
  function update(state){
    const p=state.match?.phase||'waiting';
    if((p==='waiting'||p==='countdown')&&p!==phase)reset();phase=p;
    for(const side of ['red','blue']) {const f=state.match?.fighters?.[side];nodes[side].classList.toggle('fighter-absent',!f);nodes[side].classList.toggle('fighter-active',!!f&&p==='fighting');}
    mount.classList.toggle('match-paused',p==='paused');
  }
  return {hit,defend,ko,reset,update,close:reset};
}
