import test from 'node:test'
import assert from 'node:assert/strict'
import {openRecruiter,backToModes,RECRUITER_ROUTE,MODES_ROUTE} from '../src/recruiterNavigation.ts'

function fixture(run) {
  const saved={history:globalThis.history,window:globalThis.window,PopStateEvent:globalThis.PopStateEvent}
  const calls=[]
  globalThis.history={state:null,replaceState(state,unused,path){this.state=state;calls.push(['replace',path])},pushState(state,unused,path){this.state=state;calls.push(['push',path])},back(){calls.push(['back'])}}
  globalThis.window={dispatchEvent(event){calls.push(['event',event.type])}}
  globalThis.PopStateEvent=class extends Event{}
  try {run(calls)}finally{for(const [key,value]of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value}}
}
test('recruiter navigation preserves a modes history entry and uses one production route',()=>fixture(calls=>{
  let prevented=false
  openRecruiter({button:0,preventDefault(){prevented=true}})
  assert.ok(prevented)
  assert.deepEqual(calls,[['replace',MODES_ROUTE],['push',RECRUITER_ROUTE],['event','popstate']])
  backToModes({button:0,preventDefault(){}})
  assert.deepEqual(calls.at(-1),['back'])
}))
test('direct gameplay Back opens modes and modified clicks retain native navigation',()=>fixture(calls=>{
  backToModes({button:0,preventDefault(){}})
  assert.deepEqual(calls,[['push',MODES_ROUTE],['event','popstate']])
  calls.length=0
  openRecruiter({button:0,ctrlKey:true,preventDefault(){assert.fail('modified click intercepted')}})
  assert.deepEqual(calls,[])
}))
