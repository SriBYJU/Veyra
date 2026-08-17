/* Veyra Smart Vision 3.2
   Optional on-device visual matching for meal and pantry photos.
   The first Smart Vision use downloads a browser ML model from Hugging Face;
   inference then runs in the browser. Every result is review-first.
*/
(function(){
  const VERSION='3.2.0';
  const HF='https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm';
  const TESSERACT_CDN='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  const TESSERACT_WORKER='https://cdn.jsdelivr.net/npm/tesseract.js@v5.0.0/dist/worker.min.js';
  const TESSERACT_CORE='https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.0.0';
  const TESSERACT_LANG='https://tessdata.projectnaptha.com/4.0.0';
  let classifierPromise=null;
  let tesseractLoaderPromise=null;
  let ocrWorkerPromise=null;

  const FOOD_LABELS=[
    'pizza','burger','sandwich','wrap','burrito','taco','quesadilla','nachos','salad','soup','rice bowl','grain bowl',
    'pasta','spaghetti','lasagna','risotto','macaroni and cheese','ravioli','gnocchi','garlic bread',
    'chana masala','dal','dal makhani','rajma','paneer tikka','palak paneer','paneer curry','tofu curry','vegetable curry',
    'biryani','pulao','dosa','idli','sambar','samosa','naan','roti','chapati','paratha','pav bhaji','poha','upma',
    'fried rice','stir fry','noodles','dumplings','spring rolls','tofu and vegetables','mapo tofu',
    'sushi','sushi bowl','ramen','udon','soba noodles','teriyaki bowl','miso soup','tempura',
    'pad thai','thai curry','tom yum soup','basil tofu','pho','banh mi','rice paper rolls',
    'falafel','hummus','pita','shawarma bowl','lentil soup','tabbouleh','greek salad','gyro bowl',
    'black bean bowl','bean burrito','enchiladas','fajitas','guacamole','chips and salsa',
    'oatmeal','cereal','granola','yogurt bowl','smoothie','protein shake','pancakes','waffles','toast',
    'rice','beans','lentils','chickpeas','tofu','paneer','vegetables','fruit bowl','apple','banana','berries',
    'fries','potato wedges','baked potato','sweet potato','corn','broccoli','carrots','mixed vegetables',
    'cake','cookie','brownie','donut','ice cream','chips','popcorn'
  ];
  const EQUIPMENT_LABELS=['dumbbell','barbell','weight bench','cable machine','resistance bands','kettlebell','treadmill','stationary bike','rowing machine','pull-up bar','leg press machine','smith machine','elliptical','stair climber','yoga mat'];
  const PANTRY_LABELS=[
    'tofu','paneer','tempeh','rice','brown rice','quinoa','pasta','noodles','oats','cereal','bread','tortilla','pita bread',
    'black beans','kidney beans','chickpeas','lentils','edamame','peas','corn','potato','sweet potato',
    'spinach','lettuce','broccoli','cauliflower','tomato','cucumber','bell pepper','carrot','onion','garlic','mushrooms','zucchini','eggplant',
    'greek yogurt','yogurt','cheese','milk','soy milk','oat milk','coconut milk',
    'apple','banana','orange','berries','grapes','mango','avocado','lemon','lime',
    'peanut butter','almond butter','nuts','seeds','olive oil','soy sauce','tomato sauce','salsa','hummus','spices'
  ];

  function unique(arr){return [...new Set(arr.filter(Boolean).map(x=>String(x).trim()).filter(Boolean))]}
  function personalized(mode){
    const out=[];
    try{
      const p=window.state?.pantry||[]; out.push(...p);
      const learned=Object.keys(window.state?.learning?.visionFoods||{}); out.push(...learned);
      const recent=(window.state?.meals||[]).slice(-20).map(x=>x.name); out.push(...recent);
    }catch{}
    const base=mode==='pantry'?PANTRY_LABELS:mode==='equipment'?EQUIPMENT_LABELS:FOOD_LABELS; return unique([...base,...out]).slice(0,150);
  }

  async function loadTesseract(progress){
    if(window.Tesseract?.createWorker) return window.Tesseract;
    if(!tesseractLoaderPromise){
      tesseractLoaderPromise=new Promise((resolve,reject)=>{
        progress?.('Loading on-device OCR… first use downloads the OCR engine.');
        const prior=document.querySelector('script[data-veyra-tesseract]');
        if(prior){
          prior.addEventListener('load',()=>window.Tesseract?.createWorker?resolve(window.Tesseract):reject(new Error('OCR library did not initialize')),{once:true});
          prior.addEventListener('error',()=>reject(new Error('OCR library could not be downloaded')),{once:true});
          if(window.Tesseract?.createWorker)resolve(window.Tesseract);
          return;
        }
        const script=document.createElement('script');
        script.src=TESSERACT_CDN;
        script.async=true;
        script.crossOrigin='anonymous';
        script.dataset.veyraTesseract='1';
        script.onload=()=>window.Tesseract?.createWorker?resolve(window.Tesseract):reject(new Error('OCR library did not initialize'));
        script.onerror=()=>reject(new Error('OCR library could not be downloaded'));
        document.head.appendChild(script);
      }).catch(err=>{tesseractLoaderPromise=null;throw err});
    }
    return tesseractLoaderPromise;
  }

  async function getOCRWorker(progress){
    if(!ocrWorkerPromise){
      ocrWorkerPromise=(async()=>{
        const T=await loadTesseract(progress);
        progress?.('Preparing on-device OCR…');
        return T.createWorker('eng',1,{
          workerPath:TESSERACT_WORKER,
          corePath:TESSERACT_CORE,
          langPath:TESSERACT_LANG,
          logger:m=>{
            if(!progress||!m)return;
            if(m.status==='recognizing text'&&Number.isFinite(m.progress))progress(`Reading text locally… ${Math.round(m.progress*100)}%`);
            else if(m.status&&m.status!=='recognizing text')progress(`OCR: ${m.status}…`);
          }
        });
      })().catch(err=>{ocrWorkerPromise=null;throw err});
    }
    return ocrWorkerPromise;
  }

  async function extractText(file,progress,options={}){
    if(typeof window.__VEYRA_OCR_TEST_TEXT__!=='undefined'){
      return typeof window.__VEYRA_OCR_TEST_TEXT__==='function'?String(await window.__VEYRA_OCR_TEST_TEXT__(file)||''):String(window.__VEYRA_OCR_TEST_TEXT__||'');
    }
    try{
      if('TextDetector' in window){
        progress?.('Reading visible text on this device…');
        const detector=new TextDetector();
        const bmp=await createImageBitmap(file);
        try{
          const blocks=await detector.detect(bmp);
          const text=(blocks||[]).map(b=>b.rawValue||'').join(' ').trim();
          if(text.length>=8)return text;
        }finally{try{bmp.close?.()}catch{}}
      }
    }catch{}
    if(options?.heavy===false)return '';
    if(!navigator.onLine) return '';
    try{
      const worker=await getOCRWorker(progress);
      const result=await worker.recognize(file);
      return String(result?.data?.text||'').replace(/\s+/g,' ').trim();
    }catch(err){
      console.warn('Veyra OCR fallback unavailable',err);
      return '';
    }
  }

  async function getClassifier(progress){
    if(window.__VEYRA_VISION_TEST_CLASSIFIER__) return window.__VEYRA_VISION_TEST_CLASSIFIER__;
    if(!classifierPromise){
      classifierPromise=(async()=>{
        progress?.('Loading Smart Vision model… first use can take a little while.');
        const mod=await import(HF);
        if(mod.env){mod.env.allowLocalModels=false; if('useBrowserCache' in mod.env)mod.env.useBrowserCache=true;}
        const pipe=await mod.pipeline('zero-shot-image-classification','Xenova/clip-vit-base-patch32',{
          progress_callback:x=>{
            if(!x||!progress)return;
            if(x.status==='progress'&&Number.isFinite(x.progress))progress(`Downloading Smart Vision… ${Math.round(x.progress)}%`);
            else if(x.status==='ready')progress('Smart Vision ready.');
          }
        });
        return pipe;
      })().catch(err=>{classifierPromise=null;throw err});
    }
    return classifierPromise;
  }

  function portionHint(label){
    const s=String(label).toLowerCase();
    if(/pizza/.test(s))return {unit:'slice',suggestion:1,note:'Start with the number of slices you ate.'};
    if(/naan|roti|chapati|paratha|pita|tortilla|dosa|idli|samosa|taco|cookie|donut|apple|banana|orange/.test(s))return {unit:'piece',suggestion:1,note:'Confirm how many pieces/items you had.'};
    if(/rice|curry|dal|chana|rajma|sambar|pav bhaji|palak paneer|beans|lentils|chickpeas|soup|oatmeal|cereal|yogurt|pasta|noodles|risotto|biryani|pulao/.test(s))return {unit:'cup',suggestion:1,note:'Rough visual starting range: about 0.75–1.25 cups. A photo cannot measure volume exactly; confirm or edit the amount.'};
    if(/shake|smoothie/.test(s))return {unit:'serving',suggestion:1,note:'Confirm the container/serving size.'};
    return {unit:'serving',suggestion:1,note:'Confirm the amount before logging.'};
  }

  async function analyze(file,mode='food',progress){
    if(window.__VEYRA_VISION_TEST_RESULT__){
      const r=typeof window.__VEYRA_VISION_TEST_RESULT__==='function'?await window.__VEYRA_VISION_TEST_RESULT__(file,mode):window.__VEYRA_VISION_TEST_RESULT__;
      return structuredClone(r);
    }
    if(!navigator.onLine)throw new Error('Smart Vision model is not available offline until it has been downloaded once.');
    const pipe=await getClassifier(progress);
    const url=URL.createObjectURL(file);
    try{
      progress?.('Looking for likely foods…');
      const labels=personalized(mode);
      const out=await pipe(url,labels);
      const rows=(Array.isArray(out)?out:[]).slice(0,mode==='pantry'?10:7).map(x=>({label:String(x.label||''),score:Math.max(0,Math.min(100,Math.round((Number(x.score)||0)*100)))}));
      const useful=rows.filter((x,i)=>i<3||x.score>=6);
      return {
        engine:'Transformers.js / CLIP',
        version:VERSION,
        candidates:useful,
        ingredients:mode==='pantry'?useful.map(x=>x.label):[],
        equipment:mode==='equipment'?useful.map(x=>x.label):[],
        portionHints:Object.fromEntries(useful.map(x=>[x.label,portionHint(x.label)])),
        reviewRequired:true
      };
    } finally { URL.revokeObjectURL(url); }
  }

  window.VeyraVision={version:VERSION,analyze,extractText,portionHint,foodLabels:FOOD_LABELS,pantryLabels:PANTRY_LABELS,equipmentLabels:EQUIPMENT_LABELS};
})();
