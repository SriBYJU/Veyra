/* Veyra Clarity Layer 3.2
   Product-wide discoverability: every major page explains what it is for,
   exposes the most relevant next actions, and feeds one searchable Guide.
*/
(function(){
  const VERSION='3.2.0';
  const HELP={
    today:{icon:'⌂',title:'Today',summary:'Your live day: nutrition, activity, recovery, progress, Veyra Nexus, Autopilot and Today’s Coverage in one place.',actions:[['+ Log','quickAdd'],['Edit goals','editGoals'],['Import activity','activityImport']]},
    food:{icon:'🍴',title:'Nutrition',summary:'Log food by typing, voice, barcode, label or photo; tap any logged item to edit it later.',actions:[['Add food','addFood'],['Scan with Lens','lens'],['Food preferences','profile']]},
    train:{icon:'🏋️',title:'Train',summary:'Build routines, start Veyra Live, track sets/reps/load/time/distance, rest and exercise progress.',actions:[['Start workout','startWorkout'],['Create routine','addRoutine'],['Training preferences','profile']]},
    progress:{icon:'↗',title:'Progress',summary:'See real logged trends, exercise progression, milestones and Today/Week/Month/YTD/All Time/Predictive views.',actions:[['Weekly report','weeklyReport'],['Replay history','replay'],['Edit goals','editGoals']]},
    coach:{icon:'✦',title:'Coach',summary:'Ask about your own logs, training progress, pantry, recipes and where to find anything in Veyra.',actions:[['Talk to Veyra','voice'],['Replay history','replay'],['Edit profile','profile']]},
    profile:{icon:'👤',title:'Your Profile',summary:'This is the current user — name, goals, diet, restrictions, cuisines, training preferences and portable data.',actions:[['Edit full profile','setupProfile'],['Edit targets','editGoals'],['Export Vault','export']]},
    recipes:{icon:'👨‍🍳',title:'Recipes',summary:'Find meals using cuisine, pantry, dietary preferences, cooking time and the nutrition constraints you choose.',actions:[['Build a meal','recipeFinder'],['Scan ingredients','pantryCamera'],['Edit food preferences','profile']]},
    pantry:{icon:'🧺',title:'Pantry',summary:'Keep ingredients you actually have so recipe suggestions can use them instead of guessing.',actions:[['Scan ingredients','pantryCamera'],['Find recipes','recipes'],['Edit food preferences','profile']]},
    lab:{icon:'🧪',title:'Veyra Lab',summary:'Run your own descriptive habit experiments with sample size shown and no causation claims.',actions:[['New experiment','newExperiment'],['Replay history','replay']]},
    sleep:{icon:'☾',title:'Sleep & Recovery',summary:'Log sleep, energy, soreness and stress so recovery context can sit beside training — not diagnose it.',actions:[['Log sleep','logSleep'],['Hydration','water'],['View progress','progress']]},
    data:{icon:'🌍',title:'Public Data',summary:'See the public evidence and data sources Veyra references, clearly separated from your personal data.',actions:[['Methodology','about']]},
    creator:{icon:'◎',title:'About Creator',summary:'About Veyra’s creator and why the project exists. This is separate from the current user profile.',actions:[['Your profile','profile'],['Methodology','about']]},
    about:{icon:'◉',title:'Methodology',summary:'Technical details: local-first storage, uncertainty, food sources, vision, training analytics, privacy and PWA design.',actions:[['Public data','data'],['Settings','settings']]},
    settings:{icon:'⚙',title:'Settings',summary:'Targets, profile preferences, install instructions, privacy, Spotify, reminders, appearance and accessibility live here.',actions:[['Edit targets','editGoals'],['Edit profile','setupProfile'],['Open Guide','guide']]}
  };

  const GUIDE=[
    ['⌂','Today dashboard','Today → live nutrition, activity, recovery, timeline and Veyra Nexus','today'],
    ['✦','Veyra Autopilot','Today → adaptive daily plan; Settings → pause/resume Autopilot','today'],
    ['✓','Today’s Coverage','Today → neutral checklist of what is logged and which targets are set/met','today'],
    ['🎯','Calories, protein, carbs, fat, fiber & water','Goals at the top of every screen, Nutrition cards, Profile → Daily targets, or Settings → Calories & macros','goals'],
    ['👤','Name & main goal','Profile → Edit full profile','profile'],
    ['🥗','Dietary restrictions, allergies & foods to avoid','Profile → Food preferences → Edit full profile','profile'],
    ['🌍','Favorite cuisines & cooking preferences','Profile → Food preferences → Edit full profile','profile'],
    ['📅','Training days, session time & equipment','Profile → Training preferences → Edit full profile','profile'],
    ['📸','Scan gym equipment','Train → Scan gym equipment → confirm equipment → suggested exercises','equipmentCamera'],
    ['🍴','Log a food or meal','Nutrition → Add food, + Log, command bar, or voice','food'],
    ['🎙️','Voice logging & voice commands','Microphone in the top bar or Talk to Veyra','voice'],
    ['🍽️','Restaurant or branded food','Say/type what you ate naturally; Veyra asks for missing size/quantity and shows a review screen','restaurant'],
    ['▦','Barcode lookup','Nutrition → Add food → Barcode, or Veyra Lens','barcode'],
    ['🏷️','Nutrition label photo','Veyra Lens → Nutrition label → review extracted values','labelScan'],
    ['📸','Meal photo','Veyra Lens → Food photo → Smart Vision candidates → confirm amount/nutrition','lens'],
    ['🧺','Ingredient photo','Recipes/Pantry → Scan ingredients → confirm → recipe matching','pantryCamera'],
    ['⭐','Saved meals & repeat foods','Nutrition → Saved meals / recent foods','savedMeals'],
    ['💾','Save the meal I just logged','Nutrition → Save current meal','saveCurrentMeal'],
    ['📋','Copy yesterday’s meal entries','Nutrition → Copy yesterday → review selected items','copyYesterday'],
    ['🧬','Optional vitamins & micronutrients','Nutrition → Advanced nutrients → Optional','advancedNutrition'],
    ['🛒','Shopping list','Recipes → Shopping list; add missing recipe ingredients','shopping'],
    ['🧮','Recipe nutrition calculator','Nutrition / Recipes → Recipe calculator','recipeCalc'],
    ['🌤️','Flexible Day','Nutrition → Flexible Day','flexDay'],
    ['✨','Pantry/cuisine/macros recipe search','Recipes → Build a meal','recipeFinder'],
    ['📲','Apple/Samsung/Garmin/Strava screenshot import','Today → Import Activity → upload screenshot → review → save','activityImport'],
    ['🏃','Manual activity','Today + Log → Activity → enter duration/distance only if you know them','activityManual'],
    ['🏋️','Workout routines','Train → Create/Edit routine → Start','train'],
    ['➕','Custom exercise','Train → Build routine → + Custom exercise','customExercise'],
    ['⚙','Plate calculator','Train → Veyra training tools → Plate calculator','plateCalc'],
    ['🔥','Warm-up calculator','Train → Veyra training tools → Warm-up calculator','warmupCalc'],
    ['🧭','Tailor routines to my profile','Train → Tailor to profile','tailorRoutines'],
    ['🗓','Build my weekly workout plan','Train → Veyra Plan → Build my week','buildWeekPlan'],
    ['✅','Sets, reps, load, time & distance','Veyra Live → complete the interactive set checklist','train'],
    ['⏱️','Rest timer & timed exercises','Veyra Live → per-exercise rest + timed-set controls','train'],
    ['⚡','Supersets, substitutions & notes','Veyra Live → exercise tools','train'],
    ['🎤','Voice set logging','During Veyra Live → microphone / voice command; confirm values before saving','voice'],
    ['📈','Exercise strength/progression graphs','Progress → exercise analytics; Veyra highlights PRs and change from your first logs','progress'],
    ['🗓️','Training history & reports','Progress → calendar / weekly or monthly report','progress'],
    ['🏆','Streaks, PRs & achievements','Progress → Milestones / Achievements; the installed app also uses an app-icon streak badge where the browser supports it','streaks'],
    ['☾','Sleep, recovery & energy','Sleep & Recovery → Log sleep','sleep'],
    ['💧','Hydration','Today water card / quick add; target is editable from Goals','water'],
    ['⚖️','Optional body measurement history','Progress or Profile → Optional body measurement','body'],
    ['▶','Veyra Replay','Today/Progress → Replay → search your own local history','replay'],
    ['🧪','Veyra Lab','Veyra Lab → New experiment','lab'],
    ['✦','Veyra Nexus','Today → contextual next actions generated from your own logs','today'],
    ['🤖','Veyra Coach','Coach → ask about your logs, recipes, workouts or navigation','coach'],
    ['🎵','Spotify','Settings → Spotify → add your Spotify Client ID and connect','spotify'],
    ['📦','Move to another device','Profile/Settings → Export Veyra Vault JSON; import it on the other device','vault'],
    ['📄','Export food history CSV','Profile → Veyra Vault → Export food log (.csv)','profile'],
    ['📝','Human-readable report','Profile → Veyra Vault → Download human-readable report (.txt)','humanReport'],
    ['🔔','Optional reminders','Settings → Optional reminders','reminders'],
    ['◐','Light/dark theme & reduced motion','Top-right theme button / Settings → Appearance & accessibility','settings'],
    ['▯','Optional AdSense-ready space','Settings → Appearance, accessibility & optional ads → Reserve optional AdSense placements','ads'],
    ['📱','Install like an app','Settings → Install Veyra for iPhone/iPad, Android and desktop directions','install'],
    ['🌐','Public data & sources','Public Data → WHO/CDC/USDA/Open Food Facts references','data'],
    ['◉','How Veyra works technically','Methodology','about'],
    ['◎','About the creator','About Creator','creator'],
    ['🔒','Privacy, export & delete local data','Settings / Profile → Veyra Vault & Privacy','settings'],
    ['🗑','Delete all local Veyra data','Settings → Privacy → Delete all local data','deleteData']
  ];

  function act(key){
    if(HELP[key])return go(key);
    if(key==='goals')return window.action?.('editGoals');
    if(key==='profile')return go('profile');
    if(key==='food')return go('food');
    if(key==='train')return go('train');
    if(key==='progress')return go('progress');
    if(key==='coach')return go('coach');
    if(key==='recipes')return go('recipes');
    if(key==='data')return go('data');
    if(key==='about')return go('about');
    if(key==='creator')return go('creator');
    if(key==='settings')return go('settings');
    if(key==='lab')return go('lab');
    if(key==='sleep')return go('sleep');
    if(key==='body'){closeModal();go('progress');setTimeout(()=>document.querySelector('.body-metric-card')?.scrollIntoView({behavior:'smooth',block:'center'}),100);return;}
    if(key==='vault'){closeModal();go('profile');setTimeout(()=>[...document.querySelectorAll('.card h2')].find(x=>x.textContent.includes('Veyra Vault'))?.closest('.card')?.scrollIntoView({behavior:'smooth',block:'center'}),100);return;}
    if(key==='install')return window.installApp?installApp():go('settings');
    if(key==='reminders'){closeModal();go('settings');setTimeout(()=>document.querySelector('#reminderEnabled')?.closest('.card')?.scrollIntoView({behavior:'smooth',block:'center'}),100);return;}
    if(key==='spotify'){closeModal();go('settings');setTimeout(()=>[...document.querySelectorAll('.card h2,.card h3')].find(x=>/spotify/i.test(x.textContent))?.closest('.card')?.scrollIntoView({behavior:'smooth',block:'center'}),100);return;}
    if(key==='activityManual'){closeModal();return window.activityManual?.();}
    if(key==='equipmentCamera'){closeModal();return window.action?.('equipmentCamera');}
    if(key==='humanReport'){closeModal();return window.action?.('humanReport');}
    if(key==='advancedNutrition'){closeModal();go('food');setTimeout(()=>document.querySelector('#advancedToggle')?.scrollIntoView({behavior:'smooth',block:'center'}),100);return;}
    if(key==='shopping'){closeModal();go('recipes');setTimeout(()=>[...document.querySelectorAll('.card h2,.card h3')].find(x=>/shopping/i.test(x.textContent))?.closest('.card')?.scrollIntoView({behavior:'smooth',block:'center'}),100);return;}
    if(key==='streaks'){closeModal();return go('progress');}
    if(key==='ads'){closeModal();go('settings');setTimeout(()=>document.querySelector('#adsToggle')?.closest('.card')?.scrollIntoView({behavior:'smooth',block:'center'}),100);return;}
    if(key==='deleteData'){closeModal();go('settings');setTimeout(()=>[...document.querySelectorAll('button')].find(x=>/delete all local data/i.test(x.textContent))?.scrollIntoView({behavior:'smooth',block:'center'}),100);return;}
    return window.action?.(key);
  }

  function openGuideClarity(){
    openModal('Veyra Guide',`<div class="guide-hero"><img src="assets/icon-192.png" alt="Veyra logo"><div><span class="eyebrow">VEYRA GUIDE</span><h2>Where everything lives.</h2><p>Search any feature. Every result tells you exactly where to go.</p></div></div><div class="guide-search"><input id="clarityGuideSearch" placeholder="Search: calorie goal, dietary restriction, barcode, rest timer, JSON…" autocomplete="off"></div><div class="guide-quick-row"><button class="secondary compact" data-cguide="goals">Edit goals</button><button class="secondary compact" data-cguide="profile">Food preferences</button><button class="secondary compact" data-cguide="food">Log food</button><button class="secondary compact" data-cguide="train">Start workout</button></div><div id="clarityGuideList" class="guide-map-list">${GUIDE.map(([ic,t,where,key])=>`<button class="guide-map-row" data-cguide="${key}" data-search="${esc((t+' '+where).toLowerCase())}"><span>${ic}</span><div><b>${esc(t)}</b><small>${esc(where)}</small></div><em>›</em></button>`).join('')}</div><div class="install-callout"><b>Still not sure?</b> Open Coach and ask “Where do I change ___?” Veyra will point you to the right place.</div>`);
    const search=$('#clarityGuideSearch');if(search)search.oninput=()=>{const q=search.value.trim().toLowerCase(),terms=q.split(/\s+/).filter(Boolean);$$('#clarityGuideList .guide-map-row').forEach(r=>{const hay=r.dataset.search||'';r.hidden=!!terms.length&&!terms.every(t=>hay.includes(t))})};
    $$('[data-cguide]').forEach(b=>b.onclick=()=>{const k=b.dataset.cguide;closeModal();setTimeout(()=>act(k),0)});
  }

  function clarityBar(){
    const h=HELP[window.route||route]||HELP.today;
    return `<div class="clarity-bar" data-clarity-route="${esc(window.route||route)}"><div class="clarity-copy"><span class="clarity-icon">${h.icon}</span><div><b>What this page is for</b><small>${esc(h.summary)}</small></div></div><div class="clarity-actions">${(h.actions||[]).map(([label,key])=>HELP[key]?`<button class="clarity-link" data-clarity-route-go="${key}">${esc(label)}</button>`:`<button class="clarity-link" data-clarity-action="${key}">${esc(label)}</button>`).join('')}<button class="clarity-help" data-clarity-guide>Guide ?</button></div></div>`;
  }

  function applyClarity(){
    const view=$('#view');if(!view)return;
    const hero=view.querySelector('.hero');
    if(hero&&!view.querySelector('.clarity-bar'))hero.insertAdjacentHTML('afterend',clarityBar());
    $$('[data-clarity-route-go]').forEach(b=>b.onclick=()=>go(b.dataset.clarityRouteGo));
    $$('[data-clarity-action]').forEach(b=>b.onclick=()=>window.action?.(b.dataset.clarityAction));
    $$('[data-clarity-guide]').forEach(b=>b.onclick=openGuideClarity);
    const modalClose=$('#modalClose');if(modalClose&&!modalClose.getAttribute('aria-label'))modalClose.setAttribute('aria-label','Close dialog');
    const theme=$('#themeBtn');if(theme)theme.title='Switch light / dark theme';
    const avatar=document.querySelector('.avatar-btn');if(avatar){avatar.setAttribute('aria-label','Open your profile');avatar.title='Your profile';}
    const goals=document.querySelector('.goals-top');if(goals)goals.title='Edit nutrition and hydration targets';
    const guide=$('#guideBtn');if(guide){guide.title='Open Veyra Guide';guide.setAttribute('aria-label','Open Veyra Guide');guide.onclick=openGuideClarity;}
    const voice=$('#voiceQuick');if(voice){voice.title='Talk to Veyra or log by voice';voice.setAttribute('aria-label','Talk to Veyra');}
    const cmd=$('#commandBtn');if(cmd)cmd.setAttribute('aria-label','Ask Veyra or log anything');
    const fab=$('#fab');if(fab)fab.title='Quick add food, activity, water, sleep or workout';
  }

  const previousRender=window.render;
  window.render=render=function(){previousRender();applyClarity();};

  const previousAction=window.action;
  window.action=action=function(a){if(a==='guide')return openGuideClarity();return previousAction?previousAction(a):undefined;};
  window.openGuide=openGuideClarity;
  window.VEYRA_GUIDE_ITEMS=GUIDE;
  window.VEYRA_CLARITY_VERSION=VERSION;

  applyClarity();
})();
