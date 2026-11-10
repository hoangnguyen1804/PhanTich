export function connect({role='overlay',onState=()=>{},onEvent=()=>{},onStatus=()=>{}}={}){
 let ws,closed=false,retry=null,seq=0,lastState=null;
 const request=async(method,params={})=>{
  const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),35000);
  try{const res=await fetch('/rpc',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++seq,method,params}),signal:ac.signal});const data=await res.json();if(!res.ok||data.error)throw new Error(data.error?.message||data.error||`HTTP ${res.status}`);return data.result;}
  catch(e){if(e.name==='AbortError')throw new Error('Quá thời gian chờ. Kiểm tra kết nối và thử lại.');throw e;}
  finally{clearTimeout(timer);}
 };
 function open(){
  if(closed)return;ws=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws?role=${encodeURIComponent(role)}`);
  ws.onopen=()=>onStatus(true);
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}if(m.type==='state'){lastState=m.state;onState(m.state);}else onEvent(m);};
  ws.onclose=()=>{onStatus(false);if(!closed)retry=setTimeout(open,1500);};ws.onerror=()=>{};
 }
 open();
 return {call:request,get state(){return lastState;},close(){closed=true;clearTimeout(retry);ws?.close();}};
}
