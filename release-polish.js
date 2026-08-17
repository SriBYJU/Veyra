/* Veyra 3.2 release polish — final integration layer.
   Adds neutral body-metric tracking, restaurant resolver entry point,
   recipe/saved-meal consistency, shopping actions, reminders, and undo. */
(function(){
  const REL='3.4.1';
  const round1=n=>Math.round((Number(n)||0)*10)/10;
  state.bodyMetrics ||= [];
  function syncVeyraBadge(){
    try{
      if(!('setAppBadge' in navigator))return;
      const n=Number(state.streak)||0;
      if(n>0)navigator.setAppBadge(n).catch(()=>{});else if('clearAppBadge' in navigator)navigator.clearAppBadge().catch(()=>{});
    }catch{}
  }
  window.syncVeyraBadge=syncVeyraBadge;
  state.reminders ||= {enabled:false,dailyCheck:'19:00',workout:'',lastNotified:''};
  state.autopilot ||= {enabled:true};
  state.shoppingList ||= [];
  state.learning ||= {}; state.learning.recipeLikes ||= {};
  state.appVersion=REL;

  /* Normalize legacy recipe-calculator saves into the saved-meal shape. */
  state.savedMeals=(state.savedMeals||[]).map(x=>Array.isArray(x.items)?x:{id:x.id||uid(),name:x.name||'Saved meal',items:[{name:x.name||'Saved meal',meal:'Snack',cal:+x.cal||0,p:+x.p||0,c:+x.c||0,f:+x.f||0,fiber:+x.fiber||0,sugar:+x.sugar||0,quantity:1,servingLabel:x.servingLabel||'1 serving',source:x.source||'saved recipe',confidence:x.confidence||95}]});

  /* Lightweight undo detector: catches newly-added logs as one batch. */
  let undoSnapshot={meals:(state.meals||[]).map(x=>x.id),activities:(state.activities||[]).map(x=>x.id),workouts:(state.workouts||[]).map(x=>x.id),sleep:(state.sleep||[]).map(x=>x.id),bodyMetrics:(state.bodyMetrics||[]).map(x=>x.id)};
  let suppressUndo=false;
  const baseSaveRelease=save;
  save=function(){
    if(!suppressUndo){
      const added={};let total=0;
      for(const k of Object.keys(undoSnapshot)){const old=new Set(undoSnapshot[k]),ids=(state[k]||[]).map(x=>x.id).filter(Boolean),a=ids.filter(id=>!old.has(id));if(a.length){added[k]=a;total+=a.length}}
      if(total>0)window.__veyraUndo={added,at:Date.now(),label:total===1?'last log':`${total} linked logs`};
    }
    baseSaveRelease();
    undoSnapshot={meals:(state.meals||[]).map(x=>x.id),activities:(state.activities||[]).map(x=>x.id),workouts:(state.workouts||[]).map(x=>x.id),sleep:(state.sleep||[]).map(x=>x.id),bodyMetrics:(state.bodyMetrics||[]).map(x=>x.id)};
  };

  function undoLast(){const u=window.__veyraUndo;if(!u)return toast('Nothing recent to undo');suppressUndo=true;for(const [k,ids] of Object.entries(u.added||{})){const set=new Set(ids);state[k]=(state[k]||[]).filter(x=>!set.has(x.id))}window.__veyraUndo=null;save();suppressUndo=false;render();toast('Last log undone')}

  function bodyMetricModal(existing=null){
    const x=existing||{id:'',date:today(),time:now().toTimeString().slice(0,5),weight:'',note:''},unit=state.profile.units==='metric'?'kg':'lb';
    openModal(existing?'Edit body measurement':'Log body measurement',`<div class="callout"><b>Optional & neutral.</b><br>This is simply a measurement log. Veyra does not score your body, compare you with other people, or assign an “ideal” appearance.</div><form id="bodyMetricForm" class="form-grid"><label>Date<input name="date" type="date" value="${esc(x.date||today())}"></label><label>Time<input name="time" type="time" value="${esc(x.time||'')}"></label><label style="grid-column:1/-1">Body weight (${unit})<input name="weight" type="number" min="1" step="0.1" value="${x.weight??''}" required></label><label style="grid-column:1/-1">Optional note<input name="note" value="${esc(x.note||'')}" placeholder="Context only"></label><button class="primary" style="grid-column:1/-1">${existing?'Save changes':'Save measurement'}</button>${existing?'<button type="button" id="deleteBodyMetric" class="ghost" style="grid-column:1/-1">Delete measurement</button>':''}</form>`);
    $('#bodyMetricForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget)),obj={id:x.id||uid(),date:d.date,time:d.time,weight:+d.weight,note:d.note||''};if(existing)state.bodyMetrics[state.bodyMetrics.findIndex(y=>y.id===x.id)]=obj;else state.bodyMetrics.push(obj);state.bodyMetrics.sort((a,b)=>(a.date+' '+a.time).localeCompare(b.date+' '+b.time));save();closeModal();render();toast(existing?'Measurement updated':'Measurement logged')};
    $('#deleteBodyMetric')?.addEventListener('click',()=>{state.bodyMetrics=state.bodyMetrics.filter(y=>y.id!==x.id);save();closeModal();render();toast('Measurement deleted')});
  }
  function bodyTrendCard(){
    const rows=(state.bodyMetrics||[]).slice(-30),unit=state.profile.units==='metric'?'kg':'lb';
    if(!rows.length)return `<div class="card body-metric-card"><div class="card-head"><div><h2>Optional body measurement</h2><small>Observed measurements only — no body score.</small></div><button class="secondary compact" data-action="bodyMetric">+ Log</button></div><div class="empty">No body measurements logged. Add one only if this is useful to you.</div></div>`;
    const vals=rows.map(x=>+x.weight),min=Math.min(...vals),max=Math.max(...vals),w=640,h=190,p=30,X=i=>p+i/Math.max(1,rows.length-1)*(w-p*2),Y=v=>h-p-(v-min)/(max-min||1)*(h-p*2),path=rows.map((x,i)=>`${i?'L':'M'}${X(i)},${Y(+x.weight)}`).join(' '),delta=vals.at(-1)-vals[0];
    return `<div class="card body-metric-card"><div class="card-head"><div><h2>Optional body measurement</h2><small>${rows.length} logged measurement${rows.length===1?'':'s'} • observed only</small></div><button class="secondary compact" data-action="bodyMetric">+ Log</button></div><div class="metric-summary-row"><div><small>Latest</small><b>${round1(vals.at(-1))} ${unit}</b></div><div><small>Change across these logs</small><b>${delta>0?'+':''}${round1(delta)} ${unit}</b></div></div><svg viewBox="0 0 ${w} ${h}" class="body-trend-svg" role="img" aria-label="Observed body weight history"><path d="${path}" class="chart-line-a"/>${rows.map((x,i)=>`<circle cx="${X(i)}" cy="${Y(+x.weight)}" r="4" fill="#2be8d0" data-body-id="${x.id}"><title>${x.date} • ${x.weight} ${unit}</title></circle>`).join('')}</svg><div class="body-metric-list">${rows.slice(-5).reverse().map(x=>`<button class="preference-row body-edit-row" data-body-edit="${x.id}"><b>${esc(x.date)}</b><span>${round1(x.weight)} ${unit}${x.note?' • '+esc(x.note):''}</span><small>Edit ›</small></button>`).join('')}</div><div class="callout">Veyra shows what you logged. It does not infer health, attractiveness, or an ideal weight from this chart.</div></div>`;
  }

  function recipeCalculatorV3(){
    openModal('Recipe calculator',`<p class="muted">Enter totals for the whole recipe. Veyra converts them to a reusable per-serving meal.</p><form id="recipeCalcV3" class="form-grid"><label style="grid-column:1/-1">Recipe name<input name="name" required placeholder="Protein pasta"></label><label>Total calories<input name="cal" type="number" min="0" step=".1" required></label><label>Total protein (g)<input name="p" type="number" min="0" step=".1" required></label><label>Total carbs (g)<input name="c" type="number" min="0" step=".1"></label><label>Total fat (g)<input name="f" type="number" min="0" step=".1"></label><label>Total fiber (g)<input name="fiber" type="number" min="0" step=".1"></label><label>Total sugar (g)<input name="sugar" type="number" min="0" step=".1"></label><label>Servings<input name="servings" type="number" value="6" min="1" step="1" required></label><button class="primary" style="grid-column:1/-1">Calculate & save</button></form><div id="recipeCalcOutV3"></div>`);
    $('#recipeCalcV3').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget)),n=Math.max(1,+d.servings),per=k=>round1((+d[k]||0)/n),item={name:d.name,meal:'Snack',cal:per('cal'),p:per('p'),c:per('c'),f:per('f'),fiber:per('fiber'),sugar:per('sugar'),quantity:1,servingLabel:`1 of ${n} servings`,source:'user recipe calculator',confidence:98};state.savedMeals.push({id:uid(),name:d.name,items:[item]});save();$('#recipeCalcOutV3').innerHTML=`<div class="callout"><b>Per serving:</b> ${item.cal} kcal • ${item.p}g protein • ${item.c}g carbs • ${item.f}g fat. Saved under Saved Meals.</div>`;toast('Recipe saved')};
  }

  function favoritesCard(){const favs=recipeLibrary().filter(r=>state.learning.recipeLikes?.[r.name]);return `<div class="card" style="margin-top:16px"><div class="card-head"><div><h2>Favorite recipes</h2><small>Your own saved favorites.</small></div></div>${favs.length?`<div class="food-results">${favs.map(r=>`<button class="food-result" data-recipe="${esc(r.name)}"><span class="fallback-food-img">${r.emoji||'🍲'}</span><span><b>${esc(r.name)}</b><small>${esc(r.cuisine||'')} • ${r.cal} kcal • ${r.p}g protein</small></span><span>View ›</span></button>`).join('')}</div>`:'<div class="empty">Favorite a recipe and it will stay easy to find here.</div>'}</div>`}

  function reminderCard(){const r=state.reminders;return `<div class="card" style="margin-top:16px"><div class="card-head"><div><h2>Optional reminders</h2><small>Browser-friendly, not a hidden cloud notification service.</small></div></div><label class="switch-label"><input id="reminderEnabled" type="checkbox" ${r.enabled?'checked':''}> Enable in-app/browser reminders</label><div class="form-grid" style="margin-top:10px"><label>Daily check-in<input id="reminderDaily" type="time" value="${esc(r.dailyCheck||'19:00')}"></label><label>Workout reminder<input id="reminderWorkout" type="time" value="${esc(r.workout||'')}"></label></div><button id="reminderPermission" class="secondary" style="margin-top:10px">Enable browser notifications</button><div class="callout" style="margin-top:10px">Static PWAs cannot guarantee scheduled background notifications when the browser/OS fully closes the site. Veyra checks reminders while open and when you return; supported browsers can show a notification after permission.</div></div>`}

  function todayCoverageCard(){
    const meals=(state.meals||[]).filter(x=>x.date===today()),works=(state.workouts||[]).filter(x=>x.date===today()),acts=(state.activities||[]).filter(x=>x.date===today()),t=totals(),p=state.profile||{},water=(state.water||{})[today()]||0;
    const rows=[
      ['Nutrition logged',meals.length?`${meals.length} entr${meals.length===1?'y':'ies'}`:'Not logged yet',!!meals.length,'food'],
      ['Training',works.length?`${works.length} workout${works.length===1?'':'s'}`:'No workout logged',!!works.length,'train'],
      ['Activity',acts.length?`${acts.length} activit${acts.length===1?'y':'ies'}`:'No activity logged',!!acts.length,'activityManual'],
      ['Protein target',p.proteinGoal>0?`${Math.round(t.p)} / ${Math.round(p.proteinGoal)} g`:'Target not set',p.proteinGoal>0&&t.p>=p.proteinGoal,'editGoals'],
      ['Fiber target',p.fiberGoal>0?`${Math.round(t.fiber)} / ${Math.round(p.fiberGoal)} g`:'Target not set',p.fiberGoal>0&&t.fiber>=p.fiberGoal,'editGoals'],
      ['Hydration',p.waterGoal>0?`${Math.round(water)} / ${Math.round(p.waterGoal)} ${p.units==='metric'?'mL':'oz'}`:'Target not set',p.waterGoal>0&&water>=p.waterGoal,'water']
    ];
    return `<div class="card coverage-card"><div class="card-head"><div><h2>Today’s Coverage</h2><small>A neutral snapshot of what is logged — not a score for being “good” or “bad.”</small></div></div><div class="coverage-grid">${rows.map(([a,b,done,act])=>`<button class="coverage-item ${done?'covered':''}" data-action="${act}"><span>${done?'✓':'○'}</span><div><b>${a}</b><small>${b}</small></div><em>›</em></button>`).join('')}</div></div>`;
  }
  function autopilotCard(){
    if(state.autopilot?.enabled===false)return `<div class="card autopilot-card"><div class="card-head"><div><span class="eyebrow">VEYRA AUTOPILOT</span><h2>Adaptive daily planning is paused</h2><small>Turn it back on in Settings whenever you want contextual next steps.</small></div><button class="secondary compact" data-route="settings">Settings</button></div></div>`;
    const t=totals(),p=state.profile||{},sleep=(state.sleep||[]).find(x=>x.date===today()),water=(state.water||{})[today()]||0,plan=state.dayPlans?.[today()],routine=plan&&(state.routines||[]).find(x=>x.id===plan.routineId),items=[];
    if(routine)items.push(['🏋️',`Planned: ${routine.name}`,`${routine.exercises?.length||0} exercises from your weekly plan.`,'startWorkout']);
    else if(p.trainingDays)items.push(['🗓️','Build today from your week',`Your profile says ${p.trainingDays} training day${p.trainingDays===1?'':'s'} per week. Build or refresh a flexible plan.`,'buildWeekPlan']);
    if(p.proteinGoal>0&&t.p<p.proteinGoal)items.push(['🍲','Close your nutrition gap',`${Math.max(0,Math.round(p.proteinGoal-t.p))}g protein remains against the target you chose. Use pantry + cuisine constraints.`,'fillDay']);
    else if(!(state.meals||[]).some(x=>x.date===today()))items.push(['🍴','Log your first meal','Type it, say it, scan a barcode/label, or use Veyra Lens.','addFood']);
    if(p.waterGoal>0&&water<p.waterGoal*.65)items.push(['💧','Hydration check-in',`${Math.round(water)} of ${Math.round(p.waterGoal)} ${p.units==='metric'?'mL':'oz'} logged.`,'water']);
    if(!sleep)items.push(['☾','Add recovery context','Log sleep/energy so training and progress views have the full picture.','logSleep']);
    else if(sleep.energy&&sleep.energy<=2)items.push(['☾','Keep today flexible','You marked lower energy. Autopilot keeps the plan visible without forcing a harder session.','sleep']);
    if(items.length<3)items.push(['📈','Review what is changing','Use Progress, Replay and Lab to turn your own history into useful context.','progress']);
    return `<div class="card autopilot-card"><div class="card-head"><div><span class="eyebrow">VEYRA AUTOPILOT</span><h2>Your adaptive day</h2><small>Recomputes from your profile, pantry, nutrition, training plan, recovery and history. It suggests — you stay in control.</small></div><span class="status-badge good">Live</span></div><div class="autopilot-grid">${items.slice(0,4).map(([ic,title,body,act])=>`<button class="autopilot-step" data-action="${act}"><span>${ic}</span><div><b>${title}</b><small>${body}</small></div><em>›</em></button>`).join('')}</div></div>`;
  }
  function autopilotSettingsCard(){return `<div class="card"><div class="card-head"><div><h2>✦ Veyra Autopilot</h2><small>Adaptive, local daily suggestions across nutrition, training, recovery and pantry.</small></div></div><label class="switch-label"><input id="autopilotEnabled" type="checkbox" ${state.autopilot?.enabled===false?'':'checked'}> Show adaptive daily plan on Today</label><div class="callout" style="margin-top:10px"><b>User-controlled.</b><br>Autopilot never silently changes your calorie/macronutrient targets, food log or workout history. It only proposes next actions from data you have chosen to store.</div></div>`}


  function browserCompatibilityCard(){
    const nativeBarcode='BarcodeDetector' in window;
    const voice=!!(window.SpeechRecognition||window.webkitSpeechRecognition);
    const notifications='Notification' in window;
    const serviceWorker='serviceWorker' in navigator;
    const zxing=!!window.ZXingBrowser?.BrowserMultiFormatReader;
    const live=(label,ok,detail)=>`<div class="preference-row"><div><b>${label}</b><small>${detail}</small></div><span class="status-badge ${ok?'good':'warn'}">${ok?'Available':'Fallback'}</span></div>`;
    return `<div class="card" style="margin-top:16px"><div class="card-head"><div><h2>Browser Compatibility</h2><small>What works where — and which features use a fallback.</small></div></div>
      <div class="callout"><b>Recommended:</b> current Chrome or Edge for the fullest browser-API support. Current Safari and Firefox support Veyra's core app; Veyra falls back when a browser does not expose a native API.</div>
      <div class="browser-compat-grid">
        <div class="method-card"><strong>Chrome / Edge</strong><p>Core app supported. Native barcode acceleration is commonly available, voice recognition is supported where the browser/OS exposes it, and install prompts work when PWA requirements are met.</p></div>
        <div class="method-card"><strong>Safari — iPhone, iPad, Mac</strong><p>Core app supported. Barcode photos use Veyra's JavaScript ZXing decoder when Safari has no native BarcodeDetector. Voice depends on Safari/Siri availability and can differ in a Home Screen web app. Install on iPhone/iPad with Share → Add to Home Screen.</p></div>
        <div class="method-card"><strong>Firefox</strong><p>Core app, photo uploads and JavaScript barcode fallback are supported. Built-in SpeechRecognition is generally not exposed, so use typed commands or your device keyboard microphone. Desktop PWA installation differs from Chrome/Edge.</p></div>
        <div class="method-card"><strong>Other modern Chromium browsers</strong><p>Core Veyra features should work. Exact native barcode, voice, install and notification capabilities depend on the browser and operating system.</p></div>
      </div>
      <h3 style="margin-top:14px">This browser right now</h3>
      <div class="preference-list">${live('Native barcode detector',nativeBarcode,nativeBarcode?'Used as the fast first path.':'Veyra uses ZXing instead.')}${live('ZXing barcode decoder',zxing,zxing?'JavaScript barcode fallback loaded.':'Loaded/retried on demand when you scan.')}${live('Built-in voice recognition',voice,voice?'Voice commands can use the browser recognizer.':'Typed commands and keyboard dictation still use the same Veyra command engine.')}${live('Service worker / offline app shell',serviceWorker,serviceWorker?'Offline core can be cached after first load.':'Use Veyra online in this browser.')}${live('Browser notifications',notifications,notifications?'Permission is still required.':'In-app reminder checks remain available while Veyra is open.')}</div>
      <div class="callout" style="margin-top:12px"><b>Not browser-locked:</b> nutrition logging/search, pantry, pantry-only recipes, workouts, activity history, sleep, hydration, progress graphs, Replay, Vault import/export, text Coach, and ordinary image uploads. Smart Vision/OCR may need a first-time model download and can run slower on lower-memory devices.</div>
    </div>`;
  }

  const baseProgress=views.progress,baseProfile=views.profile,baseRecipes=views.recipes,baseSettings=views.settings,baseToday=views.today;
  views.progress=function(){return baseProgress()+`<div class="section-title"><div><h2>Body measurement history</h2><p>Optional, neutral and separate from training performance.</p></div></div>`+bodyTrendCard()};
  views.profile=function(){let base=baseProfile();base=base.replace('Export food log (.csv)</button>','Export food log (.csv)</button><button class="secondary" data-action="humanReport">Download human-readable report (.txt)</button>');return base+`<div class="section-title"><div><h2>Optional measurements</h2><p>Keep a portable record if it is useful to you.</p></div></div>`+bodyTrendCard()};
  views.recipes=function(){return baseRecipes()+favoritesCard()};
  views.settings=function(){return baseSettings()+browserCompatibilityCard()+autopilotSettingsCard()+reminderCard()};
  views.today=function(){let base=baseToday();base=base+`<div class="grid grid-2 release-intelligence-grid" style="margin-top:16px">${autopilotCard()}${todayCoverageCard()}</div>`;return window.__veyraUndo?base.replace('<div class="quick-actions">',`<div class="undo-banner"><span>↶</span><div><b>Recent log saved</b><small>You can undo the latest added log batch.</small></div><button class="secondary compact" data-action="undoLast">Undo</button></div><div class="quick-actions">`):base};

  function clearShopping(){if(!state.shoppingList.length)return toast('Shopping list is already empty');state.shoppingList=[];save();render();toast('Shopping list cleared')}

  function exportHumanReport(){
    const p=state.profile||{}, t=totals(), recentMeals=(state.meals||[]).slice(-20), recentWorkouts=(state.workouts||[]).slice(-10), recentSleep=(state.sleep||[]).slice(-7), milestones=(state.milestones||[]).slice(-10);
    const lines=[
      'VEYRA — HUMAN-READABLE FITNESS & NUTRITION REPORT',
      `Generated: ${new Date().toLocaleString()}`,'',
      'PROFILE',
      `Name: ${p.name||'Not set'}`,
      `Goal: ${p.goalText||p.goal||'Not set'}`,
      `Diet: ${p.diet||'Not set'}`,
      `Dietary restrictions: ${(p.dietaryRestrictions||[]).join(', ')||'None saved'}`,
      `Favorite cuisines: ${(p.favoriteCuisines||[]).join(', ')||'None saved'}`,
      `Training preference: ${p.trainingPreference||'Not set'} • ${p.trainingDays||0} day(s)/week • ${p.sessionMinutes||0} min/session`,'',
      'TARGETS YOU CHOSE',
      `Calories: ${p.calorieGoal||'Not set'} kcal`, `Protein: ${p.proteinGoal||'Not set'} g`, `Carbs: ${p.carbGoal||'Not set'} g`, `Fat: ${p.fatGoal||'Not set'} g`, `Fiber: ${p.fiberGoal||'Not set'} g`, `Water: ${p.waterGoal||'Not set'} ${p.units==='metric'?'mL':'oz'}`,'',
      'TODAY',
      `Logged nutrition: ${Math.round(t.cal)} kcal • ${round1(t.p)} g protein • ${round1(t.c)} g carbs • ${round1(t.f)} g fat • ${round1(t.fiber)} g fiber`,
      `Meals logged today: ${(state.meals||[]).filter(x=>x.date===today()).length}`,
      `Workouts logged today: ${(state.workouts||[]).filter(x=>x.date===today()).length}`,
      `Activities logged today: ${(state.activities||[]).filter(x=>x.date===today()).length}`,'',
      'RECENT FOOD',
      ...(recentMeals.length?recentMeals.map(x=>`${x.date} ${x.time||''} — ${x.name}: ${Math.round(+x.cal||0)} kcal, ${round1(x.p)} g protein`):['No food history yet.']),'',
      'RECENT WORKOUTS',
      ...(recentWorkouts.length?recentWorkouts.map(x=>`${x.date} — ${x.routine||'Workout'}: ${x.duration||0} min, ${(x.exercises||[]).length} exercises`):['No workout history yet.']),'',
      'RECENT SLEEP / RECOVERY',
      ...(recentSleep.length?recentSleep.map(x=>`${x.date} — ${x.hours||x.duration||'—'} h • quality ${x.quality||'—'} • energy ${x.energy||'—'}`):['No sleep history yet.']),'',
      'RECENT MILESTONES',
      ...(milestones.length?milestones.map(x=>`${x.date||''} — ${x.title||''}${x.body?' — '+x.body:''}`):['No milestones yet.']),'',
      'NOTES',
      'This report reflects user-entered data and Veyra estimates. It is an informational export, not medical advice.'
    ];
    download(new Blob([lines.join('\n')],{type:'text/plain'}),`veyra-readable-report-${today()}.txt`);toast('Human-readable report downloaded');
  }

  const baseActionRelease=window.action;
  window.action=action=function(a){
    if(a==='bodyMetric')return bodyMetricModal();
    if(a==='recipeCalc')return recipeCalculatorV3();
    if(a==='clearShopping')return clearShopping();
    if(a==='undoLast')return undoLast();
    if(a==='humanReport')return exportHumanReport();
    return baseActionRelease?baseActionRelease(a):undefined;
  };

  const baseBindRelease=bind;
  bind=function(){
    baseBindRelease();
    $$('[data-body-edit]').forEach(b=>b.onclick=()=>{const x=state.bodyMetrics.find(y=>y.id===b.dataset.bodyEdit);if(x)bodyMetricModal(x)});
    $$('[data-shoppingremove]').forEach(b=>b.onclick=()=>{state.shoppingList.splice(+b.dataset.shoppingremove,1);save();render()});
    $('#reminderEnabled')?.addEventListener('change',e=>{state.reminders.enabled=e.target.checked;save();toast(e.target.checked?'Reminders enabled':'Reminders off')});
    $('#reminderDaily')?.addEventListener('change',e=>{state.reminders.dailyCheck=e.target.value;save()});
    $('#reminderWorkout')?.addEventListener('change',e=>{state.reminders.workout=e.target.value;save()});
    $('#autopilotEnabled')?.addEventListener('change',e=>{state.autopilot.enabled=e.target.checked;save();render();toast(e.target.checked?'Autopilot enabled':'Autopilot paused')});
    $('#reminderPermission')?.addEventListener('click',async()=>{if(!('Notification'in window))return toast('Browser notifications are not supported here');try{const p=await Notification.requestPermission();toast(`Notification permission: ${p}`)}catch{toast('Notification permission was not available')}});
  };

  function checkReminders(){if(!state.reminders?.enabled)return;const d=new Date(),hh=String(d.getHours()).padStart(2,'0'),mm=String(d.getMinutes()).padStart(2,'0'),stamp=today()+' '+hh+':'+mm;for(const [label,time] of [['Daily Veyra check-in',state.reminders.dailyCheck],['Workout reminder',state.reminders.workout]])if(time&&time===hh+':'+mm&&state.reminders.lastNotified!==stamp+label){state.reminders.lastNotified=stamp+label;baseSaveRelease();if('Notification'in window&&Notification.permission==='granted'){try{new Notification('Veyra',{body:label,icon:'assets/icon-192.png'})}catch{toast(label)}}else toast(label)}}
  setInterval(checkReminders,60000);setTimeout(checkReminders,1500);

  /* Add Guide mapping for body measurements/reminders without rebuilding the whole guide. */
  const baseGuide=window.openGuide;
  window.openGuide=function(...args){baseGuide?.(...args);setTimeout(()=>{const list=$('#guideMapV2');if(list&&!list.querySelector('[data-guide-key="body"]'))list.insertAdjacentHTML('beforeend',`<button class="guide-map-row" data-guide-key="body"><span>⚖️</span><div><b>Optional body measurement</b><small>Progress / Profile → Body measurement history</small></div><em>›</em></button><button class="guide-map-row" data-guide-key="reminders"><span>🔔</span><div><b>Optional reminders</b><small>Settings → Optional reminders</small></div><em>›</em></button><button class="guide-map-row" data-guide-key="browsers"><span>🌐</span><div><b>Browser Compatibility</b><small>Settings → Browser Compatibility</small></div><em>›</em></button>`);list?.querySelector('[data-guide-key="body"]')?.addEventListener('click',()=>{closeModal();go('progress')});list?.querySelector('[data-guide-key="reminders"]')?.addEventListener('click',()=>{closeModal();go('settings')});list?.querySelector('[data-guide-key="browsers"]')?.addEventListener('click',()=>{closeModal();go('settings')})},0)};

  const baseTouchForBadge=window.touchStreak;
  if(baseTouchForBadge)window.touchStreak=touchStreak=function(...args){const out=baseTouchForBadge(...args);syncVeyraBadge();return out;};
  const baseRenderForBadge=window.render||render;
  if(baseRenderForBadge)window.render=render=function(...args){const out=baseRenderForBadge(...args);syncVeyraBadge();return out;};
  save();render();
  window.VEYRA_RELEASE_VERSION=REL;
  syncVeyraBadge();
})();
