/* Veyra final audit polish — discoverability, portable servings, routine ordering, pantry recents, system theme, safe mobile gestures. */
(()=>{
  const qa=(s,r=document)=>[...r.querySelectorAll(s)], q=(s,r=document)=>r.querySelector(s);
  const uniq=a=>[...new Set((a||[]).map(x=>String(x).trim()).filter(Boolean))];
  const orderGlyph=e=>`<span class="order-glyph" aria-hidden="true">${esc(e?.icon||'🏋️')}</span>`;
  state.pantryRecents=uniq([...(state.pantryRecents||[]),...(state.pantry||[])]).slice(0,18);save();

  function resolvedTheme(){return state.theme==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):(state.theme||'dark')}
  function applyAppearance(){document.documentElement.dataset.theme=resolvedTheme();document.documentElement.dataset.themePreference=state.theme||'system'}
  applyAppearance();
  try{matchMedia('(prefers-color-scheme: light)').addEventListener('change',()=>{if(state.theme==='system')applyAppearance()})}catch{}

  function themeControls(){
    if(route!=='settings')return;
    const heading=qa('.card-head h2').find(x=>/Appearance/i.test(x.textContent)); if(!heading)return;
    const card=heading.closest('.card'); if(!card||q('#appearanceMode',card))return;
    const old=q('[data-action="theme"]',card); if(old)old.hidden=true;
    const wrap=document.createElement('label'); wrap.className='appearance-select'; wrap.innerHTML=`<span><b>Appearance</b><small>Follow your device or choose a theme.</small></span><select id="appearanceMode" aria-label="Appearance mode"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select>`;
    (card.querySelector('.stack-actions')||card).prepend(wrap); q('#appearanceMode').value=state.theme||'system';
    q('#appearanceMode').onchange=e=>{state.theme=e.target.value;applyAppearance();save();toast(`Appearance: ${e.target.options[e.target.selectedIndex].text}`)};
  }

  function pantryRecentControls(){
    if(route!=='pantry')return;
    const form=q('#pantryForm'); if(!form)return;
    const current=state.pantry.map(x=>x.toLowerCase()), rec=uniq(state.pantryRecents).filter(x=>!current.includes(x.toLowerCase())).slice(0,10);
    let box=q('#pantryRecentBox');
    if(!box){box=document.createElement('div');box.id='pantryRecentBox';box.className='pantry-recents';form.parentElement.append(box)}
    box.innerHTML=rec.length?`<small class="muted">Recently used — tap to add again</small><div class="chip-list" style="margin-top:7px">${rec.map(x=>`<button class="chip pantry-recent-add" data-ingredient="${esc(x)}">+ ${esc(x)}</button>`).join('')}</div>`:'';
    qa('.pantry-recent-add',box).forEach(b=>b.onclick=()=>{const v=b.dataset.ingredient;if(!state.pantry.some(x=>x.toLowerCase()===v.toLowerCase()))state.pantry.push(v);state.pantryRecents=uniq([v,...state.pantryRecents]).slice(0,18);save();render();toast(`${v} added to pantry`)})
  }
  document.addEventListener('submit',e=>{if(e.target?.id!=='pantryForm')return;const v=q('#pantryInput')?.value?.trim();if(v){state.pantryRecents=uniq([v,...(state.pantryRecents||[])]).slice(0,18);save()}},true);

  function moveRoutine(id,delta){const i=state.routines.findIndex(r=>r.id===id),j=i+delta;if(i<0||j<0||j>=state.routines.length)return;[state.routines[i],state.routines[j]]=[state.routines[j],state.routines[i]];save();render();toast('Routine order updated')}
  function reorderExercises(id){
    const r=state.routines.find(x=>x.id===id);if(!r)return;
    const draw=()=>{const box=q('#exerciseOrderList');if(!box)return;box.innerHTML=r.exercises.map((e,i)=>`<div class="order-row"><span>${orderGlyph(e)}<b>${esc(e.name)}</b><small>${esc(e.muscle||'')}</small></span><div><button class="ghost compact" data-ex-up="${i}" ${i===0?'disabled':''} aria-label="Move ${esc(e.name)} up">↑</button><button class="ghost compact" data-ex-down="${i}" ${i===r.exercises.length-1?'disabled':''} aria-label="Move ${esc(e.name)} down">↓</button></div></div>`).join('');qa('[data-ex-up]',box).forEach(b=>b.onclick=()=>{const i=+b.dataset.exUp;[r.exercises[i-1],r.exercises[i]]=[r.exercises[i],r.exercises[i-1]];draw()});qa('[data-ex-down]',box).forEach(b=>b.onclick=()=>{const i=+b.dataset.exDown;[r.exercises[i+1],r.exercises[i]]=[r.exercises[i],r.exercises[i+1]];draw()})};
    openModal(`Reorder ${r.name}`,`<p class="muted">Put exercises in the exact order you want them to appear during Veyra Live.</p><div id="exerciseOrderList" class="order-list"></div><button id="saveExerciseOrder" class="primary full" style="margin-top:12px">Save exercise order</button>`);draw();q('#saveExerciseOrder').onclick=()=>{save();closeModal();render();toast('Exercise order saved')}
  }
  function routineOrdering(){
    if(route!=='train')return;
    qa('.routine-card').forEach((card,i)=>{const start=q('[data-routine]',card);if(!start||q('.routine-order-tools',card))return;const tools=document.createElement('div');tools.className='routine-order-tools';tools.innerHTML=`<button class="ghost compact" data-routine-up="${start.dataset.routine}" ${i===0?'disabled':''} aria-label="Move routine up">↑</button><button class="ghost compact" data-routine-down="${start.dataset.routine}" ${i===state.routines.length-1?'disabled':''} aria-label="Move routine down">↓</button><button class="secondary compact" data-reorder-ex="${start.dataset.routine}">Reorder exercises</button>`;card.append(tools)});
    qa('[data-routine-up]').forEach(b=>b.onclick=e=>{e.stopPropagation();moveRoutine(b.dataset.routineUp,-1)});qa('[data-routine-down]').forEach(b=>b.onclick=e=>{e.stopPropagation();moveRoutine(b.dataset.routineDown,1)});qa('[data-reorder-ex]').forEach(b=>b.onclick=e=>{e.stopPropagation();reorderExercises(b.dataset.reorderEx)});
  }

  function servingConverter(form){
    if(!form||q('.mass-converter',form))return;const grams=+form.dataset.servingGrams;if(!(grams>0))return;
    const qty=q('[name="quantity"]',form);if(!qty)return;
    const box=document.createElement('div');box.className='mass-converter callout';box.style.gridColumn='1/-1';box.innerHTML=`<b>Exact mass</b><br><small>This food has a known serving mass. Enter grams or ounces and Veyra will scale the nutrition from the verified serving. Cup-to-gram conversion is only offered when a source provides it.</small><div class="inline-form" style="margin-top:8px"><input class="mass-value" type="number" min="0.1" step="0.1" value="${Math.round(grams*(+qty.value||1)*10)/10}" aria-label="Food mass"><select class="mass-unit" aria-label="Food mass unit"><option value="g">g</option><option value="oz">oz</option></select><button type="button" class="secondary mass-apply">Apply amount</button></div>`;
    const src=q('label',form); if(src)src.parentElement.insertBefore(box,src.nextSibling); else form.prepend(box);
    q('.mass-apply',box).onclick=()=>{const val=+q('.mass-value',box).value,unit=q('.mass-unit',box).value;if(!(val>0))return;const g=unit==='oz'?val*28.349523125:val,newQty=g/grams;qty.value=Math.round(newQty*1000)/1000;qty.dispatchEvent(new Event('input',{bubbles:true}));qty.dispatchEvent(new Event('change',{bubbles:true}));const serving=q('[name="servingLabel"]',form);if(serving)serving.value=`${Math.round(g*10)/10} g`;toast('Nutrition scaled to exact mass')}
  }
  const observer=new MutationObserver(()=>{servingConverter(q('#foodFormV2'));servingConverter(q('#fiReviewForm'))});observer.observe(document.body,{childList:true,subtree:true});

  function accessibleIcons(){
    const map={guideBtn:'Open Veyra Guide',themeBtn:'Change appearance',voiceQuick:'Talk to Veyra',commandBtn:'Open Veyra Command',fab:'Quick add'};
    for(const [id,label] of Object.entries(map)){const el=q('#'+id);if(el){if(!el.getAttribute('aria-label'))el.setAttribute('aria-label',label);if(!el.title)el.title=label}}
    qa('button').forEach(b=>{if(!b.textContent.trim()&&!b.getAttribute('aria-label'))b.setAttribute('aria-label','Veyra control')});
  }

  // Phone-first shortcut: horizontal swipes move only among the five primary tabs and never start on an interactive control.
  let sx=0,sy=0,swipeEligible=false;const primary=['today','food','train','progress','coach'];
  document.addEventListener('touchstart',e=>{if(innerWidth>820||!e.touches?.[0]||e.target.closest('input,textarea,select,button,a,.modal')){swipeEligible=false;return}sx=e.touches[0].clientX;sy=e.touches[0].clientY;swipeEligible=true},{passive:true});
  document.addEventListener('touchend',e=>{if(!swipeEligible||!e.changedTouches?.[0])return;swipeEligible=false;const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.abs(dx)<90||Math.abs(dy)>65)return;const i=primary.indexOf(route);if(i<0)return;const j=dx<0?i+1:i-1;if(j>=0&&j<primary.length)go(primary[j])},{passive:true});

  const priorBind=bind;bind=function(){priorBind();themeControls();pantryRecentControls();routineOrdering();accessibleIcons()};
  const priorRender=render;render=function(){applyAppearance();priorRender()};
  const oldToggle=toggleTheme;toggleTheme=function(){state.theme=resolvedTheme()==='dark'?'light':'dark';applyAppearance();save();render()};
  window.VeyraFinalAudit={applyAppearance,reorderExercises,moveRoutine};
  render();
})();
