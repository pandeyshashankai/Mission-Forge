import { localData } from "../../persistence/localData";
import {useState} from "react";
import {captureStage,appendSubassembly,readSubassemblies} from "../../game/subassemblies";
export function Subassemblies({design,selectedUid,onInsert}){
 const [list,setList]=useState(readSubassemblies),[name,setName]=useState(''),[message,setMessage]=useState('');
 const store=next=>{try{localData.setItem('mf.subassemblies',JSON.stringify(next));setList(next);}catch{throw Error('Browser storage is full. Export or remove saved data first.');}};
 return <details className="engineering-inspector" data-testid="subassemblies"><summary>Reusable stages</summary>
 <p>Select a stack part to save its whole stage and attached boosters. Inserted stages attach below the rocket; review staging and readiness afterwards.</p>
 <label>Stage name<input className="subassembly-name" aria-label="Reusable stage name" data-testid="subassembly-name" maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label>
 <button className="ui-button" data-testid="subassembly-save" disabled={!selectedUid||list.length>=12} onClick={()=>{try{store([...list,captureStage(design,selectedUid,name)]);setMessage('Stage saved on this device.');}catch(e){setMessage(e.message);}}}>Save selected stage</button>
 {list.map(s=><div className="subassembly-row" key={s.id}><strong>{s.name}</strong><button className="ui-button" data-testid={`subassembly-insert-${s.id}`} onClick={()=>{try{onInsert(appendSubassembly(design,s));setMessage('Stage added below rocket. Review staging and readiness.');}catch(e){setMessage(e.message);}}}>Insert</button><button className="ui-button" aria-label={`Delete ${s.name}`} onClick={()=>{try{store(list.filter(x=>x.id!==s.id));}catch(e){setMessage(e.message);}}}>Delete</button></div>)}
 <p role="status">{message}</p></details>;
}
