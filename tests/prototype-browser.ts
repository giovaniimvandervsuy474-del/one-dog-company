import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
const dir=mkdtempSync(path.join(tmpdir(),'pupper-browser-test-'))
process.env.PUPPER_PRODUCT_DIR=dir
process.env.PUPPER_TEST_BROWSER_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const {validateArtifact,verifyArtifact}=await import('../server/pupper/development.ts')
const artifact=validateArtifact({name:'Uppercase test fixture',purpose:'A fixture used only to verify the isolated browser testing pipeline.',html:'<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box}textarea,pre{width:100%;overflow-wrap:anywhere;white-space:pre-wrap}</style><textarea data-input></textarea><button data-run>Transform</button><pre data-output></pre><script>document.querySelector("[data-run]").onclick=()=>document.querySelector("[data-output]").textContent=document.querySelector("[data-input]").value.toUpperCase()</script>'+' '.repeat(100),tests:[{name:'First input',input:'hello',outputIncludes:'HELLO'},{name:'Different input',input:'world',outputIncludes:'WORLD'}]})
const checks=await verifyArtifact(artifact);assert.ok(checks.every(c=>c.passed));console.log(JSON.stringify(checks))
const broken=await verifyArtifact({...artifact,html:artifact.html.replace('.toUpperCase()','')});assert.ok(broken.some(c=>!c.passed));console.log('Broken product correctly rejected; fixture was not published')
