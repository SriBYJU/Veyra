/* Veyra Food Intelligence 3.2
   One resolver for typed commands, voice, restaurant foods, branded products,
   common foods and review-first logging. Runs entirely in the browser; online
   public-product lookup is optional and never required to keep using Veyra. */
(function(){
  const FI_VERSION='3.2.0';
  const WORD_NUM={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,half:.5};
  const normalize=s=>String(s||'').toLowerCase().replace(/[’']/g,"'").replace(/[^a-z0-9.'\- ]+/g,' ').replace(/\s+/g,' ').trim();
  const round=n=>Math.round((Number(n)||0)*10)/10;
  const title=s=>String(s||'').replace(/\b\w/g,c=>c.toUpperCase());
  const firstNum=s=>{const n=String(s||'').match(/\b(\d+(?:\.\d+)?)\b/);if(n)return +n[1];for(const [w,v] of Object.entries(WORD_NUM))if(new RegExp(`\\b${w}\\b`,'i').test(s))return v;return null};
  const foodEmoji=s=>{const n=normalize(s);if(/pizza/.test(n))return '🍕';if(/burrito|wrap|tortilla|taco/.test(n))return '🌯';if(/rice|bowl/.test(n))return '🥣';if(/banana/.test(n))return '🍌';if(/apple/.test(n))return '🍎';if(/yogurt/.test(n))return '🥛';if(/tofu|paneer|protein/.test(n))return '🥗';return '🍽️'};

  /* Small, high-confidence local catalog for common restaurant examples and
     common foods. The resolver still searches Open Food Facts for brands not
     present here. Restaurant recipes change; every result is reviewable. */
  const CATALOG=[
    {id:'tb-crunchwrap',brand:'Taco Bell',name:'Crunchwrap Supreme',aliases:['crunchwrap','crunch wrap','crunchwrap supreme'],unit:'item',servingLabel:'1 Crunchwrap',cal:530,p:16,c:71,f:21,fiber:6,sugar:6,sodium:1190,source:'Taco Bell / public nutrition data',sourceUrl:'https://www.tacobell.com/food/specialties/crunchwrap-supreme',confidence:94},
    {id:'tb-blackbean-crunchwrap',brand:'Taco Bell',name:'Black Bean Crunchwrap Supreme',aliases:['black bean crunchwrap','vegetarian crunchwrap'],unit:'item',servingLabel:'1 Crunchwrap',cal:520,p:13,c:77,f:18,fiber:8,sugar:6,sodium:1160,source:'Taco Bell / public nutrition data',sourceUrl:'https://www.tacobell.com/food/specialties/black-bean-crunchwrap-supreme',confidence:91},
    {id:'tb-bean-burrito',brand:'Taco Bell',name:'Bean Burrito',aliases:['bean burrito'],unit:'item',servingLabel:'1 burrito',cal:360,p:13,c:55,f:9,fiber:8,sugar:3,sodium:1000,source:'Taco Bell / public nutrition data',sourceUrl:'https://www.tacobell.com/food/burritos/bean-burrito',confidence:92},
    {id:'tb-mexican-pizza',brand:'Taco Bell',name:'Mexican Pizza',aliases:['mexican pizza'],unit:'item',servingLabel:'1 pizza',cal:530,p:19,c:49,f:29,fiber:7,sugar:3,sodium:1010,source:'Taco Bell / public nutrition data',sourceUrl:'https://www.tacobell.com/food/specialties/mexican-pizza',confidence:90},

    {id:'pj-garden-ind',brand:'Papa Johns',name:'Garden Fresh Pizza',aliases:['garden fresh pizza','garden fresh'],variant:'Pizza for One',size:'individual',crust:'Original Crust',unit:'slice',servingLabel:'1 slice (1/4 pizza)',slicesPerPizza:4,cal:190,p:7,c:26,f:6,fiber:1,sugar:4,sodium:470,source:'Papa Johns',sourceUrl:'https://www.papajohns.com/order/menu/pizza/garden-fresh',confidence:97},
    {id:'pj-garden-small',brand:'Papa Johns',name:'Garden Fresh Pizza',aliases:['garden fresh pizza','garden fresh'],variant:'Small',size:'small',crust:'Original Crust',unit:'slice',servingLabel:'1 slice (1/6 pizza)',slicesPerPizza:6,cal:190,p:7,c:26,f:6,fiber:1,sugar:4,sodium:450,source:'Papa Johns',sourceUrl:'https://www.papajohns.com/order/menu/pizza/garden-fresh',confidence:97},
    {id:'pj-garden-med',brand:'Papa Johns',name:'Garden Fresh Pizza',aliases:['garden fresh pizza','garden fresh'],variant:'Medium',size:'medium',crust:'Original Crust',unit:'slice',servingLabel:'1 slice (1/8 pizza)',slicesPerPizza:8,cal:200,p:7,c:27,f:7,fiber:1,sugar:4,sodium:480,source:'Papa Johns',sourceUrl:'https://www.papajohns.com/order/menu/pizza/garden-fresh',confidence:98},
    {id:'pj-garden-large',brand:'Papa Johns',name:'Garden Fresh Pizza',aliases:['garden fresh pizza','garden fresh'],variant:'Large',size:'large',crust:'Original Crust',unit:'slice',servingLabel:'1 slice (1/8 pizza)',slicesPerPizza:8,cal:280,p:10,c:38,f:9,fiber:2,sugar:5,sodium:690,source:'Papa Johns',sourceUrl:'https://www.papajohns.com/order/menu/pizza/garden-fresh',confidence:94},
    {id:'pj-garden-xl',brand:'Papa Johns',name:'Garden Fresh Pizza',aliases:['garden fresh pizza','garden fresh'],variant:'Extra Large',size:'extra large',crust:'Original Crust',unit:'slice',servingLabel:'1 slice (1/10 pizza)',slicesPerPizza:10,cal:300,p:11,c:41,f:9,fiber:2,sugar:6,sodium:710,source:'Papa Johns',sourceUrl:'https://www.papajohns.com/order/menu/pizza/garden-fresh',confidence:98},
    {id:'pj-garden-thin',brand:'Papa Johns',name:'Garden Fresh Pizza',aliases:['garden fresh pizza','garden fresh'],variant:'Thin Crust',size:'large',crust:'Thin Crust',unit:'slice',servingLabel:'1 slice (1/8 pizza)',slicesPerPizza:8,cal:210,p:8,c:20,f:10,fiber:1,sugar:3,sodium:480,source:'Papa Johns',sourceUrl:'https://www.papajohns.com/order/menu/pizza/garden-fresh',confidence:93},

    {id:'common-banana',brand:'',name:'Banana',aliases:['banana'],unit:'item',servingLabel:'1 medium banana',cal:105,p:1.3,c:27,f:.4,fiber:3.1,sugar:14.4,source:'USDA-style standard serving estimate',confidence:90},
    {id:'common-apple',brand:'',name:'Apple',aliases:['apple'],unit:'item',servingLabel:'1 medium apple',cal:95,p:.5,c:25,f:.3,fiber:4.4,sugar:19,source:'USDA-style standard serving estimate',confidence:90},
    {id:'common-rice',brand:'',name:'Cooked White Rice',aliases:['rice','white rice'],unit:'cup',servingLabel:'1 cup cooked',cal:205,p:4.3,c:44.5,f:.4,fiber:.6,sugar:.1,source:'USDA-style standard serving estimate',confidence:88},
    {id:'common-brown-rice',brand:'',name:'Cooked Brown Rice',aliases:['brown rice'],unit:'cup',servingLabel:'1 cup cooked',cal:216,p:5,c:44.8,f:1.8,fiber:3.5,sugar:.7,source:'USDA-style standard serving estimate',confidence:88},
    {id:'common-tofu',brand:'',name:'Firm Tofu',aliases:['tofu','firm tofu'],unit:'serving',servingLabel:'100 g',cal:144,p:17.3,c:2.8,f:8.7,fiber:2.3,sugar:.6,source:'USDA-style standard serving estimate',confidence:86},
    {id:'common-yogurt',brand:'',name:'Plain Greek Yogurt, nonfat',aliases:['greek yogurt','plain greek yogurt'],unit:'cup',servingLabel:'1 cup',cal:130,p:23,c:9,f:.7,fiber:0,sugar:7,source:'USDA-style standard serving estimate',confidence:86},
    {id:'common-tortilla',brand:'',name:'Flour Tortilla',aliases:['tortilla','flour tortilla'],unit:'item',servingLabel:'1 medium tortilla',cal:140,p:4,c:24,f:4,fiber:1.5,sugar:1,source:'generic estimate — confirm package label when available',confidence:75},
    {id:'common-paneer',brand:'',name:'Paneer',aliases:['paneer'],unit:'serving',servingLabel:'100 g',cal:265,p:18,c:3,f:20,fiber:0,sugar:2,source:'generic estimate — recipe/brand varies',confidence:72}
  ];

  /* Broad cross-cuisine fallback catalog. These are deliberately marked as
     generic dish estimates because homemade and restaurant recipes vary.
     They make natural-language logging useful across cuisines without
     pretending a generic dish is equivalent to a restaurant's published
     nutrition. Every value is reviewable before logging. */
  const DISH_CATALOG=[
    {id:'dish-chana-masala',name:'Chana Masala',aliases:['chana masala','chole','chole masala'],cuisine:'Indian',unit:'cup',servingLabel:'1 cup',cal:280,p:14,c:45,f:6,fiber:12,sugar:8},
    {id:'dish-dal-tadka',name:'Dal Tadka',aliases:['dal tadka','dal','daal'],cuisine:'Indian',unit:'cup',servingLabel:'1 cup',cal:230,p:12,c:34,f:6,fiber:10,sugar:4},
    {id:'dish-dal-makhani',name:'Dal Makhani',aliases:['dal makhani','daal makhani'],cuisine:'Indian',unit:'cup',servingLabel:'1 cup',cal:330,p:14,c:42,f:13,fiber:12,sugar:6},
    {id:'dish-rajma',name:'Rajma',aliases:['rajma','rajma masala'],cuisine:'Indian',unit:'cup',servingLabel:'1 cup',cal:290,p:15,c:48,f:5,fiber:13,sugar:6},
    {id:'dish-paneer-tikka',name:'Paneer Tikka',aliases:['paneer tikka'],cuisine:'Indian',unit:'serving',servingLabel:'1 serving',cal:360,p:24,c:14,f:24,fiber:3,sugar:6},
    {id:'dish-palak-paneer',name:'Palak Paneer',aliases:['palak paneer','saag paneer'],cuisine:'Indian',unit:'cup',servingLabel:'1 cup',cal:340,p:18,c:16,f:24,fiber:5,sugar:5},
    {id:'dish-matar-paneer',name:'Matar Paneer',aliases:['matar paneer','mutter paneer'],cuisine:'Indian',unit:'cup',servingLabel:'1 cup',cal:360,p:18,c:24,f:22,fiber:7,sugar:8},
    {id:'dish-aloo-gobi',name:'Aloo Gobi',aliases:['aloo gobi'],cuisine:'Indian',unit:'cup',servingLabel:'1 cup',cal:220,p:6,c:34,f:8,fiber:7,sugar:5},
    {id:'dish-veg-biryani',name:'Vegetable Biryani',aliases:['vegetable biryani','veg biryani','biryani'],cuisine:'Indian',unit:'cup',servingLabel:'1 cup',cal:330,p:8,c:55,f:9,fiber:5,sugar:5},
    {id:'dish-dosa',name:'Dosa',aliases:['dosa','plain dosa'],cuisine:'Indian',unit:'item',servingLabel:'1 dosa',cal:170,p:4,c:30,f:4,fiber:2,sugar:1},
    {id:'dish-masala-dosa',name:'Masala Dosa',aliases:['masala dosa'],cuisine:'Indian',unit:'item',servingLabel:'1 dosa',cal:390,p:9,c:62,f:12,fiber:6,sugar:4},
    {id:'dish-idli',name:'Idli',aliases:['idli'],cuisine:'Indian',unit:'item',servingLabel:'1 idli',cal:60,p:2,c:12,f:.5,fiber:1,sugar:0},
    {id:'dish-roti',name:'Roti / Chapati',aliases:['roti','chapati','phulka'],cuisine:'Indian',unit:'item',servingLabel:'1 roti',cal:110,p:3.5,c:20,f:2.5,fiber:3,sugar:1},
    {id:'dish-naan',name:'Naan',aliases:['naan','plain naan'],cuisine:'Indian',unit:'item',servingLabel:'1 naan',cal:260,p:9,c:45,f:5,fiber:2,sugar:4},
    {id:'dish-samosa',name:'Vegetable Samosa',aliases:['samosa','vegetable samosa','veg samosa'],cuisine:'Indian',unit:'item',servingLabel:'1 samosa',cal:260,p:5,c:32,f:13,fiber:4,sugar:2},
    {id:'dish-pav-bhaji',name:'Pav Bhaji',aliases:['pav bhaji'],cuisine:'Indian',unit:'serving',servingLabel:'1 plate',cal:520,p:14,c:78,f:17,fiber:11,sugar:10},
    {id:'dish-poha',name:'Poha',aliases:['poha'],cuisine:'Indian',unit:'cup',servingLabel:'1 cup',cal:250,p:6,c:42,f:7,fiber:4,sugar:4},
    {id:'dish-upma',name:'Upma',aliases:['upma'],cuisine:'Indian',unit:'cup',servingLabel:'1 cup',cal:250,p:7,c:42,f:7,fiber:5,sugar:4},
    {id:'dish-margherita',name:'Margherita Pizza',aliases:['margherita pizza','margarita pizza'],cuisine:'Italian',unit:'slice',servingLabel:'1 slice',cal:240,p:10,c:31,f:9,fiber:2,sugar:4},
    {id:'dish-pasta-marinara',name:'Pasta Marinara',aliases:['pasta marinara','spaghetti marinara','pasta with tomato sauce','spaghetti with tomato sauce'],cuisine:'Italian',unit:'cup',servingLabel:'1.5 cups',cal:420,p:14,c:76,f:7,fiber:7,sugar:11},
    {id:'dish-lasagna-veg',name:'Vegetable Lasagna',aliases:['vegetable lasagna','veggie lasagna','lasagna'],cuisine:'Italian',unit:'piece',servingLabel:'1 piece',cal:380,p:20,c:44,f:14,fiber:6,sugar:9},
    {id:'dish-risotto',name:'Vegetable Risotto',aliases:['vegetable risotto','risotto'],cuisine:'Italian',unit:'cup',servingLabel:'1 cup',cal:360,p:10,c:55,f:11,fiber:4,sugar:4},
    {id:'dish-gnocchi',name:'Gnocchi with Tomato Sauce',aliases:['gnocchi','gnocchi tomato sauce'],cuisine:'Italian',unit:'cup',servingLabel:'1.5 cups',cal:430,p:12,c:79,f:8,fiber:6,sugar:8},
    {id:'dish-bean-tacos',name:'Bean Tacos',aliases:['bean tacos','bean taco','vegetarian tacos','veggie tacos'],cuisine:'Mexican',unit:'item',servingLabel:'1 taco',cal:210,p:8,c:31,f:7,fiber:7,sugar:2},
    {id:'dish-bean-burrito-generic',name:'Bean Burrito',aliases:['generic bean burrito','vegetarian burrito','veggie burrito'],cuisine:'Mexican',unit:'item',servingLabel:'1 burrito',cal:470,p:18,c:73,f:13,fiber:14,sugar:5},
    {id:'dish-quesadilla',name:'Cheese Quesadilla',aliases:['cheese quesadilla','quesadilla'],cuisine:'Mexican',unit:'item',servingLabel:'1 quesadilla',cal:500,p:22,c:44,f:26,fiber:3,sugar:3},
    {id:'dish-falafel-wrap',name:'Falafel Wrap',aliases:['falafel wrap','falafel sandwich'],cuisine:'Middle Eastern',unit:'item',servingLabel:'1 wrap',cal:520,p:17,c:70,f:20,fiber:12,sugar:7},
    {id:'dish-hummus',name:'Hummus',aliases:['hummus'],cuisine:'Middle Eastern',unit:'serving',servingLabel:'1/2 cup',cal:210,p:10,c:18,f:13,fiber:7,sugar:1},
    {id:'dish-greek-salad',name:'Greek Salad',aliases:['greek salad'],cuisine:'Greek',unit:'bowl',servingLabel:'1 bowl',cal:320,p:10,c:20,f:23,fiber:6,sugar:9},
    {id:'dish-pad-thai-tofu',name:'Tofu Pad Thai',aliases:['tofu pad thai','vegetarian pad thai','pad thai'],cuisine:'Thai',unit:'plate',servingLabel:'1 plate',cal:680,p:25,c:92,f:24,fiber:8,sugar:20},
    {id:'dish-thai-curry-tofu',name:'Tofu Thai Curry',aliases:['tofu thai curry','thai curry','green curry tofu','red curry tofu'],cuisine:'Thai',unit:'bowl',servingLabel:'1 bowl',cal:540,p:22,c:45,f:31,fiber:7,sugar:10},
    {id:'dish-fried-rice-veg',name:'Vegetable Fried Rice',aliases:['vegetable fried rice','veggie fried rice','fried rice'],cuisine:'Chinese',unit:'cup',servingLabel:'1.5 cups',cal:470,p:12,c:76,f:13,fiber:6,sugar:6},
    {id:'dish-lo-mein-veg',name:'Vegetable Lo Mein',aliases:['vegetable lo mein','veggie lo mein','lo mein'],cuisine:'Chinese',unit:'plate',servingLabel:'1 plate',cal:560,p:17,c:86,f:17,fiber:7,sugar:10},
    {id:'dish-tofu-stirfry',name:'Tofu Vegetable Stir-Fry',aliases:['tofu stir fry','tofu stir-fry','tofu vegetable stir fry'],cuisine:'Chinese',unit:'bowl',servingLabel:'1 bowl',cal:420,p:27,c:35,f:21,fiber:8,sugar:10},
    {id:'dish-veggie-sushi',name:'Vegetable Sushi Roll',aliases:['vegetable sushi','veggie sushi','avocado roll','cucumber roll'],cuisine:'Japanese',unit:'roll',servingLabel:'1 roll (6–8 pieces)',cal:260,p:6,c:50,f:5,fiber:5,sugar:7},
    {id:'dish-miso-soup',name:'Miso Soup',aliases:['miso soup'],cuisine:'Japanese',unit:'cup',servingLabel:'1 cup',cal:80,p:5,c:10,f:3,fiber:2,sugar:3},
    {id:'dish-bibimbap-veg',name:'Vegetable Bibimbap',aliases:['vegetable bibimbap','veggie bibimbap','bibimbap'],cuisine:'Korean',unit:'bowl',servingLabel:'1 bowl',cal:540,p:18,c:83,f:16,fiber:10,sugar:10},
    {id:'dish-pho-tofu',name:'Tofu Pho',aliases:['tofu pho','vegetarian pho','veggie pho','pho'],cuisine:'Vietnamese',unit:'bowl',servingLabel:'1 bowl',cal:430,p:20,c:67,f:9,fiber:7,sugar:7},
    {id:'dish-tofu-banhmi',name:'Tofu Banh Mi',aliases:['tofu banh mi','vegetarian banh mi','veggie banh mi'],cuisine:'Vietnamese',unit:'item',servingLabel:'1 sandwich',cal:520,p:24,c:70,f:17,fiber:7,sugar:11},
    {id:'dish-oatmeal',name:'Oatmeal',aliases:['oatmeal','porridge'],cuisine:'American',unit:'bowl',servingLabel:'1 bowl',cal:250,p:9,c:44,f:6,fiber:7,sugar:8},
    {id:'dish-grilled-cheese',name:'Grilled Cheese Sandwich',aliases:['grilled cheese','grilled cheese sandwich'],cuisine:'American',unit:'item',servingLabel:'1 sandwich',cal:430,p:18,c:38,f:23,fiber:3,sugar:6},
    {id:'dish-veggie-burger',name:'Veggie Burger',aliases:['veggie burger','vegetable burger','plant based burger','plant-based burger'],cuisine:'American',unit:'item',servingLabel:'1 sandwich',cal:450,p:22,c:51,f:19,fiber:8,sugar:8}
  ].map(x=>({...x,brand:'',source:`Generic ${x.cuisine} dish estimate • recipe/restaurant varies`,confidence:62}));


  const BRAND_ALIASES={
    'taco bell':['taco bell','tacobell'],
    'papa johns':['papa johns',"papa john's",'papajohns','papa john'],
    'morningstar farms':['morningstar','morning star','morningstar farms'],
    'chipotle':['chipotle'],
    'starbucks':['starbucks'],
    'mcdonalds':["mcdonald's",'mcdonalds','mcdonald'],
    'subway':['subway'],
    'chick-fil-a':['chick fil a','chick-fil-a'],
    'panera':['panera','panera bread']
  };
  function canonicalBrand(s){const n=normalize(s);for(const [b,als] of Object.entries(BRAND_ALIASES))if(als.some(a=>n.includes(normalize(a))))return b;return ''}
  function mealFromText(s){const n=normalize(s);if(/breakfast/.test(n))return 'Breakfast';if(/lunch/.test(n))return 'Lunch';if(/dinner|supper/.test(n))return 'Dinner';return 'Snack'}
  function parseQuantity(text){const n=normalize(text);const m=n.match(/\b(\d+(?:\.\d+)?)\s*(?:x|slices?|pieces?|items?|servings?|wraps?|burritos?|tacos?|cups?|bowls?|plates?|rotis?|chapatis?|naans?|idlis?|dosas?|rolls?|patties?|nuggets?)\b/);if(m)return +m[1];for(const [w,v] of Object.entries(WORD_NUM)){if(new RegExp(`\\b${w}\\s+(?:slices?|pieces?|items?|servings?|wraps?|burritos?|tacos?|cups?|bowls?|plates?|rotis?|chapatis?|naans?|idlis?|dosas?|rolls?|patties?|nuggets?)\\b`).test(n))return v}return null}
  function parseSize(text){const n=normalize(text);if(/\bextra large\b|\bxl\b/.test(n))return 'extra large';if(/\blarge\b/.test(n))return 'large';if(/\bmedium\b/.test(n))return 'medium';if(/\bsmall\b/.test(n))return 'small';if(/\bindividual\b|\bpersonal\b|pizza for one/.test(n))return 'individual';return ''}
  function cleanFoodText(text){return String(text||'').replace(/^.*?\b(?:i\s+)?(?:ate|had|have|eaten|just ate|just had)\b\s*/i,'').replace(/\b(?:for\s+)?(?:breakfast|lunch|dinner|snack)\b/ig,'').trim().replace(/[.!?]+$/,'')}
  function parseIntent(text){const raw=String(text||'').trim(),clean=cleanFoodText(raw),brand=canonicalBrand(clean),quantity=parseQuantity(clean),size=parseSize(clean),meal=mealFromText(raw);return {raw,clean,brand,quantity,size,meal}}
  function hasUnknownVenue(intent){return !intent.brand&&/\b(?:from|at)\s+[a-z][a-z0-9&'. -]{1,}$/i.test(intent.clean||'')}
  function tokens(s){return normalize(s).split(' ').filter(x=>x.length>1&&!['from','at','the','a','an','of','for','my','some','had','ate','with'].includes(x))}
  function scoreCandidate(q,item){const nq=normalize(q),qt=tokens(q),hay=normalize([item.brand,item.name,item.variant,item.size,item.crust,...(item.aliases||[])].join(' '));let score=0;for(const t of qt)if(hay.includes(t))score+=t.length>=7?4:t.length>=4?2:1;if((item.aliases||[]).some(a=>nq.includes(normalize(a))))score+=6;if(normalize(item.name)&&nq.includes(normalize(item.name)))score+=5;if(item.brand&&canonicalBrand(q)===normalize(item.brand))score+=7;if(item.size&&parseSize(q)===item.size)score+=6;return score}
  function localMatches(intent){return [...CATALOG,...DISH_CATALOG].map(x=>({...x,_score:scoreCandidate(intent.clean,x)})).filter(x=>x._score>=3).sort((a,b)=>b._score-a._score)}
  function applyQty(item,qty){const q=qty||1;return {...item,quantity:q,cal:round(item.cal*q),p:round(item.p*q),c:round(item.c*q),f:round(item.f*q),fiber:round((item.fiber||0)*q),sugar:round((item.sugar||0)*q),sodium:item.sodium==null?'':round(item.sodium*q),servingLabel:q===1?(item.servingLabel||'1 serving'):`${q} × ${item.servingLabel||'1 serving'}`}}

  function profileFoodWarnings(item){
    const diet=normalize(state.profile?.diet||''), restrictions=(state.profile?.dietaryRestrictions||[]).map(normalize), avoid=normalize(state.profile?.foodsAvoid||''), text=normalize([item.name,item.brand,item.variant,item.notes,item.ingredients?.join?.(' ')||''].join(' '));
    const all=[...restrictions,avoid].join(' '), warnings=[];
    const has=(re)=>re.test(text), wants=(re)=>re.test(all);
    if(diet==='vegan' && has(/paneer|cheese|milk|cream|yogurt|butter|ghee|egg|chicken|beef|pork|fish|shrimp|turkey/))warnings.push('Your profile is vegan and this item may contain animal products.');
    else if(diet==='vegetarian' && has(/chicken|beef|pork|fish|shrimp|turkey|steak|bacon/))warnings.push('Your profile is vegetarian and this item may contain meat or seafood.');
    if(wants(/dairy|lactose/) && has(/paneer|cheese|milk|cream|yogurt|butter|ghee/))warnings.push('Your saved restrictions mention dairy/lactose and this item may contain dairy.');
    if(wants(/gluten|celiac/) && has(/wheat|flour|bread|naan|pasta|pizza|tortilla|wrap|burrito|crunchwrap/))warnings.push('Your saved restrictions mention gluten and this item may contain gluten.');
    if(wants(/nut|peanut|tree nut/) && has(/peanut|almond|cashew|pistachio|walnut|pecan|hazelnut/))warnings.push('Your saved restrictions mention nuts and this item may contain nuts.');
    if(wants(/soy/) && has(/tofu|soy|sofritas|edamame|tempeh/))warnings.push('Your saved restrictions mention soy and this item may contain soy.');
    if(wants(/egg/) && has(/egg|mayonnaise|mayo/))warnings.push('Your saved restrictions mention egg and this item may contain egg.');
    const avoided=avoid.split(/[,;]+/).map(x=>x.trim()).filter(x=>x.length>2);for(const x of avoided)if(text.includes(x))warnings.push(`This item appears to include “${x},” which is in your foods-to-avoid list.`);
    return [...new Set(warnings)];
  }

  function recordFood(d){
    const obj={id:uid(),date:d.date||today(),time:d.time||now().toTimeString().slice(0,5),meal:d.meal||'Snack',name:d.name,brand:d.brand||'',cal:+d.cal||0,p:+d.p||0,c:+d.c||0,f:+d.f||0,fiber:+d.fiber||0,sugar:+d.sugar||0,sodium:d.sodium===''?null:+d.sodium||null,quantity:+d.quantity||1,servingLabel:d.servingLabel||'1 serving',source:d.source||'manual',confidence:+d.confidence||75,sourceUrl:d.sourceUrl||'',notes:d.notes||''};
    state.meals.push(obj);touchStreak();save();closeModal();render();toast(`${obj.name} logged`);return obj;
  }
  function reviewFood(item,intent,opts={}){
    const q=intent.quantity||item.quantity||1,scaled=applyQty(item,q),brand=scaled.brand?`${scaled.brand} • `:'',sourceLink=scaled.sourceUrl?`<a href="${esc(scaled.sourceUrl)}" target="_blank" rel="noopener">Source ↗</a>`:'',profileWarnings=profileFoodWarnings(scaled);
    openModal('Confirm food',`<div class="fi-confirm-head"><div class="fi-food-art">${foodEmoji(scaled.name)}</div><div><span class="eyebrow">VEYRA SMART LOG</span><h2>${esc(scaled.name)}</h2><p>${esc(brand+scaled.servingLabel)}</p></div><span class="status-badge ${scaled.confidence>=90?'good':'warn'}">${scaled.confidence}% confidence</span></div>
      <form id="fiReviewForm" class="form-grid" data-serving-grams="${item.servingGrams||''}">
        <label>Meal<select name="meal">${['Breakfast','Lunch','Dinner','Snack'].map(m=>`<option ${m===intent.meal?'selected':''}>${m}</option>`).join('')}</select></label>
        <label>Time<input name="time" type="time" value="${now().toTimeString().slice(0,5)}"></label>
        <label>Quantity<input id="fiQty" name="quantity" type="number" min=".1" step=".1" value="${q}"></label>
        <label>Serving<input name="servingLabel" value="${esc(item.servingLabel||'1 serving')}"></label>
        <label>Calories<input name="cal" type="number" min="0" step=".1" value="${scaled.cal}"></label>
        <label>Protein (g)<input name="p" type="number" min="0" step=".1" value="${scaled.p}"></label>
        <label>Carbs (g)<input name="c" type="number" min="0" step=".1" value="${scaled.c}"></label>
        <label>Fat (g)<input name="f" type="number" min="0" step=".1" value="${scaled.f}"></label>
        <label>Fiber (g)<input name="fiber" type="number" min="0" step=".1" value="${scaled.fiber||0}"></label>
        <label>Sugar (g)<input name="sugar" type="number" min="0" step=".1" value="${scaled.sugar||0}"></label>
        <label style="grid-column:1/-1">Changes / notes<input name="notes" placeholder="e.g., no sour cream, extra cheese — edit nutrition if your changes affect it"></label>
        <div class="fi-source" style="grid-column:1/-1"><span>ⓘ ${esc(scaled.source||'Public nutrition data')}</span>${sourceLink}</div>
        ${profileWarnings.length?`<div class="wizard-note fi-warning restriction-warning" style="grid-column:1/-1"><span>⚠</span><div><strong>Check against your saved food preferences.</strong><br>${profileWarnings.map(esc).join('<br>')}</div></div>`:''}
        <div class="wizard-note fi-warning" style="grid-column:1/-1"><span>✓</span><div><strong>Review before logging.</strong><br>Restaurant recipes, sizes and customizations can change. Veyra never silently treats a match as exact.</div></div>
        <div class="fi-actions" style="grid-column:1/-1"><button type="button" id="fiEditSearch" class="ghost">Wrong food</button><button class="primary">Log this</button></div>
      </form>`);
    const f=$('#fiReviewForm'),qty=$('#fiQty');
    const recalc=()=>{const nq=+qty.value||1;for(const k of ['cal','p','c','f','fiber','sugar']){const el=f.elements[k];if(el)el.value=round((item[k]||0)*nq)}};
    qty.onchange=recalc;qty.oninput=recalc;
    f.onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(f));recordFood({...d,name:item.name,brand:item.brand,source:item.source,sourceUrl:item.sourceUrl,confidence:item.confidence,date:today(),servingLabel:d.servingLabel});if(opts.onLogged)opts.onLogged()};
    $('#fiEditSearch').onclick=()=>smartFoodSearch(intent.clean,intent.meal,opts);
  }

  function chooseVariant(matches,intent,opts={}){
    const topName=matches[0]?.name||intent.clean;openModal('One quick detail',`<div class="fi-question"><span>🍕</span><div><span class="eyebrow">VEYRA NEEDS ONE DETAIL</span><h2>${esc(topName)}</h2><p>Which version did you have?</p></div></div><div class="fi-choice-list">${matches.slice(0,8).map((x,i)=>`<button class="fi-choice" data-fi-choice="${i}"><div><b>${esc(x.variant||x.size||x.servingLabel)}</b><small>${esc(x.crust||'')} • ${x.cal} kcal per ${x.unit||'serving'}</small></div><em>Choose ›</em></button>`).join('')}</div><button id="fiNotListed" class="ghost full">Mine is different</button>`);
    $$('[data-fi-choice]').forEach(b=>b.onclick=()=>reviewFood(matches[+b.dataset.fiChoice],intent,opts));
    $('#fiNotListed').onclick=()=>smartFoodSearch(intent.clean,intent.meal,opts);
  }

  async function openFoodFactsSearch(q){
    const u=new URL('https://world.openfoodfacts.org/cgi/search.pl');u.search=new URLSearchParams({search_terms:q,search_simple:'1',action:'process',json:'1',page_size:'12',fields:'code,product_name,brands,serving_size,serving_quantity,nutriments,image_front_small_url'});
    const r=await fetch(u,{headers:{Accept:'application/json'}});if(!r.ok)throw Error('network');const j=await r.json();const queryTokens=tokens(q);return (j.products||[]).filter(p=>p.product_name).map(p=>{const n=p.nutriments||{},grams=+p.serving_quantity||100,factor=grams/100,item={id:'off-'+(p.code||uid()),brand:p.brands||'',name:p.product_name,unit:'serving',servingLabel:p.serving_size||`${grams} g`,cal:round((n['energy-kcal_100g']||0)*factor),p:round((n.proteins_100g||0)*factor),c:round((n.carbohydrates_100g||0)*factor),f:round((n.fat_100g||0)*factor),fiber:round((n.fiber_100g||0)*factor),sugar:round((n.sugars_100g||0)*factor),sodium:n.sodium_100g==null?'':round(n.sodium_100g*1000*factor),source:'Open Food Facts',sourceUrl:p.code?`https://world.openfoodfacts.org/product/${encodeURIComponent(p.code)}`:'https://world.openfoodfacts.org/',confidence:84,image:p.image_front_small_url||'',servingGrams:grams};const hay=normalize(`${item.brand} ${item.name}`),hits=queryTokens.filter(t=>hay.includes(t)).length;item._relevance=queryTokens.length?hits/queryTokens.length:0;return item}).filter(x=>x._relevance>=.34||queryTokens.length<=1).sort((a,b)=>b._relevance-a._relevance)}

  function manualUnknown(intent,opts={}){
    openModal('Finish this food',`<div class="fi-question"><span>✎</span><div><span class="eyebrow">NO CONFIDENT DATABASE MATCH</span><h2>${esc(title(intent.clean||'Food'))}</h2><p>Enter the label/published nutrition once. Veyra can remember it locally for faster logging next time.</p></div></div><form id="fiManual" class="form-grid"><label style="grid-column:1/-1">Food name<input name="name" required value="${esc(intent.clean)}"></label><label>Meal<select name="meal">${['Breakfast','Lunch','Dinner','Snack'].map(m=>`<option ${m===intent.meal?'selected':''}>${m}</option>`).join('')}</select></label><label>Serving<input name="servingLabel" value="1 serving"></label><label>Calories<input name="cal" type="number" min="0" step=".1" required></label><label>Protein (g)<input name="p" type="number" min="0" step=".1" required></label><label>Carbs (g)<input name="c" type="number" min="0" step=".1"></label><label>Fat (g)<input name="f" type="number" min="0" step=".1"></label><label>Fiber (g)<input name="fiber" type="number" min="0" step=".1"></label><label>Sugar (g)<input name="sugar" type="number" min="0" step=".1"></label><div class="stack-actions" style="grid-column:1/-1"><button type="button" id="fiLabelInstead" class="secondary">📸 Scan nutrition label instead</button><button class="primary">Save & log</button></div></form>`);
    $('#fiManual').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));recordFood({...d,quantity:1,source:'user-entered label / custom food',confidence:98,date:today(),time:now().toTimeString().slice(0,5)});if(opts.onLogged)opts.onLogged();(state.foodMemory||=[]).push({name:d.name,brand:'',servingLabel:d.servingLabel,cal:+d.cal,p:+d.p,c:+d.c||0,f:+d.f||0,fiber:+d.fiber||0,sugar:+d.sugar||0,source:'saved custom food',confidence:99});save()};
    $('#fiLabelInstead').onclick=()=>{closeModal();lens('label')};
  }


  /* When a restaurant/local dish has no published nutrition, Veyra should
     still be useful without pretending it knows an exact number. This
     ingredient-composition fallback lets the user build a transparent,
     editable estimate from recognizable components. Values are intentionally
     generic per common serving and the final result is marked low/moderate
     confidence until the user reviews it. */
  const INGREDIENT_COMPONENTS=[
    {key:'white rice',aliases:['white rice','rice'],serving:'1 cup cooked',cal:205,p:4.3,c:44.5,f:.4,fiber:.6,sugar:.1},
    {key:'brown rice',aliases:['brown rice'],serving:'1 cup cooked',cal:216,p:5,c:44.8,f:1.8,fiber:3.5,sugar:.7},
    {key:'paneer',aliases:['paneer'],serving:'100 g',cal:265,p:18,c:3,f:20,fiber:0,sugar:2},
    {key:'tofu',aliases:['tofu'],serving:'100 g',cal:144,p:17.3,c:2.8,f:8.7,fiber:2.3,sugar:.6},
    {key:'chickpeas',aliases:['chickpea','chickpeas','chana','chole'],serving:'1 cup cooked',cal:269,p:14.5,c:45,f:4.2,fiber:12.5,sugar:8},
    {key:'black beans',aliases:['black bean','black beans'],serving:'1 cup cooked',cal:227,p:15.2,c:40.8,f:.9,fiber:15,sugar:.6},
    {key:'kidney beans',aliases:['kidney bean','kidney beans','rajma'],serving:'1 cup cooked',cal:225,p:15.3,c:40.4,f:.9,fiber:13.1,sugar:.6},
    {key:'lentils / dal',aliases:['lentil','lentils','dal','daal'],serving:'1 cup cooked',cal:230,p:17.9,c:39.9,f:.8,fiber:15.6,sugar:3.6},
    {key:'flour tortilla / wrap',aliases:['tortilla','wrap'],serving:'1 medium',cal:140,p:4,c:24,f:4,fiber:1.5,sugar:1},
    {key:'roti / chapati',aliases:['roti','chapati','phulka'],serving:'1 piece',cal:110,p:3.5,c:20,f:2.5,fiber:3,sugar:1},
    {key:'naan',aliases:['naan'],serving:'1 piece',cal:260,p:9,c:45,f:5,fiber:2,sugar:4},
    {key:'bread / bun',aliases:['bread','bun','roll'],serving:'2 slices / 1 bun',cal:160,p:6,c:30,f:2,fiber:2,sugar:4},
    {key:'pasta / noodles',aliases:['pasta','noodle','noodles','spaghetti'],serving:'1.5 cups cooked',cal:330,p:12,c:66,f:2,fiber:4,sugar:3},
    {key:'potato',aliases:['potato','potatoes','aloo'],serving:'1 medium',cal:160,p:4,c:37,f:.2,fiber:4,sugar:2},
    {key:'mixed vegetables',aliases:['vegetable','vegetables','veggie','veggies','peppers','onions','broccoli','carrot','spinach','lettuce'],serving:'1 cup',cal:80,p:4,c:16,f:1,fiber:5,sugar:7},
    {key:'cheese',aliases:['cheese','mozzarella','cheddar'],serving:'1 oz / 28 g',cal:110,p:7,c:1,f:9,fiber:0,sugar:.2},
    {key:'yogurt / raita',aliases:['yogurt','yoghurt','raita'],serving:'1/2 cup',cal:75,p:7,c:6,f:2.5,fiber:0,sugar:5},
    {key:'cream sauce',aliases:['cream','creamy','alfredo','makhani sauce'],serving:'1/2 cup',cal:220,p:4,c:10,f:18,fiber:1,sugar:5},
    {key:'tomato sauce / salsa',aliases:['tomato sauce','marinara','salsa','pico'],serving:'1/2 cup',cal:70,p:2,c:14,f:1,fiber:3,sugar:8},
    {key:'cooking oil',aliases:['oil','fried','sauteed','sautéed'],serving:'1 tbsp',cal:120,p:0,c:0,f:14,fiber:0,sugar:0},
    {key:'butter / ghee',aliases:['butter','ghee'],serving:'1 tbsp',cal:112,p:.1,c:0,f:12.7,fiber:0,sugar:0},
    {key:'avocado / guacamole',aliases:['avocado','guacamole','guac'],serving:'1/2 avocado / ~75 g',cal:120,p:1.5,c:6,f:11,fiber:5,sugar:.5},
    {key:'hummus',aliases:['hummus'],serving:'1/2 cup',cal:210,p:10,c:18,f:13,fiber:7,sugar:1},
    {key:'falafel',aliases:['falafel'],serving:'4 pieces',cal:330,p:13,c:32,f:18,fiber:7,sugar:2},
    {key:'egg',aliases:['egg','eggs'],serving:'2 large',cal:144,p:12.6,c:.7,f:9.5,fiber:0,sugar:.4},
    {key:'chicken',aliases:['chicken'],serving:'4 oz cooked',cal:187,p:35,c:0,f:4,fiber:0,sugar:0},
    {key:'beef',aliases:['beef','steak'],serving:'4 oz cooked',cal:250,p:30,c:0,f:14,fiber:0,sugar:0},
    {key:'fish',aliases:['fish','salmon','tuna','cod'],serving:'4 oz cooked',cal:190,p:26,c:0,f:9,fiber:0,sugar:0},
    {key:'plant-based meat',aliases:['vegan meat','plant based meat','plant-based meat','veggie meat','meatless'],serving:'1 serving',cal:180,p:18,c:10,f:8,fiber:4,sugar:2},
    {key:'nuts / seeds',aliases:['nuts','almonds','cashews','peanuts','seeds'],serving:'1 oz / 28 g',cal:170,p:6,c:6,f:15,fiber:3,sugar:2}
  ];
  function detectedComponents(text){const n=normalize(text);return INGREDIENT_COMPONENTS.filter(x=>x.aliases.some(a=>n.includes(normalize(a))));}
  function ingredientEstimate(intent,opts={}){
    const pre=new Set(detectedComponents(intent.clean).map(x=>x.key));
    openModal('Build a careful estimate',`<div class="fi-question"><span>🧩</span><div><span class="eyebrow">VEYRA INGREDIENT ESTIMATE</span><h2>${esc(title(intent.clean||'Restaurant food'))}</h2><p>No trustworthy exact menu match was found. Choose what was actually in it and Veyra will build a transparent estimate you can edit before logging.</p></div></div>
      <div class="callout"><b>Estimate, not a label.</b><br>Restaurant portions and recipes vary. Component values below use common serving estimates and are intentionally marked lower confidence.</div>
      <div class="food-search-top" style="margin-top:12px"><input id="fiComponentSearch" placeholder="Search ingredients — paneer, rice, tortilla, sauce…"><button type="button" id="fiClearComponents" class="secondary">Clear</button></div>
      <div id="fiComponentGrid" class="fi-component-grid" style="margin-top:12px">${INGREDIENT_COMPONENTS.map((x,i)=>`<label class="fi-component" data-component-row="${i}"><input type="checkbox" value="${esc(x.key)}" ${pre.has(x.key)?'checked':''}><span><b>${esc(title(x.key))}</b><small>${esc(x.serving)} • ${x.cal} kcal • ${x.p}g protein</small></span><input class="fi-component-qty" data-key="${esc(x.key)}" type="number" min=".25" step=".25" value="1" aria-label="Servings of ${esc(x.key)}"></label>`).join('')}</div>
      <div class="stack-actions" style="margin-top:14px"><button id="fiBuildEstimate" class="primary">Review ingredient estimate</button><button id="fiPublishedInstead" class="secondary">Enter published nutrition instead</button><button id="fiScanInstead" class="ghost">📸 Scan a nutrition label</button></div>`);
    const search=$('#fiComponentSearch');
    search.oninput=()=>{const q=normalize(search.value);$$('[data-component-row]').forEach(row=>{const item=INGREDIENT_COMPONENTS[+row.dataset.componentRow];row.style.display=!q||normalize(`${item.key} ${item.aliases.join(' ')}`).includes(q)?'':'none'})};
    $('#fiClearComponents').onclick=()=>$$('#fiComponentGrid input[type="checkbox"]').forEach(x=>x.checked=false);
    $('#fiPublishedInstead').onclick=()=>manualUnknown(intent,opts);
    $('#fiScanInstead').onclick=()=>{closeModal();lens('label')};
    $('#fiBuildEstimate').onclick=()=>{
      const chosen=[];$$('#fiComponentGrid input[type="checkbox"]:checked').forEach(cb=>{const base=INGREDIENT_COMPONENTS.find(x=>x.key===cb.value);if(!base)return;const qtyEl=$(`#fiComponentGrid .fi-component-qty[data-key="${CSS.escape(base.key)}"]`),qty=Math.max(.25,+qtyEl?.value||1);chosen.push({...base,qty})});
      if(!chosen.length)return toast('Choose at least one ingredient, or use published nutrition instead');
      const sum=k=>round(chosen.reduce((a,x)=>a+(x[k]||0)*x.qty,0));
      const item={brand:intent.brand?title(intent.brand):'',name:title(intent.clean||'Restaurant food'),unit:'serving',servingLabel:'1 estimated serving',cal:sum('cal'),p:sum('p'),c:sum('c'),f:sum('f'),fiber:sum('fiber'),sugar:sum('sugar'),source:'Veyra ingredient-composition estimate • common serving data • review required',confidence:56,notes:`Estimated components: ${chosen.map(x=>`${x.qty}× ${x.key} (${x.serving})`).join(', ')}`};
      closeModal();reviewFood(item,{...intent,quantity:intent.quantity||1},opts);const note=$('#fiReviewForm input[name="notes"]');if(note)note.value=item.notes;
    };
  }

  function unknownFoodOptions(intent,opts={}){
    openModal('No exact match — keep going',`<div class="fi-question"><span>🧭</span><div><span class="eyebrow">VEYRA FALLBACK LADDER</span><h2>${esc(title(intent.clean||'Food'))}</h2><p>Veyra could not verify an exact item. It will not invent nutrition, but you do not have to abandon the log.</p></div></div>
      <div class="fi-choice-list">
        <button id="fiEstimateUnknown" class="fi-choice"><div><b>🧩 Estimate from ingredients</b><small>Best for a local restaurant, homemade dish, or custom order. Review every component and macro before logging.</small></div><em>Build ›</em></button>
        <button id="fiScanUnknown" class="fi-choice"><div><b>📸 Scan the nutrition label</b><small>Best for packaged foods or restaurant nutrition sheets.</small></div><em>Scan ›</em></button>
        <button id="fiManualUnknown" class="fi-choice"><div><b>✎ Enter published nutrition</b><small>Use numbers from the package or restaurant once; Veyra remembers the custom food locally.</small></div><em>Enter ›</em></button>
      </div><div class="callout"><b>Why this is safer and more useful.</b><br>An ingredient estimate is clearly labeled as an estimate; exact/published numbers stay distinct. Nothing is silently logged.</div>`);
    $('#fiEstimateUnknown').onclick=()=>ingredientEstimate(intent,opts);
    $('#fiScanUnknown').onclick=()=>{closeModal();lens('label')};
    $('#fiManualUnknown').onclick=()=>manualUnknown(intent,opts);
  }

  function renderSearchResults(q,meal,local,online,opts={}){
    const all=[...local.slice(0,5),...online.slice(0,10)],seen=new Set(),dedup=all.filter(x=>{const k=normalize(`${x.brand}|${x.name}|${x.servingLabel}`);if(seen.has(k))return false;seen.add(k);return true});
    const box=$('#fiSearchResults');if(!box)return;
    if(!dedup.length){box.innerHTML=`<div class="empty-state-v2"><div class="icon">🧭</div><h3>No exact match — Veyra can still help</h3><p>Build a transparent ingredient estimate, scan a label, or enter published nutrition. Veyra will never invent an exact restaurant number.</p><button id="fiUnknownOptions" class="primary">Continue resolving this food</button></div>`;$('#fiUnknownOptions').onclick=()=>unknownFoodOptions(parseIntent(q),opts);return}
    box.innerHTML=`<div class="fi-results">${dedup.map((x,i)=>`<button class="fi-result" data-fi-result="${i}">${x.image?`<img src="${esc(x.image)}" alt="">`:`<span class="fi-result-art">${foodEmoji(x.name)}</span>`}<div><b>${esc(x.name)}</b><small>${esc(x.brand||'Generic')} • ${esc(x.servingLabel)}</small><small>${x.cal||'—'} kcal • ${x.p||0}g protein • ${esc(x.source)}</small></div><em>Choose ›</em></button>`).join('')}</div><div class="callout">Veyra combines local high-confidence entries with public product data. You always review the serving and nutrition before logging.</div>`;
    $$('[data-fi-result]').forEach(b=>b.onclick=()=>reviewFood(dedup[+b.dataset.fiResult],{...parseIntent(q),meal},opts));
  }

  async function smartFoodSearch(prefill='',meal='Snack',opts={}){
    openModal('Smart food search',`<div class="fi-search-hero"><span>⌕</span><div><span class="eyebrow">TYPE OR SAY IT NATURALLY</span><h2>What did you have?</h2><p>Brand, restaurant, normal food — Veyra will ask only for details it actually needs.</p></div></div><form id="fiSearchForm" class="food-search-top"><input id="fiSearchInput" value="${esc(prefill)}" placeholder="e.g., Garden Fresh pizza from Papa Johns" autofocus><button class="primary">Find</button></form><div class="fi-search-tools"><button id="fiVoiceSearch" class="secondary">🎙 Say it</button><button id="fiBarcodeSearch" class="secondary">▦ Barcode</button><button id="fiPhotoSearch" class="secondary">📸 Meal / label photo</button></div><div id="fiSearchResults" style="margin-top:14px"><div class="empty-state-v2"><div class="icon">🍽️</div><h3>Try a real sentence</h3><p>“I had two slices of a medium Garden Fresh pizza from Papa Johns” or “MorningStar crumbles.”</p></div></div>`);
    const run=async()=>{const q=$('#fiSearchInput').value.trim();if(!q)return;const intent={...parseIntent(q),meal:mealFromText(q)||meal};if(hasUnknownVenue(intent))return unknownFoodOptions(intent,opts);const local=localMatches(intent);$('#fiSearchResults').innerHTML='<div class="scan-status"><span class="spinner"></span> Resolving food and public product data…</div>';let online=[];try{online=await openFoodFactsSearch(intent.clean)}catch{}renderSearchResults(q,intent.meal,local,online,opts)};
    $('#fiSearchForm').onsubmit=e=>{e.preventDefault();run()};$('#fiVoiceSearch').onclick=()=>{closeModal();smartVoice()};$('#fiBarcodeSearch').onclick=()=>{closeModal();barcodeFromImage()};$('#fiPhotoSearch').onclick=()=>{closeModal();lens('food')};if(prefill)setTimeout(run,20);
  }

  const CHIPOTLE_COMPONENTS=[
    {key:'brown rice',aliases:['brown rice'],cal:210,p:4,c:36,f:6,fiber:2,sugar:0},
    {key:'white rice',aliases:['white rice'],cal:210,p:4,c:40,f:4,fiber:1,sugar:0},
    {key:'black beans',aliases:['black beans','black bean'],cal:130,p:8,c:22,f:2,fiber:7,sugar:0},
    {key:'pinto beans',aliases:['pinto beans','pinto bean'],cal:130,p:8,c:21,f:2,fiber:8,sugar:1},
    {key:'sofritas',aliases:['sofritas','sofrita'],cal:150,p:8,c:9,f:10,fiber:3,sugar:5},
    {key:'fajita veggies',aliases:['fajita veggies','fajita vegetables','peppers and onions'],cal:20,p:1,c:5,f:0,fiber:1,sugar:2},
    {key:'fresh tomato salsa',aliases:['fresh tomato salsa','tomato salsa','pico','pico de gallo'],cal:25,p:0,c:4,f:0,fiber:1,sugar:1},
    {key:'corn salsa',aliases:['roasted chili corn salsa','corn salsa'],cal:80,p:3,c:16,f:1,fiber:3,sugar:4},
    {key:'green salsa',aliases:['tomatillo green chili salsa','green salsa'],cal:15,p:0,c:4,f:0,fiber:0,sugar:2},
    {key:'red salsa',aliases:['tomatillo red chili salsa','red salsa'],cal:30,p:0,c:4,f:0,fiber:1,sugar:0},
    {key:'cheese',aliases:['cheese','monterey jack'],cal:110,p:6,c:1,f:8,fiber:0,sugar:0},
    {key:'sour cream',aliases:['sour cream'],cal:110,p:2,c:2,f:9,fiber:0,sugar:2},
    {key:'romaine lettuce',aliases:['romaine lettuce','lettuce','romaine'],cal:5,p:0,c:1,f:0,fiber:1,sugar:0},
    {key:'guacamole',aliases:['guacamole','guac'],cal:230,p:2,c:8,f:22,fiber:6,sugar:1}
  ];
  function chipotleMatches(text){const n=normalize(text);return CHIPOTLE_COMPONENTS.filter(x=>x.aliases.some(a=>n.includes(a)));}
  function chipotleOrderBuilder(intent,opts={}){
    const matched=chipotleMatches(intent.clean),kind=/burrito\b/.test(normalize(intent.clean))&&!/bowl/.test(normalize(intent.clean))?'Burrito':/salad/.test(normalize(intent.clean))?'Salad':/tacos?/.test(normalize(intent.clean))?'Tacos':'Burrito Bowl';
    openModal('Confirm your Chipotle order',`<div class="fi-question"><span>🥣</span><div><span class="eyebrow">BUILD FROM PUBLISHED COMPONENTS</span><h2>Chipotle ${kind}</h2><p>Veyra found ${matched.length?matched.length+' ingredient'+(matched.length===1?'':'s'):'the restaurant, but needs the ingredients'}. Check everything that was actually in your order.</p></div></div><div class="fi-component-grid">${CHIPOTLE_COMPONENTS.map(x=>`<label class="fi-component"><input type="checkbox" value="${esc(x.key)}" ${matched.includes(x)?'checked':''}><span><b>${esc(title(x.key))}</b><small>${x.cal} kcal • ${x.p}g protein</small></span></label>`).join('')}</div><div class="callout"><b>Why Veyra asks.</b><br>Build-your-own restaurant meals can change by ingredient and portion. Review the components instead of accepting a generic “Chipotle bowl” guess.</div><button id="fiChipotleReview" class="primary full" style="margin-top:12px">Review nutrition & log</button>`);
    $('#fiChipotleReview').onclick=()=>{const keys=$$('.fi-component input:checked').map(x=>x.value),parts=CHIPOTLE_COMPONENTS.filter(x=>keys.includes(x.key));if(!parts.length)return toast('Choose at least one ingredient');const sum=k=>round(parts.reduce((a,x)=>a+(x[k]||0),0));const item={brand:'Chipotle',name:`Chipotle ${kind}`,unit:'order',servingLabel:`1 ${kind.toLowerCase()}`,cal:sum('cal'),p:sum('p'),c:sum('c'),f:sum('f'),fiber:sum('fiber'),sugar:sum('sugar'),source:'Chipotle Nutrition Calculator • component sum',sourceUrl:'https://www.chipotle.com/nutrition-calculator',confidence:93,notes:`Components: ${parts.map(x=>title(x.key)).join(', ')}`};closeModal();reviewFood(item,{...intent,quantity:1},opts);const note=$('#fiReviewForm input[name="notes"]');if(note)note.value=item.notes};
  }

  async function resolveOneFood(text,opts={}){
    const intent=parseIntent(text);if(intent.brand==='chipotle'&&/bowl|burrito|salad|taco|sofritas|rice|beans|cheese|lettuce|guac|salsa/i.test(intent.clean))return chipotleOrderBuilder(intent,opts);if(hasUnknownVenue(intent))return unknownFoodOptions(intent,opts);const mem=(state.foodMemory||[]).map(x=>({...x,_score:scoreCandidate(intent.clean,x)})).filter(x=>x._score>=3).sort((a,b)=>b._score-a._score),local=[...mem,...localMatches(intent)];
    if(local.length){
      const bestScore=local[0]._score||scoreCandidate(intent.clean,local[0]),best=local.filter(x=>(x._score||scoreCandidate(intent.clean,x))>=bestScore-1);
      const variants=best.filter(x=>normalize(x.name)===normalize(best[0].name)&&normalize(x.brand)===normalize(best[0].brand));
      const requestedSize=intent.size&&variants.find(x=>x.size===intent.size);if(requestedSize)return reviewFood(requestedSize,intent,opts);
      if(variants.length>1&&!intent.size)return chooseVariant(variants,intent,opts);
      return reviewFood(best[0],intent,opts);
    }
    smartFoodSearch(intent.clean,intent.meal,opts);
  }

  function knownFoodMentions(text){
    const n=normalize(text),aliases=[];
    for(const item of [...CATALOG,...DISH_CATALOG])for(const a of (item.aliases||[]))if(a.length>=3)aliases.push({alias:normalize(a),name:item.name});
    aliases.sort((a,b)=>b.alias.length-a.alias.length);const hits=[];
    for(const a of aliases){const idx=n.indexOf(a.alias);if(idx<0)continue;const end=idx+a.alias.length;if(hits.some(h=>!(end<=h.start||idx>=h.end)))continue;hits.push({start:idx,end,alias:a.alias,name:a.name});}
    return hits.sort((a,b)=>a.start-b.start);
  }
  function splitFoodList(text){
    const clean=cleanFoodText(text),brand=canonicalBrand(clean),restaurant=['taco bell','papa johns','chipotle','starbucks','mcdonalds','subway','chick-fil-a','panera'].includes(brand);if(/\b(from|at)\s+(taco bell|papa john|chipotle|starbucks|mcdonald|subway|panera)/i.test(clean)||(restaurant&&/\bwith\b/i.test(clean))||brand==='chipotle')return [clean];
    const parts=clean.split(/\s*,\s*|\s+and\s+(?=(?:\d+|a |an |some |one |two |three |four |five |six |seven |eight |nine |ten )?[^,]{2,})/i).map(x=>x.trim()).filter(Boolean);
    if(parts.length>1&&parts.length<=6)return parts;
    /* Natural speech often uses “with” instead of “and” (e.g. paneer tikka
       with naan). When two distinct known dishes are present, resolve them
       separately rather than collapsing the whole sentence into one item. */
    if(/\bwith\b/i.test(clean)){const hits=knownFoodMentions(clean);if(hits.length>1&&hits.length<=6)return hits.map(h=>h.alias)}
    return [clean];
  }
  function smartFoodIntent(text){const parts=splitFoodList(text);if(parts.length===1)return resolveOneFood(text);openModal('I heard a few foods',`<div class="fi-question"><span>🎙</span><div><span class="eyebrow">MULTI-FOOD LOG</span><h2>Review what Veyra heard</h2><p>We’ll resolve each item one at a time so nothing gets silently guessed.</p></div></div><div class="fi-choice-list">${parts.map((p,i)=>`<div class="fi-queue-row"><span>${i+1}</span><b>${esc(p)}</b></div>`).join('')}</div><button id="fiResolveQueue" class="primary full">Resolve ${parts.length} foods</button>`);$('#fiResolveQueue').onclick=()=>{closeModal();let i=0;const next=()=>{if(i>=parts.length)return toast(`${parts.length} foods reviewed`);resolveOneFood(parts[i++],{onLogged:next})};next()}}

  function smartVoice(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){openModal('Talk to Veyra',`<div class="voice-fallback"><div class="voice-orb">🎙️</div><h3>Voice recognition isn’t exposed by this browser.</h3><p>Use your phone keyboard microphone or type below. It goes through the exact same intent engine.</p></div><form id="fiVoiceFallback" class="inline-form"><input name="text" placeholder="I had a Crunchwrap from Taco Bell"><button class="primary">Go</button></form>`);$('#fiVoiceFallback').onsubmit=e=>{e.preventDefault();const t=new FormData(e.currentTarget).get('text');closeModal();smartHandleCommand(t)};return}
    const r=new SR();r.lang='en-US';r.interimResults=true;openModal('Talk to Veyra',`<div class="voice-fallback"><div class="voice-orb listening">🎙️</div><h3>Listening…</h3><p id="fiVoiceTranscript">Say a food, activity, workout command, or question.</p></div>`);r.onresult=e=>{const t=[...e.results].map(x=>x[0].transcript).join(' ');$('#fiVoiceTranscript').textContent=t;if(e.results[e.results.length-1].isFinal)setTimeout(()=>{closeModal();smartHandleCommand(t)},160)};r.onerror=()=>{closeModal();toast('Voice input ended')};r.start();
  }

  const previousHandle=window.handleCommand;
  function smartHandleCommand(text){const s=String(text||'').trim(),l=normalize(s);if(!s)return;
    if(/\b(i\s+)?(ate|had|have eaten|just ate|just had)\b/.test(l))return smartFoodIntent(s);
    if(/\b(log|add)\b.*\b(food|meal|breakfast|lunch|dinner|snack)\b/.test(l)){const stripped=s.replace(/^.*?\b(?:food|meal|breakfast|lunch|dinner|snack)\b\s*/i,'');if(stripped.length>2)return smartFoodIntent(`I had ${stripped}`)}
    return previousHandle?previousHandle(s):undefined;
  }


  function restaurantIdeas(){
    const diet=normalize(state.profile?.diet||''), vegetarian=/vegetarian|vegan/.test(diet);
    let rows=CATALOG.filter(x=>x.brand).filter(x=>!vegetarian||/black bean|bean burrito|garden fresh/i.test(x.name)).filter(x=>profileFoodWarnings(x).length===0);
    const seen=new Set();rows=rows.filter(x=>{const k=x.brand+'|'+x.name+'|'+(x.variant||'');if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>(b.p||0)-(a.p||0)).slice(0,10);
    openModal('Restaurant ideas Veyra can resolve',`<div class="fi-search-hero"><span>✨</span><div><span class="eyebrow">SUPPORTED PUBLISHED / REVIEWABLE DATA</span><h2>Quick restaurant ideas</h2><p>Filtered by your saved dietary preference when possible. Menu data can change, so Veyra still makes you review the serving and nutrition.</p></div></div><div class="fi-choice-list">${rows.map((x,i)=>`<button class="fi-choice" data-fi-idea="${i}"><div><b>${esc(x.brand)} — ${esc(x.name)}${x.variant?' • '+esc(x.variant):''}</b><small>${x.cal} kcal • ${x.p}g protein • ${esc(x.servingLabel)}</small></div><em>Review ›</em></button>`).join('')}</div><div class="callout">For a restaurant Veyra does not have verified menu data for, type the item anyway. Veyra will resolve a generic dish when defensible or offer an ingredient-composition estimate, label scan, or published-nutrition entry instead of inventing an exact number.</div>`);
    $$('[data-fi-idea]').forEach(b=>b.onclick=()=>{const x=rows[+b.dataset.fiIdea];reviewFood(x,{clean:x.name,meal:'Snack',quantity:1,size:x.size||''})});
  }

  function restaurantHub(){
    openModal('Restaurant intelligence',`<div class="fi-search-hero"><span>🍽️</span><div><span class="eyebrow">RESTAURANT + NUTRITION</span><h2>Log what you actually ordered</h2><p>Type the restaurant and item naturally. Veyra resolves known menu data or guides you to confirm the restaurant’s published nutrition.</p></div></div><button id="fiRestaurantIdeas" class="secondary full" style="margin-bottom:12px">✨ Show restaurant ideas that fit my saved preferences</button><form id="fiRestaurantForm" class="food-search-top"><input name="q" placeholder="e.g., 2 medium Garden Fresh slices from Papa Johns" required><button class="primary">Resolve</button></form><div class="fi-choice-list" style="margin-top:12px"><button class="fi-choice fi-example" data-example="I had a Crunchwrap from Taco Bell"><div><b>Taco Bell example</b><small>Crunchwrap → review → log</small></div><em>Try ›</em></button><button class="fi-choice fi-example" data-example="I had a Chipotle bowl with brown rice, black beans, sofritas, cheese and lettuce"><div><b>Chipotle build-your-own example</b><small>Ingredients → component review → log</small></div><em>Try ›</em></button><button class="fi-choice fi-example" data-example="I had two slices of a medium Garden Fresh pizza from Papa Johns"><div><b>Papa Johns example</b><small>Size + slices → review → log</small></div><em>Try ›</em></button></div><div class="callout">Packaged brands can also use public Open Food Facts search. If no trustworthy match exists, Veyra offers a transparent ingredient estimate, label scan, or published-nutrition entry instead of dead-ending or inventing numbers.</div>`);
    const go=q=>{closeModal();smartFoodIntent(q)};$('#fiRestaurantIdeas').onclick=restaurantIdeas;$('#fiRestaurantForm').onsubmit=e=>{e.preventDefault();go(new FormData(e.currentTarget).get('q'))};$$('.fi-example').forEach(b=>b.onclick=()=>go(b.dataset.example));
  }

  /* Make typed command and voice share the same parser. */
  window.handleCommand=smartHandleCommand;window.startVoice=smartVoice;window.smartFoodIntent=smartFoodIntent;window.smartFoodSearch=smartFoodSearch;window.VEYRA_FOOD_INTELLIGENCE_VERSION=FI_VERSION;window.__VEYRA_FI_TEST__={parseIntent,localMatches,splitFoodList,chipotleMatches,dishCatalog:DISH_CATALOG,knownFoodMentions};
  const previousAction=window.action;window.action=function(a){if(a==='voice')return smartVoice();if(a==='addFood'||a==='foodSearch')return smartFoodSearch('', 'Snack');if(a==='restaurant')return restaurantHub();return previousAction?previousAction(a):undefined};

  /* Coach should treat “I had…” as logging, not a generic Q&A prompt. */
  const oldChat=window.chat;window.chat=function(q){if(/\b(i\s+)?(ate|had|just ate|just had)\b/i.test(String(q||''))){smartFoodIntent(q);return}return oldChat?oldChat(q):undefined};

  /* Rebind current header controls because enhancements bound them directly. */
  const voiceBtn=$('#voiceQuick');if(voiceBtn)voiceBtn.onclick=smartVoice;

  /* Ensure imported/old states have memory storage. */
  state.foodMemory||=[];state.appVersion='3.2.0';save();
})();
