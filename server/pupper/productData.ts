import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { CHRONICLE } from '../paths.ts'
const dir=process.env.PUPPER_DATA_DIR||path.join(CHRONICLE,'private-product-data')
const calls=new Map<string,{at:number;count:number}>()
export function productData(id:string,token:string,data?:unknown){
 if(!/^product_[\w]+$/.test(id)||!/^Bearer [a-f0-9]{64}$/.test(token))throw new Error('Invalid private workspace credentials')
 const key=createHash('sha256').update(id+'\0'+token).digest('hex'),now=Date.now();for(const [k,v] of calls)if(now-v.at>60000)calls.delete(k);const usage=calls.get(key)??{at:now,count:0};if(++usage.count>120)throw new Error('Workspace rate limit reached');calls.set(key,usage)
 fs.mkdirSync(dir,{recursive:true,mode:0o700});const file=path.join(dir,key+'.json');
 if(data!==undefined){const text=JSON.stringify(data);if(!text||Buffer.byteLength(text)>9000)throw new Error('Workspace exceeds 9 KB demo storage limit');if(!fs.existsSync(file)&&fs.readdirSync(dir).length>=1000)throw new Error('Workspace capacity reached');fs.writeFileSync(file+'.tmp',text,{mode:0o600});fs.renameSync(file+'.tmp',file);return {saved:true}}
 return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null
}
