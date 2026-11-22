import test from 'node:test'
import assert from 'node:assert/strict'
import {hitTestBoardItem,moveBoardItem,boardItemBounds,saveBoardDraft,readBoardDraft,clearBoardDraft,preferredBoardContent} from '../src/whiteboardModel.js'

test('selects topmost pen stroke or shape at a tap',()=>{
 const items=[
  {id:'stroke',type:'stroke',width:4,points:[{x:.1,y:.1},{x:.4,y:.4}]},
  {id:'arrow',type:'shape',shape:'arrow',width:4,start:{x:.5,y:.5},end:{x:.8,y:.8}}
 ]
 assert.equal(hitTestBoardItem(items,{x:.2,y:.2},600,430),'stroke')
 assert.equal(hitTestBoardItem(items,{x:.7,y:.7},600,430),'arrow')
 assert.equal(hitTestBoardItem(items,{x:.9,y:.1},600,430),null)
})
test('text, image and sticky can be grabbed',()=>{
 const items=[
  {id:'sticky',type:'sticky',x:.15,y:.18,w:.3,h:.3},
  {id:'img',type:'image',x:.55,y:.1,w:.3,h:.3},
  {id:'text',type:'text',x:.1,y:.75,text:'Testing'}
 ]
 assert.equal(hitTestBoardItem(items,{x:.2,y:.2}),'sticky')
 assert.equal(hitTestBoardItem(items,{x:.6,y:.2}),'img')
 assert.equal(hitTestBoardItem(items,{x:.12,y:.74}),'text')
})
test('moves objects without altering shape or drawn points and keeps items in canvas',()=>{
 const shape={id:'a',type:'shape',start:{x:.2,y:.2},end:{x:.4,y:.4}}
 const moved=moveBoardItem(shape,.2,.3)
 assert.deepEqual(moved.start,{x:.4,y:.5})
 assert.deepEqual(moved.end,{x:.6000000000000001,y:.7})
 assert.deepEqual(shape.start,{x:.2,y:.2})
 const stroke={type:'stroke',points:[{x:.5,y:.5},{x:.8,y:.8}]}
 const edge=moveBoardItem(stroke,.9,.9)
 const b=boardItemBounds(edge)
 assert.ok(b.x2<=1&&b.y2<=1)
})
test('unsaved drafts survive navigation and stay isolated by user and board',()=>{
 const cache=new Map()
 const storage={setItem(k,v){cache.set(k,v)},getItem(k){return cache.get(k)||null},removeItem(k){cache.delete(k)}}
 const doc={title:'Notes',grid:false,items:[{id:'one',type:'stroke',points:[{x:.1,y:.2}]}]}
 assert.equal(saveBoardDraft(storage,'u1',null,doc,1234),true)
 assert.deepEqual(readBoardDraft(storage,'u1',null).items,doc.items)
 assert.equal(readBoardDraft(storage,'u2',null),null)
 assert.equal(readBoardDraft(storage,'u1','other'),null)
 assert.equal(preferredBoardContent({title:'Old',items:[],updatedAt:1000},readBoardDraft(storage,'u1',null)).source,'draft')
 assert.equal(preferredBoardContent({title:'New',items:[],updatedAt:2000},readBoardDraft(storage,'u1',null)).source,'server')
 clearBoardDraft(storage,'u1',null)
 assert.equal(readBoardDraft(storage,'u1',null),null)
})
