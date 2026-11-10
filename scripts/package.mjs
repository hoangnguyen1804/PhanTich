// Dependency-free ZIP packager. Only selected source/runtime paths; never data, music or personal config.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {deflateRawSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
const args=process.argv.slice(2),arg=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
const runtime=arg('--runtime'),portable=args.includes('--portable')||!!runtime;
if(portable&&!runtime)throw new Error('Dùng --runtime /đường/dẫn/node.exe để tạo portable Windows.');
const entries=[];
function collect(abs,rel){
 const st=fs.lstatSync(abs);if(st.isSymbolicLink())return;
 if(st.isDirectory())for(const name of fs.readdirSync(abs).sort()){if(['.cache','.git','.bin'].includes(name))continue;collect(path.join(abs,name),rel+'/'+name);}
 else if(st.isFile())entries.push({abs,name:rel.replaceAll('\\','/')});
}
for(const name of ['server.mjs','package.json','package-lock.json','README.md','THIRD_PARTY_NOTICES.md','CHAY.bat','CHAY-DIEN-THOAI.bat','src','public','assets','scripts','tests','docs'])if(fs.existsSync(path.join(root,name)))collect(path.join(root,name),name);
if(portable){collect(path.join(root,'node_modules'),'node_modules');collect(path.resolve(runtime),'node.exe');}
const crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc32=b=>{let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
const dist=path.join(root,'dist');fs.mkdirSync(dist,{recursive:true});
const out=path.join(dist,portable?`VoDaiLive-${version}-Windows-Portable.zip`:`VoDaiLive-${version}-Source.zip`);
const fd=fs.openSync(out,'w'),central=[];let offset=0;const write=b=>{fs.writeSync(fd,b);offset+=b.length;};
try{
 for(const entry of entries){
  const data=fs.readFileSync(entry.abs),packed=deflateRawSync(data,{level:6}),name=Buffer.from('VoDaiLive/'+entry.name),crc=crc32(data),start=offset;
  const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);header.writeUInt16LE(0x5821,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(packed.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(name.length,26);write(header);write(name);write(packed);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(8,10);c.writeUInt16LE(0x5821,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(packed.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(start,42);central.push(c,name);
 }
 const centralStart=offset;for(const b of central)write(b);const centralSize=offset-centralStart;
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(centralSize,12);end.writeUInt32LE(centralStart,16);write(end);
}finally{fs.closeSync(fd);}
const sum=crypto.createHash('sha256').update(fs.readFileSync(out)).digest('hex');
fs.writeFileSync(out+'.sha256',`${sum}  ${path.basename(out)}\n`);
if(runtime){const hash=crypto.createHash('sha256').update(fs.readFileSync(runtime)).digest('hex');console.log(`Runtime SHA256: ${hash}`);}
console.log(`Đã tạo ${out} (${(fs.statSync(out).size/1048576).toFixed(1)} MiB), ${entries.length} tệp. Không kèm dữ liệu cá nhân/nhạc.`);
