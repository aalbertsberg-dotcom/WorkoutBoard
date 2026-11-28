import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeProgramAuthor,importedProgramFromLibrary} from '../src/importedPrograms.js'
import {allArchivePrograms} from '../src/archivePrograms.js'
const row={id:'test',name:'A new plan',status:'active',weeks_count:1,plan:{schema_version:1,weeks:[{week:1,days:[]}]}}
test('only the explicitly attributed existing program receives a byline',()=>{
 const authored=allArchivePrograms.filter(p=>p.author)
 assert.deepEqual(authored.map(p=>[p.id,p.author]),[['531-original-challenge','Nathan']])
})
test('new upload attribution is preserved while existing imports stay unlabelled',()=>{
 assert.equal(importedProgramFromLibrary(row).author,'')
 assert.equal(importedProgramFromLibrary({...row,plan:{...row.plan,author_name:'Nathan'}}).author,'Nathan')
 assert.equal(normalizeProgramAuthor('  Another   Author '),'Another Author')
 assert.equal(normalizeProgramAuthor('test@example.com'),'')
})
