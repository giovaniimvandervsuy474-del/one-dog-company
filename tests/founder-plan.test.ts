import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizePlan} from '../server/founder.ts'
test('Malformed optional targets do not discard an otherwise useful research plan',()=>{const plan=normalizePlan({task:'A'.repeat(400),hypothesis:'Research demand',queries:['complaints','competitor prices','missing features'],targets:['not a URL','https://example.com/pricing','javascript:alert(1)',''],rationale:'Compare evidence'});assert.equal(plan.task.length,240);assert.deepEqual(plan.targets,['https://example.com/pricing']);assert.equal(plan.queries.length,3)})
test('Missing optional targets become an empty list without inventing sources',()=>{assert.deepEqual(normalizePlan({task:'Research invoices'}).targets,[])})
