"""1.1 functional UI acceptance. Isolated offline server only; intentionally resets its data."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os,json,time
if os.environ.get('ARENA_ALLOW_TEST_RESET')!='1':raise SystemExit('Set ARENA_ALLOW_TEST_RESET=1 and use an isolated ARENA_HOME offline server.')
base=os.environ.get('ARENA_BROWSER_URL','http://127.0.0.1:33410');out=Path(__file__).resolve().parents[1]/'evidence'/'1.1';out.mkdir(parents=True,exist_ok=True)
r={};errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--disable-dev-shm-usage'])
 ctx=browser.new_context(viewport={'width':1680,'height':1080},device_scale_factor=1)
 ctx.route('**/*',lambda route:route.continue_() if route.request.url.startswith((base+'/','data:','blob:')) else route.abort())
 page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
 page.goto(base+'/',wait_until='networkidle');page.locator('#serverStatus.connected').wait_for()
 def rpc(method,params={},allow_error=False):
  d=page.evaluate('''async ([method,params])=>{const res=await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});return res.json()}''',[method,params])
  if 'error'in d and not allow_error:raise AssertionError(d)
  return d if allow_error else d['result']
 def wait(expression,target=page,timeout=8):
  end=time.monotonic()+timeout
  while time.monotonic()<end:
   if target.evaluate('() => ('+expression+')'):return
   target.wait_for_timeout(60)
  raise AssertionError(expression)
 assert rpc('state.get')['audio']['offline'],'Refusing to reset nonoffline server'
 rpc('demo.set',{'on':False});rpc('mode.set',{'mode':'live'});rpc('session.reset');rpc('settings.set',{'settings':{'maxHp':1600,'countdownSeconds':0,'mcEnabled':False,'autoNext':False,'autoSparring':False,'roundSeconds':120,'restSeconds':2,'theme':'electric'}})
 r['six_tabs']=[]
 for slug in ['tong-quan','dieu-khien','qua-luat','am-thanh','ket-noi','nhat-ky']:
  page.locator('[data-page-link="'+slug+'"]').click();page.locator('[data-page="'+slug+'"]').wait_for(state='visible');r['six_tabs'].append(page.locator('[data-page="'+slug+'"]').is_visible())
 page.locator('#modeDemo').click();wait("document.querySelector('#heroMode').textContent.includes('THỬ')")
 r['draw_control_removed']=page.locator('[data-finish="draw"]').count()==0
 page.locator('[data-page-link="dieu-khien"]').click();wait("document.querySelectorAll('[data-corner-demo]').length===8")
 overlay=ctx.new_page();overlay.on('pageerror',lambda e:errors.append(str(e)));overlay.set_viewport_size({'width':1080,'height':1920})
 overlay.goto(base+'/overlay.html?mute=1',wait_until='networkidle');overlay.wait_for_timeout(150)
 r['red_menu']='5' in overlay.locator('#redSupport').inner_text() and '30' in overlay.locator('#redSupport').inner_text()
 r['blue_menu']='6' in overlay.locator('#blueSupport').inner_text() and '50' in overlay.locator('#blueSupport').inner_text()
 initial=rpc('state.get');page.locator('[data-corner-demo="red"][data-coins="5"]').click();overlay.wait_for_timeout(180)
 r['outsider_coin5_starts_red_windup']=len(rpc('state.get')['match']['activeActions'])>0 and overlay.locator('.boxer-red.charging').count()==1
 r['no_hp_loss_before_impact']=rpc('state.get')['match']['fighters']['blue']['hp']==initial['match']['fighters']['blue']['hp']
 overlay.screenshot(path=str(out/'combo-windup.png'));overlay.wait_for_timeout(1600)
 r['combo_impact_reduces_blue']=rpc('state.get')['match']['fighters']['blue']['hp']<initial['match']['fighters']['blue']['hp']
 before=rpc('state.get');page.locator('[data-corner-demo="blue"][data-coins="6"]').click();overlay.wait_for_timeout(1700)
 r['outsider_coin6_reduces_red']=rpc('state.get')['match']['fighters']['red']['hp']<before['match']['fighters']['red']['hp']
 before=rpc('state.get');page.locator('[data-corner-demo="red"][data-coins="99"]').click();page.wait_for_timeout(120)
 r['boost_visible']=rpc('state.get')['match']['fighters']['red']['powerMultiplier']==1.3
 page.locator('[data-corner-demo="blue"][data-coins="20"]').click();page.wait_for_timeout(180)
 r['heal_routes_blue']=rpc('state.get')['match']['fighters']['blue']['hp']>before['match']['fighters']['blue']['hp']
 # Freeze an actual cinematic along with damage timeline.
 page.locator('[data-corner-demo="red"][data-coins="30"]').click();overlay.wait_for_timeout(250)
 page.locator('[data-rpc="match.pause"]').click();wait("document.querySelector('#operatorPhase').textContent==='TẠM DỪNG'")
 paused=rpc('state.get');overlay.wait_for_timeout(2700)
 r['paused_ultimate_does_not_damage']=rpc('state.get')['match']['fighters']['blue']['hp']==paused['match']['fighters']['blue']['hp']
 r['paused_charge_remains_visible']=overlay.locator('.charge-aura').count()>0
 page.locator('[data-rpc="match.resume"]').click();overlay.wait_for_timeout(2600)
 r['ultimate_impacts_after_resume']=rpc('state.get')['match']['fighters']['blue']['hp']<paused['match']['fighters']['blue']['hp']
 overlay.screenshot(path=str(out/'live-arena.png'))
 # Invalid edited rule stays local, and valid change is saved end-to-end.
 page.locator('[data-page-link="qua-luat"]').click();rows=page.locator('#cornerRulesRows [data-coin-rule="coins"]');rows.nth(1).fill('5');page.locator('#saveCornerRules').click();page.wait_for_timeout(150)
 r['duplicate_price_error']='trùng' in page.locator('#cornerRuleStatus').inner_text()
 r['invalid_rule_not_applied']=rpc('state.get')['settings']['cornerGifts'][1]['coins']==6
 page.locator('#revertCornerRules').click();rows.nth(0).fill('7');page.locator('#saveCornerRules').click();wait("document.querySelector('#cornerRuleStatus').textContent.includes('Đã lưu')")
 r['valid_rule_saved']=rpc('state.get')['settings']['cornerGifts'][0]['coins']==7
 rules=rpc('state.get')['settings']['cornerGifts'];rules[0]['coins']=5;rpc('settings.set',{'settings':{'cornerGifts':rules}})
 page.screenshot(path=str(out/'control-rules.png'),full_page=True)
 # Overhead title survives into the next bout on same corner.
 rpc('queue.add',{'uid':'next-opponent','name':'Đối thủ mới'});rpc('match.finish',{'winner':'blue'});overlay.wait_for_timeout(300)
 r['champion_title_above_blue']=overlay.locator('[data-champion="blue"]').get_attribute('visibility')=='visible'
 overlay.screenshot(path=str(out/'champion.png'));rpc('match.next');overlay.wait_for_timeout(300)
 r['blue_champion_stays_blue']=rpc('state.get')['match']['fighters']['blue']['uid']==before['match']['fighters']['blue']['uid']
 r['champion_title_persists']=overlay.locator('[data-champion="blue"]').get_attribute('visibility')=='visible'
 r['draw_api_rejected']='error' in rpc('match.finish',{'winner':None},allow_error=True)
 # Real round clock expires into rest, never score result. Shortest legal round15s.
 rpc('settings.set',{'settings':{'roundSeconds':15}});rpc('match.reset');rpc('match.start')
 wait("document.querySelector('#phaseBadge').textContent==='NGHỈ GIỮA HIỆP'",timeout=18)
 r['clock_enters_rest_not_result']=rpc('state.get')['match']['result'] is None
 overlay.screenshot(path=str(out/'rest.png'));page.wait_for_timeout(2400)
 r['next_round_without_draw']=rpc('state.get')['match']['round']==2 and rpc('state.get')['match']['phase']=='fighting'
 # Confirm genuine KO (not referee award) at low test HP.
 rpc('settings.set',{'settings':{'maxHp':100,'roundSeconds':120}});rpc('match.reset');rpc('match.start');s=rpc('state.get');red=s['match']['fighters']['red']
 for i in range(4):
  if rpc('state.get')['match']['phase']=='finished':break
  rpc('sim.gift',{'uid':'another-outsider','name':'Người xem','coins':30,'eventId':'qa-ko-'+str(i)});overlay.wait_for_timeout(2700)
 s=rpc('state.get');r['real_ko']=s['match']['result']['reason']=='ko' and s['match']['result']['winner']=='red';overlay.screenshot(path=str(out/'real-ko.png'))
 # Browser with English-only voice list must NEVER speak through that voice.
 voice=ctx.new_page();voice.on('pageerror',lambda e:errors.append(str(e)))
 voice.add_init_script("window.__spoken=[];Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[{name:'EnglishOnly',lang:'en-US'}],speak:u=>window.__spoken.push(u.lang),cancel:()=>{},addEventListener:()=>{},removeEventListener:()=>{}}});")
 voice.goto(base+'/overlay.html',wait_until='networkidle');voice.locator('#soundUnlock').click();rpc('mc.say',{'text':'Góc đỏ tung một cú móc uy lực!'});voice.wait_for_timeout(1800)
 r['english_only_never_spoken']=voice.evaluate('window.__spoken.length===0')
 r['missing_vietnamese_warning']='GIỌNG VIỆT' in voice.locator('#mcSpeaking').inner_text()
 page.locator('[data-page-link="am-thanh"]').click();page.screenshot(path=str(out/'control-voice.png'),full_page=True)
 overlay.goto(base+'/overlay.html?mute=1&bg=transparent',wait_until='networkidle');overlay.set_viewport_size({'width':390,'height':844});overlay.wait_for_timeout(100)
 r['mobile_fits']=round(overlay.locator('#stage').bounding_box()['width'])==390 and overlay.locator('body').evaluate("e=>e.classList.contains('clear')")
 overlay.screenshot(path=str(out/'mobile-overlay.png'));page.set_viewport_size({'width':390,'height':844});page.locator('[data-page-link="tong-quan"]').click();r['mobile_control_no_overflow']=page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path=str(out/'mobile-control.png'),full_page=True)
 rpc('mode.set',{'mode':'live'});rpc('settings.set',{'settings':{'maxHp':1600,'roundSeconds':120,'restSeconds':8,'autoSparring':True,'autoNext':True,'mcEnabled':True,'countdownSeconds':4}})
 r['live_stats_separate']=rpc('state.get')['stats']['coins']==0
 r['page_errors']=errors;browser.close()
(out/'browser-checks.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));print(json.dumps(r,ensure_ascii=False,indent=2))
assert all(v if not isinstance(v,list)else all(v)for k,v in r.items()if k!='page_errors')and not errors
