import fs from 'node:fs';
import path from 'node:path';
import { ROOT,DATA,readJSON,writeJSON } from './storage.mjs';
export const GIFT_ACTIONS=[
 {id:'entry',label:'Lên đài thách đấu',emoji:'🥊'},
 {id:'jab',label:'Đấm thẳng',emoji:'👊'},
 {id:'hook',label:'Cú móc sấm sét',emoji:'⚡'},
 {id:'uppercut',label:'Đấm bốc bùng nổ',emoji:'💥'},
 {id:'flurry',label:'Liên hoàn đấm',emoji:'🔥'},
 {id:'ultimate',label:'Tuyệt kỹ bão quyền',emoji:'🌪️'},
 {id:'heal',label:'Tiếp sức hồi máu',emoji:'💚'},
 {id:'shield',label:'Lá chắn thép',emoji:'🛡️'},
];
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().replace(/[^a-z0-9]/g,'');
let current=readJSON(path.join(ROOT,'assets/gifts.json'),{gifts:[]});
const saved=readJSON(path.join(DATA,'gifts.json'),{});
if(saved.at>current.at&&Array.isArray(saved.gifts))current=saved;
const byId=new Map(),byName=new Map();
function apply(d){
 byId.clear();byName.clear();
 for(const g of d.gifts||[]){
  if(!/^\d{1,20}$/.test(String(g.id))||!Number.isFinite(+g.coins)||+g.coins<=0)continue;
  const x={id:String(g.id),name:String(g.name||'Quà').slice(0,80),en:String(g.en||'').slice(0,80),coins:Math.round(+g.coins),img:/^https:\/\//.test(g.img||'')?String(g.img).slice(0,600):''};
  byId.set(x.id,x);
  for(const n of [x.name,x.en])if(n)byName.set(norm(n),x);
 }
}
apply(current);
export const findGift=(id,name)=>byId.get(String(id||''))||byName.get(norm(name))||null;
export const catalog=()=>({at:current.at,total:byId.size,gifts:[...byId.values()].sort((a,b)=>a.coins-b.coins||a.name.localeCompare(b.name,'vi')),actions:GIFT_ACTIONS});
export async function refreshCatalog(){
 if(process.env.ARENA_OFFLINE==='1')throw new Error('Đang ở chế độ kiểm thử ngoại tuyến. Danh sách đóng kèm vẫn sử dụng được.');
 const query=new URLSearchParams({aid:'1988',app_name:'tiktok_web',device_platform:'web_pc',app_language:'vi-VN',language:'vi-VN',region:'VN'});
 const res=await fetch(`https://webcast.tiktok.com/webcast/gift/list/?${query}`,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0','Accept-Language':'vi-VN,vi;q=0.9'}});
 if(!res.ok)throw new Error(`TikTok trả HTTP ${res.status}; giữ nguyên danh sách hiện có.`);
 const data=await res.json();const gifts=(data?.data?.gifts||[]).filter(g=>g.name&&g.diamond_count>0&&!g.lock_info?.lock).map(g=>({id:String(g.id),name:g.name,en:findGift(g.id)?.en||'',coins:g.diamond_count,img:g.image?.url_list?.[0]||''}));
 if(gifts.length<100)throw new Error('Danh sách trả về chưa đầy đủ; giữ nguyên danh sách hiện có.');
 current={at:Date.now(),gifts};writeJSON(path.join(DATA,'gifts.json'),current);apply(current);return catalog();
}
