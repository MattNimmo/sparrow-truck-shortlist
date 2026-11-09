import {createFeedClient,renderFeed,observed,freshness,filterItems,NO_PHOTO,ATTEMPTS} from './live.mjs?v=0.6.2';
// Shown in place of the table rows until the first good feed arrives. Never an empty table.
export function feedStateRow(kind,{attempt=1,attempts=ATTEMPTS,invalid=false}={}){
 const why=invalid?'Our saved inventory feed sent data this page can’t read yet, so it shows nothing rather than something wrong. This page keeps checking every 15 seconds.':`Our saved inventory feed didn’t respond after ${attempts} ${attempts===1?'try':'tries'}. It usually recovers within a minute, and this page keeps checking every 15 seconds.`;
 if(kind==='failed')return `<tr class="feed-state failed"><td colspan="6"><div class="feed-message"><h3>The truck list didn’t load.</h3><p>${why}</p><button type="button" class="retry" data-retry>Try again</button></div></td></tr>`;
 return `<tr class="feed-state loading"><td colspan="6"><div class="feed-message"><p>${attempt>1?`The inventory feed is waking up. Trying again (${attempt} of ${attempts})…`:'Loading priced trucks from saved inventory…'}</p></div></td></tr>`;
}
export function sortedRows(rows,key){if(!['order','price','miles','fit','life','deal','budget','ease'].includes(key))throw new Error('Unknown comparison metric');const value=r=>r.dataset[key]===''?Infinity:Number(r.dataset[key]);return [...rows].sort((a,b)=>value(a)-value(b)||Number(a.dataset.order)-Number(b.dataset.order));}
if(typeof document!=='undefined'){
 if(window.matchMedia('(max-width:760px)').matches)document.querySelector('#filters').open=false;
 const sort=document.querySelector('#sort'),body=document.querySelector('tbody'),state=document.querySelector('#live-state'),summary=document.querySelector('#feed-summary'),search=document.querySelector('#search'),result=document.querySelector('#result-count'),reset=document.querySelector('#reset');
 const toggles=[...document.querySelectorAll('[data-filter]')],expanded=new Set();let current=null,lastFreshness=null,phase='loading',refocus=false;
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
 // Before any data: 'loading' shows each try; 'failed' stays put while background polls keep checking.
 const showState=(kind,info)=>{
  if(current||kind==='failed'&&phase==='failed')return;phase=kind;body.innerHTML=feedStateRow(kind,info);
  result.textContent=kind==='failed'?'Not loaded':info?.attempt>1?`Retrying · ${info.attempt} of ${info.attempts}`:'Connecting…';
  summary.textContent=kind==='failed'?'Waiting for the saved inventory feed.':'Loading ranked saved observations.';
  // A keyboard user who pressed Try again lands back on it, unless they have moved on.
  if(kind==='failed'&&refocus&&(document.activeElement===document.body||!document.activeElement))body.querySelector('[data-retry]')?.focus({preventScroll:true});
  if(kind==='failed')refocus=false;
 };
 sort.addEventListener('change',arrange);search.addEventListener('input',arrange);
 for(const toggle of toggles)toggle.addEventListener('click',()=>{toggle.setAttribute('aria-pressed',String(toggle.getAttribute('aria-pressed')!=='true'));arrange();});
 reset.addEventListener('click',()=>{search.value='';for(const t of toggles)t.setAttribute('aria-pressed','false');arrange();});
 body.addEventListener('click',event=>{if(event.target.closest('[data-retry]')){retry();return;}const button=event.target.closest('[data-expand]');if(!button)return;const row=button.closest('.truck-row'),url=row.dataset.listing;if(expanded.has(url))expanded.delete(url);else expanded.add(url);arrange();});
 // A photo the source no longer serves falls back to the same placeholder as a listing without one.
 body.addEventListener('error',event=>{const thumb=event.target instanceof HTMLImageElement&&event.target.closest('.thumb');if(thumb)thumb.outerHTML=NO_PHOTO;},true);
 document.querySelector('#print').addEventListener('click',()=>window.print());
 const client=createFeedClient({onData:data=>{current=data;phase='ready';render();},onAttempt:info=>{if(phase==='loading')showState('loading',info);},onStatus:status=>{
  if(current&&freshnessKey()!==lastFreshness)render();if(!status.connected)showState('failed',status);state.dataset.connected=String(status.connected);
  state.textContent=status.connected?`Connected · checked ${observed(status.lastSuccess)}`:`Disconnected · ${status.lastSuccess?'last successful feed '+observed(status.lastSuccess):'waiting for saved inventory'}`;
  document.querySelector('#connection-note').textContent=status.connected?'Updates every 15 seconds. New source searches follow the existing scan schedule.':current?'Retrying automatically. Any visible trucks are the last successful saved data, not a live source check.':'Retrying automatically every 15 seconds.';
 }});
 // Try again (and Refresh now before any data) shows the loading state, then a fresh round of tries.
 function retry(){refocus=document.activeElement?.matches('[data-retry]')??false;showState('loading');client.refresh();}
 document.querySelector('#refresh').addEventListener('click',retry);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)client.stop();else client.start();});client.start();
}
