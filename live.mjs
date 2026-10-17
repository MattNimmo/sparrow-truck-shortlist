export const FEED_URL='https://mypgatfnwkxtoevabuhb.supabase.co/functions/v1/truck-public-feed';
export const POLL_MS=15000;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
export function listingURL(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return null;return ['www.penskeusedtrucks.com','appleton.wi-autosales.com','www.aimntlsonlineauctions.com','chartertrucks.com','www.truckpaper.com'].includes(u.hostname)?u.href:null;}catch{return null;}}
// Listing photos come only from each source's own image service, over https.
export function thumbnailURL(value){
 try{
  const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.hash)return null;
  if(u.hostname==='api.penskeusedtrucks.com')return /^\/b2b\/usedtrucks\/api\/v3\/image\/\d{1,12}\/\d{1,3}$/.test(u.pathname)&&!u.search?u.href:null;
  if(u.hostname==='media.sandhills.com')return u.pathname==='/img.axd'&&/^\d{1,15}$/.test(u.searchParams.get('id')??'')&&u.searchParams.get('checksum')?u.href:null;
  if(['chartertrucks.com','appleton.wi-autosales.com'].includes(u.hostname))return /^\/wp-content\/uploads\/[\w./-]+\.(?:jpe?g|png|webp)$/i.test(u.pathname)&&!/logo|icon|placeholder/i.test(u.pathname)?u.href:null;
 }catch{}
 return null;
}
// The feed's thumbnail; a Penske unit's lead photo also has a fixed address when the feed has none.
export function thumbnailFor(item){
 const listed=thumbnailURL(item.thumbnail_url);if(listed)return listed;
 const unit=listingURL(item.listing_url)?.match(/^https:\/\/www\.penskeusedtrucks\.com\/search-inventory\.html\?\/#\/vehicle-details\?unitNumber=(\d{1,12})$/)?.[1];
 return unit?`https://api.penskeusedtrucks.com/b2b/usedtrucks/api/v3/image/${unit}/1`:null;
}
export const NO_PHOTO='<span class="thumb missing" aria-hidden="true"><span>No saved<br>photo</span></span>';
export function validateFeed(data){
 if(data?.contract!=='truck-public-feed-v1'||!Array.isArray(data.items)||data.items.length>50||typeof data.revision!=='string'||!Number.isFinite(Date.parse(data.served_at)))throw Error('Invalid feed');
 if(data.ranking_mode==='weighted-top-50'&&!['rubric-v3.2','rubric-v3.3','rubric-v3.4','rubric-v3.5'].includes(data.rubric_version))throw Error('Unsupported rubric');
 const ids=new Set();for(const item of data.items){if(!item||typeof item.id!=='string'||ids.has(item.id)||!listingURL(item.listing_url)||!Number.isFinite(Date.parse(item.observed_at))||!['LISTED_UNCONFIRMED','SOLD'].includes(item.listing_status))throw Error('Invalid listing');ids.add(item.id);if(data.ranking_mode==='weighted-top-50'){if(['rubric-v3.4','rubric-v3.5'].includes(data.rubric_version)&&(!(number(item.price)&&item.price>0)||item.currency!=='USD'))throw Error('Asking price required');if(!number(item.score)||item.score>100||!item.categories||!Array.isArray(item.verify)||!number(item.assumed))throw Error('Invalid score');for(const [k,max] of [['Mover fit',30],['Remaining life',25],['Deal',20],['Budget',15],['Ease',10]])if(!number(item.categories[k])||item.categories[k]>max)throw Error('Invalid category');}for(const k of ['price','mileage','body_feet','gvwr'])if(item[k]!=null&&!number(item[k]))throw Error('Invalid metric');if(item.overall_rank!=null&&(!Number.isInteger(item.overall_rank)||item.overall_rank<1||item.overall_rank>50))throw Error('Invalid rank');}return data;
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
export const METRICS=[['Mover fit',30,'fit'],['Remaining life',25,'life'],['Deal',20,'deal'],['Budget',15,'budget'],['Ease',10,'ease']];
export function filterItems(items,{query='',price=false,miles=false,mover=false,attic=false}={}){
 const q=query.trim().toLowerCase();return items.filter(i=>(!q||[i.title,i.seller,i.state].some(v=>String(v??'').toLowerCase().includes(q)))&&(!price||i.currency==='USD'&&number(i.price)&&i.price<=55000)&&(!miles||i.mileage_unit==='mi'&&number(i.mileage)&&i.mileage<=170000)&&(!mover||i.moving_body===true)&&(!attic||i.points?.attic===2));
}
function target(value,unit,kind){
 if(!number(value)||unit!==(kind==='price'?'USD':'mi'))return {tone:'neutral',label:'Unit unconfirmed'};
 const [lo,hi]=kind==='price'?[29000,55000]:[80000,170000];
 return value>hi?{tone:'warn',label:'Above target'}:value<lo?{tone:'info',label:'Below target'}:{tone:'good',label:'In target'};
}
function tag(label,value){return `<span class="spec-tag ${value===true?'yes':value===false?'no':'unknown'}">${value===true?'✓':value===false?'−':'?'} ${escape(label)}${value==null?' unknown':''}</span>`;}
export function rustLabel(i){
 const r=i.rust_review;
 if(!r||r.status==='pending')return 'Rust · not assessed';
 if(r.status==='stale')return 'Rust · review expired';
 if(r.status==='insufficient')return 'Rust · photos insufficient';
 const p={none:0,minor:-2,major:-3,extreme:-4}[r.severity];
 if(r.status!=='reviewed'||p===undefined||r.penalty!==p)return 'Rust · not assessed';
 return r.severity==='none'?'No visible rust · 0':`${r.severity[0].toUpperCase()+r.severity.slice(1)} rust · −${-p}`;
}
export function renderFeed(data,{now=Date.now()}={}){
 validateFeed(data);const eligible=data.items.filter(i=>i.listing_status!=='SOLD');
 const priceOrder=eligible.filter(i=>number(i.price)&&i.currency==='USD').sort((a,b)=>a.price-b.price||a.id.localeCompare(b.id));
 const milesOrder=eligible.filter(i=>number(i.mileage)&&i.mileage_unit==='mi').sort((a,b)=>a.mileage-b.mileage||a.id.localeCompare(b.id));
 return data.items.map(i=>{
 const weighted=data.ranking_mode==='weighted-top-50',fresh=freshness(i,now),status=weighted?(i.unverified?'UNVERIFIED IDENTITY — INVESTIGATE':'INVESTIGATE — NOT QUALIFIED'):publicState(i);
 const active=fresh==='FRESH'&&status==='INVESTIGATE — NOT QUALIFIED';
 const rank=i.overall_rank==null?'Unranked':`${weighted||active?'Overall':'Previous overall'} <strong>#${i.overall_rank}</strong>`;
 const price=number(i.price)?`${i.currency==='USD'?'$':i.currency==='CAD'?'CAD $':''}${count(i.price)}${!['USD','CAD'].includes(i.currency)?' (currency unknown)':''}`:'Unknown';
 const mileage=number(i.mileage)?`${count(i.mileage)} ${['mi','km'].includes(i.mileage_unit)?i.mileage_unit:'(unit unknown)'}`:'Unknown';
 const p=priceOrder.indexOf(i),m=milesOrder.indexOf(i),pt=target(i.price,i.currency,'price'),mt=target(i.mileage,i.mileage_unit,'miles');
 const body=i.body_length_conflict?'Conflicting body length — verify':`${number(i.body_feet)?count(i.body_feet)+' ft':'Length unknown'}; moving fit: ${yesNo(i.moving_body)}`;
 const weight=number(i.gvwr)?`Advertised ${count(i.gvwr)} lb`:`Exact GVWR unknown${i.advertised_gvw?'; GVW claim '+i.advertised_gvw:''}${i.advertised_weight_class?'; '+i.advertised_weight_class:''}`;
 const capacity=number(Number(i.liftgate_capacity))&&Number(i.liftgate_capacity)>0?`; listed capacity ${count(Number(i.liftgate_capacity))} lb`:'';
 const tone=i.score>=80?'good':i.score>=70?'info':i.score>=60?'warn':'neutral';
 const metrics=weighted?METRICS.map(([k,max,key])=>`<div class="metric ${key}"><span>${escape(k)}</span><span class="track" aria-hidden="true"><i style="--fill:${Math.max(0,Math.min(100,i.categories[k]/max*100)).toFixed(2)}%"></i></span><strong>${i.categories[k]} / ${max}</strong></div>`).join(''):'Scores unavailable';
 const detailId=`detail-${i.id}`,title=escape(i.title??'Truck listing'),photo=thumbnailFor(i);
 const thumb=photo?`<a class="thumb" href="${escape(listingURL(i.listing_url))}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true"><img src="${escape(photo)}" alt="" width="320" height="240" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a>`:NO_PHOTO;
 const attrs=`data-id="${escape(i.id)}" data-listing="${escape(i.listing_url)}" data-order="${i.overall_rank??''}" data-price="${number(i.price)&&i.currency==='USD'?i.price:''}" data-miles="${number(i.mileage)&&i.mileage_unit==='mi'?i.mileage:''}" ${METRICS.map(([k,,key])=>`data-${key}="${-(i.categories?.[k]??0)}"`).join(' ')}`;
 return `<tr class="truck-row" ${attrs}>
 <th scope="row" class="truck"><div class="identity">${thumb}<div class="identity-text"><span class="position">${rank}</span><a href="${escape(listingURL(i.listing_url))}" target="_blank" rel="noopener noreferrer">${title} <span aria-hidden="true">↗</span></a><small>${escape(i.seller??'Seller unknown')}${i.state?' · '+escape(i.state):''}</small>${i.unverified?'<span class="badge warn identity">Unverified identity</span>':''}${fresh!=='FRESH'?`<span class="badge warn">${fresh}</span>`:''}</div></div></th>
 <td class="asking" data-label="Asking price"><strong class="asking-value">${escape(price)}</strong><span class="badge ${pt.tone}">${pt.label}</span>${p>=0?`<small> · P${p+1} of ${priceOrder.length} priced</small>`:''}</td>
 <td class="mileage" data-label="Mileage"><strong>${escape(mileage)}</strong><span class="badge ${mt.tone}">${mt.label}</span>${m>=0?`<small>M${m+1} of ${milesOrder.length} with mi</small>`:''}</td>
 <td class="score" data-label="Overall score">${weighted?`<strong class="score-value">${i.score}<span>/100</span></strong><span class="badge ${tone}">${escape(i.tier)}</span><small>${i.assumed} assumed points</small><span class="badge ${i.rust_review?.penalty<0?'warn':'neutral'}">${escape(rustLabel(i))}</span>`:'Unranked'}</td>
 <td class="metrics" data-label="Weighted scores">${metrics}</td>
 <td class="setup" data-label="Moving setup"><div class="tags">${tag(number(i.body_feet)?`${i.body_feet} ft`:'Length',i.body_length_conflict?null:number(i.body_feet)?i.body_feet===26:null)}${tag('Moving body',i.moving_body)}${tag('Liftgate',i.liftgate)}${tag('Attic',i.points?.attic===2?true:i.attic==='No'?false:null)}</div><button class="expand" type="button" data-expand="${escape(i.id)}" aria-expanded="false" aria-controls="${escape(detailId)}">Details &amp; score <span aria-hidden="true">＋</span></button></td>
 </tr><tr class="detail-row" id="${escape(detailId)}" data-detail-for="${escape(i.id)}" hidden><td colspan="6"><div class="detail-grid">
 <section><h3>Listing evidence</h3><dl>${[['Rust photo inspection',rustLabel(i)+(i.rust_review?.reviewed_at?'; '+i.rust_review.photo_count+' photos; '+i.rust_review.coverage+' coverage; reviewed '+observed(i.rust_review.reviewed_at):'')],['Body',body],['Cummins / Allison',yesNo(i.cummins)+' / '+yesNo(i.allison)],['Liftgate',yesNo(i.liftgate)+capacity],['Weight',weight],['Attic',i.attic??(i.points?.attic===2?'Explicit attic claim in listing text':'Unknown')],['Width / interior height',(i.body_width??'Unknown')+' / '+height(i.internal_height)],['Acquisition estimate',number(i.allin)?'$'+count(i.allin)+' incl. estimated transport':'Unknown']].map(([k,v])=>`<div><dt>${escape(k)}</dt><dd>${escape(v)}</dd></div>`).join('')}</dl></section>
 <section><h3>Point breakdown</h3><ul class="point-list">${Object.entries(i.points??{}).map(([k,v])=>`<li><span>${escape(k)}${i.verify?.includes(k)?' · assumed':''}</span><strong>${escape(v)}</strong></li>`).join('')}</ul></section>
 <section><h3>What to verify</h3><p>${weighted?escape(i.assumed)+' assumed points. Estimated points are not confirmed equipment.':escape(i.rationale??'Review the listing evidence.')}</p><ul>${(i.verify??[]).map(k=>`<li>${escape(k)}</li>`).join('')||'<li>Seller availability and mechanical inspection</li>'}</ul><p class="evidence-status">${escape(status)}<br>${fresh} · ${escape(i.listing_status)}<br>Observed ${escape(observed(i.observed_at))}</p></section>
 </div></td></tr>`;
 }).join('');
}

export function createFeedClient({fetchFn=fetch,onData,onStatus,now=()=>new Date(),setTimer=setTimeout,clearTimer=clearTimeout}){
 let revision=null,busy=false,lastSuccess=null,timer=null,running=false,first=true;
 async function refresh(){if(busy)return;busy=true;try{const response=await fetchFn(FEED_URL,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('Feed unavailable');const data=validateFeed(await response.json());if(first||data.revision!==revision){onData(data);revision=data.revision;first=false;}lastSuccess=now();onStatus({connected:true,lastSuccess,data});}catch{onStatus({connected:false,lastSuccess});}finally{busy=false;if(running)timer=setTimer(refresh,POLL_MS);}}
 return {refresh,start(){if(running)return;running=true;refresh();},stop(){running=false;if(timer!==null)clearTimer(timer);timer=null;}};
}
