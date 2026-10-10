import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pupper-budget-'))
process.env.BROWSER_BUDGET_FILE=path.join(dir,'budget.json')
process.env.BROWSERBASE_DAILY_MINUTES='1'
const {browserBudget,reserveBrowser,settleBrowser}=await import('../server/pupper/browserBudget.ts')
test('Browserbase reserves before opening, enforces daily cap and persists usage',()=>{const id=reserveBrowser(50);assert.equal(browserBudget().usedMinutes,50/60);assert.throws(()=>reserveBrowser(11));settleBrowser(id,30);assert.equal(browserBudget().usedMinutes,.5);const id2=reserveBrowser(30);assert.equal(browserBudget().blocked,true);assert.throws(()=>reserveBrowser(1));assert.equal(JSON.parse(fs.readFileSync(process.env.BROWSER_BUDGET_FILE!,'utf8')).length,2);settleBrowser(id2,0);assert.equal(browserBudget().remainingMinutes,.5)})
