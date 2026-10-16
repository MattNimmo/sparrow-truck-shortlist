import {createFeedClient,renderFeed,observed,freshness} from './live.mjs?v=0.3.1';
export function sortedRows(rows,key){if(!['order','price','miles','fit','life','deal','budget','ease'].includes(key))throw new Error('Unknown comparison metric');const value=r=>r.dataset[key]===''?Infinity:Number(r.dataset[key]);return [...rows].sort((a,b)=>value(a)-value(b));}
if(typeof document!=='undefined'){
 const sort=document.querySelector('#sort'),body=document.querySelector('tbody'),state=document.querySelector('#live-state'),summary=document.querySelector('#feed-summary');let current=null,lastFreshness=null;
 const sortTable=()=>{for(const row of sortedRows([...body.rows],sort.value))body.append(row);};
 const freshnessKey=()=>current?.items.map(i=>i.id+freshness(i)).join('|');
 const render=()=>{if(current){lastFreshness=freshnessKey();body.innerHTML=renderFeed(current);summary.textContent=`${current.published_count} trucks · ${current.rubric_version} · ${current.rankable_count} rankable saved listings screened; ${current.excluded_count} known failures and ${current.stale_count} stale/undated listings excluded. Ranked automatically by score, then deal discount. P/M ranks compare these published trucks only.`;}sortTable();};
 sort.addEventListener('change',sortTable);document.querySelector('#print').addEventListener('click',()=>window.print());
 const client=createFeedClient({onData:data=>{current=data;render();},onStatus:status=>{if(current&&freshnessKey()!==lastFreshness)render();state.dataset.connected=String(status.connected);state.textContent=status.connected?`Connected · Checked ${observed(status.lastSuccess)} · Refreshes every 15 seconds. Source searches remain on the 1 PM Central Sunday–Friday schedule.`:`Disconnected · ${status.lastSuccess?'Showing last successful feed from '+observed(status.lastSuccess):'Waiting for the ranked inventory feed'} · Retrying automatically. These details are not live.`;}});
 document.querySelector('#refresh').addEventListener('click',()=>client.refresh());document.addEventListener('visibilitychange',()=>{if(document.hidden)client.stop();else client.start();});client.start();
}
