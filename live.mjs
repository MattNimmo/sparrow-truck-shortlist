export const FEED_URL='https://mypgatfnwkxtoevabuhb.supabase.co/functions/v1/truck-public-feed';
export const POLL_MS=15000;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
export function listingURL(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return null;return ['www.penskeusedtrucks.com','appleton.wi-autosales.com','www.aimntlsonlineauctions.com','chartertrucks.com','www.truckpaper.com'].includes(u.hostname)?u.href:null;}catch{return null;}}
export function validateFeed(data){
 if(data?.contract!=='truck-public-feed-v1'||!Array.isArray(data.items)||data.items.length>50||typeof data.revision!=='string'||!Number.isFinite(Date.parse(data.served_at)))throw Error('Invalid feed');
 if(data.ranking_mode==='weighted-top-50'&&!['rubric-v3.2','rubric-v3.3'].includes(data.rubric_version))throw Error('Unsupported rubric');
 const ids=new Set();for(const item of data.items){if(!item||typeof item.id!=='string'||ids.has(item.id)||!listingURL(item.listing_url)||!Number.isFinite(Date.parse(item.observed_at))||!['LISTED_UNCONFIRMED','SOLD'].includes(item.listing_status))throw Error('Invalid listing');ids.add(item.id);if(data.ranking_mode==='weighted-top-50'){if(!number(item.score)||item.score>100||!item.categories||!Array.isArray(item.verify)||!number(item.assumed))throw Error('Invalid score');for(const [k,max] of [['Mover fit',30],['Remaining life',25],['Deal',20],['Budget',15],['Ease',10]])if(!number(item.categories[k])||item.categories[k]>max)throw Error('Invalid category');}for(const k of ['price','mileage','body_feet','gvwr'])if(item[k]!=null&&!number(item[k]))throw Error('Invalid metric');if(item.overall_rank!=null&&(!Number.isInteger(item.overall_rank)||item.overall_rank<1||item.overall_rank>50))throw Error('Invalid rank');}return data;
}
const yesNo=value=>value===true?'Yes':value===false?'No':'Unknown';
const count=value=>number(value)?value.toLocaleString('en-US'):'Unknown';
export const observed=value=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value))+' Central';
function height(value){if(!value)return 'Unknown';const inches=Number(String(value).replaceAll(',','').match(/^([\d.]+)\s*in$/i)?.[1]);return Number.isFinite(inches)&&(inches<=0||inches>144)?'Conflicting height claim — verify':String(value);}
export function freshness(item,now=Date.now()){const age=now-Date.parse(item.observed_at);return age< -300000?'INVALID_FUTURE':age>86400000?'STALE':'FRESH';}
export function publicState(i){
 if(i.listing_status==='SOLD')return 'SOLD';
 const weightClass=Number(String(i.advertised_weight_class??'').match(/^Class \d+: *([\d,]+)/i)?.[1]?.replaceAll(',',''));
 if(i.body_length_conflict||i.moving_body===false||(number(i.body_feet)&&i.body_feet!==26)||(number(i.gvwr)&&i.gvwr>26000)||weightClass>26000)return 'PUBLIC SPECS NEED REVIEW';
 if(i.currency==='USD'&&i.price>55000||i.mileage_unit==='mi'&&i.mileage>170000)return 'ABOVE TARGET — REVIEW';
 return 'INVESTIGATE — NOT QUALIFIED';
}
export function renderFeed(data,{now=Date.now()}={}){
 validateFeed(data);const eligible=data.items.filter(i=>i.listing_status!=='SOLD');
 const priceOrder=eligible.filter(i=>number(i.price)&&i.currency==='USD').sort((a,b)=>a.price-b.price||a.id.localeCompare(b.id));
 const milesOrder=eligible.filter(i=>number(i.mileage)&&i.mileage_unit==='mi').sort((a,b)=>a.mileage-b.mileage||a.id.localeCompare(b.id));
 return data.items.map(i=>{
 const currentFreshness=freshness(i,now),status=data.ranking_mode==='weighted-top-50'?(i.unverified?'UNVERIFIED IDENTITY — INVESTIGATE':'INVESTIGATE — NOT QUALIFIED'):publicState(i),active=currentFreshness==='FRESH'&&status==='INVESTIGATE — NOT QUALIFIED';
 const weighted=data.ranking_mode==='weighted-top-50';
 const rank=i.overall_rank==null?'Unranked':`${weighted?'Overall':active?'Overall':'Previous overall'} <strong>#${i.overall_rank}</strong>`;
 const rationale=weighted?`${i.assumed} assumed points. Verify: ${i.verify.join(', ')||'No scored spec assumptions'}.`:i.overall_rank!=null?i.rationale:'New investigation candidate outside the original curated ten. It has no overall rank until the full-inventory ranking is implemented.';
 const price=number(i.price)?`${i.currency==='USD'?'$':i.currency==='CAD'?'CAD $':''}${count(i.price)}${!['USD','CAD'].includes(i.currency)?' (currency unknown)':''}`:'Unknown';
 const p=priceOrder.indexOf(i),m=milesOrder.indexOf(i);
 const mileage=number(i.mileage)?`${count(i.mileage)} ${['mi','km'].includes(i.mileage_unit)?i.mileage_unit:'(unit unknown)'}`:'Unknown';
 const body=i.body_length_conflict?'Conflicting body length — verify':`${number(i.body_feet)?count(i.body_feet)+' ft':'Length unknown'}; moving fit: ${yesNo(i.moving_body)}`;
 const capacity=number(Number(i.liftgate_capacity))&&Number(i.liftgate_capacity)>0?`; listed capacity ${count(Number(i.liftgate_capacity))} lb`:'';
 const weight=number(i.gvwr)?`Advertised ${count(i.gvwr)} lb`:`Exact GVWR unknown${i.advertised_gvw?'; GVW claim '+i.advertised_gvw:''}${i.advertised_weight_class?'; '+i.advertised_weight_class:''}`;
 const scoreCells=weighted?`<td class="score"><strong>${i.score}/100</strong><small>${escape(i.tier)}</small><details><summary>Point breakdown</summary><ul>${Object.entries(i.points??{}).map(([k,v])=>`<li>${escape(k)}: ${escape(v)}${i.verify.includes(k)?' · assumed':''}</li>`).join('')}</ul></details><small>${i.assumed} assumed points</small></td>${['Mover fit','Remaining life','Deal','Budget','Ease'].map((k,j)=>`<td>${i.categories[k]} / ${[30,25,20,15,10][j]}</td>`).join('')}`:'';
 return `<tr data-id="${escape(i.id)}" data-order="${i.overall_rank??''}" data-fit="${-(i.categories?.['Mover fit']??0)}" data-life="${-(i.categories?.['Remaining life']??0)}" data-deal="${-(i.categories?.Deal??0)}" data-budget="${-(i.categories?.Budget??0)}" data-ease="${-(i.categories?.Ease??0)}" data-price="${number(i.price)&&i.currency==='USD'?i.price:''}" data-miles="${number(i.mileage)&&i.mileage_unit==='mi'?i.mileage:''}"><th scope="row"><span class="position">${rank}</span><a href="${escape(listingURL(i.listing_url))}" target="_blank" rel="noopener noreferrer">${escape(i.title??'Truck listing')} ↗</a><small>${escape(i.seller??'Seller unknown')}</small><p class="rank-reason">${escape(rationale)}</p></th><td><strong>${escape(status)}</strong><small>${currentFreshness} · ${escape(i.listing_status)}</small><small>Observed ${escape(observed(i.observed_at))}</small></td>${scoreCells}<td>${escape(price)}${p>=0?' · P'+(p+1):''}</td><td>${escape(mileage)}${m>=0?' · M'+(m+1):''}</td><td>${escape(body)}</td><td>${yesNo(i.cummins)} / ${yesNo(i.allison)}</td><td>${yesNo(i.liftgate)}${escape(capacity)}</td><td>${escape(weight)}</td><td>${escape(i.attic??'Unknown')}</td><td>${escape(i.body_width??'Unknown')} / ${escape(height(i.internal_height))}</td></tr>`;
 }).join('');
}
export function createFeedClient({fetchFn=fetch,onData,onStatus,now=()=>new Date(),setTimer=setTimeout,clearTimer=clearTimeout}){
 let revision=null,busy=false,lastSuccess=null,timer=null,running=false,first=true;
 async function refresh(){if(busy)return;busy=true;try{const response=await fetchFn(FEED_URL,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('Feed unavailable');const data=validateFeed(await response.json());if(first||data.revision!==revision){onData(data);revision=data.revision;first=false;}lastSuccess=now();onStatus({connected:true,lastSuccess,data});}catch{onStatus({connected:false,lastSuccess});}finally{busy=false;if(running)timer=setTimer(refresh,POLL_MS);}}
 return {refresh,start(){if(running)return;running=true;refresh();},stop(){running=false;if(timer!==null)clearTimer(timer);timer=null;}};
}
