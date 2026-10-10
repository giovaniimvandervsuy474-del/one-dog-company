import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
test('Catalog preserves independent demos, avoids duplicate runs and selects only after ten candidates',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pupper-products-'));process.env.PUPPER_PRODUCTS_DIR=path.join(temp,'products');process.env.PUPPER_PRODUCTS_FILE=path.join(temp,'catalog.json');const {archiveProduct,catalog,productFile}=await import('../server/pupper/products.ts');try{
 const state={name:'First tool',purpose:'A functional independent product',runId:'run1',version:1,checks:[{name:'Interaction',passed:true,detail:'Passed'}]};const first=archiveProduct(state,'<h1>First</h1>',{score:45,problem:'First problem'});assert.equal(archiveProduct(state,'overwrite',{}).id,first.id);assert.equal(productFile(first.id,'index.html')?.toString(),'<h1>First</h1>');assert.equal(productFile('../../etc/passwd','index.html'),null);assert.equal(catalog().recommended,null);
 for(let i=2;i<=10;i++)archiveProduct({...state,name:'Tool '+i,runId:'run'+i},'<h1>'+i+'</h1>',{score:i*9,problem:'Problem '+i});assert.equal(catalog().products.length,10);assert.equal(catalog().complete,true);assert.equal(catalog().recommended,catalog().products[0].id);assert.equal(catalog().products[0].name,'Tool 10');assert.throws(()=>archiveProduct({...state,name:'Eleventh',runId:'run11'},'new',{}));assert.equal(productFile(first.id,'index.html')?.toString(),'<h1>First</h1>')
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
})
