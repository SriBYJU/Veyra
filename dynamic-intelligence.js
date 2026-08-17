/* Veyra 3.4 — Dynamic Intelligence Layer
   Replaces finite food/recipe dead-ends with a resolver + procedural pantry engine.
   Core history remains local-first. Online lookups are user-triggered and review-first.
*/
(function(){
  const VERSION='3.4.1';
  const $q=(s,r=document)=>r.querySelector(s), $qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const num=v=>Number.isFinite(+v)?+v:0;
  const round=v=>Math.round(num(v)*10)/10;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const norm=s=>String(s||'').toLowerCase().replace(/[’']/g,"'").replace(/[^a-z0-9.'&+\- ]+/g,' ').replace(/\s+/g,' ').trim();
  const title=s=>String(s||'').replace(/\b\w/g,c=>c.toUpperCase());
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const stop=new Set(['the','a','an','and','or','of','with','from','at','for','my','i','had','ate','some','one','two','three','large','medium','small','order','item','meal','food']);
  const toks=s=>norm(s).split(' ').filter(x=>x.length>1&&!stop.has(x));
  const overlap=(a,b)=>{const A=toks(a),B=toks(b);if(!A.length||!B.length)return 0;const h=A.filter(x=>B.some(y=>y===x||y.includes(x)||x.includes(y))).length;return h/A.length};
  const safeEsc=s=>typeof esc==='function'?esc(String(s??'')):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const nowTime=()=>new Date().toTimeString().slice(0,5);
  const cacheKey=s=>norm(s).slice(0,180);
  function publicHttpUrl(value){
    try{const u=new URL(String(value||''));if(!/^https?:$/.test(u.protocol))return null;const h=u.hostname.toLowerCase().replace(/^www\./,'');if(!h||h==='localhost'||h.endsWith('.local')||h==='0.0.0.0'||h==='::1'||/^127\./.test(h)||/^10\./.test(h)||/^192\.168\./.test(h)||/^169\.254\./.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h))return null;return u}catch{return null}
  }

  state.liveFoodCache ||= {};
  state.venueSiteCache ||= {};
  state.generatedRecipes ||= {};
  state.recipePreferences ||= {mode:state.profile?.pantryPreference==='extras'?'extras':'pantry-only',allowBasics:true};
  state.foodMemory ||= [];
  state.pantryIntel ||= {};
  state.appVersion=VERSION;

  /* ---------------- Food resolver ---------------- */
  function parseFoodIntent(raw){
    const text=String(raw||'').trim();
    const meal=/\bbreakfast\b/i.test(text)?'Breakfast':/\blunch\b/i.test(text)?'Lunch':/\bdinner|supper\b/i.test(text)?'Dinner':'Snack';
    let clean=text.replace(/^.*?\b(?:i\s+)?(?:ate|had|just ate|just had|log(?:ged)?|add)\b\s*/i,'').replace(/\b(?:for\s+)?(?:breakfast|lunch|dinner|snack)\b/ig,'').trim().replace(/[.!?]+$/,'');
    let venue='',item=clean,modifications='';
    const venueMatch=clean.match(/\b(?:from|at)\s+(.+)$/i);
    if(venueMatch){
      let venueTail=venueMatch[1].trim();
      const tailMod=venueTail.match(/(?:,|\s+)\b((?:without|no|extra|add|light|substitute|swap)\b.+)$/i);
      if(tailMod){modifications=tailMod[1].trim();venueTail=venueTail.slice(0,tailMod.index).replace(/[,\s]+$/,'').trim()}
      venue=venueTail;item=clean.slice(0,venueMatch.index).trim();
    }
    const itemMod=item.match(/\b((?:without|no|extra|add|light|substitute|swap)\b.+)$/i);
    if(itemMod){modifications=modifications||itemMod[1].trim();item=item.slice(0,itemMod.index).replace(/[,\s]+$/,'').trim()}
    const size=(item.match(/\b(kids?|small|medium|large|extra[- ]large|xl|tall|grande|venti|trenta)\b/i)||[])[1]||'';
    const qmatch=item.match(/\b(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|half)\s*(?:x|slices?|pieces?|items?|servings?|cups?|bowls?|wraps?|burritos?|tacos?|sandwiches?|burgers?|drinks?)\b/i);
    const qwords={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,half:.5},qraw=qmatch?.[1]?.toLowerCase();let quantity=qraw?(qwords[qraw]??num(qraw)):1;
    item=item.replace(/^\s*(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|half)\s+(?:slices?|pieces?|items?|servings?|cups?|bowls?|wraps?|burritos?|tacos?|sandwiches?|burgers?|drinks?)\s+(?:of\s+)?/i,'').trim();
    if(!qmatch&&venue){const lead=item.match(/^\s*(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s+(.+)/i);if(lead){const k=lead[1].toLowerCase();quantity=qwords[k]??num(k);item=lead[2].trim()}}
    item=item.replace(/^(?:a|an)\s+/i,'').trim();return {raw:text,clean,item:item||clean,venue,meal,quantity:quantity||1,size,modifications};
  }

  function sourceScore(q,item){
    const hay=[item.name,item.brand,item.description,item.source].filter(Boolean).join(' ');
    let s=overlap(q,hay)*100;
    if(item.brand&&norm(q).includes(norm(item.brand)))s+=18;
    if(item.name&&norm(q).includes(norm(item.name)))s+=22;
    return s;
  }

  function memorySearch(query){
    const seen=new Set(), rows=[];
    for(const x of [...(state.customFoods||[]),...(state.foodMemory||[]),...(state.meals||[]).slice().reverse()]){
      if(!x?.name)continue;const k=norm(`${x.brand||''}|${x.name}|${x.servingLabel||''}`);if(seen.has(k))continue;seen.add(k);
      const score=sourceScore(query,x);if(score<28)continue;
      rows.push({...x,source:x.source||'Your Veyra history',confidence:Math.max(92,num(x.confidence)||92),_score:score,_kind:'memory'});
    }
    return rows.sort((a,b)=>b._score-a._score).slice(0,6);
  }

  function gatewayBase(){const raw=window.VEYRA_CONFIG?.gatewayUrl||'';if(!raw)return '';const u=publicHttpUrl(raw);return u?u.href.replace(/\/$/,''):''}
  async function gatewaySearch(query){const base=gatewayBase();if(!base)return [];const u=new URL(base+'/food');u.searchParams.set('q',query);const j=await fetchJSON(u,8500);return (j.items||[]).map(x=>({...x,_kind:x._kind||'gateway',source:x.source||'Veyra Intelligence Gateway'}));}
  async function fetchJSON(url,timeout=8500,opts={}){
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);
    try{const r=await fetch(url,{...opts,signal:ctl.signal,headers:{Accept:'application/json',...(opts.headers||{})}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}finally{clearTimeout(timer)}
  }
  async function fetchText(url,timeout=9000){
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);
    try{const r=await fetch(url,{signal:ctl.signal,headers:{Accept:'text/plain, text/markdown;q=0.9, */*;q=0.5'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.text()}finally{clearTimeout(timer)}
  }

  async function offSearch(query){
    const u=new URL('https://world.openfoodfacts.org/cgi/search.pl');
    u.search=new URLSearchParams({search_terms:query,search_simple:'1',action:'process',json:'1',page_size:'16',fields:'code,product_name,brands,serving_size,serving_quantity,nutriments,image_front_small_url'});
    const j=await fetchJSON(u,8000),qt=toks(query);
    return (j.products||[]).filter(p=>p.product_name).map(p=>{
      const n=p.nutriments||{},grams=num(p.serving_quantity)||100,f=grams/100;
      const item={name:p.product_name,brand:p.brands||'',servingLabel:p.serving_size||`${grams} g`,servingGrams:grams,
        cal:round(num(n['energy-kcal_100g'])*f),p:round(num(n.proteins_100g)*f),c:round(num(n.carbohydrates_100g)*f),f:round(num(n.fat_100g)*f),fiber:round(num(n.fiber_100g)*f),sugar:round(num(n.sugars_100g)*f),
        source:'Open Food Facts',sourceUrl:p.code?`https://world.openfoodfacts.org/product/${encodeURIComponent(p.code)}`:'https://world.openfoodfacts.org/',confidence:84,image:p.image_front_small_url||'',_kind:'public'};
      const hay=norm(`${item.brand} ${item.name}`),hits=qt.filter(t=>hay.includes(t)).length;item._score=(qt.length?hits/qt.length:0)*100;return item;
    }).filter(x=>x._score>=24).sort((a,b)=>b._score-a._score).slice(0,10);
  }

  /* FoodData Central exposes a public DEMO_KEY for exploratory calls. Veyra uses
     it only as a secondary zero-setup fallback and never relies on it for core use. */
  function nutrientValue(food,re,unitRe=null){
    const rows=(food.foodNutrients||[]).filter(x=>re.test(String(x.nutrientName||x.nutrient?.name||'')));
    const n=(unitRe?rows.find(x=>unitRe.test(String(x.unitName||x.nutrient?.unitName||''))):null)||rows[0];
    return n?num(n.value??n.amount):0;
  }
  function energyKcal(food){
    const rows=(food.foodNutrients||[]);
    const kcal=rows.find(x=>/^Energy$/i.test(String(x.nutrientName||x.nutrient?.name||''))&&/kcal/i.test(String(x.unitName||x.nutrient?.unitName||'')));
    if(kcal)return num(kcal.value??kcal.amount);
    const legacy=rows.find(x=>String(x.nutrientNumber||x.nutrient?.number||'')==='208');
    if(legacy)return num(legacy.value??legacy.amount);
    const kj=rows.find(x=>/^Energy$/i.test(String(x.nutrientName||x.nutrient?.name||''))&&/^kJ$/i.test(String(x.unitName||x.nutrient?.unitName||'')));
    return kj?num(kj.value??kj.amount)/4.184:0;
  }
  async function usdaSearch(query){
    const u=new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
    u.search=new URLSearchParams({api_key:'DEMO_KEY',query,pageSize:'12'});
    const j=await fetchJSON(u,8500),qt=toks(query);
    return (j.foods||[]).map(f=>{
      const grams=/^g$/i.test(f.servingSizeUnit||'')&&num(f.servingSize)>0?num(f.servingSize):100,fac=grams/100;
      const item={name:f.description||f.lowercaseDescription||'USDA food',brand:f.brandName||f.brandOwner||'',servingLabel:f.householdServingFullText||(`${round(grams)} g reference`),servingGrams:grams,
        cal:round(energyKcal(f)*fac),p:round(nutrientValue(f,/^Protein$/i)*fac),c:round(nutrientValue(f,/Carbohydrate/i)*fac),f:round(nutrientValue(f,/Total lipid|Total Fat/i)*fac),fiber:round(nutrientValue(f,/Fiber/i)*fac),sugar:round(nutrientValue(f,/Sugars/i)*fac),
        source:'USDA FoodData Central',sourceUrl:f.fdcId?`https://fdc.nal.usda.gov/food-details/${f.fdcId}/nutrients`:'https://fdc.nal.usda.gov/',confidence:/Branded/i.test(f.dataType||'')?86:80,_kind:'public'};
      const hay=norm(`${item.brand} ${item.name}`),hits=qt.filter(t=>hay.includes(t)).length;item._score=(qt.length?hits/qt.length:0)*100+(item.brand&&norm(query).includes(norm(item.brand))?12:0);return item;
    }).filter(x=>x.cal>0&&x._score>=25).sort((a,b)=>b._score-a._score).slice(0,8);
  }

  async function wikidataOfficialSite(venue){
    const key=cacheKey(venue);const cached=state.venueSiteCache[key];if(cached?.url&&Date.now()-cached.ts<90*864e5)return cached.url;
    const s=new URL('https://www.wikidata.org/w/api.php');s.search=new URLSearchParams({action:'wbsearchentities',search:venue,language:'en',format:'json',origin:'*',limit:'5',type:'item'});
    const j=await fetchJSON(s,7000),rows=(j.search||[]).sort((a,b)=>{const aa=/restaurant|fast food|coffee|cafe|pizza|bakery|food|chain/i.test(a.description||'')?1:0,bb=/restaurant|fast food|coffee|cafe|pizza|bakery|food|chain/i.test(b.description||'')?1:0;return bb-aa});
    if(!rows.length)return '';
    const ids=rows.slice(0,4).map(x=>x.id).join('|');const e=new URL('https://www.wikidata.org/w/api.php');e.search=new URLSearchParams({action:'wbgetentities',ids,props:'claims|descriptions|labels',format:'json',origin:'*'});
    const data=await fetchJSON(e,7000);
    for(const r of rows){const ent=data.entities?.[r.id],claim=ent?.claims?.P856?.find?.(x=>x?.mainsnak?.datavalue?.value),url=claim?.mainsnak?.datavalue?.value;if(url){state.venueSiteCache[key]={url,ts:Date.now()};save();return url}}
    return '';
  }

  function linksFromReader(text,origin){
    const out=[];for(const m of String(text||'').matchAll(/\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g))out.push(m[1]);
    for(const m of String(text||'').matchAll(/https?:\/\/[^\s<>()"']+/g))out.push(m[0].replace(/[.,;]+$/,''));
    return uniq(out).filter(u=>{try{const h=new URL(u).hostname.toLowerCase(),root=new URL(origin).hostname.toLowerCase();return h===root||h.endsWith('.'+root)}catch{return false}}).slice(0,350);
  }
  async function reader(url){const base=gatewayBase();if(base){try{return await fetchText(`${base}/read?url=${encodeURIComponent(url)}`,9000)}catch{}}return fetchText(`https://r.jina.ai/${url}`,8500)}
  function rankLinks(urls,item){const it=toks(item);return urls.map(u=>({u,s:it.filter(t=>norm(u).includes(t)).length*8+(/menu|food|product|nutrition|item/i.test(u)?2:0)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.u)}
  function parsePublishedNutrition(text,item){
    const raw=String(text||''),lower=raw.toLowerCase(),itemTokens=toks(item).sort((a,b)=>b.length-a.length);
    const anchors=[];
    const phrase=norm(item),phraseVariants=uniq([phrase,phrase.replace(/\b([a-z][a-z-]{3,})s$/i,'$1')]);
    for(const ph of phraseVariants.filter(Boolean)){let i=lower.indexOf(ph);while(i>=0&&anchors.length<5){anchors.push(i);i=lower.indexOf(ph,i+ph.length)}}
    if(!anchors.length){for(const tok of itemTokens.slice(0,3)){const variants=uniq([tok,/^[a-z][a-z-]{3,}s$/i.test(tok)?tok.slice(0,-1):'']);for(const v of variants.filter(Boolean)){let i=lower.indexOf(v);while(i>=0&&anchors.length<8){anchors.push(i);i=lower.indexOf(v,i+v.length)}}}}
    if(!anchors.length)return null;
    const grab=(t,labels,kind='g')=>{
      for(const lab of labels){
        if(kind==='kcal'){
          const after=t.match(new RegExp(`(?:${lab})[^A-Za-z0-9]{0,16}(\\d{1,4}(?:\\.\\d+)?)\\s*(?:kcal|calories?|cal)?\\b`,'i'));if(after)return +after[1];
          const before=t.match(new RegExp(`(\\d{1,4}(?:\\.\\d+)?)\\s*(?:kcal|calories?|cal)\\b[^A-Za-z0-9]{0,12}(?:${lab})?`,'i'));if(before)return +before[1];
        }else{
          const after=t.match(new RegExp(`(?:${lab})[^A-Za-z0-9]{0,16}(\\d{1,4}(?:\\.\\d+)?)\\s*(?:g|grams?)\\b`,'i'));if(after)return +after[1];
          const before=t.match(new RegExp(`(\\d{1,4}(?:\\.\\d+)?)\\s*(?:g|grams?)\\b[^A-Za-z0-9]{0,12}(?:${lab})`,'i'));if(before)return +before[1];
        }
      }
      return 0;
    };
    let best=null,bestScore=-1;
    for(const a of anchors){
      const t=raw.slice(Math.max(0,a-350),Math.min(raw.length,a+900)),windowNorm=norm(t),matchedTokens=itemTokens.filter(tok=>windowNorm.includes(tok)).length;
      if(itemTokens.length>=2&&matchedTokens<Math.min(2,itemTokens.length))continue;
      let cal=grab(t,['calories?','energy'],'kcal');if(!cal){const m=t.match(/\b(\d{2,4})\s*(?:kcal|calories?|cal)\b/i);if(m)cal=+m[1]}
      const p=grab(t,['protein']),c=grab(t,['total carbohydrates?','carbohydrates?','carbs?']),f=grab(t,['total fat','fat']),fiber=grab(t,['dietary fiber','fiber']),sugar=grab(t,['total sugars?','sugars?']);
      if(!(cal>0&&cal<4000)||(!(p>0)&&!(c>0)&&!(f>0)))continue;
      const score=(p>0)+(c>0)+(f>0)+(fiber>0)+(sugar>0);if(score>bestScore){best={cal,p,c,f,fiber,sugar};bestScore=score}
    }
    return best;
  }

  async function researchSpecificOfficialSite(site,intent,status){
    if(!site)return null;let rootText='',mapText='';
    const parsedUrl=publicHttpUrl(site);if(!parsedUrl)return null;
    const origin=parsedUrl.origin;status?.(`Checking ${intent.venue||'the restaurant'}'s published pages…`);
    const [root,map]=await Promise.allSettled([reader(parsedUrl.href),reader(origin+'/sitemap.xml')]);
    if(root.status==='fulfilled')rootText=root.value;if(map.status==='fulfilled')mapText=map.value;
    let urls=uniq([...linksFromReader(rootText,origin),...linksFromReader(mapText,origin)]);
    const nested=urls.filter(u=>/sitemap/i.test(u)).slice(0,2);if(nested.length){const ns=await Promise.allSettled(nested.map(reader));for(const x of ns)if(x.status==='fulfilled')urls.push(...linksFromReader(x.value,origin));urls=uniq(urls)}
    const ranked=rankLinks(urls,intent.item).slice(0,4);
    const rootNutrition=parsePublishedNutrition(rootText,intent.item);if(rootNutrition&&(!ranked.length||ranked.length===0))return {...rootNutrition,name:title(intent.item),brand:intent.venue,servingLabel:'Published serving — review',source:`${intent.venue||'Restaurant'} official website`,sourceUrl:parsedUrl.href,confidence:86,_kind:'official'};
    if(ranked.length){status?.('Reading the most relevant official menu page…');const pages=await Promise.allSettled(ranked.slice(0,3).map(async u=>({u,text:await reader(u)})));for(const p of pages){if(p.status!=='fulfilled')continue;const n=parsePublishedNutrition(p.value.text,intent.item);if(n)return {...n,name:title(intent.item),brand:intent.venue,servingLabel:'Published serving — review',source:`${intent.venue||'Restaurant'} official website`,sourceUrl:p.value.u,confidence:(n.p&&n.c&&n.f)?94:87,_kind:'official'}}}
    if(rootNutrition)return {...rootNutrition,name:title(intent.item),brand:intent.venue,servingLabel:'Published serving — review',source:`${intent.venue||'Restaurant'} official website`,sourceUrl:parsedUrl.href,confidence:84,_kind:'official'};
    return null;
  }
  async function officialSiteResearch(intent,status){
    if(!intent.venue)return null;status?.(`Finding ${intent.venue}'s official site…`);
    let site='';try{site=await wikidataOfficialSite(intent.venue)}catch{}if(!site)return null;
    return researchSpecificOfficialSite(site,intent,status);
  }


  const GENERIC_DISHES=[
    [/\bpizza\b/i,{label:'Pizza',cal:285,p:12,c:36,f:10,fiber:2,sugar:4,servingLabel:'1 typical slice'}],
    [/\b(?:veggie |vegetable |plant[- ]based )?burgers?\b|\bwhoppers?\b/i,{label:'Burger / sandwich',cal:470,p:20,c:50,f:21,fiber:5,sugar:9,servingLabel:'1 typical sandwich'}],
    [/\bburrito\b/i,{label:'Burrito',cal:560,p:20,c:78,f:18,fiber:12,sugar:6,servingLabel:'1 typical burrito'}],
    [/\btacos?\b/i,{label:'Tacos',cal:210,p:8,c:26,f:9,fiber:4,sugar:2,servingLabel:'1 typical taco'}],
    [/\bwrap\b/i,{label:'Wrap',cal:430,p:18,c:52,f:16,fiber:6,sugar:5,servingLabel:'1 typical wrap'}],
    [/\bsandwich\b|\bsub\b/i,{label:'Sandwich',cal:420,p:18,c:50,f:16,fiber:5,sugar:7,servingLabel:'1 typical sandwich'}],
    [/\b(?:rice |grain )?bowl\b/i,{label:'Bowl',cal:520,p:20,c:72,f:16,fiber:10,sugar:7,servingLabel:'1 typical bowl'}],
    [/\bsalad\b/i,{label:'Entrée salad',cal:350,p:14,c:28,f:21,fiber:8,sugar:9,servingLabel:'1 entrée salad'}],
    [/\bpasta\b|\bspaghetti\b|\bnoodles?\b/i,{label:'Pasta / noodles',cal:480,p:16,c:72,f:14,fiber:6,sugar:8,servingLabel:'1 restaurant plate'}],
    [/\bcurry\b|\bmasala\b/i,{label:'Curry',cal:390,p:15,c:45,f:17,fiber:9,sugar:8,servingLabel:'1 cup / bowl estimate'}],
    [/\bsoup\b/i,{label:'Soup',cal:240,p:10,c:32,f:8,fiber:7,sugar:6,servingLabel:'1 bowl'}],
    [/\bfries\b|\bfrench fries\b/i,{label:'French fries',cal:365,p:5,c:48,f:17,fiber:5,sugar:1,servingLabel:'1 medium order'}],
    [/\bsmoothie\b|\bshake\b/i,{label:'Smoothie / shake',cal:330,p:12,c:52,f:8,fiber:5,sugar:34,servingLabel:'1 medium drink'}]
  ];
  function genericDishEstimate(intent){const hit=GENERIC_DISHES.find(([re])=>re.test(intent.item));if(!hit)return null;const x=hit[1],q=intent.quantity||1;return {...x,name:title(intent.item),brand:intent.venue||'',cal:round(x.cal*q),p:round(x.p*q),c:round(x.c*q),f:round(x.f*q),fiber:round(x.fiber*q),sugar:round(x.sugar*q),servingLabel:q===1?x.servingLabel:`${q} × ${x.servingLabel}`,source:'Veyra generic dish estimate — recipes and portions vary',confidence:52,_kind:'estimate'}}

  function venueMatchScore(venue,item){
    if(!venue)return 1;
    const v=norm(venue),brand=norm(item?.brand||''),source=norm(item?.source||''),name=norm(item?.name||''),vt=toks(venue);
    if(brand){if(brand===v||brand.includes(v)||v.includes(brand))return 1;const bs=overlap(venue,brand);if(bs>=.75)return bs}
    if(source&&(source.includes(v)||v.includes(source)))return 1;
    const ns=overlap(venue,name);
    if(vt.length===1)return name.includes(v)?1:0;
    return ns>=.8?ns:0;
  }
  function venueAwarePublic(rows,intent){if(!intent.venue)return rows;return rows.map(x=>{const vm=venueMatchScore(intent.venue,x);if(vm>=.5)return {...x,_venueMatch:true};return {...x,_venueMatch:false,_kind:'reference',confidence:Math.min(num(x.confidence)||60,60),source:`${x.source} — similar-item reference; not verified for ${intent.venue}`}})}

  function dedupeFood(rows,query){const seen=new Set();return rows.map(x=>({...x,_score:num(x._score)||sourceScore(query,x)})).sort((a,b)=>b._score-a._score||num(b.confidence)-num(a.confidence)).filter(x=>{const k=norm(`${x.brand}|${x.name}|${x.servingLabel}`);if(seen.has(k))return false;seen.add(k);return true}).slice(0,16)}
  function rememberFood(x){if(!x?.name)return;const key=norm(`${x.brand||''}|${x.name}|${x.servingLabel||''}`),mem=state.foodMemory||[];const i=mem.findIndex(y=>norm(`${y.brand||''}|${y.name}|${y.servingLabel||''}`)===key);const copy={name:x.name,brand:x.brand||'',servingLabel:x.servingLabel||'1 serving',servingGrams:x.servingGrams||null,cal:num(x.cal),p:num(x.p),c:num(x.c),f:num(x.f),fiber:num(x.fiber),sugar:num(x.sugar),source:x.source||'resolved food',sourceUrl:x.sourceUrl||'',confidence:num(x.confidence)||80};if(i>=0)mem[i]=copy;else mem.unshift(copy);state.foodMemory=mem.slice(0,120);save()}

  function openResolvedFood(item,meal,intent){
    const qty=intent.quantity||1,scaled={...item,meal,time:nowTime(),quantity:qty};
    if(intent.modifications){scaled.notes=[item.notes,`Customization: ${intent.modifications}. Published values may describe the standard item.`].filter(Boolean).join(' • ');scaled.confidence=Math.max(40,num(item.confidence)-8)}
    if(qty!==1&&!/×/.test(item.servingLabel||'')){for(const k of ['cal','p','c','f','fiber','sugar'])scaled[k]=round(num(item[k])*qty);scaled.servingLabel=`${qty} × ${item.servingLabel||'1 serving'}`}
    rememberFood(item);closeModal();addFoodModal(meal,scaled);
  }

  function renderFoodResults(box,rows,intent,meal,query){
    if(!box)return;const exact=dedupeFood(rows,query),estimate=genericDishEstimate(intent);
    if(!exact.length&&!estimate){box.innerHTML=`<div class="empty-state-v2"><div class="icon">🧭</div><h3>No published match yet — but this is not a dead end</h3><p>Veyra checked live public sources${intent.venue?' and tried to identify the restaurant’s official site':''}. If that item has no published nutrition, you can estimate it transparently from the dish/ingredients or enter/scan a label.</p><div class="stack-actions"><button id="dynIngredientEstimate" class="primary">Build a transparent estimate</button>${intent.venue?'<button id="dynOfficialUrl" class="secondary">Try the restaurant website</button>':''}<button id="dynManualFood" class="secondary">Enter published / label nutrition</button><button id="dynLabelScan" class="secondary">📸 Scan a nutrition label</button></div></div>`;
      $q('#dynIngredientEstimate')?.addEventListener('click',()=>openIngredientEstimate(intent,meal));$q('#dynOfficialUrl')?.addEventListener('click',()=>openRestaurantWebsiteResearch(intent,meal,query));$q('#dynManualFood')?.addEventListener('click',()=>{closeModal();addFoodModal(meal,{name:intent.item,brand:intent.venue||'',time:nowTime(),meal,confidence:98,source:'user-entered published nutrition'})});$q('#dynLabelScan')?.addEventListener('click',()=>{closeModal();action('labelScan')});return}
    const all=estimate?[...exact,{...estimate,_score:1}]:exact;
    box.innerHTML=`<div class="food-results">${all.map((x,i)=>`<button class="food-result dyn-food-result" data-i="${i}">${x.image?`<img src="${safeEsc(x.image)}" alt="">`:`<span class="fallback-food-img">${x._kind==='official'?'🌐':x._kind==='estimate'?'≈':x._kind==='reference'?'↔':'🍽️'}</span>`}<span><b>${safeEsc(x.name)}</b><small>${safeEsc(x.brand||'Generic')} • ${safeEsc(x.servingLabel||'1 serving')}</small><small>${x.cal?`${x.cal} kcal`:''}${x.p?` • ${x.p}g protein`:''} • ${safeEsc(x.source||'')}</small></span><span>${x._kind==='estimate'?'Estimate ›':x._kind==='reference'?'Reference ›':'Review ›'}</span></button>`).join('')}</div>${intent.modifications?`<div class="callout"><b>Customization detected:</b> ${safeEsc(intent.modifications)}. Published nutrition often describes the standard item, so review/edit the values before logging.</div>`:''}<div class="callout"><b>Resolver ladder:</b> your saved history → Open Food Facts → USDA public food data → restaurant official-site research when discoverable → transparent estimate. Nothing is silently treated as exact.</div>`;
    $qa('.dyn-food-result',box).forEach(b=>b.onclick=()=>openResolvedFood(all[+b.dataset.i],meal,intent));
  }

  function openRestaurantWebsiteResearch(intent,meal,query){
    openModal('Research restaurant website',`<p class="muted">Veyra could not automatically discover a trustworthy official page for <b>${safeEsc(intent.venue)}</b>. Paste the restaurant's public website — no API key is needed. Veyra will look for the item and published nutrition, then make you review the result before logging.</p><form id="dynRestaurantUrlForm" class="inline-form"><input name="url" type="url" required placeholder="https://restaurant.com"><button class="primary">Research</button></form><div id="dynRestaurantUrlStatus"></div>`);
    const form=$q('#dynRestaurantUrlForm');if(form)form.onsubmit=async e=>{e.preventDefault();const url=new FormData(e.currentTarget).get('url'),box=$q('#dynRestaurantUrlStatus'),validated=publicHttpUrl(url);if(!validated){if(box)box.innerHTML='<div class="callout">Use a public http/https restaurant website. Local/private-network addresses are not accepted.</div>';return}if(intent.venue){state.venueSiteCache[cacheKey(intent.venue)]={url:validated.href,ts:Date.now(),learned:true};save()}if(box)box.innerHTML='<div class="scan-status"><span class="spinner"></span> Reading the official site…</div>';let hit=null;try{hit=await researchSpecificOfficialSite(validated.href,intent,m=>{if(box)box.innerHTML=`<div class="scan-status"><span class="spinner"></span> ${safeEsc(m)}</div>`})}catch{}if(hit)return renderFoodResults(box,[hit],intent,meal,query);if(box){box.innerHTML='<div class="callout">Veyra could not find published nutrition for that item on the supplied site. It saved the public restaurant site for future lookups, but it will not invent an exact value.</div><button id="dynUrlEstimate" class="primary" style="margin-top:10px">Build an estimate instead</button>';$q('#dynUrlEstimate')?.addEventListener('click',()=>openIngredientEstimate(intent,meal))}};
  }

  const EST_COMPONENTS=[
    ['bread / bun',260,8,48,4,3,6],['tortilla / wrap',160,5,28,4,3,2],['rice / grain',210,5,44,2,3,1],['beans / lentils',190,12,34,2,11,2],['tofu / plant protein',180,20,7,10,4,2],['cheese',110,7,1,9,0,0],['vegetables',60,3,12,1,4,6],['sauce / dressing',120,2,10,9,1,6],['avocado / guacamole',160,2,9,15,7,1],['fried component',230,7,26,12,2,2],['dessert / sweet topping',180,2,28,8,1,20]
  ];
  function openIngredientEstimate(intent,meal){
    openModal('Build an estimate',`<p class="muted">Choose only what was actually in <b>${safeEsc(intent.item)}</b>. This creates an editable estimate — not a claim that the restaurant published these numbers.</p><div class="fi-component-grid">${EST_COMPONENTS.map((x,i)=>`<label class="fi-component"><input type="checkbox" value="${i}"><span><b>${safeEsc(title(x[0]))}</b><small>Typical component • ${x[1]} kcal • ${x[2]}g protein</small></span></label>`).join('')}</div><button id="dynBuildEstimate" class="primary full" style="margin-top:12px">Review estimated nutrition</button>`);
    $q('#dynBuildEstimate').onclick=()=>{const chosen=$qa('.fi-component input:checked').map(x=>EST_COMPONENTS[+x.value]);if(!chosen.length)return toast('Choose at least one component');const sum=i=>round(chosen.reduce((a,x)=>a+x[i],0));const item={name:title(intent.item),brand:intent.venue||'',cal:sum(1),p:sum(2),c:sum(3),f:sum(4),fiber:sum(5),sugar:sum(6),servingLabel:'1 estimated order',source:'Veyra ingredient-composition estimate — review required',confidence:50,notes:`Estimated from: ${chosen.map(x=>x[0]).join(', ')}`};closeModal();addFoodModal(meal,{...item,meal,time:nowTime(),quantity:1})}
  }

  async function resolveFood(query,meal,box,status){
    const intent=parseFoodIntent(query);meal=meal||intent.meal;const key=cacheKey(query),cached=state.liveFoodCache[key];
    if(cached&&Date.now()-cached.ts<14*864e5){renderFoodResults(box,[...memorySearch(query),...(cached.rows||[])],intent,meal,query);return}
    const mem=memorySearch(query);status?.('Searching live public nutrition sources…');
    let off=[],usda=[],gateway=[],official=null;
    const sourceQuery=intent.venue?`${intent.item} ${intent.venue}`:intent.item;
    const p0=gatewaySearch(sourceQuery).catch(()=>[]),p1=offSearch(sourceQuery).catch(()=>[]),p2=usdaSearch(sourceQuery).catch(()=>[]);
    [gateway,off,usda]=await Promise.all([p0,p1,p2]);
    gateway=venueAwarePublic(gateway,intent);off=venueAwarePublic(off,intent);usda=venueAwarePublic(usda,intent);
    const strong=[...gateway,...off,...usda].some(x=>x._score>=68&&(!intent.venue||x._venueMatch));
    if(intent.venue&&!strong){try{official=await officialSiteResearch(intent,m=>status?.(m))}catch{}}
    const rows=dedupeFood([...gateway,...off,...usda,...(official?[official]:[])],sourceQuery);
    state.liveFoodCache[key]={ts:Date.now(),rows:rows.slice(0,10).map(({image,...x})=>x)};save();
    renderFoodResults(box,[...mem,...rows],intent,meal,query);
  }

  function openLiveFoodSearch(prefill='',meal='Snack'){
    openModal('Veyra Live Food Resolver',`<div class="fi-search-hero"><span>🌐</span><div><span class="eyebrow">DYNAMIC • REVIEW-FIRST</span><h2>Tell Veyra what you actually had</h2><p>Common food, obscure brand, restaurant item, or local dish. Veyra keeps looking instead of stopping at a fixed list.</p></div></div><form id="dynFoodForm" class="food-search-top"><input id="dynFoodInput" value="${safeEsc(prefill)}" placeholder="e.g., truffle mushroom pizza from a restaurant" autofocus><button class="primary">Resolve</button></form><div class="fi-search-tools"><button id="dynFoodVoice" class="secondary">🎙 Say it</button><button id="dynFoodBarcode" class="secondary">▦ Barcode</button><button id="dynFoodLens" class="secondary">📸 Meal / label photo</button></div><div id="dynFoodResults" style="margin-top:14px"><div class="empty-state-v2"><div class="icon">🌐</div><h3>Not limited to a preset menu</h3><p>If Veyra does not already know the item, it checks live public nutrition data and, for restaurant queries, can research a discoverable official site before falling back to a clearly labeled estimate.</p></div></div>`);
    const run=()=>{const input=$q('#dynFoodInput'),q=input?.value.trim();if(!q)return;const box=$q('#dynFoodResults');box.innerHTML='<div class="scan-status"><span class="spinner"></span> <span id="dynFoodStatus">Searching…</span></div>';resolveFood(q,meal,box,m=>{const s=$q('#dynFoodStatus');if(s)s.textContent=m}).catch(()=>renderFoodResults(box,[],parseFoodIntent(q),meal,q))};
    $q('#dynFoodForm').onsubmit=e=>{e.preventDefault();run()};$q('#dynFoodVoice').onclick=()=>{closeModal();startVoice()};$q('#dynFoodBarcode').onclick=()=>{closeModal();action('barcode')};$q('#dynFoodLens').onclick=()=>{closeModal();action('lens')};if(prefill)setTimeout(run,30);
  }

  /* ---------------- Procedural pantry recipe engine ---------------- */
  const NUTR={
    tofu:[144,17,3,9,2,1,'protein','150 g'],tempeh:[195,20,8,11,6,0,'protein','100 g'],paneer:[265,18,3,20,0,2,'protein','100 g'],seitan:[141,25,12,2,1,1,'protein','100 g'],edamame:[188,18,14,8,8,3,'protein','1 cup'],
    'black beans':[227,15,41,1,15,1,'protein','1 cup'],beans:[220,14,40,1,13,2,'protein','1 cup'],chickpeas:[269,15,45,4,12,8,'protein','1 cup'],lentils:[230,18,40,1,16,4,'protein','1 cup'],
    'greek yogurt':[130,23,9,1,0,7,'protein','1 cup'],yogurt:[150,12,15,4,0,10,'protein','1 cup'],'cottage cheese':[180,24,8,5,0,6,'protein','1 cup'],cheese:[115,7,1,9,0,0,'protein','1 oz'],
    rice:[205,4,45,0,1,0,'carb','1 cup cooked'],'brown rice':[216,5,45,2,4,1,'carb','1 cup cooked'],quinoa:[222,8,39,4,5,2,'carb','1 cup cooked'],pasta:[220,8,43,1,3,1,'carb','1 cup cooked'],noodles:[220,7,40,4,2,2,'carb','1 cup cooked'],oats:[150,5,27,3,4,1,'carb','1/2 cup dry'],potato:[160,4,37,0,4,2,'carb','1 medium'],tortilla:[140,4,24,4,2,1,'wrap','1 tortilla'],bread:[150,6,28,2,3,3,'wrap','2 slices'],naan:[260,9,45,5,2,4,'wrap','1 naan'],
    spinach:[30,4,5,0,4,1,'veg','2 cups'],broccoli:[55,4,11,1,5,2,'veg','1 cup'],pepper:[35,1,8,0,3,5,'veg','1 cup'],peppers:[35,1,8,0,3,5,'veg','1 cup'],tomato:[32,2,7,0,2,5,'veg','1 cup'],onion:[46,1,11,0,2,5,'veg','1 cup'],cucumber:[30,1,7,0,1,3,'veg','1 cup'],mushrooms:[30,4,4,0,1,2,'veg','1.5 cups'],carrot:[50,1,12,0,4,6,'veg','1 cup'],corn:[130,5,29,2,4,9,'veg','1 cup'],lettuce:[15,1,3,0,1,1,'veg','2 cups'],
    salsa:[40,2,8,0,2,5,'sauce','1/2 cup'],'tomato sauce':[70,2,13,2,3,8,'sauce','1/2 cup'],'soy sauce':[18,2,2,0,0,1,'sauce','1 tbsp'],'peanut sauce':[90,3,6,7,1,3,'sauce','2 tbsp'],hummus:[140,5,12,9,4,1,'sauce','1/3 cup'],guacamole:[150,2,8,13,6,1,'sauce','1/2 cup'],
    apple:[95,1,25,0,4,19,'fruit','1 medium'],banana:[105,1,27,0,3,14,'fruit','1 medium'],berries:[80,1,18,1,8,10,'fruit','1 cup']
  };
  const CAT_PATTERNS={protein:/tofu|tempeh|paneer|seitan|edamame|beans?|chickpeas?|lentils?|dal\b|yogurt|cottage cheese|cheese|protein|soy curls|tvp|crumbles/i,carb:/rice|quinoa|pasta|noodles?|oats?|potato|couscous|barley|farro|grain/i,wrap:/tortilla|bread|naan|pita|wrap|bun/i,veg:/spinach|broccoli|pepper|tomato|onion|cucumber|mushroom|carrot|corn|lettuce|cabbage|zucchini|cauliflower|peas?|vegetable|greens?/i,sauce:/salsa|sauce|hummus|guac|dressing|pesto|chutney|tahini|soy sauce|hot sauce/i,fruit:/apple|banana|berries|mango|orange|grape|pineapple|fruit/i,spice:/spice|masala|cumin|turmeric|paprika|pepper powder|chili|curry powder|garam|oregano|basil|cilantro|parsley|garlic|ginger/i};
  function inferredCategory(x,name=''){const n=norm(name);for(const [cat,re] of Object.entries(CAT_PATTERNS))if(re.test(n))return cat;if(num(x.p)>=12&&num(x.p)*4>=num(x.cal)*.2)return 'protein';if(num(x.c)>=25&&num(x.cal)>=120)return 'carb';if(num(x.cal)<=100&&num(x.c)<=20&&num(x.fiber)>=2)return 'veg';return 'other'}
  function nutrientProfile(name){const n=norm(name),intel=state.pantryIntel?.[n];if(intel?.cal>0)return {...intel,cat:intel.cat||inferredCategory(intel,name),amount:intel.servingLabel||'1 resolved serving',known:true};for(const [k,v] of Object.entries(NUTR))if(n.includes(k))return {cal:v[0],p:v[1],c:v[2],f:v[3],fiber:v[4],sugar:v[5],cat:v[6],amount:v[7],known:true};for(const [cat,re] of Object.entries(CAT_PATTERNS))if(re.test(n))return {cal:cat==='protein'?170:cat==='carb'?190:cat==='wrap'?145:cat==='sauce'?70:cat==='fruit'?90:cat==='veg'?40:5,p:cat==='protein'?13:cat==='carb'?5:cat==='wrap'?4:cat==='veg'?2:1,c:cat==='protein'?12:cat==='carb'?38:cat==='wrap'?25:cat==='fruit'?22:cat==='veg'?9:4,f:cat==='protein'?7:cat==='sauce'?5:2,fiber:cat==='protein'?6:cat==='veg'?4:cat==='fruit'?4:2,sugar:cat==='fruit'?12:cat==='veg'?4:2,cat,amount:'1 practical serving',known:false};return {cal:0,p:0,c:0,f:0,fiber:0,sugar:0,cat:'other',amount:'to taste / practical amount',known:false}}
  async function enrichPantryIntelligence(status){
    const unknown=uniq((state.pantry||[]).filter(name=>{const p=nutrientProfile(name);return !p.known||p.cal<=0})).slice(0,6);
    if(!unknown.length)return;
    status?.(`Understanding ${unknown.length} pantry ingredient${unknown.length===1?'':'s'}…`);
    await Promise.all(unknown.map(async name=>{
      try{
        let rows=await offSearch(name).catch(()=>[]),best=rows.find(x=>x.cal>0&&x._score>=35);
        if(!best){rows=await usdaSearch(name).catch(()=>[]);best=rows.find(x=>x.cal>0&&x._score>=35)}
        if(best)state.pantryIntel[norm(name)]={cal:best.cal,p:best.p,c:best.c,f:best.f,fiber:best.fiber,sugar:best.sugar,cat:inferredCategory(best,name),servingLabel:best.servingLabel||'1 resolved serving',source:best.source,confidence:best.confidence,ts:Date.now()};
      }catch{}
    }));
    save();
  }

  function pantryItems(){return uniq((state.pantry||[]).map(x=>String(x).trim())).map(name=>({name,...nutrientProfile(name)}))}
  function restrictionBlocks(name,diet){const n=norm(name),all=norm([state.profile?.foodsAvoid,...(state.profile?.dietaryRestrictions||[])].join(' '));if((diet||'').toLowerCase()==='vegan'&&/paneer|cheese|milk|yogurt|butter|egg|meat|chicken|beef|pork|fish/i.test(n))return true;if((diet||'').toLowerCase()==='vegetarian'&&/chicken|beef|pork|fish|shrimp|turkey|bacon|meat/i.test(n))return true;if(/dairy|lactose/.test(all)&&/paneer|cheese|milk|yogurt|butter|cream/i.test(n))return true;if(/gluten|celiac/.test(all)&&/bread|naan|pita|tortilla|pasta|noodle|seitan|wheat/i.test(n))return true;if(/soy/.test(all)&&/tofu|tempeh|edamame|soy|tvp/i.test(n))return true;if(/nut|peanut/.test(all)&&/peanut|almond|cashew|walnut|nut/i.test(n))return true;return all.split(/[,;]+/).map(x=>x.replace(/^(no|avoid)\s+/,'').trim()).filter(x=>x.length>2).some(x=>n.includes(x.replace(/s$/,'')))}
  const CUISINE_WORDS={Indian:['Indian','masala','curry','tikka'],Mexican:['Mexican','taco','burrito','salsa'],Italian:['Italian','pasta','tomato','basil'],Mediterranean:['Mediterranean','hummus','herb'],Chinese:['Chinese','stir-fry','soy'],Japanese:['Japanese','rice bowl','soy'],Thai:['Thai','basil','curry'],Korean:['Korean','bowl','chili'],American:['American','skillet','sandwich'],Greek:['Greek','herb','yogurt'],Vietnamese:['Vietnamese','rice bowl','herb'],'Middle Eastern':['Middle Eastern','hummus','spiced']};
  function cuisineFor(opts,items){if(opts.cuisine)return opts.cuisine;const fav=(state.profile?.favoriteCuisines||[])[0];if(fav)return fav;if(items.some(x=>/masala|paneer|dal|chutney/i.test(x.name)))return 'Indian';if(items.some(x=>/tortilla|salsa|black beans/i.test(x.name)))return 'Mexican';if(items.some(x=>/pasta|pesto|tomato sauce/i.test(x.name)))return 'Italian';return 'Flexible'}
  function sumNutrition(items){const out={cal:0,p:0,c:0,f:0,fiber:0,sugar:0,known:0};for(const x of items){for(const k of ['cal','p','c','f','fiber','sugar'])out[k]+=num(x[k]);if(x.known)out.known++}for(const k of ['cal','p','c','f','fiber','sugar'])out[k]=round(out[k]);out.coverage=items.length?out.known/items.length:0;return out}
  function pick(items,cat,n=1){return items.filter(x=>x.cat===cat).slice(0,n)}
  function nameRecipe(cuisine,style,items){const lead=items.find(x=>x.cat==='protein')||items[0],veg=items.find(x=>x.cat==='veg'&&x!==lead);const base=[lead?.name,veg?.name].filter(Boolean).slice(0,2).map(title).join(' & ');return `${cuisine==='Flexible'?'Pantry':cuisine} ${base||'Kitchen'} ${style}`.replace(/\s+/g,' ').trim()}
  function makeRecipe(cuisine,style,used,steps,time,tag='Only your pantry',optional=[]){const n=sumNutrition(used),id='dyn-'+norm(nameRecipe(cuisine,style,used)).replace(/\s+/g,'-')+'-'+used.map(x=>norm(x.name).slice(0,6)).join('-'),names=norm(used.map(x=>x.name).join(' ')),hasAnimal=/chicken|beef|pork|turkey|fish|shrimp|bacon|meat/.test(names),hasDairyEgg=/paneer|cheese|milk|yogurt|butter|cream|egg/.test(names),diet=hasAnimal?[]:hasDairyEgg?['vegetarian']:['vegetarian','vegan'];return {id,name:nameRecipe(cuisine,style,used),emoji:style.includes('Wrap')?'🌯':style.includes('Pasta')?'🍝':style.includes('Salad')?'🥗':style.includes('Soup')?'🍲':style.includes('Bowl')?'🥣':'🍳',cuisine,diet,time,difficulty:time<=15?'Easy':time<=25?'Easy–Moderate':'Moderate',servings:1,mealType:'Flexible',cal:n.cal,p:n.p,c:n.c,f:n.f,fiber:n.fiber,sugar:n.sugar,ingredients:used.map(x=>`${x.amount} ${x.name}`),ingredientNames:used.map(x=>x.name),steps,tag,optionalExtras:optional,nutritionCoverage:n.coverage,_pantryRatio:1,_hits:used.map(x=>x.name),_missing:[],_dynamic:true,_score:100}}
  function proceduralRecipes(opts={}){
    const diet=(opts.diet||state.profile?.diet||'').toLowerCase(),avoid=uniq([...(opts.avoid||[]),...(String(state.profile?.foodsAvoid||'').split(/[,;]+/))]).map(norm).filter(Boolean),all=pantryItems().filter(x=>!restrictionBlocks(x.name,diet)&&!avoid.some(a=>norm(x.name).includes(a)||a.includes(norm(x.name))));if(!all.length)return [];
    const proteins=pick(all,'protein',4),carbs=pick(all,'carb',3),wraps=pick(all,'wrap',2),vegs=pick(all,'veg',5),sauces=pick(all,'sauce',2),fruits=pick(all,'fruit',2),spices=pick(all,'spice',3),other=all.filter(x=>!['protein','carb','wrap','veg','sauce','fruit','spice'].includes(x.cat)).slice(0,3),cuisine=cuisineFor(opts,all),basics=state.recipePreferences?.allowBasics!==false;
    const recs=[];const choose=(...groups)=>uniq(groups.flat().filter(Boolean).map(x=>x.name)).map(n=>all.find(x=>x.name===n)).filter(Boolean);
    if(proteins.length&&vegs.length){const used=choose(proteins[0],...vegs.slice(0,2),carbs[0],sauces[0],...spices.slice(0,2));recs.push(makeRecipe(cuisine,'Skillet',used,[`Prep ${used.map(x=>x.name).join(', ')}.`,`Cook the firmer ingredients first, then add quicker-cooking ingredients.`,sauces[0]?`Finish with ${sauces[0].name} and adjust the amount to taste.`:'Cook together and serve; add seasoning only if it is already listed in your pantry.'],16))}
    if((carbs.length||wraps.length)&&proteins.length){const base=carbs[0]||wraps[0],used=choose(base,proteins[0],...vegs.slice(0,2),sauces[0],...spices.slice(0,1));recs.push(makeRecipe(cuisine,wraps.includes(base)?'Wrap':'Bowl',used,[`Prepare ${base.name} as the base.`,`Heat or cook ${proteins[0].name} with ${vegs.slice(0,2).map(x=>x.name).join(' and ')||'your pantry vegetables'}.`,`Assemble everything${sauces[0]?` with ${sauces[0].name}`:''}.`],14))}
    const pasta=all.find(x=>/pasta|noodle/i.test(x.name));if(pasta){const used=choose(pasta,proteins[0],...vegs.slice(0,2),sauces[0],...spices.slice(0,2));recs.push(makeRecipe(cuisine==='Flexible'?'Italian':cuisine,'Pasta',used,[`Cook ${pasta.name}.`,`Cook the remaining pantry ingredients in a separate pan.`,sauces[0]?`Combine with ${sauces[0].name}; add any listed pantry spice if desired.`:'Combine and serve; no unlisted seasoning is required.'],20))}
    if(vegs.length>=2){const used=choose(...vegs.slice(0,3),proteins[0],sauces[0],fruits[0]);recs.push(makeRecipe(cuisine,'Salad Bowl',used,[`Chop ${vegs.slice(0,3).map(x=>x.name).join(', ')}.`,proteins[0]?`Add ${proteins[0].name} for the protein component.`:'Combine the vegetables into a substantial bowl.',sauces[0]?`Use ${sauces[0].name} as the dressing component.`:'Serve as-is; use a dressing only if one is already listed in your pantry.'],10))}
    if(basics&&all.length>=3){const used=choose(proteins[0],carbs[0],...vegs.slice(0,3),...spices.slice(0,2));recs.push(makeRecipe(cuisine,'Soup',used,[`Add the sturdier pantry ingredients to a pot with water.`,`Simmer until everything is tender.`,`Add quick-cooking ingredients near the end and season with pantry spices.`],25,'Only your pantry + water'))}
    if(wraps.length){const used=choose(wraps[0],proteins[0],...vegs.slice(0,2),sauces[0]);recs.push(makeRecipe(cuisine,'Wrap',used,[`Warm ${wraps[0].name}.`,`Cook or warm the filling ingredients.`,`Fill, fold, and serve${sauces[0]?` with ${sauces[0].name}`:''}.`],12))}
    if(carbs.some(x=>/potato/i.test(x.name))){const potato=carbs.find(x=>/potato/i.test(x.name)),used=choose(potato,proteins[0],...vegs.slice(0,2),sauces[0]);recs.push(makeRecipe(cuisine,'Hash',used,[`Dice and cook ${potato.name} until tender and browned.`,`Add the remaining pantry ingredients.`,`Cook together until hot; use only seasonings already included from your pantry.`],22))}
    if(!recs.length){const used=all.slice(0,Math.min(5,all.length));recs.push(makeRecipe(cuisine,'Pantry Medley',used,[`Prep ${used.map(x=>x.name).join(', ')}.`,`Use the cooking method that fits the ingredients: sauté, roast, simmer, or assemble cold.`,`Taste and adjust using only seasonings already in your pantry.`],18))}
    const equipment=(opts.equipment||[]).map(norm),mealType=norm(opts.mealType||''),taste=norm(opts.taste||''),difficulty=norm(opts.difficulty||'');
    if(equipment.includes('air fryer')&&(proteins.length||vegs.length)){
      const used=choose(proteins[0],...vegs.slice(0,3),sauces[0],...spices.slice(0,2));
      if(used.length)recs.unshift(makeRecipe(cuisine,'Air Fryer Tray',used,[`Prep ${used.map(x=>x.name).join(', ')} into air-fryer-friendly pieces.`,`Air fry in batches as needed, checking that ingredients which require cooking are fully cooked before serving.`,sauces[0]?`Finish with ${sauces[0].name}.`:'Finish only with seasonings already in your pantry.'],18));
    }
    if(equipment.includes('microwave')&&(carbs.length||proteins.length||vegs.length)){
      const used=choose(carbs[0],proteins[0],...vegs.slice(0,2),sauces[0]);
      if(used.length)recs.unshift(makeRecipe(cuisine,'Microwave Bowl',used,[`Place suitable pantry ingredients in a microwave-safe bowl.`,`Heat in short intervals, stirring between intervals, until ingredients that require cooking are fully cooked.`,sauces[0]?`Finish with ${sauces[0].name}.`:'Serve using only listed pantry ingredients.'],12));
    }
    if(mealType==='breakfast'){
      const breakfast=all.filter(x=>/oat|cereal|yogurt|fruit|banana|berry|bread|toast|granola|milk|protein|tofu|potato/i.test(x.name)||['fruit','protein','carb'].includes(x.cat)).slice(0,5);
      if(breakfast.length>=2)recs.unshift(makeRecipe(cuisine,'Breakfast Bowl',breakfast,[`Prepare ${breakfast.map(x=>x.name).join(', ')} in the way appropriate for each ingredient.`,`Combine into a breakfast bowl using only the listed pantry ingredients.`,`Adjust texture or seasoning only with pantry items already listed.`],12));
    }
    for(const r of recs){
      if(opts.mealType)r.mealType=title(opts.mealType);
      if(opts.difficulty)r.requestedDifficulty=opts.difficulty;
      if(opts.taste)r.taste=opts.taste;
      if((opts.equipment||[]).length)r.equipment=[...(opts.equipment||[])];
      if(taste==='spicy'&&spices.length)r.steps=[...r.steps,`For a spicier finish, use ${spices.slice(0,2).map(x=>x.name).join(' or ')} from your pantry to taste.`];
      if(taste==='mild')r.steps=[...r.steps,'Keep stronger pantry seasonings light and adjust gradually to taste.'];
    }
    if(equipment.includes('no cook')){
      const unsafeRaw=/\b(chicken|beef|pork|turkey|raw fish|raw shrimp|raw meat)\b/i;
      for(let i=recs.length-1;i>=0;i--){if(!/Salad|Wrap/.test(recs[i].name)||recs[i].ingredientNames.some(x=>unsafeRaw.test(x)))recs.splice(i,1);}
    }
    if(['easy','quick','simple'].includes(difficulty)){for(let i=recs.length-1;i>=0;i--)if(recs[i].time>20)recs.splice(i,1)}
    const profileCook=String(state.profile?.cookingTime||'').match(/(\d{1,3})/);
    const maxCal=num(opts.maxCal)||Infinity,minProtein=num(opts.minProtein)||0,maxTime=num(opts.time)||(profileCook?+profileCook[1]:Infinity);
    let filtered=recs.filter(r=>r.time<=maxTime&&r.cal<=maxCal&&r.p>=minProtein);
    if(!filtered.length&&minProtein>0){filtered=recs.map(r=>{if(r.p>=minProtein)return r;const pItem=proteins[0];if(!pItem)return r;const factor=clamp(minProtein/Math.max(r.p,1),1,1.7);return {...r,name:r.name+' — Protein Boost',cal:round(r.cal+(factor-1)*pItem.cal),p:round(r.p+(factor-1)*pItem.p),c:round(r.c+(factor-1)*pItem.c),f:round(r.f+(factor-1)*pItem.f),ingredients:r.ingredients.map(x=>x.includes(pItem.name)?`${round(factor)}× ${pItem.amount} ${pItem.name}`:x),tag:'Only your pantry • adjusted portion'}}).filter(r=>r.time<=maxTime&&r.cal<=maxCal&&r.p>=minProtein)}
    const final=filtered.length?filtered:(minProtein>0?[]:recs.filter(r=>r.time<=maxTime&&r.cal<=maxCal));for(const r of final)state.generatedRecipes[r.name]=r;save();return final.slice(0,10)
  }

  const legacyRecipeLibrary=typeof recipeLibrary==='function'?recipeLibrary:null;
  recipeLibrary=function(){const dyn=Object.values(state.generatedRecipes||{}),legacy=legacyRecipeLibrary?legacyRecipeLibrary():[];const seen=new Set();return [...dyn,...legacy].filter(x=>x?.name&&!seen.has(x.name)&&seen.add(x.name))};
  recipeMatches=function(opts={}){
    const pantry=(state.pantry||[]).length>0;if(pantry){const dyn=proceduralRecipes(opts);if(dyn.length||opts.requirePantry)return dyn}
    const legacy=[];const maxCal=num(opts.maxCal)||Infinity,minP=num(opts.minProtein)||0,cuisine=norm(opts.cuisine||'');return legacy.filter(r=>r.cal<=maxCal&&r.p>=minP&&(!cuisine||norm(r.cuisine)===cuisine)).map(r=>({...r,_pantryRatio:0,_dynamic:false,_score:10})).slice(0,10)
  };

  function recipeCard(r){return `<button class="recipe-card dyn-recipe-card" data-recipe="${safeEsc(r.name)}"><div class="recipe-art">${r.emoji||'🍲'}</div><div class="recipe-body"><span class="confidence">${safeEsc(r.tag||'Dynamic idea')}</span><h3>${safeEsc(r.name)}</h3><div class="recipe-meta">${safeEsc(r.cuisine||'Flexible')} • ${r.time||'—'} min${r.cal?` • ~${r.cal} kcal`:''}${r.p?` • ~${r.p}g protein`:''}</div><div class="recipe-fit"><span class="fit-chip good">${r._dynamic?'Only your pantry':'Idea — review ingredients'}</span>${r.nutritionCoverage!=null&&r.nutritionCoverage<.75?'<span class="fit-chip">Nutrition partly estimated</span>':''}</div></div></button>`}
  function dynamicRecipesView(){
    const recs=(state.pantry||[]).length?proceduralRecipes({}):recipeMatches({});
    return hero('Smart Recipes','Build from what you actually have.','Veyra now composes recipes from your pantry instead of asking a fixed recipe library for the nearest match.',`<button class="primary" data-action="recipeFinder">✨ Build from my pantry</button><button class="secondary" data-route="pantry">Edit pantry</button><button class="secondary" data-action="pantryCamera">📸 Scan ingredients</button>`)+`
      <div class="card"><div class="card-head"><div><h2>Dynamic recipe mode</h2><small>${state.pantry.length?'Every pantry-only idea below uses ingredients you already entered.':'Add pantry ingredients to unlock pantry-only generation.'}</small></div></div><div class="preference-grid"><div class="preference-card"><small>Mode</small><b>${state.recipePreferences.mode==='extras'?'Pantry + optional extras':'Pantry only'}</b></div><div class="preference-card"><small>Pantry</small><b>${state.pantry.length} ingredient${state.pantry.length===1?'':'s'}</b></div><div class="preference-card"><small>Basics</small><b>${state.recipePreferences.allowBasics?'Water / salt allowed':'Nothing assumed'}</b></div></div></div>
      <div class="section-title"><div><h2>${state.pantry.length?'What you can make now':'Ideas until you add a pantry'}</h2><p>${state.pantry.length?'No “20% match.” No required shopping trip.':'Add pantry ingredients to generate recipes from what you actually have.'}</p></div></div>${recs.length?`<div class="recipe-grid">${recs.map(recipeCard).join('')}</div>`:`<div class="card"><div class="empty-state-v2"><div class="icon">🧺</div><h3>Add a few ingredients</h3><p>Then Veyra can construct meals from those ingredients instead of searching a preset list.</p><button class="primary" data-route="pantry">Open Pantry</button></div></div>`}`;
  }
  function dynamicPantryView(){const recs=state.pantry.length?proceduralRecipes({}):[];return hero('Pantry Mode','Your ingredients become the recipe engine.','Add what is actually in your kitchen. Pantry-only generation never turns missing ingredients into required groceries.',`<button class="primary" data-action="pantryCamera">📸 Scan ingredients</button><button class="secondary" data-action="recipeFinder">✨ Make something now</button>`)+`<div class="card"><form id="pantryForm" class="inline-form"><input id="pantryInput" placeholder="Add any ingredient — not just a preset item"><button class="primary">Add</button></form><div class="chip-list">${state.pantry.map((x,i)=>`<button class="chip" data-pantryremove="${i}">${safeEsc(x)} ×</button>`).join('')}</div>${!state.pantry.length?'<div class="empty-state-v2"><div class="icon">🧺</div><h3>Your pantry is empty</h3><p>Add whatever you actually have. Veyra will classify and combine it dynamically.</p></div>':''}</div>${state.pantry.length?`<div class="section-title"><div><h2>Pantry-only ideas</h2><p>These are composed from the ingredients above — not matched against a fixed recipe list.</p></div></div><div class="recipe-grid">${recs.slice(0,6).map(recipeCard).join('')}</div>`:''}`}

  function parseRecipeRequest(text){
    const s=String(text||''),lower=s.toLowerCase(),cuisines=Object.keys(CUISINE_WORDS);
    const cuisine=cuisines.find(c=>lower.includes(c.toLowerCase()))||'';
    const max=(s.match(/(?:under|below|max(?:imum)?)[^0-9]{0,10}(\d{2,4})\s*(?:cal|kcal|calories)?/i)||[])[1];
    const protein=(s.match(/(?:at least|min(?:imum)?|over|\+)[^0-9]{0,10}(\d{1,3})\s*g?\s*protein/i)||[])[1]||(s.match(/(\d{1,3})\s*g\+?\s*protein/i)||[])[1];
    const time=(s.match(/(?:under|within|max(?:imum)?)[^0-9]{0,10}(\d{1,3})\s*(?:min|minutes)/i)||[])[1]||(s.match(/(?:^|[,;]|\b)\s*(\d{1,3})\s*(?:min|minutes)\b/i)||[])[1];
    const mealType=(lower.match(/\b(breakfast|lunch|dinner|snack)\b/)||[])[1]||'';
    const difficulty=(lower.match(/\b(easy|quick|simple|medium|moderate|hard|advanced)\b/)||[])[1]||'';
    const taste=(lower.match(/\b(spicy|mild|savory|sweet|fresh|creamy|crispy|comfort(?:ing)?|light)\b/)||[])[1]||'';
    const equipment=[];for(const e of ['air fryer','microwave','oven','stove','blender','slow cooker','instant pot','grill','no-cook'])if(lower.includes(e))equipment.push(e);
    const avoid=[];for(const m of s.matchAll(/\b(?:no|without|avoid)\s+([a-z][a-z -]{1,35})(?=,|\.|;|\band\b|$)/ig))avoid.push(m[1].trim());
    const diet=/\bvegan\b/i.test(s)?'vegan':/\bvegetarian\b/i.test(s)?'vegetarian':/\bpescatarian\b/i.test(s)?'pescatarian':state.profile?.diet||'';
    return {cuisine,maxCal:max?+max:Infinity,minProtein:protein?+protein:0,time:time?+time:Infinity,diet,mealType,difficulty,taste,equipment,avoid:uniq(avoid)};
  }
  function openRecipeBuilder(prefill=''){
    openModal('Build from my pantry',`<div class="callout"><b>Pantry-only is a hard constraint.</b><br>Veyra constructs a meal from the ingredients you actually have. Water/salt can be allowed as basics; no other missing ingredient is silently required.</div><form id="dynRecipeForm" class="form-grid"><label style="grid-column:1/-1">Describe what you want<input name="request" value="${safeEsc(prefill)}" placeholder="Indian vegetarian, only my pantry, 25g+ protein, under 500 calories, 20 min"></label><label>Mode<select name="mode"><option value="pantry-only" ${state.recipePreferences.mode!=='extras'?'selected':''}>Use ONLY my pantry</option><option value="extras" ${state.recipePreferences.mode==='extras'?'selected':''}>Pantry + optional extras</option></select></label><label class="switch-label"><input name="basics" type="checkbox" ${state.recipePreferences.allowBasics?'checked':''}> Allow water / salt as basics</label><button class="primary" style="grid-column:1/-1">Construct recipes</button></form><div id="dynRecipeResults"></div>`);
    $q('#dynRecipeForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));state.recipePreferences.mode=d.mode;state.recipePreferences.allowBasics=!!d.basics;const box=$q('#dynRecipeResults');if(box)box.innerHTML='<div class="scan-status"><span class="spinner"></span> Understanding your pantry…</div>';await enrichPantryIntelligence(m=>{if(box)box.innerHTML=`<div class="scan-status"><span class="spinner"></span> ${safeEsc(m)}</div>`});const opts=parseRecipeRequest(d.request||'');let rows=proceduralRecipes(opts);if(d.mode==='extras'&&rows.length){rows=rows.map(r=>({...r,optionalExtras:uniq([...(r.optionalExtras||[]),...suggestOptionalExtras(r.cuisine,r.ingredientNames)]).slice(0,3),tag:'Pantry core • extras optional'}))}save();if(!box)return;box.innerHTML=rows.length?`<div class="food-results" style="margin-top:12px">${rows.map(r=>`<button class="food-result dyn-builder-recipe" data-name="${safeEsc(r.name)}"><span class="fallback-food-img">${r.emoji}</span><span><b>${safeEsc(r.name)}</b><small>${safeEsc(r.cuisine)} • ${r.time} min • ~${r.cal} kcal • ~${r.p}g protein</small><small>${d.mode==='extras'&&r.optionalExtras?.length?`Optional only: ${safeEsc(r.optionalExtras.join(', '))}`:'Requires no additional groceries'}</small></span><span>View ›</span></button>`).join('')}</div>`:`<div class="callout" style="margin-top:12px">Those constraints cannot all be met from the current pantry${opts.minProtein?` at ${opts.minProtein}g+ protein`:''}${Number.isFinite(opts.maxCal)?` under ${opts.maxCal} kcal`:''}${Number.isFinite(opts.time)?` within ${opts.time} min`:''}. Veyra did not invent a missing ingredient or quietly ignore a numeric constraint. Add an ingredient or loosen one constraint.</div>`;$qa('.dyn-builder-recipe').forEach(b=>b.onclick=()=>openDynamicRecipe(b.dataset.name))}
  }
  function suggestOptionalExtras(cuisine,used){const map={Indian:['cilantro','lemon','plain yogurt'],Mexican:['lime','cilantro','salsa'],Italian:['basil','parmesan','chili flakes'],Chinese:['sesame seeds','scallions','chili crisp'],Japanese:['nori','sesame seeds','scallions'],Thai:['lime','basil','peanuts'],Mediterranean:['lemon','parsley','tahini'],Greek:['lemon','oregano','feta']};return (map[cuisine]||['fresh herbs','lemon']).filter(x=>!(used||[]).some(u=>norm(u).includes(norm(x))))}
  function openDynamicRecipe(name){const r=state.generatedRecipes?.[name]||recipeMatches({}).find(x=>x.name===name)||recipeLibrary().find(x=>x.name===name);if(!r)return toast('Recipe context changed — generate it again');const dynamic=!!r._dynamic,optional=r.optionalExtras||[];openModal(name,`<div class="recipe-hero">${r.emoji||'🍲'}</div><div class="confidence-line"><b>${safeEsc(r.cuisine||'Flexible')} • ${r.time||'—'} min</b><span class="status-badge good">${r.cal?`~${r.cal} kcal • ~${r.p}g protein`:'Nutrition review needed'}</span></div>${dynamic?'<div class="callout"><b>Pantry-only construction.</b><br>Every required ingredient below came from your pantry. Amounts and nutrition are practical estimates and remain editable before logging.</div>':''}<h3>Required ingredients</h3><div class="chip-list">${(r.ingredients||[]).map(i=>`<span class="chip">${safeEsc(i)} ✓</span>`).join('')}</div>${optional.length?`<h3>Optional extras — not required</h3><div class="chip-list">${optional.map(i=>`<span class="chip">${safeEsc(i)} optional</span>`).join('')}</div>`:''}<h3>Method</h3><ol class="muted">${(r.steps||['Prep the ingredients.','Cook or assemble using the recipe style.','Taste and adjust using what you already have.']).map(s=>`<li>${safeEsc(s)}</li>`).join('')}</ol>${r.nutritionCoverage!=null&&r.nutritionCoverage<1?`<div class="callout">Nutrition is estimated from recognized pantry ingredients (${Math.round(r.nutritionCoverage*100)}% of ingredient names matched to Veyra’s local nutrition references). Review the numbers before logging.</div>`:''}<div class="stack-actions"><button id="dynCookLog" class="primary">Cook this & review nutrition</button><button id="dynFavoriteRecipe" class="secondary">${state.learning?.recipeLikes?.[r.name]?'★ Favorite':'☆ Favorite'}</button></div>`);$q('#dynCookLog').onclick=()=>{closeModal();addFoodModal('Dinner',{name:r.name,meal:'Dinner',cal:r.cal||'',p:r.p||'',c:r.c||'',f:r.f||'',fiber:r.fiber||'',sugar:r.sugar||'',servingLabel:'1 recipe serving',quantity:1,time:nowTime(),confidence:r.nutritionCoverage>=.75?82:65,source:'Veyra dynamic pantry recipe estimate'})};$q('#dynFavoriteRecipe').onclick=()=>{state.learning||={};state.learning.recipeLikes||={};state.learning.recipeLikes[r.name]=!state.learning.recipeLikes[r.name];save();toast(state.learning.recipeLikes[r.name]?'Recipe favorited':'Favorite removed')}
  }

  function startVoiceDynamic(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){
      openModal('Talk to Veyra',`<div class="voice-fallback"><div class="voice-orb">🎙️</div><p>Speech recognition is not available in this browser. Use your keyboard microphone or type the same natural-language command below.</p></div><form id="voiceFallbackDynamic" class="inline-form"><input name="text" placeholder="I had a Whopper from Burger King / make dinner from my pantry"><button class="primary">Go</button></form>`);
      const form=$q('#voiceFallbackDynamic');if(form)form.onsubmit=e=>{e.preventDefault();const t=new FormData(e.currentTarget).get('text');closeModal();window.handleCommand(t)};return;
    }
    const r=new SR();r.lang='en-US';r.interimResults=true;
    openModal('Talk to Veyra',`<div class="voice-fallback"><div class="voice-orb listening">🎙️</div><h3>Listening…</h3><p id="voiceTranscriptDynamic">Say what you ate, ask for a pantry recipe, start a workout, or ask Veyra a question.</p></div>`);
    r.onresult=e=>{const text=[...e.results].map(x=>x[0].transcript).join(' ');const out=$q('#voiceTranscriptDynamic');if(out)out.textContent=text;if(e.results[e.results.length-1].isFinal)setTimeout(()=>{closeModal();window.handleCommand(text)},180)};
    r.onerror=()=>{closeModal();toast('Voice input ended')};r.start();
  }

  /* ---------------- Integration hooks ---------------- */
  const previousAction=window.action;
  window.action=action=function(a){
    if(a==='addFood'||a==='foodSearch'||a==='restaurant')return openLiveFoodSearch('', 'Snack');
    if(a==='recipeFinder')return openRecipeBuilder();
    if(a==='voice')return startVoiceDynamic();
    return previousAction?previousAction(a):undefined;
  };
  const previousHandle=window.handleCommand;
  window.handleCommand=handleCommand=function(text){const s=String(text||'').trim(),l=s.toLowerCase();if(!s)return;if(/\b(?:i\s+)?(?:ate|had|just ate|just had)\b/.test(l)){const intent=parseFoodIntent(s);return openLiveFoodSearch(s,intent.meal)}if(/\b(?:log|add)\b.*\b(?:food|meal|breakfast|lunch|dinner|snack)\b/.test(l))return openLiveFoodSearch(s);if(/\b(?:recipe|cook|make|meal idea|what can i make)\b/.test(l)&&(/\bpantry\b/.test(l)||(state.pantry||[]).length))return openRecipeBuilder(s);if(/\bpantry\b/.test(l)&&/\b(?:only|use|dinner|lunch|breakfast|meal|eat)\b/.test(l))return openRecipeBuilder(s);return previousHandle?previousHandle(s):undefined};
  window.startVoice=startVoice=startVoiceDynamic;
  window.smartFoodSearch=smartFoodSearch=function(prefill='',meal='Snack'){return openLiveFoodSearch(prefill,meal)};
  window.openRecipe=openRecipe=openDynamicRecipe;
  window.VeyraDynamicFood={version:VERSION,parseFoodIntent,parsePublishedNutrition,genericDishEstimate,publicHttpUrl,venueMatchScore,venueAwarePublic,offSearch,usdaSearch,officialSiteResearch,researchSpecificOfficialSite,resolveFood,gatewaySearch,gatewayBase};
  window.VeyraDynamicRecipes={version:VERSION,proceduralRecipes,parseRecipeRequest,enrichPantryIntelligence,openBuilder:openRecipeBuilder,openRecipe:openDynamicRecipe};

  views.recipes=dynamicRecipesView;views.pantry=dynamicPantryView;
  const previousAboutView=views.about,previousDataView=views.data;
  if(previousAboutView)views.about=function(){return previousAboutView()+`<div class="card" style="margin-top:16px"><div class="card-head"><div><h2>Dynamic food & pantry intelligence</h2><small>What goes online — and what does not</small></div></div><div class="method-grid"><div class="method-card"><strong>Open-ended food resolver</strong><p>Veyra searches saved local food memory first, then public food sources. For a named restaurant, it can discover a public official website through Wikidata and read likely menu/nutrition pages through a keyless public web reader.</p></div><div class="method-card"><strong>No silent exactness</strong><p>Published data, public-database matches and estimates carry different sources/confidence. If exact nutrition cannot be verified, Veyra offers a reviewable estimate instead of pretending.</p></div><div class="method-card"><strong>Procedural pantry recipes</strong><p>Pantry-only recipes are assembled from the ingredients actually stored in this browser. Unknown pantry ingredients can be enriched from public nutrition sources before construction.</p></div><div class="method-card"><strong>Privacy boundary</strong><p>Personal history remains local. Online lookups send only the food/product/restaurant query or public website needed for that lookup; Veyra does not upload the user's complete fitness history.</p></div></div></div>`};
  if(previousDataView)views.data=function(){return previousDataView()+`<div class="card" style="margin-top:16px"><div class="card-head"><h2>Live resolver sources</h2><small>Used only when the user asks Veyra to look something up</small></div></div><div class="chip-list"><a class="chip" href="https://world.openfoodfacts.org/" target="_blank" rel="noopener">Open Food Facts ↗</a><a class="chip" href="https://fdc.nal.usda.gov/" target="_blank" rel="noopener">USDA FoodData Central ↗</a><a class="chip" href="https://www.wikidata.org/" target="_blank" rel="noopener">Wikidata ↗</a><a class="chip" href="https://jina.ai/reader/" target="_blank" rel="noopener">Jina Reader ↗</a></div></div>`};

  const previousBind=bind;
  bind=function(){previousBind();$qa('[data-action]').forEach(b=>b.onclick=()=>action(b.dataset.action));$qa('[data-mealadd]').forEach(b=>b.onclick=()=>openLiveFoodSearch('',b.dataset.mealadd||'Snack'));const vq=$q('#voiceQuick');if(vq)vq.onclick=startVoiceDynamic;const cf=$q('#coachForm');if(cf&&!cf.dataset.dynamicFoodHook){cf.dataset.dynamicFoodHook='1';cf.addEventListener('submit',e=>{const q=$q('#coachInput')?.value?.trim()||'';const foodStatement=/\b(?:i\s+)?(?:ate|had|just ate|just had)\b/i.test(q)||/\b(?:log|add)\b.*\b(?:food|meal|breakfast|lunch|dinner|snack)\b/i.test(q),recipeStatement=(/\b(?:recipe|cook|make|meal idea|what can i make)\b/i.test(q)&&(/\bpantry\b/i.test(q)||(state.pantry||[]).length))||(/\bpantry\b/i.test(q)&&/\b(?:only|use|dinner|lunch|breakfast|meal|eat)\b/i.test(q));if(foodStatement||recipeStatement){e.preventDefault();e.stopImmediatePropagation();if(foodStatement){const intent=parseFoodIntent(q);openLiveFoodSearch(q,intent.meal)}else openRecipeBuilder(q)}},true)}$qa('.recipe-card[data-recipe],.coach-recipe[data-name],.finder-recipe[data-name],.nexus-plan-item[data-recipe]').forEach(b=>b.onclick=e=>{e.stopPropagation();openDynamicRecipe(b.dataset.recipe||b.dataset.name)});const pf=$q('#pantryForm');if(pf)pf.onsubmit=e=>{e.preventDefault();const input=$q('#pantryInput');const v=input?.value.trim();if(v&&!state.pantry.some(x=>norm(x)===norm(v))){state.pantry.push(v);state.pantryRecents=uniq([v,...(state.pantryRecents||[])]).slice(0,18);save();render();toast(`${v} added`)}else if(v)toast('That ingredient is already in your pantry')};$qa('[data-pantryremove]').forEach(b=>b.onclick=()=>{state.pantry.splice(+b.dataset.pantryremove,1);save();render()})};

  const previousRender=render;
  render=function(){previousRender();document.querySelectorAll('.nexus-plan-item p,.recipe-fit,.food-result small,.bubble').forEach(el=>{if(el.childElementCount)return;el.textContent=el.textContent.replace(/\b100% pantry match\b/gi,'Only your pantry').replace(/\b\d+% pantry match\b/gi,'Pantry-aware')})};

  save();render();
})();
