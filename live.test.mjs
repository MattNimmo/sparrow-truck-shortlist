import test from 'node:test';import assert from 'node:assert/strict';import {validateFeed,renderFeed,createFeedClient,listingURL,freshness,publicState,POLL_MS,filterItems} from './live.mjs?v=0.6.2';
const t='2026-10-16T14:00:00Z';
function data(revision='one',patch={}){return {contract:'truck-public-feed-v1',served_at:t,revision,published_count:1,items:[{id:'published-1',overall_rank:1,rationale:'Originally selected',title:'Truck <script>',seller:'Dealer & Co',listing_url:'https://www.truckpaper.com/listing/for-sale/123/truck',observed_at:t,listing_status:'LISTED_UNCONFIRMED',price:43900,currency:'USD',mileage:154000,mileage_unit:'mi',body_feet:26,moving_body:true,cummins:true,allison:true,liftgate:true,gvwr:null,internal_height:'1,210 in',...patch}]};}
test('live rows escape listing claims, flag invalid dimensions and keep curated rank',()=>{const html=renderFeed(data(),{now:Date.parse(t)});assert.match(html,/Overall <strong>#1/);assert.match(html,/Truck &lt;script&gt;/);assert.ok(!html.includes('Truck <script>'));assert.match(html,/Dealer &amp; Co/);assert.match(html,/Conflicting height claim/);assert.match(html,/FRESH/);assert.match(html,/Observed/);});
test('sold, stale and conflicting evidence is explicit, never an active current rank',()=>{let html=renderFeed(data('two',{listing_status:'SOLD',body_length_conflict:true}),{now:Date.parse(t)});assert.match(html,/Previous overall/);assert.match(html,/>SOLD</);assert.match(html,/Conflicting body length/);html=renderFeed(data(),{now:Date.parse(t)+86400001});assert.match(html,/STALE/);assert.match(html,/Previous overall/);assert.equal(freshness(data().items[0],Date.parse(t)-300001),'INVALID_FUTURE');});
test('unknown currency/distance never gets a false USD/mileage rank; malicious URLs are rejected',()=>{const html=renderFeed(data('two',{currency:null,mileage_unit:null,price:0,liftgate_capacity:'0'}),{now:Date.parse(t)});assert.match(html,/currency unknown/);assert.match(html,/unit unknown/);assert.ok(!html.includes(' · P1'));assert.ok(!html.includes('listed capacity'));for(const value of ['javascript:alert(1)','https://www.truckpaper.com.evil/test','https://user:pass@www.truckpaper.com/test'])assert.equal(listingURL(value),null);});
test('feed validates identity, timestamps, row limits and metrics before rendering',()=>{for(const d of [{}, {...data(),items:new Array(51).fill(data().items[0])},data('x',{price:-1}),data('x',{observed_at:'invalid'}),data('x',{overall_rank:51}),data('x',{listing_status:'BOUGHT'}),{...data(),items:[data().items[0],data().items[0]]}])assert.throws(()=>validateFeed(d));assert.equal(validateFeed(data()).published_count,1);});
test('successful polls apply changed revisions once and fetch with no cache or credentials',async()=>{const updates=[],states=[],calls=[],replies=[data(),data(),data('two',{price:42000})];const c=createFeedClient({fetchFn:async(...args)=>{calls.push(args);return {ok:true,json:async()=>replies.shift()};},onData:d=>updates.push(d),onStatus:s=>states.push(s),now:()=>new Date(t)});await c.refresh();await c.refresh();await c.refresh();assert.equal(updates.length,2);assert.equal(updates[1].items[0].price,42000);assert.equal(states.length,3);assert.equal(calls[0][1].cache,'no-store');assert.equal(calls[0][1].credentials,'omit');});
test('failed or invalid polls retain last good data and explicitly disconnect; recovery updates',async()=>{let n=0;const updates=[],states=[];const c=createFeedClient({fetchFn:async()=>{n++;if(n===2)return {ok:false};return {ok:true,json:async()=>n===3?{}:data(String(n))};},onData:d=>updates.push(d),onStatus:s=>states.push(s),now:()=>new Date(t)});for(let i=0;i<4;i++)await c.refresh();assert.equal(updates.length,2);assert.equal(states[1].connected,false);assert.equal(states[2].connected,false);assert.equal(states[3].connected,true);assert.ok(states[1].lastSuccess);});
test('polling starts at15seconds without overlapping requests and can pause',async()=>{let release,scheduled,delay,cleared;const c=createFeedClient({fetchFn:()=>new Promise(r=>release=r),onData:()=>{},onStatus:()=>{},setTimer:(f,ms)=>{scheduled=f;delay=ms;return 42;},clearTimer:id=>cleared=id});c.start();c.start();await c.refresh();release({ok:true,json:async()=>data()});await new Promise(r=>setImmediate(r));assert.equal(delay,POLL_MS);assert.equal(typeof scheduled,'function');c.stop();assert.equal(cleared,42);});

test('changed public specifications and above-target values prompt review without a false active rank',()=>{for(const change of [{gvwr:33000},{body_feet:24},{advertised_weight_class:'Class 8: 33,001 pounds or greater'},{moving_body:false},{body_length_conflict:true}]){const d=data('changed',change);assert.equal(publicState(d.items[0]),'PUBLIC SPECS NEED REVIEW');assert.match(renderFeed(d,{now:Date.parse(t)}),/Previous overall/);}assert.equal(publicState(data('x',{price:56000}).items[0]),'ABOVE TARGET — REVIEW');assert.equal(publicState(data('x',{mileage:171000}).items[0]),'ABOVE TARGET — REVIEW');assert.equal(publicState(data('x',{gvwr:null}).items[0]),'INVESTIGATE — NOT QUALIFIED');});

test('weighted rows show all metrics and assumed points, preserving rank when metric-sorted',()=>{const d=data();d.ranking_mode='weighted-top-50';d.rubric_version='rubric-v3.3';Object.assign(d.items[0],{score:75,tier:'GOOD BUY',categories:{'Mover fit':25,'Remaining life':20,Deal:10,Budget:12,Ease:8},points:{ramp:0.4},assumed:5,verify:['ramp'],unverified:true});const html=renderFeed(d,{now:Date.parse(t)});assert.match(html,/75<span>\/100/);assert.match(html,/25 \/ 30/);assert.match(html,/20 \/ 25/);assert.match(html,/5 assumed points/);assert.match(html,/UNVERIFIED IDENTITY/);assert.match(html,/ramp · assumed/);d.items[0].categories.Deal=21;assert.throws(()=>validateFeed(d));});

test('v3.4 refuses an unpriced published row',()=>{const d=data();d.ranking_mode='weighted-top-50';d.rubric_version='rubric-v3.4';d.items[0].price=null;assert.throws(()=>validateFeed(d),/Asking price required/);});

test('price-first rows keep identity then asking price, all metric labels and accessible details',()=>{
 const d=data();d.ranking_mode='weighted-top-50';d.rubric_version='rubric-v3.4';Object.assign(d.items[0],{score:74,tier:'GOOD BUY',categories:{'Mover fit':20,'Remaining life':19,Deal:17,Budget:11,Ease:7},points:{attic:2},assumed:3,verify:['ramp']});
 const html=renderFeed(d,{now:Date.parse(t)});assert.ok(html.indexOf('class="asking"')<html.indexOf('class="mileage"'));assert.ok(html.indexOf('class="asking"')<html.indexOf('class="score"'));assert.match(html,/class="asking-value">\$43,900/);assert.match(html,/aria-expanded="false" aria-controls="detail-published-1"/);assert.match(html,/data-detail-for="published-1" hidden/);assert.match(html,/Remaining life/);assert.match(html,/Deal/);assert.match(html,/Budget/);assert.match(html,/Ease/);assert.match(html,/In target/);
});
test('filters combine without changing ranks and exclude unknown claims',()=>{
 const items=[{title:'International MV 022592',seller:'AIM',state:'OH',overall_rank:8,price:37900,currency:'USD',mileage:129257,mileage_unit:'mi',moving_body:true,points:{attic:2}},{title:'Freightliner',seller:'Penske',overall_rank:1,price:57000,currency:'USD',mileage:90000,mileage_unit:'mi',moving_body:null,points:{attic:0}},{title:'Box',seller:'Dealer',overall_rank:10,price:30000,currency:null,mileage:100000,mileage_unit:'km',moving_body:false}];
 assert.equal(filterItems(items,{query:'aim',attic:true,price:true,miles:true,mover:true}).length,1);assert.equal(filterItems(items,{query:' OH '})[0].overall_rank,8);assert.equal(filterItems(items,{price:true}).length,1);assert.equal(filterItems(items,{miles:true}).length,2);assert.equal(filterItems(items,{mover:true}).length,1);assert.equal(filterItems(items,{query:'nothing'}).length,0);assert.equal(items[0].overall_rank,8);
});
import {thumbnailURL,thumbnailFor,NO_PHOTO} from './live.mjs?v=0.6.2';
test('thumbnails come only from each source photo service; Penske units have a fixed lead photo',()=>{
 const sandhills='https://media.sandhills.com/img.axd?id=10004401576&wid=4326209787&w=320&h=240&checksum=00RRuPTLsWQuKBDm8eeQLayYtjmy6kVzHNEcFMUQ2N0%3d';
 for(const ok of [sandhills,'https://api.penskeusedtrucks.com/b2b/usedtrucks/api/v3/image/204924/1','https://chartertrucks.com/wp-content/uploads/IMG_6883-3.jpeg'])assert.equal(thumbnailURL(ok),ok);
 for(const bad of ['javascript:alert(1)','http://media.sandhills.com/img.axd?id=1&checksum=x','https://media.sandhills.com/img.axd?id=1','https://media.sandhills.com.evil.example/img.axd?id=1&checksum=x','https://evil.example/truck.jpg','https://u:p@api.penskeusedtrucks.com/b2b/usedtrucks/api/v3/image/1/1','https://api.penskeusedtrucks.com/b2b/usedtrucks/api/v3/image/1/1?x=1','https://chartertrucks.com/wp-content/uploads/logo.png',null,42])assert.equal(thumbnailURL(bad),null,String(bad));
 assert.equal(thumbnailFor({thumbnail_url:sandhills,listing_url:'https://www.truckpaper.com/listing/1'}),sandhills);
 assert.equal(thumbnailFor({thumbnail_url:null,listing_url:'https://www.penskeusedtrucks.com/search-inventory.html?/#/vehicle-details?unitNumber=204924'}),'https://api.penskeusedtrucks.com/b2b/usedtrucks/api/v3/image/204924/1');
 assert.equal(thumbnailFor({thumbnail_url:'https://evil.example/x.jpg',listing_url:'https://www.truckpaper.com/listing/1'}),null);
});
test('each row shows a lazy, linked, decorative thumbnail beside its identity, or a clear placeholder',()=>{
 const d=data();d.ranking_mode='weighted-top-50';d.rubric_version='rubric-v3.4';Object.assign(d.items[0],{score:74,tier:'GOOD BUY',categories:{'Mover fit':20,'Remaining life':19,Deal:17,Budget:11,Ease:7},points:{},assumed:3,verify:[],thumbnail_url:'https://media.sandhills.com/img.axd?id=1&w=320&h=240&checksum=a"b'});
 let html=renderFeed(d,{now:Date.parse(t)});
 assert.match(html,/<div class="identity"><a class="thumb" href="https:\/\/www\.truckpaper\.com\/listing\/for-sale\/123\/truck" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true"><img src="https:\/\/media\.sandhills\.com\/img\.axd\?id=1&amp;w=320&amp;h=240&amp;checksum=a%22b" alt="" width="320" height="240" loading="lazy" decoding="async" referrerpolicy="no-referrer"><\/a><div class="identity-text"><span class="position">/);
 assert.ok(html.indexOf('class="thumb"')<html.indexOf('Truck &lt;script&gt;'));
 d.items[0].thumbnail_url='https://evil.example/x.jpg';html=renderFeed(d,{now:Date.parse(t)});
 assert.ok(html.includes(NO_PHOTO));assert.ok(!html.includes('evil.example'));assert.match(NO_PHOTO,/No saved<br>photo/);
});

 test('rust labels distinguish zero deduction, penalties and missing evidence and escape no raw notes',async()=>{
 const {rustLabel}=await import('./live.mjs');
 assert.equal(rustLabel({}),'Rust · not assessed');
 for(const [severity,penalty] of Object.entries({none:0,minor:-2,major:-3,extreme:-4})){
  const i={rust_review:{status:'reviewed',severity,penalty}};
  assert.ok(rustLabel(i).includes(severity==='none'?'No rust deduction':'rust'));
 }
 assert.equal(rustLabel({rust_review:{status:'insufficient'}}),'Rust · photos insufficient');
 assert.equal(rustLabel({rust_review:{status:'stale'}}),'Rust · review expired');
 assert.equal(rustLabel({rust_review:{status:'reviewed',severity:'none',penalty:-4}}),'Rust · not assessed');
 });

test('v3.5 displays the applied overall rust deduction and partial photo evidence',()=>{
 const d=data();d.ranking_mode='weighted-top-50';d.rubric_version='rubric-v3.5';Object.assign(d.items[0],{score:72,tier:'GOOD BUY',categories:{'Mover fit':20,'Remaining life':19,Deal:17,Budget:11,Ease:7},points:{'rust inspection':-2},assumed:3,verify:[],rust_review:{status:'reviewed',severity:'minor',penalty:-2,reviewed_at:t,photo_count:6,coverage:'partial'}});
 const html=renderFeed(d,{now:Date.parse(t)});assert.match(html,/Minor rust · −2/);assert.match(html,/6 photos; partial coverage/);assert.match(html,/rust inspection/);
 d.items[0].price=null;assert.throws(()=>validateFeed(d),/Asking price required/);
});

import {fetchFeed,RETRY_DELAYS,ATTEMPTS,retryableStatus} from './live.mjs?v=0.6.2';
test('a 503, a network error and a timeout are retried 1, 2 and 4 seconds apart before the feed loads',async()=>{
 const replies=[()=>({ok:false,status:503}),()=>{throw new TypeError('Failed to fetch');},()=>{throw new DOMException('The operation timed out.','TimeoutError');},()=>({ok:true,status:200,json:async()=>data()})];
 const waits=[],attempts=[],states=[],signals=[];
 const c=createFeedClient({fetchFn:async(url,init)=>{signals.push(init.signal);return replies.shift()();},sleep:async ms=>{waits.push(ms);},onAttempt:a=>attempts.push(a),onData:()=>{},onStatus:s=>states.push(s),now:()=>new Date(t)});
 await c.refresh();
 assert.deepEqual(waits,[1000,2000,4000]);assert.deepEqual(RETRY_DELAYS,[1000,2000,4000]);assert.equal(ATTEMPTS,4);
 assert.deepEqual(attempts.map(a=>`${a.attempt}/${a.attempts}`),['1/4','2/4','3/4','4/4']);
 assert.equal(states.length,1);assert.equal(states[0].connected,true);
 assert.ok(signals.every(s=>s instanceof AbortSignal));assert.equal(new Set(signals).size,4,'each try gets its own timeout');
});
test('after the fourth failed try the client reports a disconnect and keeps polling',async()=>{
 let calls=0,scheduled=null;const states=[],waits=[];
 const c=createFeedClient({fetchFn:async()=>{calls++;return {ok:false,status:503};},sleep:async ms=>{waits.push(ms);},onData:()=>assert.fail('no data'),onStatus:s=>states.push(s),setTimer:(f,ms)=>{scheduled=ms;return 7;},clearTimer:()=>{}});
 c.start();await new Promise(r=>setImmediate(r));
 assert.equal(calls,4);assert.deepEqual(waits,[1000,2000,4000]);assert.equal(states.length,1);assert.equal(states[0].connected,false);assert.equal(states[0].attempts,4);assert.equal(states[0].invalid,false);assert.equal(scheduled,POLL_MS);c.stop();
});
test('a 403, a 404 or an invalid feed fails at once; only 5xx, 408 and 429 statuses are retried',async()=>{
 for(const [reply,invalid] of [[{ok:false,status:403},false],[{ok:false,status:404},false],[{ok:true,status:200,json:async()=>({})},true]]){
  let calls=0;await assert.rejects(fetchFeed({fetchFn:async()=>{calls++;return reply;},sleep:async()=>assert.fail('no retry')}),e=>e.attempts===1&&e.invalid===invalid);assert.equal(calls,1);
 }
 for(const s of [500,502,503,504,546,408,429])assert.equal(retryableStatus(s),true,String(s));
 for(const s of [400,401,403,404,200,undefined])assert.equal(retryableStatus(s),false,String(s));
});
test('a manual refresh replaces the pending poll instead of starting a second loop',async()=>{
 let id=0;const live=new Set();
 const c=createFeedClient({fetchFn:async()=>({ok:true,status:200,json:async()=>data()}),onData:()=>{},onStatus:()=>{},setTimer:()=>{live.add(++id);return id;},clearTimer:i=>live.delete(i)});
 c.start();await new Promise(r=>setImmediate(r));assert.equal(live.size,1);
 await c.refresh();await c.refresh();assert.equal(live.size,1);c.stop();assert.equal(live.size,0);
});
test("AIM's new aimusedtrucks.com storefront is an accepted listing host, alongside the old one",()=>{
 for(const ok of ['https://www.aimusedtrucks.com/inventory/?/listing/for-sale/260273079/2021-international-mv-cargo-slash-straight-box-trucks?accountcrmid=361416&settingscrmid=11422249','https://www.aimntlsonlineauctions.com/inventory/?/listing/for-sale/1/truck'])assert.equal(listingURL(ok),ok);
 for(const bad of ['https://aimusedtrucks.com.evil.example/x','http://www.aimusedtrucks.com/x','https://evil.aimusedtrucks.com/x'])assert.equal(listingURL(bad),null);
 assert.equal(validateFeed(data('aim',{listing_url:'https://www.aimusedtrucks.com/inventory/?/listing/for-sale/260273079/truck'})).items.length,1);
});
