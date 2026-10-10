import type { Graph } from '../types.ts'
export function researchGraph():Graph {const ts=Date.now();const nodes:Graph['nodes']=[
{id:'pupper:plan',label:'Hypothesis',kind:'brain',since:ts,active:true,meta:{desc:'Focused problem selection using previous evidence'}},
{id:'pupper:browser',label:'Browser',kind:'worker',since:ts,active:true,meta:{desc:'Read-only public-web research through Browserbase'}},
{id:'pupper:evidence',label:'Evidence',kind:'storage',since:ts,active:true,meta:{desc:'Observed sources, prices and quotations'}},
{id:'pupper:analysis',label:'Analysis',kind:'brain',since:ts,active:true,meta:{desc:'Source-grounded comparison; no fabricated demand'}},
{id:'pupper:validation',label:'Experiment',kind:'module',since:ts,active:true,meta:{desc:'Audience, offer and success / stop metrics'}},
{id:'pupper:development',label:'Development',kind:'worker',since:ts,active:true,meta:{desc:'Generate a functional offline prototype'}},
{id:'pupper:tests',label:'Browser tests',kind:'worker',since:ts,active:true,meta:{desc:'Distinct input/output tests, runtime and mobile layout'}},
{id:'pupper:memory',label:'Memory',kind:'storage',since:ts,active:true,meta:{desc:'Persistent lessons and decisions; not model-weight training'}},
{id:'pupper:fees',label:'Pump.fun fees',kind:'economy',since:ts,active:true,meta:{desc:'Read-only on-chain creator fees'}},
{id:'pupper:budget',label:'Spending limits',kind:'scheduler',since:ts,active:true,meta:{desc:'Durable reservations and rolling budgets'}}];const flows=[['plan','browser'],['browser','evidence'],['evidence','analysis'],['analysis','validation'],['validation','development'],['development','tests'],['tests','memory'],['analysis','memory'],['memory','plan'],['budget','browser'],['budget','development'],['fees','budget']];return {ts,nodes,edges:flows.map(([a,b])=>({from:'pupper:'+a,to:'pupper:'+b,kind:'flow'}))}}
