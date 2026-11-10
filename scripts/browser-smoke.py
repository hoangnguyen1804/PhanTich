"""Optional development acceptance run: Python Playwright + Chromium. Does not call external services."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,os
if os.environ.get('ARENA_ALLOW_TEST_RESET')!='1':
 raise SystemExit('Chỉ chạy với server kiểm thử riêng: đặt ARENA_ALLOW_TEST_RESET=1, ARENA_HOME riêng và ARENA_OFFLINE=1. Script sẽ reset dữ liệu của server đích.')
base=os.environ.get('ARENA_BROWSER_URL','http://127.0.0.1:3100');out=Path(__file__).resolve().parents[1]/'evidence';out.mkdir(exist_ok=True)
results={};errors=[];blocked=set()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--disable-dev-shm-usage'])
 context=b.new_context(viewport={'width':1680,'height':1080},device_scale_factor=1)
 def route(r):
  if r.request.url.startswith((base+'/','data:','blob:','about:')):r.continue_()
  else:
   from urllib.parse import urlparse
   blocked.add(urlparse(r.request.url).hostname);r.abort()
 context.route('**/*',route)
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
 page.goto(base+'/',wait_until='networkidle');page.locator('#serverStatus.connected').wait_for()
 def wait_js(expression,timeout=30000):
  import time
  deadline=time.monotonic()+timeout/1000
  while time.monotonic()<deadline:
   if page.evaluate('() => ('+expression+')'):return
   page.wait_for_timeout(75)
  raise AssertionError('Timed out: '+expression)
 def rpc(method,params={}):
  return page.evaluate('''async ([method,params])=>{const r=await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const x=await r.json();if(x.error)throw new Error(x.error.message);return x.result}''',[method,params])
 assert rpc('state.get')['audio']['offline'], 'Chỉ được chạy trên server ngoại tuyến kiểm thử.'
 rpc('demo.set',{'on':False});rpc('mode.set',{'mode':'live'});rpc('session.reset');rpc('settings.set',{'settings':{'countdownSeconds':4,'entryCoins':1,'theme':'electric','mcEnabled':False}})
 results['fresh_no_activation']=page.locator('input[id*=lic]').count()==0
 results['tabs']=[]
 for slug in ['tong-quan','dieu-khien','qua-luat','am-thanh','ket-noi','nhat-ky']:
  page.locator('[data-page-link="'+slug+'"]').click();page.wait_for_timeout(100)
  results['tabs'].append({'page':slug,'visible':page.locator('[data-page="'+slug+'"]').is_visible()})
 page.locator('[data-page-link="tong-quan"]').click();page.screenshot(path=str(out/'dashboard-waiting.png'),full_page=True)
 # Actual operator click begins demo and server continues through countdown.
 page.locator('#heroDemo').click();wait_js("document.querySelector('#heroMode').textContent==='DEMO ARENA'")
 wait_js("document.querySelector('#phaseBadge').textContent==='ĐANG THI ĐẤU'",timeout=12000);page.wait_for_timeout(2000)
 results['demo_button_starts_game']=rpc('state.get')['mode']=='demo'
 page.locator('#heroDemo').click();wait_js("document.querySelector('#heroDemo').textContent.includes('Chạy')")
 page.screenshot(path=str(out/'dashboard-demo.png'),full_page=True)
 page.locator('[data-page-link="dieu-khien"]').click()
 page.locator('[data-rpc="match.pause"]').click();wait_js("document.querySelector('#operatorPhase').textContent==='TẠM DỪNG'")
 before=rpc('state.get')['match']['remainingMs'];page.wait_for_timeout(350);results['pause_button_freezes_clock']=rpc('state.get')['match']['remainingMs']==before
 page.locator('[data-rpc="match.resume"]').click();wait_js("document.querySelector('#operatorPhase').textContent==='ĐANG THI ĐẤU'")
 page.wait_for_timeout(1100);page.locator('#simActor').select_option('red');page.locator('#simText').fill('đấm móc');before=rpc('state.get')['match']['fighters']['blue']['hp']
 page.locator('#simChatForm button[type=submit]').click();page.wait_for_timeout(400)
 results['comment_hook_damages_opponent']=rpc('state.get')['match']['fighters']['blue']['hp']<before
 page.wait_for_timeout(1100)
 page.locator('#simCoins').fill('30');before=rpc('state.get')['match']['fighters']['blue']['hp'];page.locator('#simGift').click();page.wait_for_timeout(400)
 results['gift_button_combo_damages']=rpc('state.get')['match']['fighters']['blue']['hp']<before
 # Operator-added challenger shows untrusted text as text, never executes it.
 page.locator('#queueName').fill('<img src=x onerror=alert(9)>');page.locator('#queueUid').fill('browser_test');page.locator('#queueForm button[type=submit]').click();page.wait_for_timeout(300)
 results['untrusted_name_safe']=page.locator('#queueList img[src=x]').count()==0 and '<img' in page.locator('#queueList').inner_text()
 page.locator('#queueList button[aria-label*="browser_test"]').count() # UID is never trusted as markup.
 rpc('queue.remove',{'uid':'browser_test'})
 page.locator('[data-page-link="qua-luat"]').click();wait_js("document.querySelectorAll('#giftMappings .gift-map-row').length>0")
 results['gift_action_rows']=page.locator('#giftMappings .gift-map-row').count()
 page.locator('#giftMappings .gift-map-row button').last.click();page.wait_for_timeout(200)
 results['gift_picker_visible']=page.locator('#giftDialog').is_visible();page.locator('#giftSearch').fill('Rose');page.wait_for_timeout(200)
 results['gift_search_results']=page.locator('#giftPickerGrid button').count()
 page.screenshot(path=str(out/'gift-picker.png'));page.locator('#closeGiftDialog').click()
 # Change an actual setting through UI.
 entry=page.locator('[data-setting="entryCoins"]');entry.fill('3');entry.dispatch_event('change');page.wait_for_timeout(400)
 results['rules_setting_saved']=rpc('state.get')['settings']['entryCoins']==3
 rpc('settings.set',{'settings':{'entryCoins':1,'theme':'electric'}})
 page.screenshot(path=str(out/'dashboard-rules.png'),full_page=True)
 # Portrait rendering receives real game state, animated paid combo, and KO.
 overlay=context.new_page();overlay.on('pageerror',lambda e:errors.append(str(e)));overlay.set_viewport_size({'width':1080,'height':1920})
 overlay.goto(base+'/overlay.html?mute=1',wait_until='networkidle');overlay.wait_for_timeout(400)
 results['overlay_actual_demo_badge']='DEMO' in overlay.locator('#modeBadge').inner_text()
 s=rpc('state.get');red=s['match']['fighters']['red']
 rpc('sim.gift',{'uid':red['uid'],'name':red['name'],'coins':100,'eventId':'browser-animation'})
 overlay.wait_for_timeout(150);results['combo_fx_created']=overlay.locator('#combatFx > *').count()>0
 overlay.screenshot(path=str(out/'overlay-combo.png'))
 overlay.wait_for_timeout(3600);results['combo_particles_expire']=overlay.locator('#combatFx .particle').count()==0
 rpc('match.finish',{'winner':'red'});overlay.wait_for_timeout(200);overlay.screenshot(path=str(out/'overlay-ko.png'))
 results['ko_winner_visible']='WINNER' in overlay.locator('#centerTitle').inner_text()
 rpc('settings.set',{'settings':{'theme':'ice'}});overlay.wait_for_timeout(200)
 results['theme_applied']=overlay.locator('body').get_attribute('data-theme')=='ice' or overlay.locator('#stage').get_attribute('data-theme')=='ice'
 overlay.goto(base+'/overlay.html?mute=1&bg=transparent',wait_until='networkidle');results['transparent_mode']=overlay.locator('body').evaluate("e=>e.classList.contains('clear')")
 overlay.set_viewport_size({'width':390,'height':844});overlay.wait_for_timeout(200);results['mobile_stage_width']=round(overlay.locator('#stage').bounding_box()['width']);overlay.screenshot(path=str(out/'overlay-mobile.png'))
 # Back to live: the real leaderboard must still be empty.
 page.locator('#modeLive').click();wait_js("document.querySelector('#heroMode').textContent==='LIVE ARENA'")
 s=rpc('state.get');results['live_stats_clean_after_demo']=s['stats']['coins']==0 and s['stats']['matches']==0
 page.set_viewport_size({'width':390,'height':844});page.locator('[data-page-link="tong-quan"]').click();page.wait_for_timeout(200);results['mobile_no_horizontal_overflow']=page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(out/'dashboard-mobile.png'),full_page=True)
 results['page_errors']=errors;results['blocked_external_hosts']=sorted(blocked)
 context.close();b.close()
(out/'browser-checks.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));print(json.dumps(results,ensure_ascii=False,indent=2))
