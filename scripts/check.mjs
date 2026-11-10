import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(/\.(mjs|js)$/.test(f))files.push(f);}}
for(const d of ['src','public/js','scripts','tests'])walk(path.join(root,d));files.push(path.join(root,'server.mjs'));
let failed=0;for(const f of files){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0){failed++;console.error(path.relative(root,f),r.stderr);}}
console.log(`Kiểm tra cú pháp ${files.length} tệp: ${failed} lỗi.`);process.exitCode=failed?1:0;
