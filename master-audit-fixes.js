/* Veyra 3.4 master-checklist completion layer.
   Adds explicit pantry metadata/editing, richer procedural-recipe output/actions,
   saved-meal management, repeat-combination suggestions, deletion undo,
   hydration history, training coverage, and complete weekly reporting.
   Personal history remains local in the existing Veyra state/Vault. */
(()=>{
  'use strict';
  const VERSION='3.4.1';
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const num=v=>Number.isFinite(+v)?+v:0;
  const round=v=>Math.round(num(v)*10)/10;
  const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const safe=s=>typeof esc==='function'?esc(String(s??'')):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const clone=x=>typeof structuredClone==='function'?structuredClone(x):JSON.parse(JSON.stringify(x));

  state.pantryMeta ||= {};
  state.savedRecipes ||= [];
  state.shoppingList ||= [];
  state.appVersion=VERSION;

  /* ---------- Pantry metadata / editing ---------- */
  const pantryKey=name=>norm(name);
  function pantryInfo(name){
    const m=state.pantryMeta[pantryKey(name)]||{};
    return {name,qty:m.qty??'',unit:m.unit||'',category:m.category||'Other',favorite:!!m.favorite,note:m.note||''};
  }
  function setPantryInfo(name,patch={}){
    const k=pantryKey(name);state.pantryMeta[k]={...(state.pantryMeta[k]||{}),...patch,name};
  }
  function addPantryItem(name,meta={}){
    name=String(name||'').trim();if(!name)return false;
    const existing=(state.pantry||[]).find(x=>pantryKey(x)===pantryKey(name));
    if(!existing)state.pantry.push(name);
    setPantryInfo(existing||name,meta);
    state.pantryRecents=uniq([name,...(state.pantryRecents||[])]).slice(0,24);
    save();return true;
  }
  function removePantryItem(name){
    const k=pantryKey(name);state.pantry=(state.pantry||[]).filter(x=>pantryKey(x)!==k);delete state.pantryMeta[k];save();
  }
  for(const x of state.pantry||[])setPantryInfo(x,state.pantryMeta[pantryKey(x)]||{});

  function pantryEditor(existing=''){
    const x=existing?pantryInfo(existing):{name:'',qty:'',unit:'',category:'Other',favorite:false,note:''};
    openModal(existing?'Edit pantry item':'Add pantry item',`<form id="pantryAuditForm" class="form-grid">
      <label style="grid-column:1/-1">Ingredient / product<input name="name" required value="${safe(x.name)}" placeholder="Anything in your kitchen"></label>
      <label>Quantity<input name="qty" type="number" min="0" step="0.1" value="${safe(x.qty)}" placeholder="Optional"></label>
      <label>Unit<select name="unit"><option value="">Optional</option>${['count','g','kg','oz','lb','cup','tbsp','tsp','mL','L'].map(u=>`<option ${x.unit===u?'selected':''}>${u}</option>`).join('')}</select></label>
      <label>Category<select name="category">${['Protein','Grain / starch','Vegetable','Fruit','Dairy / alternative','Sauce / condiment','Snack','Frozen','Drink','Spice / seasoning','Other'].map(c=>`<option ${x.category===c?'selected':''}>${c}</option>`).join('')}</select></label>
      <label class="switch-label"><input name="favorite" type="checkbox" ${x.favorite?'checked':''}> Favorite pantry item</label>
      <label style="grid-column:1/-1">Note<input name="note" value="${safe(x.note)}" placeholder="Optional: brand, flavor, use soon…"></label>
      <button class="primary" style="grid-column:1/-1">${existing?'Save changes':'Add to pantry'}</button>
      ${existing?'<button type="button" id="pantryDeleteAudit" class="ghost danger" style="grid-column:1/-1">Remove from pantry</button>':''}
    </form>`);
    q('#pantryAuditForm').onsubmit=e=>{
      e.preventDefault();const fd=new FormData(e.currentTarget),name=String(fd.get('name')||'').trim();if(!name)return;
      if(existing&&pantryKey(existing)!==pantryKey(name))removePantryItem(existing);
      addPantryItem(name,{qty:fd.get('qty')||'',unit:fd.get('unit')||'',category:fd.get('category')||'Other',favorite:fd.get('favorite')==='on',note:fd.get('note')||''});
      closeModal();render();toast(existing?'Pantry item updated':'Added to pantry');
    };
    q('#pantryDeleteAudit')?.addEventListener('click',()=>{removePantryItem(existing);closeModal();render();toast('Removed from pantry')});
  }

  function pantryAuditView(){
    const rows=(state.pantry||[]).map(pantryInfo),favorites=rows.filter(x=>x.favorite),rec=uniq(state.pantryRecents||[]).filter(x=>!state.pantry.some(y=>pantryKey(y)===pantryKey(x))).slice(0,10);
    const recs=rows.length&&window.VeyraDynamicRecipes?.proceduralRecipes?window.VeyraDynamicRecipes.proceduralRecipes({}):[];
    const row=x=>`<div class="pantry-audit-row"><button class="pantry-main" data-pantry-edit-audit="${safe(x.name)}"><b>${safe(x.name)}</b><small>${[x.qty?`${x.qty} ${x.unit||''}`.trim():'',x.category,x.note].filter(Boolean).map(safe).join(' • ')}</small></button><button class="ghost compact" data-pantry-fav-audit="${safe(x.name)}" aria-label="Favorite ${safe(x.name)}">${x.favorite?'★':'☆'}</button><button class="ghost compact" data-pantry-remove-audit="${safe(x.name)}" aria-label="Remove ${safe(x.name)}">×</button></div>`;
    return hero('Pantry Mode','Your actual kitchen, not a preset ingredient list.','Add any ingredient or product. Quantities, categories, favorites and recents stay local. Pantry-only recipes treat what you entered as a hard inventory constraint.',`<button class="primary" data-action="pantryAddAudit">+ Add ingredient</button><button class="secondary" data-action="pantryCamera">📸 Scan ingredients</button><button class="secondary" data-action="recipeFinder">✨ Make something now</button>`)+
      `<div class="grid grid-2"><div class="card"><div class="card-head"><div><h2>Current pantry</h2><small>${rows.length} item${rows.length===1?'':'s'} • editable</small></div></div>${rows.length?`<div class="pantry-audit-list">${rows.map(row).join('')}</div>`:'<div class="empty-state-v2"><div class="icon">🧺</div><h3>Your pantry is empty</h3><p>Add exactly what you have. Veyra will not invent required groceries in pantry-only mode.</p></div>'}</div><div class="card"><div class="card-head"><div><h2>Favorites & recents</h2><small>Fast re-entry without a fixed catalog</small></div></div>${favorites.length?`<small class="muted">Favorites</small><div class="chip-list">${favorites.map(x=>`<button class="chip" data-pantry-edit-audit="${safe(x.name)}">★ ${safe(x.name)}</button>`).join('')}</div>`:''}${rec.length?`<small class="muted">Recently used</small><div class="chip-list">${rec.map(x=>`<button class="chip" data-pantry-readd-audit="${safe(x)}">+ ${safe(x)}</button>`).join('')}</div>`:''}${!favorites.length&&!rec.length?'<div class="empty">Favorites and recently used items will appear here.</div>':''}</div></div>`+
      (rows.length?`<div class="section-title"><div><h2>Pantry-only ideas</h2><p>Required ingredients come only from the pantry above.</p></div></div>${recs.length?`<div class="recipe-grid">${recs.slice(0,6).map(r=>`<button class="recipe-card" data-recipe="${safe(r.name)}"><div class="recipe-art">${r.emoji||'🍲'}</div><div class="recipe-body"><span class="confidence">Only your pantry</span><h3>${safe(r.name)}</h3><div class="recipe-meta">${safe(r.cuisine||'Flexible')} • ${r.time||'—'} min • ~${r.cal||0} kcal • ~${r.p||0}g protein</div></div></button>`).join('')}</div>`:'<div class="card"><div class="empty">The current restrictions or numeric constraints leave no defensible pantry-only idea. Loosen one constraint or add an ingredient.</div></div>'}`:'');
  }

  /* ---------- Recipe output / persistence ---------- */
  function savedRecipeCard(){
    const rows=state.savedRecipes||[];
    return `<div class="card" style="margin-top:16px"><div class="card-head"><div><h2>Saved recipes</h2><small>Recipes you explicitly saved, separate from favorites.</small></div></div>${rows.length?`<div class="food-results">${rows.slice().reverse().map(r=>`<div class="food-result"><span class="fallback-food-img">${r.emoji||'🍲'}</span><span><b>${safe(r.name)}</b><small>${safe(r.cuisine||'Flexible')} • ${r.time||'—'} min • ${r.servings||1} serving${(r.servings||1)===1?'':'s'}</small></span><div class="row-actions"><button class="secondary compact" data-recipe="${safe(r.name)}">Open</button><button class="ghost compact" data-savedrecipe-delete="${safe(r.id||r.name)}">Delete</button></div></div>`).join('')}</div>`:'<div class="empty">Open a generated recipe and choose Save recipe to keep a copy here.</div>'}</div>`;
  }
  function findRecipe(name){return state.generatedRecipes?.[name]||(state.savedRecipes||[]).find(x=>x.name===name)||(typeof recipeLibrary==='function'?recipeLibrary().find(x=>x.name===name):null)}
  function favoriteRecipeCard(){
    const likes=state.learning?.recipeLikes||{},seen=new Set(),rows=Object.entries(likes).filter(([,on])=>!!on).map(([name])=>findRecipe(name)).filter(r=>r?.name&&!seen.has(r.name)&&seen.add(r.name));
    return `<div class="card" style="margin-top:16px"><div class="card-head"><div><h2>Favorite recipes</h2><small>Favorites stay easy to reopen, including recipes Veyra generated from your pantry.</small></div></div>${rows.length?`<div class="food-results">${rows.slice().reverse().map(r=>`<button class="food-result" data-recipe="${safe(r.name)}"><span class="fallback-food-img">${r.emoji||'🍲'}</span><span><b>${safe(r.name)}</b><small>${safe(r.cuisine||'Flexible')} • ${r.time||'—'} min${r.p?` • ~${round(r.p)}g protein`:''}</small></span><span>Open ›</span></button>`).join('')}</div>`:'<div class="empty">Favorite a generated or saved recipe and it will appear here.</div>'}</div>`;
  }
  function openRecipeAudit(name){
    const r=findRecipe(name);if(!r)return toast('Recipe context changed — generate it again');
    const optional=r.optionalExtras||[],servings=Math.max(1,num(r.servings)||1),per=k=>round(num(r[k])/servings),ingredients=r.ingredients||[],steps=r.steps||[];
    openModal(name,`<div class="recipe-hero">${r.emoji||'🍲'}</div><div class="confidence-line"><b>${safe(r.cuisine||'Flexible')} • ${r.time||'—'} min • ${safe(r.difficulty||'Easy–Moderate')}</b><span class="status-badge good">${servings} serving${servings===1?'':'s'}</span></div>
      <div class="recipe-output-grid"><div><small>Calories / serving</small><b>~${per('cal')}</b></div><div><small>Protein</small><b>~${per('p')}g</b></div><div><small>Carbs</small><b>~${per('c')}g</b></div><div><small>Fat</small><b>~${per('f')}g</b></div><div><small>Fiber</small><b>~${per('fiber')}g</b></div><div><small>Difficulty</small><b>${safe(r.difficulty||'Easy–Moderate')}</b></div></div>
      ${r._dynamic?'<div class="callout"><b>Pantry-only required ingredients.</b><br>Every required ingredient below came from the pantry state that generated this recipe. Nutrition is an estimate and stays editable before logging.</div>':''}
      <h3>Required ingredients</h3><div class="chip-list">${ingredients.map(i=>`<span class="chip">${safe(i)} ✓</span>`).join('')}</div>
      ${optional.length?`<h3>Optional extras — never required</h3><div class="chip-list">${optional.map(i=>`<span class="chip">${safe(i)} optional</span>`).join('')}</div>`:''}
      <h3>Instructions</h3><ol class="muted">${(steps.length?steps:['Prep the listed ingredients.','Cook or assemble using the described style.','Taste and adjust only with ingredients you actually have.']).map(s=>`<li>${safe(s)}</li>`).join('')}</ol>
      <div class="stack-actions"><button id="recipeCookAudit" class="primary">Cook & review nutrition</button><button id="recipeSaveAudit" class="secondary">💾 Save recipe</button><button id="recipeFavAudit" class="secondary">${state.learning?.recipeLikes?.[r.name]?'★ Favorite':'☆ Favorite'}</button>${optional.length?'<button id="recipeShopAudit" class="secondary">Add optional extras to shopping list</button>':''}</div>`);
    q('#recipeCookAudit').onclick=()=>{const meal=['Breakfast','Lunch','Dinner','Snack'].find(x=>norm(x)===norm(r.mealType))||'Dinner';closeModal();addFoodModal(meal,{name:r.name,meal,cal:per('cal'),p:per('p'),c:per('c'),f:per('f'),fiber:per('fiber'),sugar:per('sugar'),servingLabel:`1 of ${servings} recipe serving${servings===1?'':'s'}`,quantity:1,time:new Date().toTimeString().slice(0,5),confidence:r.nutritionCoverage>=.75?82:65,source:r._dynamic?'Veyra dynamic pantry recipe estimate':'Veyra recipe estimate'})};
    q('#recipeSaveAudit').onclick=()=>{const copy=clone(r);copy.savedAt=Date.now();copy.id=copy.id||uid();const i=state.savedRecipes.findIndex(x=>x.name===copy.name);if(i>=0)state.savedRecipes[i]=copy;else state.savedRecipes.push(copy);save();toast('Recipe saved')};
    q('#recipeFavAudit').onclick=()=>{state.learning||={};state.learning.recipeLikes||={};state.learning.recipeLikes[r.name]=!state.learning.recipeLikes[r.name];save();q('#recipeFavAudit').textContent=state.learning.recipeLikes[r.name]?'★ Favorite':'☆ Favorite';toast(state.learning.recipeLikes[r.name]?'Recipe favorited':'Favorite removed')};
    q('#recipeShopAudit')?.addEventListener('click',()=>{for(const x of optional)if(!state.shoppingList.some(y=>norm(typeof y==='string'?y:y.name)===norm(x)))state.shoppingList.push({name:x,source:`Optional extra for ${r.name}`});save();toast('Optional extras added to shopping list')});
  }

  /* ---------- Saved meals ---------- */
  function normalizeSavedMeal(sm){
    if(Array.isArray(sm?.items))return sm;
    if(sm?.name)return {...sm,items:[{name:sm.name,cal:num(sm.cal),p:num(sm.p),c:num(sm.c),f:num(sm.f),fiber:num(sm.fiber),sugar:num(sm.sugar),meal:'Snack'}]};
    return {...sm,items:[]};
  }
  state.savedMeals=(state.savedMeals||[]).map(normalizeSavedMeal);
  function savedMealTotals(sm){return (sm.items||[]).reduce((a,x)=>({cal:a.cal+num(x.cal),p:a.p+num(x.p),c:a.c+num(x.c),f:a.f+num(x.f),fiber:a.fiber+num(x.fiber),sugar:a.sugar+num(x.sugar)}),{cal:0,p:0,c:0,f:0,fiber:0,sugar:0})}
  function editSavedMealAudit(index){
    const sm=state.savedMeals[index];if(!sm)return;const rows=sm.items||[];
    openModal('Edit saved meal',`<form id="savedMealEditAudit"><label>Saved meal name<input name="name" value="${safe(sm.name||'Saved meal')}" required></label><div class="saved-meal-edit-list">${rows.map((x,i)=>`<div class="saved-meal-edit-row" data-saved-item="${i}"><label>Food<input name="name_${i}" value="${safe(x.name||'Food')}" required></label><label>Calories<input name="cal_${i}" type="number" min="0" step=".1" value="${num(x.cal)}"></label><label>Protein (g)<input name="p_${i}" type="number" min="0" step=".1" value="${num(x.p)}"></label><label>Carbs (g)<input name="c_${i}" type="number" min="0" step=".1" value="${num(x.c)}"></label><label>Fat (g)<input name="f_${i}" type="number" min="0" step=".1" value="${num(x.f)}"></label><button type="button" class="ghost compact" data-saved-item-remove="${i}">Remove item</button></div>`).join('')}</div><div id="savedMealSummaryAudit" class="callout"></div><button class="primary full" style="margin-top:12px">Save meal changes</button></form>`);
    const refresh=()=>{const fd=new FormData(q('#savedMealEditAudit'));let cal=0,p=0;qa('[data-saved-item]').forEach(row=>{if(row.hidden)return;const i=row.dataset.savedItem;cal+=num(fd.get(`cal_${i}`));p+=num(fd.get(`p_${i}`))});q('#savedMealSummaryAudit').innerHTML=`<b>Updated meal total:</b> ${round(cal)} kcal • ${round(p)}g protein`};
    q('#savedMealEditAudit').addEventListener('input',refresh);qa('[data-saved-item-remove]').forEach(b=>b.onclick=()=>{b.closest('[data-saved-item]').hidden=true;refresh()});refresh();
    q('#savedMealEditAudit').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.currentTarget),items=[];qa('[data-saved-item]').forEach(row=>{if(row.hidden)return;const i=row.dataset.savedItem,prior=rows[+i]||{};items.push({...prior,name:String(fd.get(`name_${i}`)||'').trim(),cal:num(fd.get(`cal_${i}`)),p:num(fd.get(`p_${i}`)),c:num(fd.get(`c_${i}`)),f:num(fd.get(`f_${i}`))})});if(!items.length)return toast('Keep at least one food in a saved meal');state.savedMeals[index]={...sm,name:String(fd.get('name')).trim(),items};save();closeModal();savedMealsAudit();toast('Saved meal updated')};
  }
  function savedMealsAudit(){
    const saved=state.savedMeals||[];openModal('Saved meals',`<p class="muted">Log, rename, edit or delete combinations you repeat. Nutrition totals recalculate from the saved items.</p>${saved.length?`<div class="food-results">${saved.map((sm,i)=>{const t=savedMealTotals(sm);return `<div class="food-result"><span class="fallback-food-img">💾</span><span><b>${safe(sm.name||'Saved meal')}</b><small>${sm.items?.length||0} items • ${round(t.cal)} kcal • ${round(t.p)}g protein</small></span><div class="row-actions"><button class="primary compact" data-sm-log="${i}">Log</button><button class="secondary compact" data-sm-edit="${i}">Edit</button><button class="ghost compact" data-sm-delete="${i}">Delete</button></div></div>`}).join('')}</div>`:'<div class="empty">No saved meals yet. Save a meal from Nutrition after logging it.</div>'}<button id="smSaveToday" class="secondary full" style="margin-top:12px">Save a meal from today</button>`);
    qa('[data-sm-log]').forEach(b=>b.onclick=()=>{const sm=state.savedMeals[+b.dataset.smLog];for(const item of sm.items||[])state.meals.push({...clone(item),id:uid(),date:today(),time:new Date().toTimeString().slice(0,5),source:'saved meal',confidence:item.confidence||99});if(typeof touchStreak==='function')touchStreak();save();closeModal();render();toast(`${sm.name} logged`)});
    qa('[data-sm-edit]').forEach(b=>b.onclick=()=>editSavedMealAudit(+b.dataset.smEdit));
    qa('[data-sm-delete]').forEach(b=>b.onclick=()=>{state.savedMeals.splice(+b.dataset.smDelete,1);save();savedMealsAudit()});
    q('#smSaveToday').onclick=()=>{closeModal();action('saveCurrentMeal')};
  }

  let repeatCandidate=null;
  function repeatedMealSuggestion(){
    repeatCandidate=null;const slots={};
    for(const m of state.meals||[]){const key=`${m.date||''}|${m.meal||'Meal'}`;(slots[key]||=[]).push(m)}
    const signatures={};
    for(const [slot,items] of Object.entries(slots)){if(items.length<2)continue;const meal=slot.split('|')[1],names=items.map(x=>norm(x.name)).sort(),sig=`${meal}|${names.join('~')}`;(signatures[sig]||=[]).push({slot,items})}
    const combo=Object.entries(signatures).sort((a,b)=>b[1].length-a[1].length).find(([,rows])=>rows.length>=3);
    if(combo){const rows=combo[1],latest=rows.at(-1),names=latest.items.map(x=>x.name),candidateItems=latest.items.map(({id,date,time,...rest})=>clone(rest)),already=(state.savedMeals||[]).some(sm=>norm((sm.items||[]).map(x=>x.name).sort().join('~'))===norm(names.slice().sort().join('~')));if(!already){repeatCandidate={name:`My ${latest.slot.split('|')[1]}`,items:candidateItems,count:rows.length};return `<div class="card repeat-save-card" style="margin-top:16px"><div class="card-head"><div><h2>Save a frequent meal?</h2><small>You logged this ${safe(latest.slot.split('|')[1])} combination on ${rows.length} days.</small></div><button class="secondary compact" data-save-frequent-combo="1">Save for one-tap logging</button></div><p class="muted">${names.map(safe).join(' + ')}. Veyra never auto-saves or auto-logs it.</p></div>`}}
    const groups={};for(const m of state.meals||[]){const k=`${m.meal}|${norm(m.name)}`;groups[k]=(groups[k]||0)+1}
    const best=Object.entries(groups).sort((a,b)=>b[1]-a[1]).find(([,count])=>count>=3);if(!best)return '';
    const [meal,nameKey]=best[0].split('|'),count=best[1],already=(state.savedMeals||[]).some(sm=>(sm.items||[]).some(x=>norm(x.name)===nameKey));if(already)return '';
    const sample=[...(state.meals||[])].reverse().find(x=>x.meal===meal&&norm(x.name)===nameKey);if(!sample)return '';
    repeatCandidate={name:sample.name,items:[Object.fromEntries(Object.entries(sample).filter(([k])=>!['id','date','time'].includes(k)))],count};
    return `<div class="card repeat-save-card" style="margin-top:16px"><div class="card-head"><div><h2>Save a frequent food?</h2><small>You logged ${safe(sample.name)} ${count} times.</small></div><button class="secondary compact" data-save-frequent-combo="1">Save for one-tap logging</button></div><p class="muted">Veyra only suggests this after repeated use.</p></div>`;
  }

  /* ---------- Food deletion undo ---------- */
  let deletedMeal=null;
  function deletedMealBanner(){return deletedMeal?`<div class="undo-banner"><span>↶</span><div><b>${safe(deletedMeal.name)} was deleted</b><small>Undo is available until another deletion replaces this snapshot.</small></div><button class="secondary compact" data-action="undoDeletedFoodAudit">Undo delete</button></div>`:''}
  document.addEventListener('click',e=>{if(e.target?.id!=='deleteMealV2'&&e.target?.id!=='deleteFood')return;const form=q('#foodFormV2')||q('#foodForm');if(!form)return;const fd=new FormData(form),name=fd.get('name'),date=fd.get('date');const cand=[...(state.meals||[])].reverse().find(x=>x.name===name&&(!date||x.date===date));if(cand)deletedMeal=clone(cand)},true);

  /* ---------- Hydration history ---------- */
  function hydrationHistoryCard(){
    const entries=Object.entries(state.water||{}).sort((a,b)=>a[0].localeCompare(b[0])).slice(-14),unit=state.profile?.units==='metric'?'mL':'oz';
    if(!entries.length)return `<div class="card hydration-history"><div class="card-head"><div><h2>Hydration history</h2><small>No days logged yet.</small></div><button class="secondary compact" data-action="water">+ Log water</button></div><div class="empty">Your daily totals will build here.</div></div>`;
    const max=Math.max(...entries.map(([,v])=>num(v)),1);return `<div class="card hydration-history"><div class="card-head"><div><h2>Hydration history</h2><small>Last ${entries.length} logged day${entries.length===1?'':'s'} • ${unit}</small></div><button class="secondary compact" data-action="water">+ Log water</button></div><div class="hydration-bars">${entries.map(([d,v])=>`<div class="hydration-bar-row"><small>${safe(d.slice(5))}</small><div class="progress-track"><div class="progress-fill" style="width:${Math.round(num(v)/max*100)}%"></div></div><b>${round(v)} ${unit}</b></div>`).join('')}</div></div>`;
  }

  /* ---------- Training coverage ---------- */
  function trainingCoverageAudit(){
    const muscle={};let push=0,pull=0;
    for(const w of state.workouts||[])for(const ex of w.exercises||[]){const def=typeof exerciseDef==='function'?exerciseDef(ex.name):ex,sets=ex.setsData||ex.sets||[],done=Array.isArray(sets)?sets.filter(s=>s.done!==false):[],volume=done.reduce((a,s)=>a+(num(s.weight)*Math.max(1,num(s.reps)||1)||num(s.seconds)||num(s.distance)||1),0)||Math.max(1,done.length||num(ex.sets)||1),primary=def?.muscle||ex.muscle||'Other',secondary=def?.secondary||ex.secondary||'';muscle[primary]=(muscle[primary]||0)+volume;if(secondary)muscle[secondary]=(muscle[secondary]||0)+volume*.5;if(/Chest|Shoulders|Triceps|Quads/i.test(primary))push+=volume;if(/Back|Biceps|Hamstrings|Rear delts/i.test(primary))pull+=volume}
    const rows=Object.entries(muscle).sort((a,b)=>b[1]-a[1]);if(!rows.length)return '<div class="empty">Complete workouts and Veyra will build primary + secondary training coverage from your real sets.</div>';
    const max=Math.max(...rows.map(x=>x[1]),1),balance=(push||pull)?Math.round(push/Math.max(push+pull,1)*100):null;
    return `<div class="muscle-audit"><div class="muscle-bars">${rows.slice(0,10).map(([m,v])=>`<div><span>${safe(m)}<b>${Math.round(v/max*100)}%</b></span><div class="progress-track"><div class="progress-fill" style="width:${Math.round(v/max*100)}%"></div></div></div>`).join('')}</div>${balance!==null?`<div class="callout"><b>Recent push / pull context:</b> roughly ${balance}% push-pattern volume and ${100-balance}% pull-pattern volume. Secondary muscles receive half-weighted credit. This is training coverage, not a body-quality score.</div>`:''}</div>`;
  }
  window.trainingCoverage=trainingCoverage=trainingCoverageAudit;

  /* ---------- In-progress workout crash/refresh recovery ---------- */
  const ACTIVE_WORKOUT_KEY='veyra-active-workout-v1';
  function persistActiveWorkout(){
    try{if(typeof liveWorkout!=='undefined'&&liveWorkout)localStorage.setItem(ACTIVE_WORKOUT_KEY,JSON.stringify({savedAt:Date.now(),workout:liveWorkout}));else localStorage.removeItem(ACTIVE_WORKOUT_KEY)}catch{}
  }
  function restoreActiveWorkout(){
    try{const raw=localStorage.getItem(ACTIVE_WORKOUT_KEY);if(!raw)return false;const j=JSON.parse(raw);if(!j?.workout||Date.now()-num(j.savedAt)>36*60*60*1000){localStorage.removeItem(ACTIVE_WORKOUT_KEY);return false}liveWorkout=j.workout;return true}catch{localStorage.removeItem(ACTIVE_WORKOUT_KEY);return false}
  }
  function activeWorkoutCard(){
    if(typeof liveWorkout==='undefined'||!liveWorkout)return '';
    return `<div class="card active-workout-resume"><div class="card-head"><div><span class="eyebrow">IN-PROGRESS WORKOUT</span><h2>${safe(liveWorkout.routine||'Workout')}</h2><small>${(liveWorkout.exercises||[]).length} exercises • saved locally as you log</small></div><button class="primary compact" data-action="resumeWorkoutAudit">Resume</button></div><p class="muted">If the page refreshes or closes accidentally, Veyra can restore this unfinished session on this device.</p></div>`;
  }
  restoreActiveWorkout();
  document.addEventListener('input',()=>{if(typeof liveWorkout!=='undefined'&&liveWorkout)setTimeout(persistActiveWorkout,0)},true);
  document.addEventListener('change',()=>{if(typeof liveWorkout!=='undefined'&&liveWorkout)setTimeout(persistActiveWorkout,0)},true);
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('.live-workout-v2')||e.target?.closest?.('[data-routine]')||e.target?.closest?.('[data-start-routine]')||e.target?.id==='emptyWorkoutV2')setTimeout(persistActiveWorkout,20);
    if(e.target?.id==='finishWorkoutV2'||e.target?.id==='cancelWorkoutV2')setTimeout(persistActiveWorkout,80);
  },true);
  window.addEventListener('beforeunload',persistActiveWorkout);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persistActiveWorkout()});

  /* ---------- Previous meal reuse ---------- */
  function copyPreviousMealAudit(){
    const rows=(state.meals||[]).slice().sort((a,b)=>`${a.date||''} ${a.time||''}`.localeCompare(`${b.date||''} ${b.time||''}`));
    if(!rows.length)return toast('No previous meal to copy yet');
    const last=rows.at(-1),same=rows.filter(x=>x.date===last.date&&x.meal===last.meal&&Math.abs(String(x.time||'').localeCompare(String(last.time||'')))>=0);
    const items=same.length?same:[last];
    openModal('Copy previous meal',`<p class="muted">Your most recent ${safe(last.meal||'meal')} from ${safe(last.date||'your history')}. Review the items before copying them to today.</p><div class="food-results">${items.map(x=>`<label class="food-result"><input class="copy-prev-check" type="checkbox" data-id="${safe(x.id)}" checked><span class="fallback-food-img">🍴</span><span><b>${safe(x.name)}</b><small>${num(x.cal)} kcal • ${num(x.p)}g protein</small></span></label>`).join('')}</div><button id="copyPreviousConfirmAudit" class="primary full" style="margin-top:10px">Copy selected to today</button>`);
    q('#copyPreviousConfirmAudit').onclick=()=>{const ids=new Set(qa('.copy-prev-check:checked').map(x=>String(x.dataset.id))),chosen=items.filter(x=>ids.has(String(x.id)));if(!chosen.length)return toast('Choose at least one item');for(const x of chosen)state.meals.push({...clone(x),id:uid(),date:today(),time:new Date().toTimeString().slice(0,5),source:'copied previous meal'});save();closeModal();render();toast(`${chosen.length} item${chosen.length===1?'':'s'} copied`)};
  }

  /* ---------- Replay natural-language history queries ---------- */
  const dayOffset=n=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
  const workoutVolumeAudit=w=>(w?.exercises||[]).reduce((sum,e)=>sum+(e.setsData||e.sets||[]).reduce((a,x)=>a+(num(x.weight)*num(x.reps)),0),0);
  function replayQueryAudit(raw){
    const query=String(raw||'').trim(),l=norm(query),sections=[];let foods=[],works=[],acts=[],recipes=[];
    if(/what did i eat yesterday|food yesterday|ate yesterday/.test(l)) foods=(state.meals||[]).filter(x=>x.date===dayOffset(-1));
    else if(/high protein.*indian|indian.*high protein/.test(l)) foods=(state.meals||[]).filter(x=>num(x.p)>=20&&(/indian/i.test(String(x.cuisine||''))||/rajma|paneer|chana|dal|tikka|biryani|roti|naan|dosa|idli|sambar|masala|curry/i.test(String(x.name||''))));
    else if(/show all .*bench.*sessions|all bench sessions|bench sessions/.test(l)) works=(state.workouts||[]).filter(w=>(w.exercises||[]).some(e=>/bench/i.test(e.name||'')));
    else if(/compare last (?:five|5) .*push.*workouts|last (?:five|5) push/.test(l)) works=(state.workouts||[]).filter(w=>/push/i.test(w.routine||'')).slice(-5);
    else if(/what did i do last .*push|last push day/.test(l)) works=(state.workouts||[]).filter(w=>/push/i.test(w.routine||'')).slice(-1);
    else {
      const words=l.split(' ').filter(x=>x.length>1),hit=text=>words.every(w=>norm(text).includes(w))||words.some(w=>norm(text).includes(w));
      foods=(state.meals||[]).filter(x=>hit(`${x.name} ${x.meal} ${x.notes||''} ${x.cuisine||''}`)).slice(-20);
      works=(state.workouts||[]).filter(x=>hit(`${x.routine} ${(x.exercises||[]).map(e=>`${e.name} ${e.note||''}`).join(' ')} ${x.note||''}`)).slice(-12);
      acts=(state.activities||[]).filter(x=>hit(`${x.type} ${x.source||''} ${x.environment||''}`)).slice(-12);
      recipes=[...(state.savedRecipes||[]),...Object.values(state.generatedRecipes||{})].filter(x=>hit(`${x.name} ${x.cuisine||''} ${(x.ingredients||[]).join(' ')}`)).slice(-12);
    }
    if(foods.length)sections.push(`<h3>Meals</h3><div class="food-results">${foods.slice().reverse().map(x=>`<button class="food-result" data-replay-audit-meal="${safe(x.id)}"><span class="fallback-food-img">🍴</span><span><b>${safe(x.name)}</b><small>${safe(x.date)} • ${safe(x.meal||'Meal')} • ${num(x.cal)} kcal • ${num(x.p)}g protein</small></span><span>Review ›</span></button>`).join('')}</div>`);
    if(works.length){
      const compare=/compare last (?:five|5)|last (?:five|5) push/.test(l);
      if(compare)sections.push(`<h3>Workout comparison</h3><div style="overflow:auto"><table class="sets-table-v2"><thead><tr><th>Date</th><th>Routine</th><th>Exercises</th><th>Volume</th><th>Duration</th></tr></thead><tbody>${works.map(w=>`<tr><td>${safe(w.date)}</td><td>${safe(w.routine)}</td><td>${(w.exercises||[]).length}</td><td>${round(workoutVolumeAudit(w))}</td><td>${num(w.duration)||'—'} min</td></tr>`).join('')}</tbody></table></div>`);
      else sections.push(`<h3>Workouts</h3><div class="food-results">${works.slice().reverse().map(w=>`<div class="food-result"><span class="fallback-food-img">🏋️</span><span><b>${safe(w.routine)}</b><small>${safe(w.date)} • ${(w.exercises||[]).map(e=>safe(e.name)).join(', ')||'No exercise detail'}</small><small>${round(workoutVolumeAudit(w))||0} logged weight×rep volume • ${num(w.duration)||'—'} min</small></span></div>`).join('')}</div>`);
    }
    if(acts.length)sections.push(`<h3>Activities</h3><div class="food-results">${acts.slice().reverse().map(x=>`<div class="food-result"><span class="fallback-food-img">🏃</span><span><b>${safe(x.type)}</b><small>${safe(x.date)} • ${num(x.duration)} min${num(x.distance)?` • ${num(x.distance)} ${typeof unitDistance==='function'?unitDistance():''}`:''}</small></span></div>`).join('')}</div>`);
    if(recipes.length)sections.push(`<h3>Recipes</h3><div class="food-results">${recipes.slice().reverse().map(r=>`<button class="food-result" data-recipe="${safe(r.name)}"><span class="fallback-food-img">${r.emoji||'🍲'}</span><span><b>${safe(r.name)}</b><small>${safe(r.cuisine||'Flexible')} • ${(r.ingredients||[]).map(safe).join(', ')}</small></span><span>Open ›</span></button>`).join('')}</div>`);
    return sections.join('')||`<div class="empty-state-v2"><div class="icon">▶</div><h3>No matching local history</h3><p>Replay searched meals, workouts, activities and saved/generated recipes on this device. Try a broader phrase or log more history first.</p></div>`;
  }
  function replayModalAudit(prefill=''){
    openModal('Veyra Replay',`<div class="callout"><b>Ask your history naturally.</b><br>Replay searches only the data stored in this browser. Try “What did I eat yesterday?”, “Show all bench sessions”, “Compare last five Push workouts”, or “What did I do last Push Day?”</div><div class="food-search-top"><input id="replayAuditSearch" value="${safe(prefill)}" placeholder="Ask about meals, workouts, recipes or activities" autofocus><button id="replayAuditGo" class="primary">Search</button></div><div class="chip-list" style="margin-top:9px">${['What did I eat yesterday?','Show all bench sessions','Compare last five Push workouts','What did I do last Push Day?'].map(x=>`<button class="chip replay-audit-prompt">${safe(x)}</button>`).join('')}</div><div id="replayAuditResults" style="margin-top:12px"></div>`);
    const run=()=>{const qv=q('#replayAuditSearch')?.value||'';q('#replayAuditResults').innerHTML=replayQueryAudit(qv);qa('[data-replay-audit-meal]').forEach(b=>b.onclick=()=>{const x=(state.meals||[]).find(m=>String(m.id)===String(b.dataset.replayAuditMeal));if(x){closeModal();addFoodModal(x.meal,x)}});qa('#replayAuditResults [data-recipe]').forEach(b=>b.onclick=()=>openRecipeAudit(b.dataset.recipe))};
    q('#replayAuditGo').onclick=run;q('#replayAuditSearch').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();run()}};qa('.replay-audit-prompt').forEach(b=>b.onclick=()=>{q('#replayAuditSearch').value=b.textContent;run()});if(prefill)setTimeout(run,0);
  }

  /* ---------- Complete weekly report ---------- */
  function weeklyReportAudit(){
    const end=today(),endD=new Date(end+'T12:00:00'),startD=new Date(endD);startD.setDate(startD.getDate()-6);const fmt=d=>d.toISOString().slice(0,10),start=fmt(startD),inRange=d=>String(d||'')>=start&&String(d||'')<=end;
    const meals=(state.meals||[]).filter(x=>inRange(x.date)),workouts=(state.workouts||[]).filter(x=>inRange(x.date)),activities=(state.activities||[]).filter(x=>inRange(x.date)),sleep=(state.sleep||[]).filter(x=>inRange(x.date));
    const loggedDays=uniq([...meals.map(x=>x.date),...workouts.map(x=>x.date),...activities.map(x=>x.date),...sleep.map(x=>x.date)]).length;
    const foodDays={};for(const m of meals){foodDays[m.date]||={p:0,n:0};foodDays[m.date].p+=num(m.p);foodDays[m.date].n++}
    const pDays=Object.values(foodDays),goal=num(state.profile?.proteinGoal),met=goal?pDays.filter(x=>x.p>=goal).length:0,avgP=pDays.length?round(pDays.reduce((a,x)=>a+x.p,0)/pDays.length):0;
    const common={};for(const m of meals){const k=norm(m.name);common[k]||={name:m.name,n:0};common[k].n++}const topFoods=Object.values(common).sort((a,b)=>b.n-a.n).slice(0,3);
    const muscle={},exerciseSessions={};
    for(const w of workouts)for(const ex of w.exercises||[]){const def=typeof exerciseDef==='function'?exerciseDef(ex.name):ex,primary=def?.muscle||ex.muscle||'Other',sets=ex.setsData||ex.sets||[],done=Array.isArray(sets)?sets.filter(s=>s.done!==false):[],vol=done.reduce((a,s)=>a+(num(s.weight)*Math.max(1,num(s.reps)||1)||num(s.seconds)||num(s.distance)||1),0)||Math.max(1,done.length||num(ex.sets)||1);muscle[primary]=(muscle[primary]||0)+vol;const best=done.reduce((mx,s)=>Math.max(mx,num(s.weight),num(s.seconds),num(s.distance)),0);(exerciseSessions[ex.name]||=[]).push({date:w.date,best})}
    let improved=null;for(const [name,rows] of Object.entries(exerciseSessions)){rows.sort((a,b)=>a.date.localeCompare(b.date));if(rows.length<2)continue;const delta=rows.at(-1).best-rows[0].best;if(delta>0&&(!improved||delta>improved.delta))improved={name,delta}}
    const dist=Object.entries(muscle).sort((a,b)=>b[1]-a[1]).slice(0,5),distMax=Math.max(...dist.map(x=>x[1]),1),mins=activities.reduce((a,x)=>a+num(x.duration),0),sleepAvg=sleep.length?round(sleep.reduce((a,x)=>a+num(x.hours),0)/sleep.length):null;
    openModal('Your Veyra Week',`<div class="report-hero"><span class="eyebrow">${start} → ${end}</span><h2>Weekly report</h2><p class="muted">Only data you actually logged is summarized. Missing days remain missing.</p></div><div class="report-grid"><div><b>${workouts.length}</b><small>workouts</small></div><div><b>${mins}</b><small>activity min</small></div><div><b>${meals.length}</b><small>food entries</small></div><div><b>${sleepAvg??'—'}</b><small>${sleepAvg!==null?'avg sleep h':'sleep not logged'}</small></div></div><div class="grid grid-2" style="margin-top:12px"><div class="card flat"><h3>Protein consistency</h3><p class="muted">${goal?(pDays.length?`Met your chosen ${goal}g target on ${met} of ${pDays.length} food-logged days. Average: ${avgP}g on those days.`:'No food-logged days this week.'):(pDays.length?`Average protein across ${pDays.length} food-logged days: ${avgP}g. Set a target if you want target consistency shown.`:'No food-logged days this week.')}</p></div><div class="card flat"><h3>Most common foods</h3><p class="muted">${topFoods.length?topFoods.map(x=>`${safe(x.name)} ×${x.n}`).join(' • '):'No food entries this week.'}</p></div><div class="card flat"><h3>Most improved exercise</h3><p class="muted">${improved?`${safe(improved.name)} improved by ${round(improved.delta)} in its logged set metric across comparable sessions.`:'No repeat exercise with a positive comparable change this week.'}</p></div><div class="card flat"><h3>Training distribution</h3><p class="muted">${dist.length?dist.map(([m,v])=>`${safe(m)} ${Math.round(v/distMax*100)}%`).join(' • '):'No completed workout set data this week.'}</p></div></div><div class="callout"><b>Consistency:</b> Veyra activity appeared on ${loggedDays} day${loggedDays===1?'':'s'} this week. This is an engagement recap, not a grade for food choices or your body.</div><div class="stack-actions" style="margin-top:12px"><button id="closeWeeklyAudit" class="primary">Done</button></div>`);q('#closeWeeklyAudit').onclick=closeModal;
  }

  /* ---------- View/action integration ---------- */
  const baseRecipes=views.recipes,baseFood=views.food,baseProgress=views.progress,baseTrain=views.train,baseToday=views.today;
  views.pantry=pantryAuditView;
  views.recipes=function(){return baseRecipes()+favoriteRecipeCard()+savedRecipeCard()};
  views.food=function(){return deletedMealBanner()+baseFood()+`<div class="card" style="margin-top:12px"><button class="secondary full" data-action="copyPreviousMealAudit">⏮ Copy previous meal</button></div>`+repeatedMealSuggestion()};
  views.progress=function(){return baseProgress()+`<div class="section-title"><div><h2>Hydration</h2><p>Daily totals from what you explicitly logged.</p></div></div>`+hydrationHistoryCard()};
  views.train=function(){return activeWorkoutCard()+baseTrain()};
  views.today=function(){return activeWorkoutCard()+baseToday()};

  const baseAction=window.action;
  window.action=action=function(a){
    if(a==='pantryAddAudit')return pantryEditor();
    if(a==='savedMeals')return savedMealsAudit();
    if(a==='weeklyReport')return weeklyReportAudit();
    if(a==='replay')return replayModalAudit();
    if(a==='copyPreviousMealAudit')return copyPreviousMealAudit();
    if(a==='resumeWorkoutAudit'){if(typeof liveWorkout!=='undefined'&&liveWorkout&&typeof renderLiveWorkout==='function')return renderLiveWorkout();return toast('No unfinished workout to resume')}
    if(a==='undoDeletedFoodAudit'){if(!deletedMeal)return toast('Nothing to restore');if(!state.meals.some(x=>x.id===deletedMeal.id))state.meals.push(deletedMeal);deletedMeal=null;save();render();return toast('Deleted food restored')}
    return baseAction?baseAction(a):undefined;
  };
  const baseHandle=window.handleCommand;
  window.handleCommand=handleCommand=function(text){const s=String(text||'').trim(),l=s.toLowerCase();if(!s)return;const add=l.match(/^(?:add|put)\s+(.+?)\s+(?:to|in)\s+(?:my\s+)?pantry\b/i);if(add){addPantryItem(add[1],{});render();return toast(`${add[1]} added to pantry`)}if(/\b(?:show|open)\s+(?:my\s+)?saved meals\b/i.test(l))return savedMealsAudit();if(/what did i eat yesterday|bench sessions|compare last (?:five|5) .*push|what did i do last .*push/i.test(l))return replayModalAudit(s);return baseHandle?baseHandle(s):undefined};

  const baseBind=bind;
  bind=function(){baseBind();
    qa('[data-pantry-edit-audit]').forEach(b=>b.onclick=()=>pantryEditor(b.dataset.pantryEditAudit));
    qa('[data-pantry-remove-audit]').forEach(b=>b.onclick=()=>{removePantryItem(b.dataset.pantryRemoveAudit);render();toast('Removed from pantry')});
    qa('[data-pantry-fav-audit]').forEach(b=>b.onclick=()=>{const name=b.dataset.pantryFavAudit,info=pantryInfo(name);setPantryInfo(name,{favorite:!info.favorite});save();render();toast(info.favorite?'Favorite removed':'Pantry favorite added')});
    qa('[data-pantry-readd-audit]').forEach(b=>b.onclick=()=>{addPantryItem(b.dataset.pantryReaddAudit,{});render();toast('Added back to pantry')});
    qa('[data-recipe]').forEach(b=>b.onclick=e=>{e.stopPropagation();openRecipeAudit(b.dataset.recipe)});
    qa('[data-savedrecipe-delete]').forEach(b=>b.onclick=()=>{const id=b.dataset.savedrecipeDelete;state.savedRecipes=state.savedRecipes.filter(x=>String(x.id||x.name)!==id);save();render();toast('Saved recipe deleted')});
    qa('[data-save-frequent-combo]').forEach(b=>b.onclick=()=>{if(!repeatCandidate)return;state.savedMeals.push({id:uid(),name:repeatCandidate.name,items:clone(repeatCandidate.items)});repeatCandidate=null;save();render();toast('Frequent meal saved')});
  };

  // Builder results are rendered after an asynchronous lookup, so bind those separately.
  const mo=new MutationObserver(()=>qa('.dyn-builder-recipe').forEach(b=>{if(b.dataset.auditBound)return;b.dataset.auditBound='1';b.onclick=e=>{e.stopPropagation();openRecipeAudit(b.dataset.name)}}));
  mo.observe(document.body,{subtree:true,childList:true});

  const baseGuide=window.openGuide;
  window.openGuide=function(...args){baseGuide?.(...args);setTimeout(()=>{const list=q('#guideMapV2');if(!list||q('[data-guide-key="pantry-edit"]',list))return;list.insertAdjacentHTML('beforeend',`<button class="guide-map-row" data-guide-key="pantry-edit"><span>🧺</span><div><b>Pantry quantities, categories & favorites</b><small>Pantry → tap an ingredient to edit</small></div><em>›</em></button><button class="guide-map-row" data-guide-key="saved-meals-audit"><span>💾</span><div><b>Rename or edit saved meals</b><small>Nutrition → Saved meals</small></div><em>›</em></button><button class="guide-map-row" data-guide-key="hydration-history"><span>💧</span><div><b>Hydration history</b><small>Progress → Hydration</small></div><em>›</em></button>`);q('[data-guide-key="pantry-edit"]',list)?.addEventListener('click',()=>{closeModal();go('pantry')});q('[data-guide-key="saved-meals-audit"]',list)?.addEventListener('click',()=>{closeModal();go('food');setTimeout(savedMealsAudit,80)});q('[data-guide-key="hydration-history"]',list)?.addEventListener('click',()=>{closeModal();go('progress')})},0)};

  window.openRecipe=openRecipeAudit;
  window.VeyraMasterAudit={version:VERSION,pantryEditor,pantryAuditView,openRecipeAudit,savedMealsAudit,trainingCoverageAudit,hydrationHistoryCard,weeklyReportAudit,repeatedMealSuggestion,persistActiveWorkout,restoreActiveWorkout,activeWorkoutCard,replayQueryAudit,replayModalAudit,copyPreviousMealAudit};
  save();render();
})();
