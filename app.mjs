import {createFeedClient,renderFeed,observed,freshness,filterItems,NO_PHOTO} from './live.mjs?v=0.5.0';
export function sortedRows(rows,key){if(!['order','price','miles','fit','life','deal','budget','ease'].includes(key))throw new Error('Unknown comparison metric');const value=r=>r.dataset[key]===''?Infinity:Number(r.dataset[key]);return [...rows].sort((a,b)=>value(a)-value(b)||Number(a.dataset.order)-Number(b.dataset.order));}
if(typeof document!=='undefined'){
 if(window.matchMedia('(max-width:760px)').matches)document.querySelector('#filters').open=false;
 const sort=document.querySelector('#sort'),body=document.querySelector('tbody'),state=document.querySelector('#live-state'),summary=document.querySelector('#feed-summary'),search=document.querySelector('#search'),result=document.querySelector('#result-count'),reset=document.querySelector('#reset');
 const toggles=[...document.querySelectorAll('[data-filter]')],expanded=new Set();let current=null,lastFreshness=null;
 const options=()=>Object.fromEntries([['query',search.value],...toggles.map(b=>[b.dataset.filter,b.getAttribute('aria-pressed')==='true'])]);
 const arrange=()=>{
  if(!current)return;
  const focused=document.activeElement?.closest('[data-expand]')?.dataset.expand;
  const matching=new Set(filterItems(current.items,options()).map(i=>i.listing_url));
  const groups=[...body.querySelectorAll('.truck-row')].map(row=>({row,detail:document.getElementById(`detail-${row.dataset.id}`)}));
  const details=new Map(groups.map(g=>[g.row,g.detail]));
  for(const row of sortedRows(groups.map(g=>g.row),sort.value)){
   const detail=details.get(row),visible=matching.has(row.dataset.listing),open=expanded.has(row.dataset.listing);row.hidden=!visible;detail.hidden=!visible||!open;row.querySelector('[data-expand]').setAttribute('aria-expanded',String(open));body.append(row,detail);
  }
  if(focused)body.querySelector(`[data-expand="${focused}"]`)?.focus({preventScroll:true});
  const active=search.value.trim()||toggles.some(b=>b.getAttribute('aria-pressed')==='true');reset.hidden=!active;
  result.textContent=`${matching.size} of ${current.published_count} trucks`;
  document.querySelector('#empty').hidden=matching.size!==0;
 };
 const freshnessKey=()=>current?.items.map(i=>i.id+freshness(i)).join('|');
 const render=()=>{
  if(!current)return;
  lastFreshness=freshnessKey();body.innerHTML=renderFeed(current);
  document.querySelector('#rubric-version').textContent=current.rubric_version??'Current rubric';
  summary.textContent=`${current.rankable_count} priced listings ranked · ${current.excluded_count} known failures, ${current.missing_price_count??0} without a valid USD asking price, and ${current.stale_count} stale/undated listings excluded. Coverage reflects saved exact details; marketplace detail coverage remains partial.`;
  arrange();
 };
 sort.addEventListener('change',arrange);search.addEventListener('input',arrange);
 for(const toggle of toggles)toggle.addEventListener('click',()=>{toggle.setAttribute('aria-pressed',String(toggle.getAttribute('aria-pressed')!=='true'));arrange();});
 reset.addEventListener('click',()=>{search.value='';for(const t of toggles)t.setAttribute('aria-pressed','false');arrange();});
 body.addEventListener('click',event=>{const button=event.target.closest('[data-expand]');if(!button)return;const row=button.closest('.truck-row'),url=row.dataset.listing;if(expanded.has(url))expanded.delete(url);else expanded.add(url);arrange();});
 // A photo the source no longer serves falls back to the same placeholder as a listing without one.
 body.addEventListener('error',event=>{const thumb=event.target instanceof HTMLImageElement&&event.target.closest('.thumb');if(thumb)thumb.outerHTML=NO_PHOTO;},true);
 document.querySelector('#print').addEventListener('click',()=>window.print());
 const client=createFeedClient({onData:data=>{current=data;render();},onStatus:status=>{
  if(current&&freshnessKey()!==lastFreshness)render();state.dataset.connected=String(status.connected);
  state.textContent=status.connected?`Connected · checked ${observed(status.lastSuccess)}`:`Disconnected · ${status.lastSuccess?'last successful feed '+observed(status.lastSuccess):'waiting for saved inventory'}`;
  document.querySelector('#connection-note').textContent=status.connected?'Updates every 15 seconds. New source searches follow the existing scan schedule.':'Retrying automatically. Any visible trucks are the last successful saved data, not a live source check.';
 }});
 document.querySelector('#refresh').addEventListener('click',()=>client.refresh());
 document.addEventListener('visibilitychange',()=>{if(document.hidden)client.stop();else client.start();});client.start();
}
