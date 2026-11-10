"""Media/KO UI acceptance. Use only with an isolated ARENA_HOME and ARENA_OFFLINE=1 server."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import io,wave,math,struct,json,time,os
if os.environ.get('ARENA_ALLOW_TEST_RESET')!='1':
 raise SystemExit('Chỉ chạy với server kiểm thử riêng: đặt ARENA_ALLOW_TEST_RESET=1, ARENA_HOME riêng và ARENA_OFFLINE=1. Script sẽ reset dữ liệu của server đích.')
base=os.environ.get('ARENA_BROWSER_URL','http://127.0.0.1:3100');out=Path(__file__).resolve().parents[1]/'evidence';results={};errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--disable-dev-shm-usage'])
 ctx=b.new_context(viewport={'width':1500,'height':1000})
 ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith((base+'/','blob:','data:')) else r.abort())
 control=ctx.new_page();control.on('pageerror',lambda e:errors.append(str(e)));control.on('dialog',lambda d:d.accept());control.goto(base+'/',wait_until='networkidle');control.locator('#serverStatus.connected').wait_for()
 def rpc(method,params={}):
  return control.evaluate('''async ([method,params])=>{const r=await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const d=await r.json();if(d.error)throw new Error(d.error.message);return d.result}''',[method,params])
 assert rpc('state.get')['audio']['offline'], 'Chỉ được chạy trên server ngoại tuyến kiểm thử.'
 rpc('demo.set',{'on':False});rpc('mode.set',{'mode':'live'});rpc('settings.set',{'settings':{'countdownSeconds':0,'mcEnabled':False,'musicEnabled':True,'autoNext':False,'theme':'electric'}});rpc('mode.set',{'mode':'demo'})
 for song in rpc('music.list')['files']:
  if song['name'].startswith('kiem-thu'):rpc('music.delete',{'name':song['name']})
 ov=ctx.new_page();ov.on('pageerror',lambda e:errors.append(str(e)));ov.set_viewport_size({'width':1080,'height':1920})
 ov.add_init_script('''window.__arenaContexts=[];window.__arenaSources=0;const AC=window.AudioContext;window.AudioContext=class extends AC{constructor(...a){super(...a);window.__arenaContexts.push(this)}};for(const T of [OscillatorNode,AudioBufferSourceNode]){const orig=T.prototype.start;T.prototype.start=function(...a){window.__arenaSources++;return orig.apply(this,a)}}''')
 ov.goto(base+'/overlay.html',wait_until='networkidle');ov.locator('#soundUnlock').click();ov.wait_for_timeout(200)
 results['sound_unlocked']=ov.evaluate("window.__arenaContexts.length>0&&window.__arenaContexts.every(x=>x.state==='running')")
 control.locator('[data-page-link="am-thanh"]').click()
 buf=io.BytesIO()
 with wave.open(buf,'wb') as w:
  w.setnchannels(1);w.setsampwidth(2);w.setframerate(16000);w.writeframes(b''.join(struct.pack('<h',int(1500*math.sin(2*math.pi*220*t/16000)))for t in range(16000)))
 control.locator('#musicFiles').set_input_files({'name':'kiem-thu.wav','mimeType':'audio/wav','buffer':buf.getvalue()})
 deadline=time.monotonic()+8
 while time.monotonic()<deadline:
  if 'kiem-thu.wav' in control.locator('#musicList').inner_text():break
  control.wait_for_timeout(100)
 results['music_upload_ui']= 'kiem-thu.wav' in control.locator('#musicList').inner_text()
 control.locator('#sayText').fill('Đây là câu bình luận kiểm thử của Võ Đài LIVE.');control.locator('#sayForm button[type=submit]').click();ov.wait_for_timeout(500)
 results['manual_mc_caption_with_auto_disabled']='Đây là câu bình luận kiểm thử' in ov.locator('#mcCaption').inner_text()
 s=rpc('state.get');red=s['match']['fighters']['red']
 before_sources=ov.evaluate('window.__arenaSources')
 rpc('sim.chat',{'uid':red['uid'],'name':red['name'],'text':'đấm móc'});ov.wait_for_timeout(200)
 results['hit_synthesizes_audio_nodes']=ov.evaluate('window.__arenaSources')>before_sources
 ov.screenshot(path=str(out/'overlay-real-combat.png'))
 for i in range(8):
  s=rpc('state.get')
  if s['match']['phase']=='finished':break
  rpc('sim.gift',{'uid':red['uid'],'name':red['name'],'coins':1000,'eventId':'media-ko-'+str(i)})
 ov.wait_for_timeout(180)
 s=rpc('state.get');results['actual_gifts_produce_ko']=s['match']['result']['reason']=='ko';results['ko_stamp_shown']=ov.locator('.ko-stamp').count()>0
 ov.screenshot(path=str(out/'overlay-real-ko.png'))
 rpc('music.delete',{'name':'kiem-thu.wav'});results['music_deleted']=not any(x['name']=='kiem-thu.wav'for x in rpc('music.list')['files'])
 rpc('mode.set',{'mode':'live'});rpc('settings.set',{'settings':{'countdownSeconds':4,'mcEnabled':True,'musicEnabled':False,'autoNext':True,'theme':'electric'}})
 results['page_errors']=errors;b.close()
(out/'browser-media-checks.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));print(json.dumps(results,ensure_ascii=False,indent=2))
assert all(v for k,v in results.items() if k!='page_errors')and not errors
