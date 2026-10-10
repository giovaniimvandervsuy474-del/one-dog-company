import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { ROOT, CHRONICLE } from '../paths.ts'
import { catalog, productFile } from './products.ts'
import { recent } from '../ledger.ts'
const run=promisify(execFile),dir=path.join(CHRONICLE,'github-project'),stateFile=path.join(CHRONICLE,'project-github.json')
const repo=process.env.ONE_DOG_GITHUB_REPO||'giovaniimvandervsuy474-del/one-dog-company'
const key=path.join(ROOT,'.github-ssh','one-dog-company'),hosts=path.join(ROOT,'.github-ssh','known_hosts')
let busy=false,state={status:'waiting_for_access',repo:'https://github.com/'+repo,lastSync:0,error:''}
try{state={...state,...JSON.parse(fs.readFileSync(stateFile,'utf8'))}}catch{}
export function githubStatus(){return {...state,configured:fs.existsSync(key),busy}}
function save(){fs.mkdirSync(CHRONICLE,{recursive:true});fs.writeFileSync(stateFile,JSON.stringify(state))}
const credential=/(?:rqsty-sk-|bb_live_|github_pat_|ghp_|sk-proj-)[A-Za-z0-9+\/=_-]{16,}|-----BEGIN (?:OPENSSH|RSA|EC) PRIVATE KEY-----/g
export function checkedText(text:string){if(credential.test(text)){credential.lastIndex=0;throw new Error('Credential-like content blocked from GitHub export')}credential.lastIndex=0;return text}
function copy(rel:string){const source=path.join(ROOT,rel),dest=path.join(dir,rel);if(!fs.existsSync(source))return;const st=fs.lstatSync(source);if(st.isSymbolicLink())return;if(st.isDirectory()){for(const f of fs.readdirSync(source))if(!f.startsWith('.')&&!['node_modules','dist'].includes(f))copy(path.join(rel,f));return}fs.mkdirSync(path.dirname(dest),{recursive:true});if(/\.(?:glb|png|jpg|jpeg|webp|ico)$/i.test(source))fs.copyFileSync(source,dest);else fs.writeFileSync(dest,checkedText(fs.readFileSync(source,'utf8')))}
async function git(args:string[]){return (await run('git',args,{cwd:dir,timeout:45000,maxBuffer:1024*1024,env:{...process.env,GIT_SSH_COMMAND:`ssh -i ${key} -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=${hosts}`}})).stdout.trim()}
export async function syncProject(){
 if(busy)return {ok:false,error:'Sync already running'};if(!/^[\w-]+\/[\w.-]+$/.test(repo))return {ok:false,error:'Invalid repository'}
 busy=true;try{state.status='syncing';state.error='';save();fs.mkdirSync(dir,{recursive:true});if(!fs.existsSync(path.join(dir,'.git'))){await git(['init','-b','main']);await git(['remote','add','origin',`git@github.com:${repo}.git`])}
 if(!fs.existsSync(key)){state.status='waiting_for_access';save();return {ok:false,error:'Repository deploy key is not configured'}}
 const remote=await git(['ls-remote','--heads','origin','main']);let head='';try{head=await git(['rev-parse','HEAD'])}catch{}
 if(remote&&!head){await git(['fetch','origin','main']);await git(['checkout','-B','main','FETCH_HEAD'])}else if(remote){await git(['fetch','origin','main']);await git(['merge','--ff-only','origin/main'])}
 for(const rel of ['server','web/src','web/index.html','web/vite.config.ts','web/tsconfig.json','web/public/activity-layout.css','web/public/brand','web/public/models/pupper-executive.glb','package.json','package-lock.json','.gitignore','tests','README.md','deploy/PUPPER-RUNBOOK.md'])copy(rel)
 const output=path.join(dir,'agent-work');fs.mkdirSync(path.join(output,'products'),{recursive:true});fs.writeFileSync(path.join(output,'catalog.json'),checkedText(JSON.stringify(catalog(),null,2)));fs.writeFileSync(path.join(output,'journal.json'),checkedText(JSON.stringify(recent(250),null,2)))
 for(const p of catalog().products){const product=path.join(output,'products',p.id);fs.mkdirSync(product,{recursive:true});const html=productFile(p.id,'index.html');if(html)fs.writeFileSync(path.join(product,'index.html'),checkedText(html.toString()));fs.writeFileSync(path.join(product,'business-plan.json'),checkedText(JSON.stringify(p.plan,null,2)));fs.writeFileSync(path.join(product,'checks.json'),JSON.stringify(p.checks,null,2))}
 const research=path.join(ROOT,'workspace','research','runs');if(fs.existsSync(research)){fs.mkdirSync(path.join(output,'research'),{recursive:true});for(const f of fs.readdirSync(research).filter(f=>/^research_\d+\.json$/.test(f)))fs.writeFileSync(path.join(output,'research',f),checkedText(fs.readFileSync(path.join(research,f),'utf8')))}
 await git(['add','--','server','web','package.json','package-lock.json','.gitignore','tests','README.md','deploy','agent-work']);if(await git(['diff','--cached','--name-only']))await git(['-c','user.name=One Dog Company Agent','-c','user.email=one-dog-company@users.noreply.github.com','commit','-m','One Dog Company: code, research, business plans and verified products'])
 await git(['push','-u','origin','main']);state.status='synced';state.lastSync=Date.now();state.error='';save();return {ok:true}
 }catch(e){state.status='error';state.error=e instanceof Error?e.message.replace(/(?:rqsty-sk-|bb_live_|github_pat_|ghp_)[A-Za-z0-9+\/=_-]+/g,'[redacted]').slice(0,600):'GitHub sync failed';save();return {ok:false,error:state.error}}finally{busy=false}
}
export function startGithubSync(){setInterval(()=>{if(process.env.ONE_DOG_GITHUB_SYNC==='1'&&!busy)void syncProject()},300000)}
