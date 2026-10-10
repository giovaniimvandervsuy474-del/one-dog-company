import fs from 'node:fs'
import path from 'node:path'
import { Connection, PublicKey } from '@solana/web3.js'
import { CHRONICLE } from '../paths.ts'
const PUMP=new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'), AMM=new PublicKey('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA'), WSOL=new PublicKey('So11111111111111111111111111111111111111112'), TOKEN=new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), ATA=new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
const FILE=path.join(CHRONICLE,`pump-fee-receipts${process.env.PUPPER_CREATOR_WALLET ? '-'+process.env.PUPPER_CREATOR_WALLET : ''}.json`)
type Receipt={signature:string;ts:number;sol:number}
let receipts:Receipt[]=[];try{receipts=JSON.parse(fs.readFileSync(FILE,'utf8'))}catch{}
let state={mint:process.env.PUPPER_TOKEN_MINT||'',status:'not_configured',creator:process.env.PUPPER_CREATOR_WALLET||'',walletBalanceSol:null as number|null,totalAvailableSol:null as number|null,unclaimedSol:null as number|null,collectedObservedSol:0,receipts:[] as Receipt[],checkedAt:0,error:'',liveEventAt:0,refreshIntervalMs:5000,scope:'Creator wallet fees across all its tokens; collected receipts observed by this service'}
let busy=false,connection:Connection|undefined,watching=false,lastHistoryAt=0
const seen=new Set<string>()
let debounce:ReturnType<typeof setTimeout>|undefined
function rpc(){if(!connection){const endpoint=process.env.SOLANA_RPC_URL||'https://api.mainnet-beta.solana.com';const ws=new URL(endpoint);ws.protocol='wss:';connection=new Connection(endpoint,{commitment:'confirmed',wsEndpoint:process.env.SOLANA_WS_URL||ws.toString(),fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(12000)})})}return connection}
function watch(keys:PublicKey[]){if(watching)return;watching=true;for(const key of keys)rpc().onAccountChange(key,()=>{state.liveEventAt=Date.now();if(!debounce)debounce=setTimeout(()=>{debounce=undefined;void refreshFees()},350)},'confirmed')}

function ata(owner:PublicKey){return PublicKey.findProgramAddressSync([owner.toBuffer(),TOKEN.toBuffer(),WSOL.toBuffer()],ATA)[0]}
export function pumpFees(){return state}
export function feeTransfers(tx:any,creator:string,vault:string,vaultATA:string,destinationATA:string){if(tx?.meta?.err)return 0;let lamports=0
 const outer=tx?.transaction?.message?.instructions??[]
 for(const group of tx?.meta?.innerInstructions??[]){const program=outer[group.index]?.programId?.toString();if(![PUMP.toBase58(),AMM.toBase58()].includes(program))continue;for(const ix of group.instructions??[]){const info=ix.parsed?.info;if(ix.parsed?.type==='transfer'&&ix.program==='system'&&info?.source===vault&&info.destination===creator)lamports+=Number(info.lamports)||0;if(['transfer','transferChecked'].includes(ix.parsed?.type)&&ix.program==='spl-token'&&info?.source===vaultATA&&info.destination===destinationATA)lamports+=Number(info.amount??info.tokenAmount?.amount)||0}}
 return lamports/1e9}
export async function refreshFees(){if(busy||(!state.mint&&!process.env.PUPPER_CREATOR_WALLET))return;busy=true;try{
 const conn=rpc()
 const mint=new PublicKey(state.mint),curve=PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'),mint.toBuffer()],PUMP)[0],account=await conn.getAccountInfo(curve)
 if(!account&&!process.env.PUPPER_CREATOR_WALLET){state={...state,status:'not_launched',unclaimedSol:null,checkedAt:Date.now(),error:''};return}
 if(account&&(!account.owner.equals(PUMP)||account.data.length<81))throw new Error('Token is not a supported Pump.fun bonding curve')
 const creator=process.env.PUPPER_CREATOR_WALLET?new PublicKey(process.env.PUPPER_CREATOR_WALLET):new PublicKey(account!.data.subarray(49,81));if(creator.equals(PublicKey.default))throw new Error('Creator has not been assigned')
 const vault=PublicKey.findProgramAddressSync([Buffer.from('creator-vault'),creator.toBuffer()],PUMP)[0],ammVault=PublicKey.findProgramAddressSync([Buffer.from('creator_vault'),creator.toBuffer()],AMM)[0],vaultATA=ata(ammVault),destinationATA=ata(creator)
 const [vaultInfo,rent,tokenBalance,walletLamports]=await Promise.all([conn.getAccountInfo(vault),conn.getMinimumBalanceForRentExemption(0),conn.getTokenAccountBalance(vaultATA).catch(()=>null),conn.getBalance(creator)])
 if(vaultInfo&&!vaultInfo.owner.equals(PUMP))throw new Error('Creator fee vault owner mismatch')
 const unclaimedSol=(Math.max(0,(vaultInfo?.lamports??0)-(vaultInfo?rent:0))+Number(tokenBalance?.value.amount??0))/1e9
 state={...state,status:'connected',creator:creator.toBase58(),walletBalanceSol:walletLamports/1e9,totalAvailableSol:walletLamports/1e9+unclaimedSol,unclaimedSol,checkedAt:Date.now(),error:''};watch([creator,vault,vaultATA]);
 if(Date.now()-lastHistoryAt>60000){lastHistoryAt=Date.now();const sigs=await conn.getSignaturesForAddress(creator,{limit:25});for(const sig of sigs.slice(0,10)){if(sig.err||seen.has(sig.signature)||receipts.some(r=>r.signature===sig.signature))continue;const tx=await conn.getParsedTransaction(sig.signature,{maxSupportedTransactionVersion:0});seen.add(sig.signature);const sol=feeTransfers(tx,creator.toBase58(),vault.toBase58(),vaultATA.toBase58(),destinationATA.toBase58());if(sol>0)receipts.push({signature:sig.signature,ts:(sig.blockTime??0)*1000,sol})}
 }
 receipts=receipts.slice(-500);fs.mkdirSync(CHRONICLE,{recursive:true});fs.writeFileSync(FILE,JSON.stringify(receipts));state={...state,status:'connected',creator:creator.toBase58(),walletBalanceSol:walletLamports/1e9,totalAvailableSol:walletLamports/1e9+unclaimedSol,unclaimedSol,collectedObservedSol:receipts.reduce((s,r)=>s+r.sol,0),receipts:receipts.slice(-10).reverse(),checkedAt:Date.now(),error:''}
 }catch{state={...state,status:'unavailable',error:'Solana fee data unavailable; retrying. No estimated fees are shown.'}}finally{busy=false}}
export function startFees(){void refreshFees();setInterval(()=>void refreshFees(),5000)}
