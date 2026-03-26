import { useState, useEffect, useRef } from "react";
import {
  supabase, signUp, signIn, signOut, getUser,
  saveProfile, getProfile, saveProStatus,
  saveMeal, getSavedMeals,
  logMeal, getTodayLog, getLogByDate, deleteMealLog, getFrequentMeals,
  heartMeal, deleteSavedMeal,
  saveMealPlan, getWeekPlans,
  getGenerationUsage,
  getCustomGroceryList, saveCustomGroceryList,
  getWeightLog, addWeightEntry, deleteWeightEntry,
  getTodayWater, upsertWaterLog, getWaterHistory, updateWaterGoal,
  getLoggedDatesInRange,
  getMealLogRange, getMealLogSummary, getAchievements, unlockAchievement,
  startFast, endFast, getFastingLog,
} from "./lib/supabase";
import { generateMealPlan } from "./lib/claude";
import OnboardingTour from "./components/OnboardingTour";
import PricingModal from "./components/PricingModal";

// USDA FoodData Central API key (set VITE_USDA_API_KEY in Vercel env vars)
const USDA_API_KEY = import.meta.env.VITE_USDA_API_KEY || "DEMO_KEY";
if (!import.meta.env.VITE_USDA_API_KEY) {
  console.warn("[usda] VITE_USDA_API_KEY not set — using DEMO_KEY (30 req/hr limit). Set via Vercel env vars.");
}

// Admin account — only this email sees the dev panel in the Profile tab
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "macrasupport@gmail.com";

const T = {
  bg:"#09090B",sf:"#121215",bd:"#1E1E22",acc:"#C8B88A",
  accM:"rgba(200,184,138,0.12)",accG:"rgba(200,184,138,0.06)",
  tx:"#FAFAF9",tx2:"#A1A1AA",txM:"#52525B",
  pro:"#C4714A",carb:"#C9A84C",fat:"#7A9E7E",ok:"#6BCB77",
  r:14,font:"'Outfit',sans-serif",mono:"'DM Mono',monospace"
};

// Returns YYYY-MM-DD in the user's LOCAL timezone.
// Always use this instead of new Date().toISOString().split('T')[0]
// (toISOString is UTC and can return the wrong day for non-UTC users).
const localDate = (d = new Date()) => d.toLocaleDateString('en-CA');

// ── Monochrome SVG icon primitives — width/height="1em" inherits parent fontSize ──
const _I=(c)=><svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{c}</svg>;
const IcoFlame  = _I(<path d="M12 21c-4 0-7-3.1-7-7 0-2.4 1-4.4 2.5-5.8.2 1.2.8 2.1 1.5 2.6C9 8.5 9.5 5.5 12 3c.7 2 1.8 3.5 3 4.5.7-1.3.5-3 .1-4.1 2 1.9 3.9 4.5 3.9 7.1 0 5.1-3 10.5-7 10.5z"/>);
const IcoMoon   = _I(<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>);
const IcoTrophy = _I(<><path d="M8 21h8M12 17v4"/><path d="M5 3h14v8a7 7 0 01-14 0V3z"/><path d="M3 7h2M19 7h2M5 7c0 2 1.5 3.5 2 4M19 7c0 2-1.5 3.5-2 4"/></>);
const IcoStar   = _I(<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>);
const IcoDrop   = _I(<path d="M12 2C8.5 8.5 5 12.5 5 16a7 7 0 0014 0c0-3.5-3.5-7.5-7-14z"/>);
const IcoChart  = _I(<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>);
const IcoTarget = _I(<><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>);
const IcoFork   = _I(<><path d="M9 3v7c0 1.1-.9 2-2 2s-2-.9-2-2V3"/><line x1="7" y1="12" x2="7" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><path d="M13 3v4a2 2 0 004 0V3"/></>);
const IcoClip   = _I(<><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></>);
const IcoScale  = _I(<><line x1="12" y1="3" x2="12" y2="20"/><line x1="8" y1="20" x2="16" y2="20"/><line x1="5" y1="9" x2="19" y2="9"/><path d="M6 9l3 6H3l3-6zM18 9l3 6h-6l3-6z"/></>);
const IcoSun    = _I(<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></>);
const IcoBowl   = _I(<><path d="M4.5 11h15c-.5 4-3.8 7-7.5 7s-7-3-7.5-7z"/><line x1="4.5" y1="11" x2="19.5" y2="11"/><path d="M9 11V7M12 11V5M15 11V7"/></>);
const IcoApple  = _I(<><path d="M12 19c-3.87 0-7-2.7-7-7 0-3.5 2.8-7 7-7s7 3.5 7 7c0 4.3-3.13 7-7 7z"/><line x1="12" y1="5" x2="12" y2="3"/><path d="M12 3c1-1 2.5-1.5 3.5-1"/></>);
const IcoPlate  = _I(<><circle cx="12" cy="13" r="5"/><line x1="4" y1="5" x2="4" y2="19"/><line x1="2" y1="7" x2="6" y2="7"/><line x1="20" y1="5" x2="20" y2="10"/><path d="M18 5a2 2 0 012 2v3"/><line x1="20" y1="10" x2="20" y2="19"/></>);

const MEAL_CATS = ['breakfast','lunch','snack','dinner'];

const CAT_CONFIG = {
  breakfast:{label:'Breakfast',icon:IcoSun,  pct:0.25},
  lunch:    {label:'Lunch',    icon:IcoBowl, pct:0.30},
  snack:    {label:'Snack',    icon:IcoApple,pct:0.15},
  dinner:   {label:'Dinner',   icon:IcoPlate,pct:0.30},
  other:    {label:'Other',    icon:'·',     pct:0},
};

const Card=({children,style:s={},onClick,...rest})=><div onClick={onClick} style={{background:T.sf,borderRadius:T.r,border:`1px solid ${T.bd}`,...s}} {...rest}>{children}</div>;
const Lbl=({children})=><span style={{fontSize:10,fontWeight:600,color:T.txM,letterSpacing:"0.1em",textTransform:"uppercase"}}>{children}</span>;

const Ring=({pct,r,stroke,w,children})=>{
  const c=2*Math.PI*r,o=c-(Math.min(pct,100)/100)*c,s=(r+w)*2;
  return <div style={{position:"relative",width:s,height:s}}>
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <circle cx={s/2} cy={s/2} r={r} fill="none" stroke={T.bd} strokeWidth={w}/>
      <circle cx={s/2} cy={s/2} r={r} fill="none" stroke={stroke} strokeWidth={w}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={o}
        transform={`rotate(-90 ${s/2} ${s/2})`} style={{transition:"stroke-dashoffset 1s ease"}}/>
    </svg>
    <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>{children}</div>
  </div>;
};

// ─── AUTH SCREEN ────────────────────────────────────────────────
const AuthScreen = ({onAuth}) => {
  const [mode,setMode]=useState("login"); // login | signup
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);

  const handleSubmit = async () => {
    setError("");
    if(!email||!password){setError("Please fill in all fields.");return;}
    setLoading(true);
    try {
      if(mode==="signup"){
        const {data,error:err}=await signUp(email,password);
        if(err){setError(typeof err==="string"?err:err.message||"Sign up failed");setLoading(false);return;}
        onAuth(data.user);
      } else {
        const {data,error:err}=await signIn(email,password);
        if(err){setError(typeof err==="string"?err:err.message||"Login failed");setLoading(false);return;}
        onAuth(data.user);
      }
    } catch(e){setError(e.message||"Something went wrong");}
    setLoading(false);
  };

  const inputStyle={width:"100%",padding:"14px 16px",borderRadius:T.r,border:`1px solid ${T.bd}`,background:T.sf,color:T.tx,fontSize:16,fontFamily:T.font,fontWeight:500,outline:"none",boxSizing:"border-box"};

  return <div style={{maxWidth:430,margin:"0 auto",minHeight:"100vh",background:T.bg,fontFamily:T.font,display:"flex",flexDirection:"column",justifyContent:"center",padding:"0 20px"}}>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
    <div style={{textAlign:"center",marginBottom:40}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:14}}>
        <img src="/logo.svg" alt="Macra" style={{width:36,height:36}}/>
        <span style={{fontSize:30,fontWeight:600,color:T.acc,fontFamily:"'Cormorant Garamond',serif",letterSpacing:"0.08em",lineHeight:1}}>Macra</span>
      </div>
      <p style={{fontSize:14,color:T.tx2,margin:0}}>{mode==="login"?"Welcome back.":"Create your account."}</p>
    </div>

    <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
      <div>
        <Lbl>Email</Lbl>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" style={{...inputStyle,marginTop:6}}/>
      </div>
      <div>
        <Lbl>Password</Lbl>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={{...inputStyle,marginTop:6}} onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
      </div>
    </div>

    {error&&<div style={{padding:"10px 14px",borderRadius:10,background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",marginBottom:16}}>
      <p style={{fontSize:13,color:"#EF4444",margin:0}}>{error}</p>
    </div>}

    <button onClick={handleSubmit} disabled={loading} style={{width:"100%",padding:16,borderRadius:T.r,border:"none",background:T.acc,color:T.bg,fontSize:15,fontWeight:700,cursor:loading?"wait":"pointer",fontFamily:T.font,opacity:loading?0.6:1,marginBottom:16}}>
      {loading?"Please wait...":(mode==="login"?"Sign In":"Create Account")}
    </button>

    <p style={{textAlign:"center",fontSize:13,color:T.tx2,margin:0}}>
      {mode==="login"?"Don't have an account? ":"Already have an account? "}
      <span onClick={()=>{setMode(mode==="login"?"signup":"login");setError("")}} style={{color:T.acc,fontWeight:600,cursor:"pointer"}}>
        {mode==="login"?"Sign Up":"Sign In"}
      </span>
    </p>
  </div>;
};

// ─── MACRO CALCULATOR ENGINE ───────────────────────────────────
function getProteinMult(bmi, goal, activity, diet=[]) {
  if (bmi > 35) return 0.7;
  if (diet.includes("High Protein")) return 1.2;
  if (activity === "sedentary") return goal === "cut" ? 0.85 : 0.75;
  if (goal === "cut") {
    if (activity === "light" || activity === "moderate") return 1.0;
    if (activity === "active") return 1.1;
    if (activity === "very_active") return 1.2;
  }
  if (goal === "maintain") {
    if (activity === "light") return 0.85;
    if (activity === "moderate") return 0.9;
    if (activity === "active" || activity === "very_active") return 1.0;
  }
  if (goal === "lean_bulk" || goal === "bulk") {
    if (activity === "light" || activity === "moderate") return 1.0;
    if (activity === "active") return 1.1;
    if (activity === "very_active") return 1.2;
  }
  return 1.0;
}

function calcMacros(profile) {
  const {sex,age,weightLbs,heightFt,heightIn,activity,goal,diet=[]} = profile;
  const weightKg = weightLbs * 0.453592;
  const heightCm = (heightFt * 12 + heightIn) * 2.54;
  const bmr = sex === "male"
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  const actMult = {sedentary:1.2,light:1.375,moderate:1.55,active:1.725,very_active:1.9};
  const tdee = Math.round(bmr * (actMult[activity] || 1.55));
  const goalAdj = {cut:-500,maintain:0,lean_bulk:250,bulk:500};
  const target = Math.round(tdee + (goalAdj[goal] || 0));
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  const proteinMult = getProteinMult(bmi, goal, activity, diet);
  const proteinG = Math.max(100, Math.round(weightLbs * proteinMult));
  const proteinCal = proteinG * 4;
  const remaining = target - proteinCal;
  const fatG  = Math.max(40, Math.round((remaining * 0.50) / 9));
  const carbG = Math.max(50, Math.round((remaining * 0.50) / 4));
  const rule = bmi > 35 ? "BMI>35 cap" : diet.includes("High Protein") ? "high_protein preference" : `${goal}+${activity}`;
  const proteinPct = Math.round((proteinCal / target) * 100);
  const carbPct    = Math.round((carbG * 4  / target) * 100);
  const fatPct     = Math.round((fatG  * 9  / target) * 100);
  console.log(`[macros] protein rule: ${rule} → ${proteinMult}g/lb = ${proteinG}g | BMR:${Math.round(bmr)} TDEE:${tdee} target:${target}`);
  console.log(`[macros] split — protein: ${proteinPct}% carbs: ${carbPct}% fat: ${fatPct}% (${proteinG}g / ${carbG}g / ${fatG}g)`);
  return {tdee, target, proteinG, fatG, carbG};
}

// ─── SPLASH SCREEN ─────────────────────────────────────────────
const Splash = ({onFinish}) => {
  const [phase,setPhase]=useState(0); // 0=logo, 1=tagline, 2=fade out
  useEffect(()=>{
    const t1=setTimeout(()=>setPhase(1),800);
    const t2=setTimeout(()=>setPhase(2),2200);
    const t3=setTimeout(()=>onFinish(),2800);
    return ()=>{clearTimeout(t1);clearTimeout(t2);clearTimeout(t3)};
  },[]);
  return <div style={{
    maxWidth:430,margin:"0 auto",height:"100vh",background:T.bg,fontFamily:T.font,
    display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
    opacity:phase===2?0:1,transition:"opacity 0.6s ease"
  }}>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
    {/* Logo mark */}
    <img src="/logo.svg" alt="Macra" style={{
      width:88,height:88,
      marginBottom:20,
      opacity:phase>=0?1:0,transform:phase>=0?"scale(1)":"scale(0.8)",
      transition:"all 0.6s cubic-bezier(0.22, 1, 0.36, 1)"
    }}/>
    {/* Wordmark */}
    <h1 style={{
      fontSize:42,fontWeight:600,color:T.acc,margin:"0 0 8px",
      letterSpacing:"0.08em",fontFamily:"'Cormorant Garamond',serif",
      opacity:phase>=0?1:0,transform:phase>=0?"translateY(0)":"translateY(12px)",
      transition:"all 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.15s"
    }}>Macra</h1>
    {/* Tagline */}
    <p style={{
      fontSize:15,color:T.tx2,margin:0,fontWeight:400,letterSpacing:"0.06em",
      opacity:phase>=1?1:0,transform:phase>=1?"translateY(0)":"translateY(8px)",
      transition:"all 0.5s cubic-bezier(0.22, 1, 0.36, 1)"
    }}>Eat with intention.</p>
  </div>;
};

// ─── NUMERIC INPUT ─────────────────────────────────────────────
// Defined at module level (not inside Onboarding) so React treats it as a
// stable component type across re-renders — prevents unmount/remount on each
// state change which was causing spurious network requests.
const NumInput = ({label, value, onChange, min, max, unit}) => {
  const [display, setDisplay] = useState("");
  const [focused, setFocused] = useState(false);

  // When parent value changes (e.g. +/- buttons) and we're not editing, sync display
  useEffect(() => {
    if (!focused) setDisplay(String(value));
  }, [value, focused]);

  const handleFocus = () => {
    setFocused(true);
    setDisplay(""); // clear so user types from scratch
  };

  const handleBlur = () => {
    setFocused(false);
    const parsed = parseInt(display, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      onChange(clamped);
      setDisplay(String(clamped));
    } else {
      // empty or invalid — restore the last valid value
      setDisplay(String(value));
    }
  };

  const btnStyle = {width:40,height:40,borderRadius:10,border:`1px solid ${T.bd}`,background:T.sf,color:T.tx,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font,flexShrink:0};

  return (
    <div style={{flex:1}}>
      {label ? <Lbl>{label}</Lbl> : null}
      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:label?8:0}}>
        <button onClick={()=>onChange(Math.max(min, value-1))} style={btnStyle}>−</button>
        <div style={{flex:1,display:"flex",alignItems:"baseline",justifyContent:"center",gap:4}}>
          <input
            type="number"
            inputMode="numeric"
            value={focused ? display : value}
            min={min}
            max={max}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={e => setDisplay(e.target.value)} // free typing, no clamping
            style={{width:68,textAlign:"center",fontSize:28,fontWeight:700,color:T.tx,fontFamily:T.mono,background:"transparent",border:"none",outline:"none",appearance:"textfield",WebkitAppearance:"none",MozAppearance:"textfield",padding:0,margin:0}}
          />
          {unit && <span style={{fontSize:13,color:T.txM}}>{unit}</span>}
        </div>
        <button onClick={()=>onChange(Math.min(max, value+1))} style={btnStyle}>+</button>
      </div>
    </div>
  );
};

// ─── ONBOARDING ────────────────────────────────────────────────
const Onboarding = ({onComplete}) => {
  const [step,setStep] = useState(0);
  const [dir,setDir] = useState(1);
  const [profile,setProfile] = useState({
    name:"",sex:"male",age:28,weightLbs:185,heightFt:5,heightIn:11,
    activity:"active",goal:"lean_bulk",diet:[],weeklyBudget:null,pickinessLevel:3
  });
  const [budgetInput,setBudgetInput] = useState("");
  const [pickinessInput,setPickinessInput] = useState(3);

  const set = (k,v) => setProfile(p=>({...p,[k]:v}));
  const next = () => {setDir(1);setStep(s=>s+1)};
  const back = () => {setDir(-1);setStep(s=>s-1)};

  const totalSteps = 8;
  const pct = ((step+1)/totalSteps)*100;

  const inputStyle = {
    width:"100%",padding:"14px 16px",borderRadius:T.r,border:`1px solid ${T.bd}`,
    background:T.sf,color:T.tx,fontSize:16,fontFamily:T.font,fontWeight:500,
    outline:"none",boxSizing:"border-box"
  };

  const SelectBtn = ({label,selected,onClick,sub}) => (
    <button onClick={onClick} style={{
      width:"100%",padding:sub?"14px 16px":"18px 16px",borderRadius:T.r,
      border:`1.5px solid ${selected?T.acc:T.bd}`,
      background:selected?T.accM:"transparent",
      color:selected?T.acc:T.tx2,fontSize:sub?14:16,fontWeight:selected?600:500,
      cursor:"pointer",textAlign:"left",fontFamily:T.font,
      transition:"all 0.2s ease",display:"flex",alignItems:"center",justifyContent:"space-between"
    }}>
      <span>{label}</span>
      {selected && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
    </button>
  );

  const macros = step===7 ? calcMacros(profile) : null;

  const steps = [
    // 0: Name + Sex
    <div key="0">
      <h2 style={{fontSize:28,fontWeight:700,color:T.tx,margin:"0 0 6px",letterSpacing:"-0.02em"}}>Welcome to Macra</h2>
      <p style={{fontSize:14,color:T.txM,margin:"0 0 32px",lineHeight:1.5}}>Eat with intention. We'll calculate your ideal nutrition targets in about 60 seconds.</p>
      <Lbl>Your Name</Lbl>
      <input value={profile.name} onChange={e=>set("name",e.target.value)} placeholder="Enter your name" style={{...inputStyle,marginTop:8,marginBottom:24}} />
      <Lbl>Biological Sex</Lbl>
      <p style={{fontSize:11,color:T.txM,margin:"4px 0 10px"}}>Used for metabolic rate calculation</p>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <SelectBtn label="Male" selected={profile.sex==="male"} onClick={()=>set("sex","male")}/>
        <SelectBtn label="Female" selected={profile.sex==="female"} onClick={()=>set("sex","female")}/>
      </div>
    </div>,

    // 1: Age + Weight
    <div key="1">
      <h2 style={{fontSize:28,fontWeight:700,color:T.tx,margin:"0 0 6px",letterSpacing:"-0.02em"}}>Body Stats</h2>
      <p style={{fontSize:14,color:T.txM,margin:"0 0 32px",lineHeight:1.5}}>This determines your base metabolic rate.</p>
      <div style={{marginBottom:28}}>
        <NumInput label="Age" value={profile.age} onChange={v=>set("age",v)} min={14} max={85} unit="yrs"/>
      </div>
      <div style={{marginBottom:28}}>
        <NumInput label="Weight" value={profile.weightLbs} onChange={v=>set("weightLbs",v)} min={80} max={400} unit="lbs"/>
      </div>
      <Lbl>Height</Lbl>
      <div style={{display:"flex",gap:16,marginTop:8}}>
        <NumInput label="" value={profile.heightFt} onChange={v=>set("heightFt",v)} min={4} max={7} unit="ft"/>
        <NumInput label="" value={profile.heightIn} onChange={v=>set("heightIn",v)} min={0} max={11} unit="in"/>
      </div>
    </div>,

    // 2: Activity
    <div key="2">
      <h2 style={{fontSize:28,fontWeight:700,color:T.tx,margin:"0 0 6px",letterSpacing:"-0.02em"}}>Activity Level</h2>
      <p style={{fontSize:14,color:T.txM,margin:"0 0 32px",lineHeight:1.5}}>How many days per week do you exercise?</p>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {[
          {k:"sedentary",l:"Sedentary",d:"Little to no exercise"},
          {k:"light",l:"Lightly Active",d:"1–2 days/week"},
          {k:"moderate",l:"Moderately Active",d:"3–4 days/week"},
          {k:"active",l:"Very Active",d:"5–6 days/week"},
          {k:"very_active",l:"Athlete",d:"Intense daily training"},
        ].map(a=>(
          <button key={a.k} onClick={()=>set("activity",a.k)} style={{
            width:"100%",padding:"16px",borderRadius:T.r,
            border:`1.5px solid ${profile.activity===a.k?T.acc:T.bd}`,
            background:profile.activity===a.k?T.accM:"transparent",
            cursor:"pointer",textAlign:"left",fontFamily:T.font,transition:"all 0.2s"
          }}>
            <span style={{fontSize:15,fontWeight:600,color:profile.activity===a.k?T.acc:T.tx,display:"block"}}>{a.l}</span>
            <span style={{fontSize:12,color:T.txM,marginTop:2,display:"block"}}>{a.d}</span>
          </button>
        ))}
      </div>
    </div>,

    // 3: Goal
    <div key="3">
      <h2 style={{fontSize:28,fontWeight:700,color:T.tx,margin:"0 0 6px",letterSpacing:"-0.02em"}}>What's Your Goal?</h2>
      <p style={{fontSize:14,color:T.txM,margin:"0 0 32px",lineHeight:1.5}}>This adjusts your calorie target accordingly.</p>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {[
          {k:"cut",l:"Cut",d:"Lose fat · −500 cal deficit",icon:"↘"},
          {k:"maintain",l:"Maintain",d:"Stay where you are · no adjustment",icon:"→"},
          {k:"lean_bulk",l:"Lean Bulk",d:"Build muscle slowly · +250 cal surplus",icon:"↗"},
          {k:"bulk",l:"Bulk",d:"Maximum muscle gain · +500 cal surplus",icon:"⬆"},
        ].map(g=>(
          <button key={g.k} onClick={()=>set("goal",g.k)} style={{
            width:"100%",padding:"16px 16px",borderRadius:T.r,
            border:`1.5px solid ${profile.goal===g.k?T.acc:T.bd}`,
            background:profile.goal===g.k?T.accM:"transparent",
            cursor:"pointer",textAlign:"left",fontFamily:T.font,transition:"all 0.2s",
            display:"flex",alignItems:"center",gap:14
          }}>
            <span style={{fontSize:22,width:32,textAlign:"center",filter:profile.goal===g.k?"none":"grayscale(1) opacity(0.4)"}}>{g.icon}</span>
            <div>
              <span style={{fontSize:15,fontWeight:600,color:profile.goal===g.k?T.acc:T.tx,display:"block"}}>{g.l}</span>
              <span style={{fontSize:12,color:T.txM,display:"block",marginTop:2}}>{g.d}</span>
            </div>
          </button>
        ))}
      </div>
    </div>,

    // 4: Dietary Preferences
    <div key="4">
      <h2 style={{fontSize:28,fontWeight:700,color:T.tx,margin:"0 0 6px",letterSpacing:"-0.02em"}}>Dietary Preferences</h2>
      <p style={{fontSize:14,color:T.txM,margin:"0 0 32px",lineHeight:1.5}}>Select any that apply. This helps the AI customize your plans.</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
        {["No Restrictions","Dairy-Free","Gluten-Free","Vegetarian","Vegan","Keto","Paleo","Carnivore","Mediterranean","High Protein","High Fiber","Halal","Kosher","Nut-Free","Low Sodium"].map(d=>{
          const sel=profile.diet.includes(d);
          return <button key={d} onClick={()=>set("diet",sel?profile.diet.filter(x=>x!==d):[...profile.diet,d])} style={{
            padding:"10px 16px",borderRadius:20,
            border:`1.5px solid ${sel?T.acc:T.bd}`,
            background:sel?T.accM:"transparent",
            color:sel?T.acc:T.tx2,fontSize:13,fontWeight:sel?600:500,
            cursor:"pointer",fontFamily:T.font,transition:"all 0.2s"
          }}>{d}</button>;
        })}
      </div>
    </div>,

    // 5: Weekly Grocery Budget
    <div key="5">
      <h2 style={{fontSize:28,fontWeight:700,color:T.tx,margin:"0 0 6px",letterSpacing:"-0.02em"}}>Weekly Grocery Budget</h2>
      <p style={{fontSize:14,color:T.txM,margin:"0 0 28px",lineHeight:1.5}}>What's your weekly grocery budget?</p>
      <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:8}}>
        <span style={{padding:"14px 0 14px 16px",borderRadius:`${T.r} 0 0 ${T.r}`,border:`1px solid ${T.bd}`,borderRight:"none",background:T.sf,color:T.txM,fontSize:16,fontWeight:600,lineHeight:1,height:50,boxSizing:"border-box",display:"flex",alignItems:"center"}}>$</span>
        <input
          type="number" inputMode="numeric" placeholder="e.g. 100"
          value={budgetInput}
          onChange={e=>setBudgetInput(e.target.value.replace(/[^0-9]/g,""))}
          style={{flex:1,padding:"14px 16px",borderRadius:`0 ${T.r} ${T.r} 0`,border:`1px solid ${T.bd}`,background:T.sf,color:T.tx,fontSize:16,fontFamily:T.font,fontWeight:500,outline:"none",boxSizing:"border-box",height:50}}
        />
      </div>
      <p style={{fontSize:12,color:T.txM,margin:"0 0 12px",lineHeight:1.6}}>
        This helps us tailor your meal plans to fit your budget. Without a budget set, suggested meals and ingredients may be more extensive or costly.
      </p>
      <p style={{fontSize:10,color:T.txM,margin:"0 0 28px",lineHeight:1.6,opacity:0.7}}>
        Note: Macra cannot guarantee exact budget accuracy. Grocery prices vary by location, store, and season. Budget guidance is approximate and intended as a helpful starting point only.
      </p>
      <button onClick={()=>{set("weeklyBudget",null);next();}} style={{width:"100%",padding:12,borderRadius:T.r,border:`1px solid ${T.bd}`,background:"transparent",color:T.tx2,fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:T.font}}>
        Skip
      </button>
    </div>,

    // 6: Pickiness / Meal Complexity
    <div key="6">
      <h2 style={{fontSize:28,fontWeight:700,color:T.tx,margin:"0 0 6px",letterSpacing:"-0.02em"}}>How adventurous are you with food?</h2>
      <p style={{fontSize:14,color:T.txM,margin:"0 0 28px",lineHeight:1.5}}>This helps us tailor meal suggestions to your taste preferences.</p>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {[
          {v:1,l:"Very adventurous",d:"Love trying new cuisines and bold flavors"},
          {v:2,l:"Somewhat adventurous",d:"Enjoy variety and global flavors"},
          {v:3,l:"Balanced",d:"Mix of familiar and new"},
          {v:4,l:"Somewhat picky",d:"Prefer mostly familiar dishes"},
          {v:5,l:"Very picky",d:"Prefer simple, familiar everyday meals"},
        ].map(o=>(
          <SelectBtn key={o.v} label={o.l} sub={o.d} selected={pickinessInput===o.v} onClick={()=>setPickinessInput(o.v)}/>
        ))}
      </div>
      {pickinessInput>=4&&<div style={{marginTop:16,padding:"12px 14px",borderRadius:T.r,border:`1px solid ${T.acc}40`,background:T.accM}}>
        <p style={{fontSize:12,color:T.tx2,margin:0,lineHeight:1.6}}>For the best experience, we recommend visiting the <strong style={{color:T.acc}}>You tab</strong> after setup to add any foods you don't eat. This helps us avoid suggesting meals you won't enjoy.</p>
      </div>}
      <button onClick={()=>{setPickinessInput(3);next();}} style={{width:"100%",padding:12,borderRadius:T.r,border:`1px solid ${T.bd}`,background:"transparent",color:T.tx2,fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:T.font,marginTop:20}}>
        Skip (default: Balanced)
      </button>
    </div>,

    // 7: Results
    <div key="7">
      <h2 style={{fontSize:28,fontWeight:700,color:T.tx,margin:"0 0 6px",letterSpacing:"-0.02em"}}>Your Targets</h2>
      <p style={{fontSize:14,color:T.txM,margin:"0 0 8px",lineHeight:1.5}}>
        {profile.name ? `${profile.name}, here's` : "Here's"} your personalized daily nutrition plan.
      </p>
      <p style={{fontSize:12,color:T.txM,margin:"0 0 28px"}}>
        TDEE: <span style={{color:T.tx,fontFamily:T.mono,fontWeight:600}}>{macros?.tdee}</span> cal · Goal adjustment applied
      </p>

      {/* Big calorie number */}
      <div style={{textAlign:"center",marginBottom:28}}>
        <Ring pct={100} r={58} stroke={T.acc} w={5}>
          <span style={{fontSize:38,fontWeight:700,color:T.tx,fontFamily:T.mono,lineHeight:1}}>{macros?.target}</span>
          <span style={{fontSize:10,color:T.txM,fontWeight:500,letterSpacing:"0.12em",marginTop:4,textTransform:"uppercase"}}>daily calories</span>
        </Ring>
      </div>

      {/* Macro breakdown */}
      <div style={{display:"flex",gap:10,marginBottom:24}}>
        {[
          {l:"Protein",v:`${macros?.proteinG??0}g`,c:T.pro,sub:`${(macros?.proteinG??0)*4} cal`},
          {l:"Carbs",v:`${macros?.carbG??0}g`,c:T.carb,sub:`${(macros?.carbG??0)*4} cal`},
          {l:"Fat",v:`${macros?.fatG??0}g`,c:T.fat,sub:`${(macros?.fatG??0)*9} cal`},
        ].map(m=>(
          <Card key={m.l} style={{flex:1,padding:"18px 12px",textAlign:"center"}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:m.c,margin:"0 auto 8px"}}/>
            <p style={{fontSize:22,fontWeight:700,color:T.tx,margin:0,fontFamily:T.mono}}>{m.v}</p>
            <Lbl>{m.l}</Lbl>
            <p style={{fontSize:11,color:T.txM,margin:"6px 0 0",fontFamily:T.mono}}>{m.sub}</p>
          </Card>
        ))}
      </div>

      {/* Summary */}
      <Card style={{padding:"14px 16px",background:T.accG,border:`1px solid ${T.accM}`}}>
        <p style={{fontSize:13,color:T.tx2,margin:0,lineHeight:1.6}}>
          Based on your stats ({profile.weightLbs} lbs, {profile.heightFt}'{profile.heightIn}", {profile.age}y, {profile.activity.replace("_"," ")}) with a <strong style={{color:T.acc}}>{profile.goal.replace("_"," ")}</strong> goal. You can adjust these anytime in Profile.
        </p>
      </Card>
    </div>,
  ];

  return <div style={{maxWidth:430,margin:"0 auto",minHeight:"100vh",background:T.bg,fontFamily:T.font,display:"flex",flexDirection:"column"}}>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

    {/* Progress */}
    <div style={{padding:"16px 20px 0"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        {step>0 ? <button onClick={back} style={{background:"none",border:"none",color:T.tx2,fontSize:14,cursor:"pointer",fontFamily:T.font,fontWeight:500,padding:0}}>← Back</button> : <span/>}
        <span style={{fontSize:12,color:T.txM,fontFamily:T.mono}}>{step+1}/{totalSteps}</span>
      </div>
      <div style={{height:3,borderRadius:2,background:T.bd}}>
        <div style={{height:"100%",borderRadius:2,background:T.acc,width:`${pct}%`,transition:"width 0.4s ease"}}/>
      </div>
    </div>

    {/* Content */}
    <div style={{flex:1,padding:"32px 20px 24px",overflowY:"auto"}}>
      {steps[step]}
    </div>

    {/* CTA */}
    <div style={{padding:"0 20px 32px"}}>
      <button onClick={()=>{
        if(step === 5){
          // Budget step — save value if entered, then advance
          const val = budgetInput ? parseInt(budgetInput, 10) : null;
          set("weeklyBudget", val && val > 0 ? val : null);
          next();
        } else if(step === 6){
          // Pickiness step — save and advance
          set("pickinessLevel", pickinessInput);
          next();
        } else if(step < totalSteps - 1){
          next();
        } else {
          onComplete({...profile, pickinessLevel: profile.pickinessLevel ?? pickinessInput, macros:calcMacros(profile)});
        }
      }} style={{
        width:"100%",padding:16,borderRadius:T.r,border:"none",
        background:T.acc,color:T.bg,fontSize:15,fontWeight:700,
        cursor:"pointer",letterSpacing:"0.02em",fontFamily:T.font,
        opacity:(step===0 && !profile.name)?0.4:1,
        pointerEvents:(step===0 && !profile.name)?"none":"auto"
      }}>
        {step === totalSteps - 1 ? "Start Tracking →" : "Continue"}
      </button>
    </div>
  </div>;
};

// ─── HEART ICON ────────────────────────────────────────────────
const HeartIcon = ({filled, size=16}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled?T.acc:"none"} stroke={filled?T.acc:T.txM} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"block"}}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);

// ─── SWIPEABLE ROW ─────────────────────────────────────────────
// Reveals a red Delete button on left-swipe. Used for log entries and
// frequently-logged items. Defined at module level so it's a stable
// component reference and won't unmount/remount on parent re-renders.
const SwipeableRow = ({onDelete, children, style:outerStyle={}}) => {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(null);
  const startY = useRef(null);
  const startOffset = useRef(0);
  const isHoriz = useRef(false);
  const containerRef = useRef(null);
  const REVEAL = 80;

  const onTS = (e) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    startOffset.current = offset; // capture current offset so right-swipe can cancel
    isHoriz.current = false;
    setDragging(true);
  };
  const onTM = (e) => {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (!isHoriz.current) {
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isHoriz.current = Math.abs(dx) > Math.abs(dy);
      return;
    }
    // Both directions: left reveals delete, right cancels reveal
    setOffset(Math.max(-REVEAL, Math.min(0, startOffset.current + dx)));
  };
  const onTE = () => {
    setDragging(false);
    startX.current = null;
    setOffset(prev => prev < -(REVEAL / 2) ? -REVEAL : 0);
  };

  // Tap anywhere outside this row to collapse the delete button
  useEffect(() => {
    if (offset >= 0) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOffset(0);
      }
    };
    const t = setTimeout(() => document.addEventListener('touchstart', handler, { passive: true }), 150);
    return () => { clearTimeout(t); document.removeEventListener('touchstart', handler); };
  }, [offset]);

  return (
    <div ref={containerRef} style={{position:"relative", overflow:"hidden", borderRadius:T.r, marginBottom:6, ...outerStyle}}>
      {/* Delete button revealed on swipe */}
      <div style={{position:"absolute", top:0, right:0, bottom:0, width:REVEAL, background:"#EF4444", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer"}}
        onClick={() => { onDelete(); setOffset(0); }}>
        <span style={{color:"#fff", fontSize:13, fontWeight:700}}>Delete</span>
      </div>
      {/* Sliding content */}
      <div style={{transform:`translateX(${offset}px)`, transition:dragging?"none":"transform 0.2s ease"}}
        onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}>
        {children}
      </div>
    </div>
  );
};

// ─── SHARED UI HELPERS ──────────────────────────────────────────
const BackBtn = ({onBack}) => (
  <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:6,padding:"0 0 20px",color:T.acc,fontSize:14,fontWeight:600,fontFamily:T.font}}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>Back
  </button>
);

// ─── WEEK STRIP ─────────────────────────────────────────────────
const STRIP_DAY_ABB = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const WeekStrip = ({viewDate, onSelectDate, onOpenCalendar}) => {
  const todayStr = localDate();
  const viewStr  = localDate(viewDate);
  const containerRef = useRef(null);
  const selectedRef  = useRef(null);

  // Monday of viewDate's week
  const viewMon = new Date(viewDate);
  const dow = viewDate.getDay();
  viewMon.setDate(viewDate.getDate() + (dow === 0 ? -6 : 1 - dow));

  // 3 weeks: prev, current, next (21 days)
  const days = [];
  for(let i = -7; i < 14; i++){
    const d = new Date(viewMon);
    d.setDate(viewMon.getDate() + i);
    days.push(d);
  }

  // Scroll selected day into horizontal centre without triggering page scroll
  useEffect(()=>{
    const container = containerRef.current;
    const el = selectedRef.current;
    if(!container || !el) return;
    const target = el.offsetLeft - (container.offsetWidth - el.offsetWidth) / 2;
    container.scrollLeft = target;
  }, [viewStr]);

  return <div data-tour="week-strip" style={{display:'flex',alignItems:'center',gap:4,margin:'4px 0 8px'}}>
    <style>{`.ws-strip::-webkit-scrollbar{display:none}`}</style>
    <div className="ws-strip" ref={containerRef}
      style={{flex:1,display:'flex',overflowX:'auto',scrollbarWidth:'none',msOverflowStyle:'none',gap:0,WebkitOverflowScrolling:'touch'}}>
      {days.map(d=>{
        const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const isToday2=ds===todayStr, isSel=ds===viewStr;
        return <div key={ds} ref={isSel?selectedRef:null}
          onClick={()=>onSelectDate(new Date(ds+'T12:00:00'))}
          style={{flexShrink:0,width:44,display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'3px 0',cursor:'pointer',userSelect:'none'}}>
          <span style={{fontSize:9,letterSpacing:'0.06em',fontWeight:isToday2?700:400,color:isToday2?T.acc:T.txM}}>
            {STRIP_DAY_ABB[d.getDay()].toUpperCase()}
          </span>
          <div style={{width:30,height:30,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
            background:isSel?T.acc:'transparent',
            boxShadow:isToday2&&!isSel?`0 0 0 1.5px ${T.acc}`:'none',
            transition:'background 0.15s'}}>
            <span style={{fontSize:13,fontWeight:isSel||isToday2?700:400,color:isSel?T.bg:isToday2?T.acc:T.tx2,fontFamily:T.mono}}>
              {d.getDate()}
            </span>
          </div>
        </div>;
      })}
    </div>
    <button onClick={onOpenCalendar} style={{flexShrink:0,padding:'6px 8px',background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center'}}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={T.tx2} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
      </svg>
    </button>
  </div>;
};

// ─── CALENDAR OVERLAY ───────────────────────────────────────────
const CAL_MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CAL_DAY_ABB = ['Mo','Tu','We','Th','Fr','Sa','Su'];

const CalendarOverlay = ({viewDate, onSelectDate, onClose, userId}) => {
  const todayStr = localDate();
  const viewStr  = localDate(viewDate);
  const curYear  = new Date().getFullYear();

  const [calMonth, setCalMonth] = useState(()=>new Date(viewDate.getFullYear(), viewDate.getMonth(), 1));
  const [loggedDates, setLoggedDates] = useState(new Set());
  const [showYearPicker, setShowYearPicker] = useState(false);
  const touchStartY = useRef(null);

  const yr = calMonth.getFullYear(), mo = calMonth.getMonth();

  useEffect(()=>{
    if(!userId) return;
    const start = `${yr}-${String(mo+1).padStart(2,'0')}-01`;
    const last = new Date(yr, mo+1, 0).getDate();
    const end   = `${yr}-${String(mo+1).padStart(2,'0')}-${String(last).padStart(2,'0')}`;
    getLoggedDatesInRange(userId, start, end).then(dates=>setLoggedDates(new Set(dates)));
  },[yr, mo, userId]);

  // Mon-first grid
  const firstDow = ((new Date(yr,mo,1).getDay()+6)%7); // 0=Mon
  const daysInMo = new Date(yr,mo+1,0).getDate();
  const cells = [...Array(firstDow).fill(null), ...Array.from({length:daysInMo},(_,i)=>i+1)];
  while(cells.length%7) cells.push(null);

  // Swipe-down to dismiss
  const onTS = e => { touchStartY.current = e.touches[0].clientY; };
  const onTE = e => {
    if(touchStartY.current===null) return;
    if(e.changedTouches[0].clientY - touchStartY.current > 80) onClose();
    touchStartY.current = null;
  };

  const years = Array.from({length:6},(_,i)=>curYear-4+i); // curYear-4 to curYear+1

  return <div onTouchStart={onTS} onTouchEnd={onTE} style={{padding:'0 20px 40px',background:T.bg,minHeight:'100vh'}}>
    {/* Top bar */}
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:4,paddingBottom:4}}>
      <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:6,padding:'8px 0',color:T.acc,fontSize:14,fontWeight:600,fontFamily:T.font}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>Close
      </button>
      <button onClick={()=>setCalMonth(new Date(curYear, new Date().getMonth(), 1))} style={{padding:'6px 14px',borderRadius:8,border:`1px solid ${T.acc}`,background:'transparent',color:T.acc,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:T.font}}>Today</button>
    </div>

    {/* Month nav */}
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',margin:'12px 0 16px'}}>
      <button onClick={()=>setCalMonth(new Date(yr,mo-1,1))} style={{background:'none',border:'none',cursor:'pointer',padding:8,color:T.tx2,display:'flex'}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.tx2} strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <button onClick={()=>setShowYearPicker(p=>!p)} style={{background:'none',border:'none',cursor:'pointer',fontFamily:T.font,textAlign:'center'}}>
        <p style={{fontSize:18,fontWeight:700,color:T.tx,margin:0,letterSpacing:'-0.02em'}}>{CAL_MONTH_NAMES[mo]}</p>
        <p style={{fontSize:12,color:T.acc,margin:'2px 0 0',fontWeight:600}}>{yr} {showYearPicker?'▲':'▼'}</p>
      </button>
      <button onClick={()=>setCalMonth(new Date(yr,mo+1,1))} style={{background:'none',border:'none',cursor:'pointer',padding:8,color:T.tx2,display:'flex'}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.tx2} strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>

    {/* Year picker */}
    {showYearPicker&&<Card style={{padding:'12px',marginBottom:16}}>
      <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center'}}>
        {years.map(y=><button key={y} onClick={()=>{setCalMonth(new Date(y,mo,1));setShowYearPicker(false);}} style={{padding:'8px 18px',borderRadius:8,border:`1px solid ${y===yr?T.acc:T.bd}`,background:y===yr?T.accM:'transparent',color:y===yr?T.acc:T.tx2,fontSize:14,fontWeight:y===yr?700:400,cursor:'pointer',fontFamily:T.font}}>{y}</button>)}
      </div>
    </Card>}

    {/* Day header row */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',marginBottom:6}}>
      {CAL_DAY_ABB.map(d=><div key={d} style={{textAlign:'center',padding:'2px 0'}}>
        <span style={{fontSize:9,color:T.txM,fontWeight:600,letterSpacing:'0.08em'}}>{d}</span>
      </div>)}
    </div>

    {/* Date grid */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',rowGap:2}}>
      {cells.map((d,i)=>{
        if(!d) return <div key={'e'+i}/>;
        const ds=`${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const isToday2=ds===todayStr, isSel=ds===viewStr;
        const hasData=loggedDates.has(ds), isFut=ds>todayStr;
        return <div key={ds} onClick={()=>onSelectDate(new Date(ds+'T12:00:00'))}
          style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'3px 0',cursor:'pointer',opacity:isFut?0.4:1}}>
          <div style={{width:34,height:34,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
            background:isSel?T.acc:'transparent',
            boxShadow:isToday2&&!isSel?`0 0 0 1.5px ${T.acc}`:'none'}}>
            <span style={{fontSize:14,fontWeight:isSel||isToday2?700:400,color:isSel?T.bg:isToday2?T.acc:T.tx,fontFamily:T.mono}}>{d}</span>
          </div>
          <div style={{width:4,height:4,borderRadius:'50%',background:T.acc,opacity:hasData&&!isSel?1:0}}/>
        </div>;
      })}
    </div>
  </div>;
};

// ─── SPARKLINE ──────────────────────────────────────────────────
const Sparkline = ({values, w=72, h=26}) => {
  if(!values||values.length===0) return null;
  if(values.length===1) return <svg width={w} height={h}><circle cx={w/2} cy={h/2} r={3} fill={T.acc}/></svg>;
  const min=Math.min(...values), max=Math.max(...values), range=max-min||1;
  const pad=3;
  const pts=values.map((v,i)=>[pad+(i/(values.length-1))*(w-pad*2), pad+(1-(v-min)/range)*(h-pad*2)]);
  const d=pts.map((p,i)=>`${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return <svg width={w} height={h} style={{overflow:'visible'}}>
    <path d={d} fill="none" stroke={T.acc} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
    {values.length<=4&&pts.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r={2.5} fill={T.acc}/>)}
  </svg>;
};

// ─── WEIGHT TRACKER ─────────────────────────────────────────────
const WeightTrackerWidget = ({userId, onViewFull}) => {
  const [entries,setEntries]=useState([]);
  const [loaded,setLoaded]=useState(false);
  const [showInput,setShowInput]=useState(false);
  const [inputVal,setInputVal]=useState('');
  const [inputUnit,setInputUnit]=useState('lbs');
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    if(!userId||loaded) return;
    getWeightLog(userId).then(d=>{setEntries(d);setLoaded(true);});
  },[userId,loaded]);

  const latest = entries.length>0 ? parseFloat(entries[entries.length-1].weight_lbs) : null;
  const sparkValues = entries.slice(-7).map(e=>parseFloat(e.weight_lbs));

  const handleLog = async() => {
    if(!inputVal||!userId) return;
    setSaving(true);
    const raw = parseFloat(inputVal);
    const lbs = inputUnit==='kg' ? Math.round(raw*2.20462*10)/10 : raw;
    const {data:row} = await addWeightEntry(userId, lbs);
    if(row) setEntries(p=>[...p,row]);
    setInputVal(''); setShowInput(false); setSaving(false);
  };

  return <Card style={{padding:'14px 16px',marginBottom:8}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}} onClick={()=>!showInput&&onViewFull()}>
      <div>
        <Lbl>Weight</Lbl>
        <div style={{marginTop:4,display:'flex',alignItems:'baseline',gap:4}}>
          {latest!=null
            ? <><span style={{fontSize:22,fontWeight:700,color:T.tx,fontFamily:T.mono}}>{latest}</span><span style={{fontSize:12,color:T.txM,fontWeight:500,marginLeft:2}}>lbs</span></>
            : <span style={{fontSize:12,color:T.txM,fontStyle:'italic'}}>Log your first weight</span>}
        </div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        {sparkValues.length>=2&&<Sparkline values={sparkValues} w={64} h={26}/>}
        <button onClick={e=>{e.stopPropagation();setShowInput(p=>!p);setInputVal('');}} style={{padding:'6px 12px',borderRadius:8,border:`1px solid ${T.acc}`,background:'transparent',color:T.acc,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:T.font,whiteSpace:'nowrap',flexShrink:0}}>+ Log</button>
      </div>
    </div>
    {showInput&&<div style={{marginTop:12,display:'flex',gap:8,alignItems:'center'}}>
      <input type="number" value={inputVal} onChange={e=>setInputVal(e.target.value)} placeholder={inputUnit==='lbs'?'185':'84'} style={{flex:1,padding:'10px 12px',borderRadius:8,border:`1px solid ${T.bd}`,background:T.bg,color:T.tx,fontSize:15,fontFamily:T.mono,outline:'none',boxSizing:'border-box'}} onKeyDown={e=>e.key==='Enter'&&handleLog()} autoFocus/>
      <button onClick={()=>setInputUnit(p=>p==='lbs'?'kg':'lbs')} style={{padding:'10px 10px',borderRadius:8,border:`1px solid ${T.bd}`,background:'transparent',color:T.tx2,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:T.font,flexShrink:0}}>{inputUnit}</button>
      <button onClick={handleLog} disabled={saving||!inputVal} style={{padding:'10px 14px',borderRadius:8,border:'none',background:T.acc,color:T.bg,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:T.font,opacity:saving||!inputVal?0.5:1,flexShrink:0}}>Log</button>
    </div>}
    {!showInput&&<p style={{fontSize:10,color:T.txM,margin:'6px 0 0',letterSpacing:'0.03em'}}>Tap card to view history · swipe entries to delete</p>}
  </Card>;
};

const WeightHistoryView = ({userId, onBack}) => {
  const [entries,setEntries]=useState([]);
  const [loaded,setLoaded]=useState(false);
  const [filter,setFilter]=useState('1M');

  useEffect(()=>{
    if(!userId) return;
    getWeightLog(userId).then(d=>{setEntries(d);setLoaded(true);});
  },[userId]);

  const handleDelete = async(id) => {
    await deleteWeightEntry(id);
    setEntries(p=>p.filter(e=>e.id!==id));
  };

  const now=new Date();
  const filterMs={'1W':7,'1M':30,'3M':90};
  const filtered = filter==='All' ? entries : entries.filter(e=>(now-new Date(e.logged_at))<=filterMs[filter]*864e5);

  // SVG line chart
  const W=320,H=140,pT=24,pR=16,pB=28,pL=38;
  const plotW=W-pL-pR, plotH=H-pT-pB;
  const vals=filtered.map(e=>parseFloat(e.weight_lbs));
  const times=filtered.map(e=>new Date(e.logged_at).getTime());
  const minV=vals.length?Math.min(...vals):0, maxV=vals.length?Math.max(...vals):100;
  const rangeV=(maxV-minV)||1;
  const minT=times.length?Math.min(...times):0, maxT=times.length?Math.max(...times):1;
  const rangeT=(maxT-minT)||1;
  const toX=t=>pL+(t-minT)/rangeT*plotW;
  const toY=v=>pT+(1-(v-minV)/rangeV)*plotH;
  const pts = filtered.length===1
    ? [[pL+plotW/2, pT+plotH/2]]
    : filtered.map(e=>[toX(new Date(e.logged_at).getTime()),toY(parseFloat(e.weight_lbs))]);
  const linePath=pts.length>=2?pts.map((p,i)=>`${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '):null;
  const fillPath=linePath?`${linePath} L${pts[pts.length-1][0].toFixed(1)},${(pT+plotH).toFixed(1)} L${pts[0][0].toFixed(1)},${(pT+plotH).toFixed(1)} Z`:null;

  const fmtLong=iso=>{const d=new Date(iso);const mo=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return `${mo[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;};

  return <div style={{padding:'0 20px 24px'}}>
    <BackBtn onBack={onBack}/>
    <h2 style={{fontSize:22,fontWeight:700,color:T.tx,margin:'0 0 16px',letterSpacing:'-0.02em'}}>Weight History</h2>

    {/* Time filter tabs */}
    <Card style={{display:'flex',padding:4,marginBottom:16}}>
      {['1W','1M','3M','All'].map(f=><button key={f} onClick={()=>setFilter(f)} style={{flex:1,padding:'8px 0',borderRadius:8,border:'none',background:filter===f?T.acc:'transparent',color:filter===f?T.bg:T.txM,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:T.font,transition:'all 0.15s'}}>{f}</button>)}
    </Card>

    {/* Chart */}
    <Card style={{padding:'16px',marginBottom:16,overflow:'hidden'}}>
      {!loaded&&<div style={{height:140,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:13,color:T.txM}}>Loading…</span></div>}
      {loaded&&filtered.length===0&&<div style={{height:140,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:13,color:T.txM}}>No entries in this period</span></div>}
      {loaded&&filtered.length>0&&<svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{display:'block',overflow:'visible'}}>
        {/* Gridlines */}
        {[0,0.5,1].map(f=>{
          const y=(pT+f*plotH).toFixed(1);
          const v=(minV+(1-f)*rangeV).toFixed(1);
          return <g key={f}>
            <line x1={pL} y1={y} x2={pL+plotW} y2={y} stroke={T.bd} strokeWidth={0.5} strokeDasharray="3,4"/>
            <text x={pL-4} y={parseFloat(y)+4} textAnchor="end" fill={T.txM} fontSize={9}>{v}</text>
          </g>;
        })}
        {/* Fill + line */}
        {fillPath&&<path d={fillPath} fill={`${T.acc}18`}/>}
        {linePath&&<path d={linePath} fill="none" stroke={T.acc} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>}
        {/* Dots */}
        {pts.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r={filtered.length<=10?3.5:2} fill={T.acc}/>)}
        {/* Annotations */}
        {filtered.length>=2&&<>
          <text x={pts[0][0]} y={pts[0][1]-9} textAnchor="middle" fill={T.tx2} fontSize={9}>{vals[0]}lbs</text>
          <text x={pts[pts.length-1][0]} y={pts[pts.length-1][1]-9} textAnchor="middle" fill={T.acc} fontSize={9} fontWeight="bold">{vals[vals.length-1]}lbs</text>
        </>}
        {filtered.length===1&&<text x={pts[0][0]} y={pts[0][1]-12} textAnchor="middle" fill={T.acc} fontSize={10} fontWeight="bold">{vals[0]}lbs</text>}
      </svg>}
    </Card>

    {/* Entries list */}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
      <Lbl>All Entries</Lbl>
      <span style={{fontSize:11,color:T.txM}}>{filtered.length} log{filtered.length!==1?'s':''}</span>
    </div>
    {loaded&&entries.length===0&&<Card style={{padding:'20px',textAlign:'center'}}>
      <p style={{fontSize:13,color:T.txM,margin:0}}>Log your first weight to start tracking</p>
    </Card>}
    {[...filtered].reverse().map(e=><SwipeableRow key={e.id} onDelete={()=>handleDelete(e.id)}>
      <Card style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',marginBottom:0}}>
        <span style={{fontSize:13,color:T.tx2,fontWeight:500}}>{fmtLong(e.logged_at)}</span>
        <span style={{fontSize:16,fontWeight:700,color:T.acc,fontFamily:T.mono}}>{parseFloat(e.weight_lbs)} lbs</span>
      </Card>
    </SwipeableRow>)}
  </div>;
};

// ─── WATER TRACKER ──────────────────────────────────────────────
const WATER_BLUE = '#4A9EFF';

const WaterTrackerWidget = ({userId, defaultGoal=8, onViewFull}) => {
  const [glasses,setGlasses]=useState(0);
  const [goal,setGoal]=useState(defaultGoal);
  const [loaded,setLoaded]=useState(false);

  useEffect(()=>{
    if(!userId||loaded) return;
    getTodayWater(userId).then(data=>{
      if(data){setGlasses(data.glasses);setGoal(data.goal);}
      setLoaded(true);
    });
  },[userId,loaded]);

  const addGlass = async(e) => {
    e.stopPropagation();
    const next=glasses+1;
    setGlasses(next);
    await upsertWaterLog(userId,next,goal);
  };

  const pct=Math.min((glasses/goal)*100,100);
  const done=glasses>=goal;

  return <Card style={{padding:'14px 16px',marginBottom:8,cursor:'pointer'}} onClick={onViewFull}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
      <div>
        <Lbl>Water</Lbl>
        <div style={{marginTop:4,display:'flex',alignItems:'baseline',gap:3}}>
          <span style={{fontSize:22,fontWeight:700,color:done?WATER_BLUE:T.tx,fontFamily:T.mono}}>{glasses}</span>
          <span style={{fontSize:12,color:T.txM,fontWeight:500}}>/ {goal} glasses</span>
        </div>
      </div>
      <button onClick={addGlass} style={{padding:'8px 14px',borderRadius:8,border:`1px solid ${WATER_BLUE}`,background:'transparent',color:WATER_BLUE,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:T.font,whiteSpace:'nowrap',flexShrink:0}}>+ Glass</button>
    </div>
    {/* Progress bar */}
    <div style={{height:5,borderRadius:3,background:T.bd,overflow:'hidden'}}>
      <div style={{height:'100%',borderRadius:3,background:WATER_BLUE,width:`${pct}%`,transition:'width 0.4s ease'}}/>
    </div>
    {done&&<p style={{fontSize:10,color:WATER_BLUE,margin:'5px 0 0',fontWeight:600,letterSpacing:'0.04em'}}>GOAL REACHED ✓</p>}
    {!done&&<p style={{fontSize:10,color:T.txM,margin:'5px 0 0'}}>Tap card to adjust goal · {goal-glasses} glass{goal-glasses!==1?'es':''} remaining</p>}
  </Card>;
};

const WaterSettingsView = ({userId, defaultGoal=8, onBack, onGoalChange}) => {
  const [glasses,setGlasses]=useState(0);
  const [goal,setGoal]=useState(defaultGoal);
  const [unit,setUnit]=useState('glasses'); // 'glasses' | 'oz'
  const [history,setHistory]=useState([]);
  const [loaded,setLoaded]=useState(false);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    if(!userId) return;
    Promise.all([getTodayWater(userId),getWaterHistory(userId)]).then(([today,hist])=>{
      if(today){setGlasses(today.glasses);setGoal(today.goal);}
      setHistory(hist);
      setLoaded(true);
    });
  },[userId]);

  const updateCount = async(val) => {
    const next=Math.max(0,val);
    setGlasses(next);
    await upsertWaterLog(userId,next,goal);
  };

  const saveGoal = async(newGoal) => {
    setSaving(true);
    setGoal(newGoal);
    await upsertWaterLog(userId,glasses,newGoal);
    await updateWaterGoal(userId,newGoal);
    if(onGoalChange) onGoalChange(newGoal);
    setSaving(false);
  };

  const toDisplay = v => unit==='oz' ? Math.round(v*8) : v;
  const toGlasses = v => unit==='oz' ? Math.round(v/8) : v;
  const unitLabel = unit==='oz' ? 'oz' : 'glasses';

  // 7-day bar chart
  const today=localDate();
  const last7=[];
  for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);last7.push(localDate(d));}
  const histMap=Object.fromEntries(history.map(r=>[r.log_date,r]));
  const barData=last7.map(d=>({date:d,glasses:histMap[d]?.glasses||0,goal:histMap[d]?.goal||goal}));
  const maxBar=Math.max(...barData.map(b=>Math.max(b.glasses,b.goal)),1);
  const BAR_H=60;
  const dayLabels=['Su','Mo','Tu','We','Th','Fr','Sa'];

  return <div style={{padding:'0 20px 24px'}}>
    <BackBtn onBack={onBack}/>
    <h2 style={{fontSize:22,fontWeight:700,color:T.tx,margin:'0 0 4px',letterSpacing:'-0.02em'}}>Water Tracker</h2>
    <p style={{fontSize:13,color:T.tx2,margin:'0 0 20px'}}>Track your daily hydration.</p>

    {/* Unit toggle */}
    <Card style={{display:'flex',padding:4,marginBottom:16}}>
      {['glasses','oz'].map(u=><button key={u} onClick={()=>setUnit(u)} style={{flex:1,padding:'8px 0',borderRadius:8,border:'none',background:unit===u?WATER_BLUE:'transparent',color:unit===u?'#fff':T.txM,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:T.font,transition:'all 0.15s',textTransform:'capitalize'}}>{u==='oz'?'Fluid oz':'Glasses'}</button>)}
    </Card>

    {/* Today's count */}
    <Card style={{padding:'20px',marginBottom:12}}>
      <Lbl>Today's Intake</Lbl>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:20,marginTop:14}}>
        <button onClick={()=>updateCount(glasses-1)} style={{width:40,height:40,borderRadius:'50%',border:`1.5px solid ${T.bd}`,background:'transparent',color:T.tx,fontSize:20,fontWeight:300,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:T.font}}>−</button>
        <div style={{textAlign:'center'}}>
          <span style={{fontSize:36,fontWeight:800,color:WATER_BLUE,fontFamily:T.mono}}>{toDisplay(glasses)}</span>
          <p style={{fontSize:12,color:T.txM,margin:'2px 0 0'}}>{unitLabel} of {toDisplay(goal)} {unitLabel}</p>
        </div>
        <button onClick={()=>updateCount(glasses+1)} style={{width:40,height:40,borderRadius:'50%',border:`1.5px solid ${WATER_BLUE}`,background:`${WATER_BLUE}18`,color:WATER_BLUE,fontSize:20,fontWeight:300,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:T.font}}>+</button>
      </div>
      {/* Progress bar */}
      <div style={{height:6,borderRadius:3,background:T.bd,overflow:'hidden',marginTop:16}}>
        <div style={{height:'100%',borderRadius:3,background:WATER_BLUE,width:`${Math.min((glasses/goal)*100,100)}%`,transition:'width 0.4s ease'}}/>
      </div>
    </Card>

    {/* Daily goal setting */}
    <Card style={{padding:'16px 20px',marginBottom:16}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <Lbl>Daily Goal</Lbl>
          <p style={{fontSize:14,color:T.tx,margin:'4px 0 0',fontWeight:500}}>{toDisplay(goal)} {unitLabel}</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={()=>saveGoal(Math.max(1,goal-1))} disabled={saving} style={{width:32,height:32,borderRadius:8,border:`1px solid ${T.bd}`,background:'transparent',color:T.tx,fontSize:18,fontWeight:300,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:T.font}}>−</button>
          <button onClick={()=>saveGoal(goal+1)} disabled={saving} style={{width:32,height:32,borderRadius:8,border:`1px solid ${WATER_BLUE}`,background:`${WATER_BLUE}18`,color:WATER_BLUE,fontSize:18,fontWeight:300,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:T.font}}>+</button>
        </div>
      </div>
    </Card>

    {/* 7-day history */}
    <Lbl>Last 7 Days</Lbl>
    <Card style={{padding:'16px',marginTop:8}}>
      {!loaded&&<div style={{height:BAR_H+24,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:12,color:T.txM}}>Loading…</span></div>}
      {loaded&&<div style={{display:'flex',alignItems:'flex-end',gap:4,justifyContent:'space-between'}}>
        {barData.map((b,i)=>{
          const barPct=(b.glasses/maxBar)*BAR_H;
          const goalPct=(b.goal/maxBar)*BAR_H;
          const isToday2=b.date===today;
          const dayIdx=new Date(b.date+'T12:00:00').getDay();
          return <div key={b.date} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
            <div style={{width:'100%',display:'flex',alignItems:'flex-end',justifyContent:'center',height:BAR_H,position:'relative'}}>
              {/* Goal line */}
              <div style={{position:'absolute',bottom:goalPct,left:0,right:0,height:1,background:`${WATER_BLUE}50`,borderRadius:1}}/>
              {/* Bar */}
              <div style={{width:'70%',height:Math.max(barPct,2),borderRadius:'3px 3px 0 0',background:isToday2?WATER_BLUE:`${WATER_BLUE}60`,transition:'height 0.3s ease'}}/>
            </div>
            <span style={{fontSize:9,color:isToday2?WATER_BLUE:T.txM,fontWeight:isToday2?700:400}}>{dayLabels[dayIdx]}</span>
          </div>;
        })}
      </div>}
    </Card>
  </div>;
};

// ─── FASTING DETAIL VIEW ────────────────────────────────────────
const FAST_GOALS = [12, 14, 16, 18, 24];
const fmtFastTime = secs => `${Math.floor(secs/3600)}h ${Math.floor((secs%3600)/60)}m`;

const FastingDetailView = ({isFasting, fastStartedAt, fastingGoal, onStart, onEnd, userId, onBack}) => {
  const [elapsed, setElapsed] = useState(0);
  const [goal, setGoal] = useState(fastingGoal || 16);
  const [fastHistory, setFastHistory] = useState([]);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (isFasting && fastStartedAt) {
      const tick = () => setElapsed(Math.floor((Date.now() - new Date(fastStartedAt).getTime()) / 1000));
      tick();
      timerRef.current = setInterval(tick, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isFasting, fastStartedAt]);

  useEffect(() => {
    if (userId) getFastingLog(userId).then(setFastHistory);
  }, [userId]);

  const goalSecs = goal * 3600;
  const pct = isFasting ? Math.min((elapsed / goalSecs) * 100, 100) : 0;
  const goalReached = isFasting && elapsed >= goalSecs;
  const ringR = 90, ringW = 8, ringSize = (ringR + ringW) * 2;
  const circumference = 2 * Math.PI * ringR;

  const handleStart = async () => {
    const now = new Date().toISOString();
    await onStart(goal, now);
  };

  const handleEnd = async () => {
    if (!confirmEnd) { setConfirmEnd(true); return; }
    setEnding(true);
    const now = new Date().toISOString();
    await onEnd(fastStartedAt, now, goal, elapsed >= goalSecs);
    setEnding(false);
    setConfirmEnd(false);
    getFastingLog(userId).then(setFastHistory);
  };

  const lastFast = fastHistory[0];
  const lastFastDur = lastFast?.ended_at ? Math.floor((new Date(lastFast.ended_at) - new Date(lastFast.started_at)) / 3600000) : null;
  const lastFastMin = lastFast?.ended_at ? Math.floor(((new Date(lastFast.ended_at) - new Date(lastFast.started_at)) % 3600000) / 60000) : null;

  return <div style={{position:"fixed",inset:0,background:T.bg,zIndex:200,overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
    <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    <div style={{maxWidth:430,margin:"0 auto",padding:"52px 20px 120px"}}>

      {/* Back */}
      <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:6,padding:0,color:T.acc,fontSize:14,fontWeight:600,fontFamily:T.font,marginBottom:28}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        Back
      </button>

      <h1 style={{fontSize:26,fontWeight:700,color:T.tx,margin:"0 0 4px",letterSpacing:"-0.02em"}}>
        {isFasting ? 'Fasting' : 'Start a Fast'}
      </h1>
      <p style={{fontSize:13,color:T.tx2,margin:"0 0 32px"}}>
        {isFasting
          ? `Started ${new Date(fastStartedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`
          : 'Track your intermittent fasting window'}
      </p>

      {/* ── Timer ring (active) ── */}
      {isFasting && <div style={{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:32}}>
        <div style={{position:'relative',width:ringSize,height:ringSize}}>
          <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
            <circle cx={ringSize/2} cy={ringSize/2} r={ringR} fill="none" stroke={T.bd} strokeWidth={ringW}/>
            <circle cx={ringSize/2} cy={ringSize/2} r={ringR} fill="none"
              stroke={goalReached ? T.acc : T.pro} strokeWidth={ringW} strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={circumference - (pct/100)*circumference}
              transform={`rotate(-90 ${ringSize/2} ${ringSize/2})`}
              style={{transition:'stroke-dashoffset 1s ease'}}/>
          </svg>
          <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
            <span style={{fontSize:36,fontWeight:700,color:goalReached?T.acc:T.tx,fontFamily:T.mono,lineHeight:1}}>{fmtFastTime(elapsed)}</span>
            <span style={{fontSize:11,color:T.txM,marginTop:4,letterSpacing:'0.08em',textTransform:'uppercase'}}>of {goal}h goal</span>
            {goalReached && <span style={{fontSize:14,marginTop:8}}>🎉 Goal reached!</span>}
          </div>
        </div>
        {/* Progress bar */}
        <div style={{width:'100%',maxWidth:280,marginTop:20}}>
          <div style={{height:4,borderRadius:2,background:T.bd,overflow:'hidden'}}>
            <div style={{height:'100%',borderRadius:2,background:goalReached?T.acc:T.pro,width:`${pct}%`,transition:'width 1s linear'}}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
            <span style={{fontSize:10,color:T.txM}}>0h</span>
            <span style={{fontSize:10,color:T.txM}}>{Math.round(pct)}%</span>
            <span style={{fontSize:10,color:T.txM}}>{goal}h</span>
          </div>
        </div>
      </div>}

      {/* ── Goal selector (inactive only) ── */}
      {!isFasting && <>
        <Lbl>Fasting Goal</Lbl>
        <div style={{display:'flex',gap:8,marginTop:8,marginBottom:28}}>
          {FAST_GOALS.map(h=>(
            <button key={h} onClick={()=>setGoal(h)} style={{
              flex:1,padding:'10px 4px',borderRadius:T.r,
              border:`1px solid ${goal===h?T.acc:T.bd}`,
              background:goal===h?T.accM:'transparent',
              color:goal===h?T.acc:T.tx2,
              fontSize:12,fontWeight:goal===h?700:500,
              cursor:'pointer',fontFamily:T.font,
            }}>{h}h</button>
          ))}
        </div>
      </>}

      {/* ── Last fast summary (inactive) ── */}
      {!isFasting && lastFast && <Card style={{padding:'14px 16px',marginBottom:24}}>
        <Lbl>Last Fast</Lbl>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8}}>
          <span style={{fontSize:13,color:T.tx2}}>{new Date(lastFast.started_at).toLocaleDateString([],{month:'short',day:'numeric'})}</span>
          <span style={{fontSize:14,fontWeight:600,color:lastFast.completed?T.acc:T.tx2,fontFamily:T.mono}}>
            {lastFastDur!==null?`${lastFastDur}h ${lastFastMin}m`:'—'} {lastFast.completed?'✓':''}
          </span>
        </div>
      </Card>}

      {/* ── Start / End button ── */}
      {!isFasting
        ? <button onClick={handleStart} style={{width:'100%',padding:16,borderRadius:T.r,border:'none',background:T.acc,color:T.bg,fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:T.font,marginBottom:32}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:"middle",marginRight:6}}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            Start {goal}h Fast
          </button>
        : <div style={{marginBottom:32}}>
            {!confirmEnd
              ? <button onClick={handleEnd} style={{width:'100%',padding:14,borderRadius:T.r,border:`1px solid ${T.bd}`,background:'transparent',color:T.tx2,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:T.font}}>
                  End Fast
                </button>
              : <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>setConfirmEnd(false)} style={{flex:1,padding:14,borderRadius:T.r,border:`1px solid ${T.bd}`,background:'transparent',color:T.tx2,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:T.font}}>Cancel</button>
                  <button onClick={handleEnd} disabled={ending} style={{flex:1,padding:14,borderRadius:T.r,border:'none',background:'#EF4444',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:T.font,opacity:ending?0.6:1}}>
                    {ending?'Ending…':'Confirm End'}
                  </button>
                </div>
            }
          </div>
      }

      {/* ── History list ── */}
      {fastHistory.length > 0 && <>
        <Lbl>History</Lbl>
        <Card style={{marginTop:10,overflow:'hidden'}}>
          {fastHistory.slice(0,7).map((f,i,arr)=>{
            const durH = f.ended_at ? Math.floor((new Date(f.ended_at)-new Date(f.started_at))/3600000) : null;
            const durM = f.ended_at ? Math.floor(((new Date(f.ended_at)-new Date(f.started_at))%3600000)/60000) : null;
            return <div key={f.id||i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',borderBottom:i<arr.length-1?`1px solid ${T.bd}`:'none'}}>
              <div>
                <p style={{fontSize:13,color:T.tx,fontWeight:500,margin:'0 0 2px'}}>{new Date(f.started_at).toLocaleDateString([],{month:'short',day:'numeric'})}</p>
                <p style={{fontSize:11,color:T.txM,margin:0}}>Goal: {f.goal_hours}h</p>
              </div>
              <div style={{textAlign:'right'}}>
                <p style={{fontSize:14,fontWeight:600,color:f.completed?T.acc:T.tx2,margin:'0 0 2px',fontFamily:T.mono}}>
                  {durH!==null?`${durH}h ${durM}m`:'In progress'}
                </p>
                <p style={{fontSize:10,color:f.completed?T.acc:T.txM,margin:0}}>{f.completed?'✓ Completed':'Partial'}</p>
              </div>
            </div>;
          })}
        </Card>
      </>}
    </div>
  </div>;
};

// ─── DASHBOARD ─────────────────────────────────────────────────
const Dashboard = ({setTab,onLogCategory,profile,todayLog=[],onLogMeal,onUnlogMeal,todayPlan=[],weekPlans={},userId,savedMeals=[],onHeartMeal,isFasting=false,fastStartedAt=null,fastingGoal=16,onStartFast,onEndFast}) => {
  const [viewDate,setViewDate]=useState(()=>new Date());
  const [historyLog,setHistoryLog]=useState(null); // null = showing today
  const [loggingId,setLoggingId]=useState(null);
  const [progressView,setProgressView]=useState(null); // null | 'weight' | 'water'
  const [showCalendar,setShowCalendar]=useState(false);
  const [pendingPlanMeal,setPendingPlanMeal]=useState(null);
  const [pendingMealType,setPendingMealType]=useState('breakfast');
  const [showFasting,setShowFasting]=useState(false);
  const [fastElapsedSecs,setFastElapsedSecs]=useState(0);
  const m = profile?.macros || {target:2200,proteinG:180,carbG:240,fatG:70};

  // Live fasting timer for Dashboard header display (updates every minute)
  useEffect(()=>{
    if(!isFasting||!fastStartedAt) return;
    const tick=()=>setFastElapsedSecs(Math.floor((Date.now()-new Date(fastStartedAt).getTime())/1000));
    tick();
    const id=setInterval(tick,60000);
    return ()=>clearInterval(id);
  },[isFasting,fastStartedAt]);
  const fastHeaderStr=`${Math.floor(fastElapsedSecs/3600)}h ${Math.floor((fastElapsedSecs%3600)/60)}m`;

  const todayStr = localDate();
  const viewStr = localDate(viewDate);
  const isToday = viewStr === todayStr;

  const displayLog = isToday ? todayLog : (historyLog||[]);

  // Load historical log when navigating to a past day
  useEffect(()=>{
    if(isToday){setHistoryLog(null);return;}
    if(!userId) return;
    (async()=>{const log = await getLogByDate(userId,viewStr);setHistoryLog(log);})();
  },[viewStr,isToday,userId]);

  const refreshHistoryLog = async () => {
    if(userId && !isToday){const log = await getLogByDate(userId,viewStr);setHistoryLog(log);}
  };

  const consumed = displayLog.reduce((a,x)=>({cal:a.cal+(x.calories||0),p:a.p+(x.protein||0),c:a.c+(x.carbs||0),f:a.f+(x.fat||0)}),{cal:0,p:0,c:0,f:0});
  const cal={cur:consumed.cal,tgt:m.target};
  const mac=[{k:"Protein",cur:consumed.p,tgt:m.proteinG,c:T.pro},{k:"Carbs",cur:consumed.c,tgt:m.carbG,c:T.carb},{k:"Fat",cur:consumed.f,tgt:m.fatG,c:T.fat}];

  // A/B plan lookup: A days = Mon/Wed/Fri/Sun (dowIndex even), B days = Tue/Thu/Sat (dowIndex odd)
  const viewDow = viewDate.getDay();
  const dowIndex = viewDow === 0 ? 6 : viewDow - 1; // Mon=0..Sun=6
  const abKey = dowIndex % 2 === 0 ? 0 : 1; // 0=Day A, 1=Day B
  const dayPlanMeals = isToday && todayPlan.length>0 ? todayPlan : (weekPlans[abKey]||[]);
  const planLabel = abKey === 0 ? "Day A Plan" : "Day B Plan";
  const loggedNamesLower = new Set(displayLog.map(x=>(x.name||"").toLowerCase()));
  const unloggedPlan = dayPlanMeals.filter(pm => !loggedNamesLower.has(pm.name.toLowerCase()));

  const remaining = Math.max(0, cal.tgt - cal.cur);
  const proteinLeft = Math.max(0,m.proteinG - consumed.p);
  const mealsLeft = unloggedPlan.length;

  // Empty state: today, nothing logged, no plan generated yet
  const isEmpty = isToday && todayLog.length === 0 && Object.keys(weekPlans).length === 0;

  const insightText = consumed.cal === 0
    ? `Start your day! Your target is ${m.target} calories with ${m.proteinG}g protein.`
    : proteinLeft > 20 && mealsLeft > 0
    ? `You need ${proteinLeft}g protein in your remaining ${mealsLeft} meal${mealsLeft>1?"s":""} to hit target.`
    : proteinLeft <= 20 && consumed.cal < m.target
    ? `Protein on track! You have ${remaining} cal remaining for the day.`
    : consumed.cal >= m.target
    ? `You've reached your ${m.target} cal target for today. Great job!`
    : `${remaining} calories remaining. Keep it up!`;

  const S_DAYS  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const S_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const viewingLabel = `${S_DAYS[viewDate.getDay()]}, ${S_MONTHS[viewDate.getMonth()]} ${viewDate.getDate()}`;
  const isFuture = viewStr > todayStr;

  // Log a meal — handles both today and past days
  const handleLogForDate = async (meal) => {
    setLoggingId(meal.name);
    if(isToday){
      if(onLogMeal) await onLogMeal(meal);
    } else {
      await logMeal(userId, meal, viewStr);
      await refreshHistoryLog();
    }
    setTimeout(()=>setLoggingId(null),800);
  };

  // Unlog a meal — handles both today and past days
  const handleUnlogForDate = async (logId) => {
    await deleteMealLog(logId);
    if(isToday){
      if(onUnlogMeal) await onUnlogMeal(logId);
    } else {
      await refreshHistoryLog();
    }
  };

  if(progressView==='weight') return <WeightHistoryView userId={userId} onBack={()=>setProgressView(null)}/>;
  if(progressView==='water') return <WaterSettingsView userId={userId} defaultGoal={profile?.waterGoal||8} onBack={()=>setProgressView(null)}/>;
  if(showCalendar) return <CalendarOverlay viewDate={viewDate} onSelectDate={d=>{setViewDate(d);setShowCalendar(false);}} onClose={()=>setShowCalendar(false)} userId={userId}/>;
  if(showFasting) return <FastingDetailView isFasting={isFasting} fastStartedAt={fastStartedAt} fastingGoal={fastingGoal} onStart={onStartFast} onEnd={onEndFast} userId={userId} onBack={()=>setShowFasting(false)}/>;

  return <div style={{padding:"0 20px 24px"}}>
    {/* ── Week strip ── */}
    <WeekStrip viewDate={viewDate} onSelectDate={setViewDate} onOpenCalendar={()=>setShowCalendar(true)}/>

    {/* ── Header: name + fasting toggle + avatar ── */}
    <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:isEmpty?4:20}}>
      <div>
        <h1 style={{fontSize:26,fontWeight:700,color:T.tx,margin:"2px 0 0",letterSpacing:"-0.02em"}}>
          {isEmpty?(profile?.name?`Welcome, ${profile.name}.`:"Welcome."):isToday?(profile?.name?`Hey, ${profile.name}`:"Daily Overview"):"Day Review"}
        </h1>
        {isEmpty&&<p style={{fontSize:14,color:T.tx2,margin:"4px 0 0",fontWeight:400}}>Let's get started.</p>}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
        {isFasting
          ? <button onClick={()=>setShowFasting(true)} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:20,border:`1px solid ${T.acc}50`,background:T.accG,cursor:'pointer',fontFamily:T.font}}>
              <div style={{width:7,height:7,borderRadius:'50%',background:T.acc,animation:'pulse 2s infinite'}}/>
              <span style={{fontSize:11,fontWeight:600,color:T.acc,whiteSpace:'nowrap'}}>Fasting · {fastHeaderStr}</span>
            </button>
          : <button onClick={()=>setShowFasting(true)} style={{display:'flex',alignItems:'center',gap:5,padding:'6px 12px',borderRadius:20,border:`1px solid ${T.bd}`,background:'transparent',cursor:'pointer',fontFamily:T.font}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.tx2} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              <span style={{fontSize:11,fontWeight:500,color:T.tx2}}>Fast</span>
            </button>
        }
        <div style={{width:38,height:38,borderRadius:"50%",background:T.acc,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <span style={{fontSize:14,fontWeight:700,color:T.bg}}>{(profile?.name||"U")[0]}</span>
        </div>
      </div>
    </div>

    {/* ── Viewing label (past/future only) ── */}
    {!isToday&&<p style={{fontSize:11,color:T.acc,fontWeight:600,textAlign:'center',margin:'-12px 0 12px',letterSpacing:'0.07em'}}>VIEWING · {viewingLabel}</p>}

    {/* ── Macro ring card ── */}
    <Card style={{padding:"28px 24px",marginBottom:16}} data-tour="macro-ring">
      <div style={{display:"flex",alignItems:"center",gap:28}}>
        <Ring pct={(cal.cur/cal.tgt)*100} r={50} stroke={T.acc} w={5}>
          <span style={{fontSize:30,fontWeight:700,color:T.tx,fontFamily:T.mono,lineHeight:1}}>{remaining}</span>
          <span style={{fontSize:9,color:T.txM,fontWeight:500,letterSpacing:"0.12em",marginTop:3,textTransform:"uppercase"}}>remaining</span>
        </Ring>
        <div style={{display:"flex",flexDirection:"column",gap:16,flex:1}}>
          {mac.map(x=><div key={x.k}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:11,color:T.tx2,fontWeight:500}}>{x.k}</span>
              <span style={{fontSize:11,color:T.tx2,fontFamily:T.mono}}>{x.cur}/{x.tgt}g</span>
            </div>
            <div style={{height:4,borderRadius:2,background:T.bd}}>
              <div style={{height:"100%",borderRadius:2,background:x.c,width:`${Math.min((x.cur/x.tgt)*100,100)}%`,transition:"width 1s ease"}}/>
            </div>
          </div>)}
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"center",gap:32,marginTop:24,paddingTop:20,borderTop:`1px solid ${T.bd}`}}>
        <div style={{textAlign:"center"}}><p style={{fontSize:18,fontWeight:700,color:T.tx,margin:0,fontFamily:T.mono}}>{cal.cur.toLocaleString()}</p><Lbl>consumed</Lbl></div>
        <div style={{width:1,background:T.bd}}/>
        <div style={{textAlign:"center"}}><p style={{fontSize:18,fontWeight:700,color:T.acc,margin:0,fontFamily:T.mono}}>{cal.tgt.toLocaleString()}</p><Lbl>target</Lbl></div>
      </div>
    </Card>

    {/* ── Empty state (today, nothing logged, no plan) ── */}
    {isEmpty ? <>
      <p style={{fontSize:13,color:T.txM,textAlign:"center",margin:"20px 0 20px",fontWeight:500}}>Log meals to track your progress</p>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <Card onClick={()=>setTab("plan")} style={{padding:"18px 20px",cursor:"pointer",display:"flex",alignItems:"center",gap:14,border:`1px solid ${T.acc}30`}}>
          <div style={{width:42,height:42,borderRadius:12,background:T.accM,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h18v18H3z"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </div>
          <div style={{flex:1}}>
            <p style={{fontSize:15,fontWeight:700,color:T.tx,margin:0}}>Generate Your First Meal Plan</p>
            <p style={{fontSize:12,color:T.tx2,margin:"3px 0 0"}}>Let AI build a week of meals for your goals</p>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.txM} strokeWidth="2" strokeLinecap="round" style={{flexShrink:0}}><path d="M9 18l6-6-6-6"/></svg>
        </Card>
        <Card onClick={()=>setTab("log")} style={{padding:"18px 20px",cursor:"pointer",display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:42,height:42,borderRadius:12,background:"rgba(107,203,119,0.12)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.ok} strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </div>
          <div style={{flex:1}}>
            <p style={{fontSize:15,fontWeight:700,color:T.tx,margin:0}}>Log Your First Meal</p>
            <p style={{fontSize:12,color:T.tx2,margin:"3px 0 0"}}>Search foods or enter macros manually</p>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.txM} strokeWidth="2" strokeLinecap="round" style={{flexShrink:0}}><path d="M9 18l6-6-6-6"/></svg>
        </Card>
      </div>
    </> : <>
      {/* ── Manual mode banner ── */}
      {profile?.trackingMode==='manual'&&<Card style={{padding:"16px 18px",marginBottom:16,textAlign:"center",border:`1px solid ${T.bd}`}}>
        <p style={{fontSize:14,fontWeight:600,color:T.tx,margin:"0 0 4px"}}>Manual Track Mode</p>
        <p style={{fontSize:12,color:T.tx2,margin:0}}>Log your meals in the Log tab to track your macros.</p>
      </Card>}

      {/* ── Today's / Day's Plan ── */}
      {profile?.trackingMode!=='manual'&&<div data-tour="todays-plan">
        {dayPlanMeals.length>0?<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"0 0 14px"}}>
          <div>
            <h2 style={{fontSize:15,fontWeight:600,color:T.tx,margin:0}}>{isToday?"Today's Plan":"Day's Plan"}</h2>
            <span style={{fontSize:10,color:T.txM,fontWeight:500}}>{planLabel}</span>
          </div>
          <span onClick={()=>setTab("plan")} style={{fontSize:12,color:T.acc,fontWeight:500,cursor:"pointer"}}>View Plan</span>
        </div>
        {unloggedPlan.length===0&&<Card style={{padding:"16px",textAlign:"center",marginBottom:6}}>
          <p style={{fontSize:13,color:T.txM,margin:0}}>All planned meals logged! Nice work.</p>
        </Card>}
        {unloggedPlan.map((pm,i)=>{
          const isLogging=loggingId===pm.name;
          return <Card key={"plan-"+i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginBottom:10,border:`1px dashed ${T.bd}`,background:"transparent",cursor:"pointer"}} onClick={()=>{setPendingMealType(getDefaultMealType());setPendingPlanMeal({name:pm.name,cal:pm.cal,p:pm.p||0,c:pm.c||0,f:pm.f||0});}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:T.txM}}/>
              <div>
                <p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>{pm.name}</p>
                <div style={{display:"flex",gap:8,marginTop:3}}>
                  {[{v:pm.cal,l:"cal",c:T.acc},{v:(pm.p||0)+"g",l:"P",c:T.pro},{v:(pm.c||0)+"g",l:"C",c:T.carb},{v:(pm.f||0)+"g",l:"F",c:T.fat}].map(x=>
                    <span key={x.l} style={{fontSize:10,fontFamily:T.mono,color:x.c}}>{x.v}<span style={{color:T.txM,fontSize:8}}> {x.l}</span></span>
                  )}
                </div>
              </div>
            </div>
            <span style={{fontSize:13,fontWeight:600,fontFamily:T.mono,color:isLogging?T.ok:T.acc}}>{isLogging?"✓":"Log →"}</span>
          </Card>;
        })}
        </>:<Card style={{padding:"16px",textAlign:"center",marginBottom:16}}>
          <p style={{fontSize:13,color:T.txM,margin:0}}>Generate your AI plan to see today's meals here.</p>
        </Card>}
      </div>}

      {/* ── Eaten / Meals Logged ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"28px 0 14px"}}>
        <h2 style={{fontSize:15,fontWeight:600,color:T.tx,margin:0}}>{isToday?"Eaten Today":"Meals Logged"}</h2>
        <span style={{fontSize:12,color:T.txM,fontFamily:T.mono}}>{displayLog.length} meal{displayLog.length!==1?"s":""}</span>
      </div>
      {!isToday&&displayLog.length===0&&<Card style={{padding:"16px",textAlign:"center",marginBottom:12}}>
        <p style={{fontSize:13,color:T.txM,margin:0}}>{isFuture?"No data yet for this date.":"No meals logged on this day."}</p>
      </Card>}
      {(()=>{
        const grouped={breakfast:[],lunch:[],snack:[],dinner:[],other:[]};
        displayLog.forEach(x=>{
          const t=(x.meal_type||'').toLowerCase();
          if(MEAL_CATS.includes(t)) grouped[t].push(x); else grouped.other.push(x);
        });
        const catsToShow=isToday?MEAL_CATS:MEAL_CATS.filter(c=>grouped[c].length>0);
        const showOther=grouped.other.length>0;
        return <>{[...catsToShow,...(showOther?['other']:[])].map(cat=>{
          const cfg=CAT_CONFIG[cat];
          const items=grouped[cat];
          const catCal=items.reduce((s,x)=>s+(x.calories||0),0);
          const catTarget=cat!=='other'?Math.round(cfg.pct*m.target):0;
          const hasItems=items.length>0;
          return <div key={cat} style={{
            background:T.sf,borderRadius:T.r,
            border:hasItems?`1px solid ${T.bd}`:`1px dashed ${T.bd}`,
            marginBottom:16,overflow:'hidden'
          }}>
            {/* Category header */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px'}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:18,lineHeight:1,flexShrink:0}}>{cfg.icon}</span>
                <div>
                  <p style={{fontSize:14,fontWeight:700,color:hasItems?T.tx:T.tx2,margin:0}}>{cfg.label}</p>
                  {hasItems&&<p style={{fontSize:11,color:T.acc,margin:"2px 0 0",fontFamily:T.mono,fontWeight:500}}>
                    {catCal} cal{catTarget>0?` / ${catTarget} cal`:''}
                  </p>}
                </div>
              </div>
              {isToday&&cat!=='other'&&<button onClick={()=>onLogCategory&&onLogCategory(cat)} style={{width:28,height:28,borderRadius:'50%',border:`1px solid ${T.bd}`,background:T.accM,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              </button>}
            </div>
            {/* Divider + meal entries */}
            {hasItems&&<>
              <div style={{height:1,background:T.bd}}/>
              {items.map((x,idx)=>(
                <SwipeableRow key={x.id} onDelete={()=>handleUnlogForDate(x.id)} style={{borderRadius:0,marginBottom:0}}>
                  <div style={{
                    display:'flex',alignItems:'center',justifyContent:'space-between',
                    padding:'12px 16px',background:T.sf,
                    borderBottom:idx<items.length-1?`1px solid ${T.bd}`:'none'
                  }}>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:13,fontWeight:600,color:T.tx,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',paddingRight:8}}>{x.name}</p>
                      <div style={{display:'flex',gap:8,marginTop:3}}>
                        {[{v:x.calories||0,l:"cal",c:T.acc},{v:x.protein||0,l:"P",c:T.pro,u:"g"},{v:x.carbs||0,l:"C",c:T.carb,u:"g"},{v:x.fat||0,l:"F",c:T.fat,u:"g"}].map(z=>
                          <span key={z.l} style={{fontSize:10,fontFamily:T.mono,color:z.c}}>{z.v}{z.u||""}<span style={{color:T.txM,fontSize:8}}> {z.l}</span></span>
                        )}
                      </div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                      <button onClick={(e)=>{e.stopPropagation();onHeartMeal&&onHeartMeal({name:x.name,cal:x.calories,p:x.protein,c:x.carbs,f:x.fat},'manual');}} style={{background:"none",border:"none",cursor:"pointer",padding:4,display:"flex",alignItems:"center"}}>
                        <HeartIcon filled={savedMeals.some(s=>s.name===x.name)}/>
                      </button>
                      <span style={{fontSize:9,color:T.txM,letterSpacing:"0.05em"}}>swipe ←</span>
                    </div>
                  </div>
                </SwipeableRow>
              ))}
            </>}
          </div>;
        })}</>;
      })()}

      {isToday&&<Card style={{padding:"14px 16px",marginTop:16,background:T.accG,border:`1px solid ${T.accM}`,display:"flex",alignItems:"flex-start",gap:10}}>
        <span style={{fontSize:14}}>✦</span>
        <p style={{fontSize:13,color:T.tx2,margin:0,lineHeight:1.5}}>{insightText}</p>
      </Card>}

      {/* ── Progress (weight + water) — below eaten ── */}
      {isToday&&<>
        <div style={{marginTop:24,marginBottom:8}}><Lbl>Progress</Lbl></div>
        <WeightTrackerWidget userId={userId} onViewFull={()=>setProgressView('weight')}/>
        <WaterTrackerWidget userId={userId} defaultGoal={profile?.waterGoal||8} onViewFull={()=>setProgressView('water')}/>
      </>}
    </>}

    {/* ── Plan meal type picker bottom sheet ── */}
    {pendingPlanMeal&&(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setPendingPlanMeal(null)}>
        <div style={{width:"100%",maxWidth:430,background:T.sf,borderRadius:"20px 20px 0 0",padding:"20px 20px 38px",border:`1px solid ${T.bd}`}} onClick={e=>e.stopPropagation()}>
          <div style={{width:36,height:4,borderRadius:2,background:T.bd,margin:"0 auto 20px"}}/>
          <p style={{fontSize:11,fontWeight:600,color:T.txM,margin:"0 0 4px",letterSpacing:"0.08em",textTransform:"uppercase"}}>Log meal</p>
          <p style={{fontSize:15,fontWeight:600,color:T.tx,margin:"0 0 18px",lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pendingPlanMeal.name}</p>
          <MealTypePicker value={pendingMealType} onChange={setPendingMealType}/>
          <button onClick={()=>{handleLogForDate({...pendingPlanMeal,type:pendingMealType});setPendingPlanMeal(null);}} style={{width:"100%",padding:14,borderRadius:T.r,border:"none",background:T.acc,color:T.bg,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:T.font,marginTop:4}}>
            Confirm &amp; Log
          </button>
          <button onClick={()=>setPendingPlanMeal(null)} style={{width:"100%",padding:10,marginTop:8,borderRadius:T.r,border:"none",background:"transparent",color:T.txM,fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:T.font}}>
            Cancel
          </button>
        </div>
      </div>
    )}

  </div>;
};

// ─── PLAN (AI-POWERED) ─────────────────────────────────────────
// Must mirror the constants in api/generate-plan.js exactly
const FREE_INTRO_LIMIT   = 3;  // first N lifetime gens, no time restriction
const PRO_DAILY_LIMIT    = 2;  // per rolling 24h
const PRO_MONTHLY_LIMIT  = 30; // calendar month

// ─── RECIPE DETAIL ─────────────────────────────────────────────
const RecipeDetail = ({meal, savedMeals=[], onHeartMeal, onLogMeal, onBack}) => {
  const [logged, setLogged] = useState(false);
  const [mealType, setMealType] = useState(() => {
    const t = (meal.type||'').toLowerCase();
    return MEAL_CATS.includes(t) ? t : getDefaultMealType();
  });
  const isSaved = savedMeals.some(s => s.name === meal.name);
  const instructions = meal.instructions || [];
  // equipment is a comma-separated string in new plans; old plans may have an array
  const equipmentItems = Array.isArray(meal.equipment)
    ? meal.equipment
    : (meal.equipment ? meal.equipment.split(",").map(s => s.trim()).filter(Boolean) : []);

  const handleLog = async () => {
    if(onLogMeal){
      await onLogMeal({type:mealType,name:meal.name,cal:meal.cal,p:meal.p||0,c:meal.c||0,f:meal.f||0});
    }
    setLogged(true);
    setTimeout(()=>onBack(), 900);
  };

  return <div style={{position:"fixed",inset:0,background:T.bg,zIndex:200,overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
    <div style={{maxWidth:430,margin:"0 auto",paddingBottom:110}}>
      {/* Header */}
      <div style={{padding:"52px 20px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:6,padding:0,color:T.acc,fontSize:14,fontWeight:600,fontFamily:T.font}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Back to Plan
          </button>
          <button onClick={()=>onHeartMeal&&onHeartMeal(meal,'ai_plan')} style={{background:"none",border:"none",cursor:"pointer",padding:6,display:"flex",alignItems:"center"}}>
            <HeartIcon filled={isSaved} size={22}/>
          </button>
        </div>
        <span style={{fontSize:10,fontWeight:600,color:T.acc,letterSpacing:"0.14em"}}>{meal.type}</span>
        <h1 style={{fontSize:24,fontWeight:700,color:T.tx,margin:"4px 0 4px",letterSpacing:"-0.02em",lineHeight:1.2}}>{meal.name}</h1>
        {meal.cuisine && <p style={{fontSize:12,color:T.txM,margin:"0 0 6px",letterSpacing:"0.03em"}}>{meal.cuisine}</p>}
        {meal.desc && <p style={{fontSize:13,color:T.tx2,margin:"0 0 20px",lineHeight:1.5}}>{meal.desc}</p>}
      </div>

      {/* Macro bar */}
      <div style={{margin:"0 20px 20px"}}>
        <Card style={{padding:"14px 18px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            {[{l:"cal",v:meal.cal,c:T.acc},{l:"P",v:(meal.p||0)+"g",c:T.pro},{l:"C",v:(meal.c||0)+"g",c:T.carb},{l:"F",v:(meal.f||0)+"g",c:T.fat}].map(x=>
              <div key={x.l} style={{textAlign:"center"}}>
                <p style={{fontSize:16,fontWeight:700,color:x.c,margin:0,fontFamily:T.mono}}>{x.v}</p>
                <span style={{fontSize:10,color:T.txM,letterSpacing:"0.05em"}}>{x.l}</span>
              </div>
            )}
            {meal.time && <div style={{textAlign:"center"}}>
              <p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>{meal.time}</p>
              <span style={{fontSize:10,color:T.txM,letterSpacing:"0.05em"}}>prep</span>
            </div>}
          </div>
        </Card>
      </div>

      {/* Ingredients */}
      {meal.ingredients?.length > 0 && <div style={{padding:"0 20px 20px"}}>
        <p style={{fontSize:11,fontWeight:700,color:T.txM,margin:"0 0 12px",letterSpacing:"0.08em",textTransform:"uppercase"}}>Ingredients</p>
        <Card style={{overflow:"hidden"}}>
          {meal.ingredients.map((ing,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",padding:"11px 16px",borderBottom:i<meal.ingredients.length-1?`1px solid ${T.bd}`:"none"}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:T.acc,marginRight:12,flexShrink:0}}/>
              <span style={{fontSize:13,color:T.tx2,fontFamily:T.mono,marginRight:10,minWidth:56,flexShrink:0}}>{ing.qty} {ing.unit}</span>
              <span style={{fontSize:14,color:T.tx,fontWeight:500}}>{ing.name}</span>
            </div>
          ))}
        </Card>
      </div>}

      {/* Instructions */}
      <div style={{padding:"0 20px 20px"}}>
        <p style={{fontSize:11,fontWeight:700,color:T.txM,margin:"0 0 14px",letterSpacing:"0.08em",textTransform:"uppercase"}}>How to Make It</p>
        {instructions.length === 0
          ? <Card style={{padding:"16px 18px"}}><p style={{fontSize:13,color:T.txM,margin:0,lineHeight:1.5}}>Regenerate your plan to see cooking instructions.</p></Card>
          : <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {instructions.map((step,i)=>(
                <div key={i} style={{display:"flex",gap:14,alignItems:"flex-start"}}>
                  <div style={{width:26,height:26,borderRadius:"50%",background:T.acc,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
                    <span style={{fontSize:11,fontWeight:700,color:T.bg,fontFamily:T.mono}}>{i+1}</span>
                  </div>
                  <p style={{fontSize:14,color:T.tx,margin:0,lineHeight:1.65,flex:1,paddingTop:3}}>{step}</p>
                </div>
              ))}
            </div>
        }
      </div>

      {/* Equipment */}
      {equipmentItems.length > 0 && <div style={{padding:"0 20px 20px"}}>
        <p style={{fontSize:11,fontWeight:700,color:T.txM,margin:"0 0 12px",letterSpacing:"0.08em",textTransform:"uppercase"}}>You'll Need</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {equipmentItems.map((item,i)=>(
            <span key={i} style={{padding:"7px 14px",borderRadius:20,border:`1px solid ${T.bd}`,fontSize:12,color:T.tx2,background:T.sf,fontWeight:500}}>{item}</span>
          ))}
        </div>
      </div>}
    </div>

    {/* Fixed footer — Log This Meal */}
    <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,padding:"12px 20px 28px",background:T.bg,borderTop:`1px solid ${T.bd}`}}>
      <MealTypePicker value={mealType} onChange={setMealType}/>
      <button onClick={handleLog} disabled={logged} style={{width:"100%",padding:16,borderRadius:T.r,border:"none",background:logged?T.ok:T.acc,color:T.bg,fontSize:15,fontWeight:700,cursor:logged?"default":"pointer",fontFamily:T.font,transition:"background 0.3s",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        {logged?"✓  Logged!":"Log This Meal"}
      </button>
    </div>
  </div>;
};

const Plan = ({profile,userId,isPro,onWeekPlanUpdate,savedMeals=[],onHeartMeal,onLogMeal,setTab,onUpgrade}) => {
  const [sel,setSel]=useState("A");
  const [loading,setLoading]=useState(false);
  const [loadMsg,setLoadMsg]=useState("");
  const [genError,setGenError]=useState("");
  const [limitHit,setLimitHit]=useState(false);
  const [abPlan,setAbPlan]=useState({});
  const [genCount,setGenCount]=useState(0);
  const [plansLoaded,setPlansLoaded]=useState(false);
  const [remaining,setRemaining]=useState(null); // null = not yet loaded
  const [selectedMeal,setSelectedMeal]=useState(null);

  // Load saved plans + current usage on mount
  useEffect(()=>{
    if(!userId||plansLoaded) return;
    // Bug 1: load from localStorage immediately so there's no flash of defaults
    const cacheKey = `macra_abplan_${userId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if(cached) { const p=JSON.parse(cached); if(p.A||p.B) setAbPlan(p); }
    } catch {}
    (async()=>{
      const [plans,usage] = await Promise.all([
        getWeekPlans(userId),
        getGenerationUsage(userId),
      ]);
      const loaded={};
      if(plans[0]) loaded.A=plans[0];
      if(plans[1]) loaded.B=plans[1];
      // Supabase is source of truth — update both state and cache
      if(Object.keys(loaded).length>0){
        setAbPlan(loaded);
        try { localStorage.setItem(cacheKey, JSON.stringify(loaded)); } catch {}
      }
      setPlansLoaded(true);

      // Derive remaining from live usage (mirrors api/generate-plan.js limits)
      if(usage){
        if(!isPro){
          if(usage.lifetimeCount < FREE_INTRO_LIMIT){
            // Intro phase
            const rem = { phase:"intro", introRemaining: Math.max(0, FREE_INTRO_LIMIT - usage.lifetimeCount) };
            setRemaining(rem);
            setLimitHit(rem.introRemaining <= 0);
          } else {
            // Weekly phase — compute days until the 7-day window expires
            let resetDays = 7;
            if(usage.lastGeneratedAt){
              const lastTime = new Date(usage.lastGeneratedAt);
              const resetTime = new Date(lastTime.getTime() + 7*24*60*60*1000);
              resetDays = Math.max(1, Math.ceil((resetTime - Date.now()) / (1000*60*60*24)));
            }
            const rem = { phase:"weekly", resetDays };
            setRemaining(rem);
            setLimitHit(usage.weeklyCount >= 1);
          }
        } else {
          const rem = {
            phase:"pro",
            daily:   Math.max(0, PRO_DAILY_LIMIT   - usage.dailyCount),
            monthly: Math.max(0, PRO_MONTHLY_LIMIT - usage.monthlyCount),
          };
          setRemaining(rem);
          if(rem.daily===0||rem.monthly===0) setLimitHit(true);
        }
      }
    })();
  },[userId,plansLoaded,isPro]);


  const generatePlan = async () => {
    setLoading(true);
    setGenError("");
    setLimitHit(false);
    const msgs=["Analyzing your macro targets...","Building Day A meals...","Building Day B meals...","Calculating ingredients...","Balancing protein distribution...","Finalizing your A/B plan..."];
    let i=0; setLoadMsg(msgs[0]);
    const interval=setInterval(()=>{i++;if(i<msgs.length)setLoadMsg(msgs[i]);},1500);

    try {
      console.log("[generate] calling generateMealPlan", { userId, isPro, macros: profile?.macros, diet: profile?.diet });
      const result = await generateMealPlan(profile,userId,isPro); // {abPlan,remaining}
      console.log("[generate] success", { dayA: result.abPlan?.A?.length, dayB: result.abPlan?.B?.length, remaining: result.remaining });
      clearInterval(interval);
      const plan=result.abPlan;
      setAbPlan(plan);
      if(result.remaining){
        setRemaining(result.remaining);
        const r = result.remaining;
        const hit = r.phase==="intro"   ? r.introRemaining <= 0
                  : r.phase==="weekly"  ? true  // slot just consumed; next resets in 7 days
                  : r.phase==="pro"     ? (r.daily===0 || r.monthly===0)
                  : false;
        setLimitHit(hit);
      }
      setGenCount(c=>c+1);
      setLoading(false);
      // Bug 1: persist to localStorage (instant on remount) and Supabase (cross-device)
      if(userId){
        try { localStorage.setItem(`macra_abplan_${userId}`, JSON.stringify(plan)); } catch {}
        if(plan.A) await saveMealPlan(userId,0,plan.A);
        if(plan.B) await saveMealPlan(userId,1,plan.B);
      }
      if(onWeekPlanUpdate) onWeekPlanUpdate({0:plan.A,1:plan.B});
    } catch(err){
      clearInterval(interval);
      setLoading(false);
      if(err.limitReached){
        setLimitHit(true);
        setGenError(err.message);
        if(err.remaining) setRemaining(err.remaining);
      } else {
        setGenError(err.message||"Generation failed — please try again");
      }
      console.error("[generate] failed:", err.message, { limitReached: err.limitReached, remaining: err.remaining });
    }
  };

  const meals=abPlan[sel]||[];
  // FIX 1: use Number() to guard against string fields and never touch ingredients array
  const dayTotals=(Array.isArray(meals)?meals:[]).reduce((a,m)=>({
    cal:a.cal+(Number(m.cal)||0),
    p:  a.p  +(Number(m.p)  ||0),
    c:  a.c  +(Number(m.c)  ||0),
    f:  a.f  +(Number(m.f)  ||0),
  }),{cal:0,p:0,c:0,f:0});

  // ── Build the usage text shown below the button ──
  const usageLine = () => {
    if(!remaining) return null;
    if(remaining.phase==="intro"){
      const r = remaining.introRemaining ?? 0;
      return `${r} of ${FREE_INTRO_LIMIT} free trial generation${r!==1?"s":""} remaining`;
    }
    if(remaining.phase==="weekly"){
      const days = remaining.resetDays ?? 7;
      const d = days===1?"day":"days";
      return limitHit
        ? `Next free generation in ${days} ${d}`
        : `1 free generation per week — resets in ${days} ${d}`;
    }
    if(remaining.phase==="pro"){
      return `${remaining.daily??0} of ${PRO_DAILY_LIMIT} left today · ${remaining.monthly??0} of ${PRO_MONTHLY_LIMIT} left this month`;
    }
    return null;
  };

  // Which specific limit did a Pro user hit?
  const proLimitKind = () => {
    if(!remaining||!isPro||remaining.phase!=="pro") return null;
    if(remaining.daily===0)   return "daily";
    if(remaining.monthly===0) return "monthly";
    return null;
  };

  if(selectedMeal) return <RecipeDetail meal={selectedMeal} savedMeals={savedMeals} onHeartMeal={onHeartMeal} onLogMeal={onLogMeal} onBack={()=>setSelectedMeal(null)}/>;

  if(profile?.trackingMode==='manual') return <div style={{padding:"0 20px 24px"}}>
    <h1 style={{fontSize:26,fontWeight:700,color:T.tx,margin:"4px 0 20px",letterSpacing:"-0.02em"}}>Meal Plan</h1>
    <Card style={{padding:"28px 20px",textAlign:"center"}}>
      <div style={{width:48,height:48,borderRadius:14,background:T.accM,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="1.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </div>
      <p style={{fontSize:16,fontWeight:700,color:T.tx,margin:"0 0 8px"}}>Manual Track Mode</p>
      <p style={{fontSize:13,color:T.tx2,margin:"0 0 20px",lineHeight:1.5}}>You're logging meals freely. Switch to AI Plan Mode to generate a personalised weekly meal plan.</p>
      <button onClick={()=>setTab&&setTab("profile")} style={{padding:"12px 24px",borderRadius:T.r,border:`1.5px solid ${T.acc}`,background:"transparent",color:T.acc,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:T.font}}>Switch to AI Plan Mode →</button>
    </Card>
  </div>;

  return <div style={{padding:"0 20px 24px"}}>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    <h1 style={{fontSize:26,fontWeight:700,color:T.tx,margin:"4px 0 16px",letterSpacing:"-0.02em"}}>Meal Plan</h1>

    {/* A/B tabs */}
    <Card data-tour="day-tabs" style={{display:"flex",padding:4,marginBottom:8}}>
      {[{k:"A"},{k:"B"}].map(d=>(
        <button key={d.k} onClick={()=>setSel(d.k)} style={{flex:1,padding:"10px 0",borderRadius:8,border:"none",background:sel===d.k?T.acc:"transparent",color:sel===d.k?T.bg:T.txM,fontSize:14,fontWeight:700,cursor:"pointer",transition:"all 0.2s ease"}}>Day {d.k}</button>
      ))}
    </Card>
    <p style={{fontSize:11,color:T.txM,textAlign:"center",margin:"0 0 16px",letterSpacing:"0.04em"}}>
      {sel==="A"?"Mon · Wed · Fri · Sun":"Tue · Thu · Sat"}
    </p>

    <div style={{display:"flex",justifyContent:"space-between",padding:"0 4px",marginBottom:18}}>
      {[{l:"Calories",v:dayTotals.cal.toLocaleString(),c:T.acc},{l:"Protein",v:dayTotals.p+"g",c:T.pro},{l:"Carbs",v:dayTotals.c+"g",c:T.carb},{l:"Fat",v:dayTotals.f+"g",c:T.fat}].map(s=>
        <div key={s.l} style={{textAlign:"center"}}><p style={{fontSize:17,fontWeight:700,color:s.c,margin:0,fontFamily:T.mono}}>{s.v}</p><Lbl>{s.l}</Lbl></div>
      )}
    </div>

    {/* Loading */}
    {loading && <Card style={{padding:"40px 20px",textAlign:"center",marginBottom:12}}>
      <div style={{width:40,height:40,margin:"0 auto 16px",borderRadius:"50%",border:`3px solid ${T.bd}`,borderTopColor:T.acc,animation:"spin 1s linear infinite"}}/>
      <p style={{fontSize:14,fontWeight:600,color:T.tx,margin:"0 0 4px"}}>{loadMsg}</p>
      <p style={{fontSize:12,color:T.txM,margin:0}}>Powered by Claude AI</p>
    </Card>}

    {/* Non-limit error */}
    {!loading && genError && !limitHit && <Card style={{padding:"16px 18px",marginBottom:12,border:"1px solid rgba(239,68,68,0.3)",background:"rgba(239,68,68,0.06)"}}>
      <p style={{fontSize:13,fontWeight:600,color:"#EF4444",margin:"0 0 4px"}}>Generation failed</p>
      <p style={{fontSize:12,color:T.tx2,margin:"0 0 12px",lineHeight:1.5}}>{genError}</p>
      <button onClick={generatePlan} style={{padding:"10px 20px",borderRadius:10,border:"none",background:T.acc,color:T.bg,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:T.font}}>↺ Retry</button>
    </Card>}

    {/* Empty state — no plan yet */}
    {!loading && meals.length===0 && <Card style={{padding:"32px 20px",marginBottom:12,textAlign:"center"}}>
      <p style={{fontSize:32,margin:"0 0 12px"}}>✦</p>
      <p style={{fontSize:15,fontWeight:600,color:T.tx,margin:"0 0 6px"}}>No plan yet</p>
      <p style={{fontSize:13,color:T.txM,margin:0}}>Tap Generate AI Plan to build your Day {sel} meals.</p>
    </Card>}

    {/* Meal cards */}
    {!loading && meals.map((m,i)=><Card key={i+"-"+sel+"-"+genCount} onClick={()=>setSelectedMeal(m)} style={{padding:18,marginBottom:8,animation:"fadeUp 0.4s ease both",animationDelay:`${i*0.08}s`,cursor:"pointer"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:10,fontWeight:600,color:T.acc,letterSpacing:"0.14em"}}>{m.type}</span>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button data-tour={i===0?"save-meal":undefined} onClick={(e)=>{e.stopPropagation();onHeartMeal&&onHeartMeal(m,'ai_plan');}} style={{background:"none",border:"none",cursor:"pointer",padding:4,display:"flex",alignItems:"center"}}>
            <HeartIcon filled={savedMeals.some(s=>s.name===m.name)}/>
          </button>
          <span style={{fontSize:11,color:T.txM}}>{m.time}</span>
        </div>
      </div>
      <h3 style={{fontSize:16,fontWeight:600,color:T.tx,margin:"0 0 2px"}}>{m.name}</h3>
      {m.cuisine && <p style={{fontSize:11,color:T.txM,margin:"0 0 4px",letterSpacing:"0.03em"}}>{m.cuisine}</p>}
      <p style={{fontSize:12,color:T.txM,margin:"0 0 12px"}}>{m.desc}</p>
      <div style={{display:"flex",gap:16,marginBottom:m.ingredients?.length>0?12:0}}>
        {[{l:"cal",v:m.cal,c:T.acc},{l:"P",v:m.p+"g",c:T.pro},{l:"C",v:m.c+"g",c:T.carb},{l:"F",v:m.f+"g",c:T.fat}].map(x=>
          <span key={x.l} style={{fontSize:12,fontFamily:T.mono,color:T.tx}}><span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:x.c,marginRight:4,verticalAlign:"middle"}}/>{x.v} <span style={{color:T.txM,fontSize:10}}>{x.l}</span></span>
        )}
      </div>
      {m.ingredients?.length>0 && <div style={{borderTop:`1px solid ${T.bd}`,paddingTop:10}}>
        <span style={{fontSize:10,fontWeight:600,color:T.txM,letterSpacing:"0.08em",textTransform:"uppercase"}}>Ingredients</span>
        <div style={{display:"flex",flexWrap:"wrap",gap:"4px 10px",marginTop:6}}>
          {m.ingredients.map((ing,ii)=><span key={ii} style={{fontSize:11,color:T.tx2}}>{ing.qty} {ing.unit} {ing.name}</span>)}
        </div>
      </div>}
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:10,paddingTop:8,borderTop:`1px solid ${T.bd}`}}>
        <span style={{fontSize:12,color:T.acc,fontWeight:600,letterSpacing:"0.02em"}}>View Recipe →</span>
      </div>
    </Card>)}

    {/* Bottom actions */}
    {!loading && <>
      {abPlan[sel] && !limitHit && <Card style={{padding:"10px 14px",marginBottom:10,background:T.accG,border:`1px solid ${T.accM}`,display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:13}}>✦</span>
        <p style={{fontSize:12,color:T.tx2,margin:0}}>AI-generated A/B plan · Grocery list auto-populates from ingredients</p>
      </Card>}

      {/* Limit-hit banner */}
      {limitHit && <Card style={{padding:"18px 20px",marginBottom:12,background:T.accG,border:`1px solid ${T.accM}`,textAlign:"center"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:8}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          <span style={{fontSize:11,fontWeight:700,color:T.acc,letterSpacing:"0.1em"}}>LIMIT REACHED</span>
        </div>
        <p style={{fontSize:13,color:T.tx2,margin:"0 0 14px",lineHeight:1.5}}>{genError}</p>
        {!isPro ? (
          <button onClick={onUpgrade} style={{padding:"12px 28px",borderRadius:T.r,border:"none",background:T.acc,color:T.bg,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:T.font}}>
            Upgrade to Pro
          </button>
        ) : (
          <p style={{fontSize:12,color:T.txM,margin:0}}>
            {proLimitKind()==="daily" ? "Resets tomorrow at midnight" : "Resets on the 1st of next month"}
          </p>
        )}
      </Card>}

      {/* Generate / Regenerate button */}
      <button
        data-tour="generate-plan"
        onClick={generatePlan}
        disabled={limitHit}
        style={{width:"100%",padding:15,borderRadius:T.r,border:"none",
          background:limitHit?T.bd:T.acc,
          color:limitHit?T.txM:T.bg,
          fontSize:14,fontWeight:700,
          cursor:limitHit?"not-allowed":"pointer",
          marginTop:4,display:"flex",alignItems:"center",justifyContent:"center",gap:6,
          opacity:limitHit?0.5:1,
        }}>
        <span>✦</span> {abPlan.A||abPlan.B ? "Regenerate Plan" : "Generate AI Plan"}
      </button>

      {/* Usage counter */}
      {usageLine() && <p style={{fontSize:11,color:T.txM,textAlign:"center",margin:"10px 0 0",fontFamily:T.mono}}>
        {usageLine()}
      </p>}
      {!isPro && !limitHit && <p style={{fontSize:11,color:T.txM,textAlign:"center",margin:"4px 0 0"}}>
        Go Pro for 2/day · 30/month generations
      </p>}
    </>}
  </div>;
};

// ─── LOG ───────────────────────────────────────────────────────
const MealCreator = ({onSave,onBack}) => {
  const [name,setName]=useState("");
  const [ingredients,setIngredients]=useState([]);
  const [showAdd,setShowAdd]=useState(false);
  const allUnits = ["g","oz","ml","fl oz","cup","tbsp","tsp","serving","piece"];
  const [ing,setIng]=useState({name:"",servingSize:"",servingUnit:"g",cal:0,p:0,c:0,f:0,qty:1});
  const empty={name:"",servingSize:"",servingUnit:"g",cal:0,p:0,c:0,f:0,qty:1};

  const fmtServing = (x) => {
    const sz = x.servingSize ? x.servingSize : "1";
    return sz + " " + x.servingUnit;
  };

  const totals = ingredients.reduce((a,x)=>({
    cal:a.cal+x.cal*x.qty,p:a.p+x.p*x.qty,c:a.c+x.c*x.qty,f:a.f+x.f*x.qty
  }),{cal:0,p:0,c:0,f:0});

  const addIngredient = () => {
    if(!ing.name) return;
    setIngredients(prev=>[...prev,{...ing,id:Date.now()}]);
    setIng({...empty});
    setShowAdd(false);
  };

  const removeIngredient = (id) => setIngredients(prev=>prev.filter(x=>x.id!==id));

  const updateQty = (id,delta) => setIngredients(prev=>prev.map(x=>x.id===id?{...x,qty:Math.max(0.25,+(x.qty+delta).toFixed(2))}:x));

  const inputStyle={width:"100%",padding:"12px 14px",borderRadius:10,border:`1px solid ${T.bd}`,background:T.sf,color:T.tx,fontSize:14,fontFamily:T.font,fontWeight:500,outline:"none",boxSizing:"border-box"};
  const smallInput={...inputStyle,padding:"10px 12px",fontSize:13,textAlign:"center"};

  return <div style={{padding:"0 20px 24px"}}>
    {/* Header */}
    <div style={{display:"flex",alignItems:"center",gap:12,paddingTop:4,marginBottom:24}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:T.tx2,fontSize:14,cursor:"pointer",fontFamily:T.font,padding:0}}>← Back</button>
      <h1 style={{fontSize:22,fontWeight:700,color:T.tx,margin:0,letterSpacing:"-0.02em",flex:1}}>Create Meal</h1>
    </div>

    {/* Meal Name */}
    <Lbl>Meal Name</Lbl>
    <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Post-Workout Power Bowl" style={{...inputStyle,marginTop:8,marginBottom:20}}/>

    {/* Running Totals */}
    <Card style={{padding:"14px 16px",marginBottom:20,background:T.accG,border:`1px solid ${T.accM}`}}>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        {[{l:"Calories",v:Math.round(totals.cal),c:T.acc},{l:"Protein",v:Math.round(totals.p)+"g",c:T.pro},{l:"Carbs",v:Math.round(totals.c)+"g",c:T.carb},{l:"Fat",v:Math.round(totals.f)+"g",c:T.fat}].map(x=>
          <div key={x.l} style={{textAlign:"center"}}>
            <p style={{fontSize:17,fontWeight:700,color:x.c,margin:0,fontFamily:T.mono}}>{x.v}</p>
            <Lbl>{x.l}</Lbl>
          </div>
        )}
      </div>
    </Card>

    {/* Ingredient List */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <Lbl>Ingredients ({ingredients.length})</Lbl>
    </div>

    {ingredients.length===0 && !showAdd && <Card style={{padding:"24px 16px",textAlign:"center",marginBottom:12}}>
      <p style={{fontSize:13,color:T.txM,margin:0}}>No ingredients yet. Tap below to add your first one.</p>
    </Card>}

    {ingredients.map(x=>(
      <Card key={x.id} style={{padding:"12px 14px",marginBottom:6}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1}}>
            <p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>{x.name}</p>
            <p style={{fontSize:11,color:T.txM,margin:"2px 0 0"}}>{fmtServing(x)} per serving</p>
            <div style={{display:"flex",gap:8,marginTop:6}}>
              {[{v:Math.round(x.cal*x.qty),l:"cal",c:T.acc},{v:Math.round(x.p*x.qty)+"g",l:"P",c:T.pro},{v:Math.round(x.c*x.qty)+"g",l:"C",c:T.carb},{v:Math.round(x.f*x.qty)+"g",l:"F",c:T.fat}].map(m=>
                <span key={m.l} style={{fontSize:11,fontFamily:T.mono,color:m.c}}>{m.v}<span style={{color:T.txM,fontSize:9}}> {m.l}</span></span>
              )}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <button onClick={()=>updateQty(x.id,-1)} style={{width:28,height:28,borderRadius:8,border:`1px solid ${T.bd}`,background:T.sf,color:T.tx,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font}}>−</button>
            <div style={{textAlign:"center",minWidth:32}}>
              <span style={{fontSize:14,fontWeight:600,color:T.tx,fontFamily:T.mono}}>x{x.qty}</span>
            </div>
            <button onClick={()=>updateQty(x.id,1)} style={{width:28,height:28,borderRadius:8,border:`1px solid ${T.bd}`,background:T.sf,color:T.tx,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font}}>+</button>
            <button onClick={()=>removeIngredient(x.id)} style={{width:28,height:28,borderRadius:8,border:"none",background:"rgba(239,68,68,0.1)",color:"#EF4444",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",marginLeft:4}}>×</button>
          </div>
        </div>
      </Card>
    ))}

    {/* Add Ingredient Form */}
    {showAdd && <Card style={{padding:"16px",marginTop:8,marginBottom:8,border:`1px solid ${T.acc}30`}}>
      <p style={{fontSize:13,fontWeight:600,color:T.acc,margin:"0 0 12px",letterSpacing:"0.04em"}}>Add Ingredient</p>

      <Lbl>Name</Lbl>
      <input value={ing.name} onChange={e=>setIng(p=>({...p,name:e.target.value}))} placeholder="e.g. Chicken Breast" style={{...inputStyle,marginTop:6,marginBottom:14}}/>

      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <div style={{flex:"0 0 80px"}}>
          <Lbl>Amount</Lbl>
          <input value={ing.servingSize} onChange={e=>setIng(p=>({...p,servingSize:e.target.value}))} placeholder="1" type="number" inputMode="decimal" style={{...smallInput,marginTop:6,textAlign:"left"}}/>
        </div>
        <div style={{flex:1}}>
          <Lbl>Unit</Lbl>
          <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>
            {allUnits.map(u=>
              <button key={u} onClick={()=>setIng(p=>({...p,servingUnit:u}))} style={{
                padding:"8px 0",borderRadius:8,border:"none",
                background:ing.servingUnit===u?T.acc:"transparent",
                color:ing.servingUnit===u?T.bg:T.txM,
                fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:T.font,
                flex:u.length>3?"0 0 calc(25% - 3px)":"0 0 calc(20% - 4px)",
                textAlign:"center",
              }}>{u}</button>
            )}
          </div>
        </div>
      </div>

      {/* Serving context label */}
      <p style={{fontSize:11,color:T.acc,margin:"4px 0 12px",fontWeight:500}}>
        Macros per {ing.servingSize||"1"} {ing.servingUnit}
      </p>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:14}}>
        {[{k:"cal",l:"Cal",c:T.acc},{k:"p",l:"Protein",c:T.pro},{k:"c",l:"Carbs",c:T.carb},{k:"f",l:"Fat",c:T.fat}].map(m=>
          <div key={m.k}>
            <div style={{display:"flex",alignItems:"center",gap:3,marginBottom:4}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:m.c}}/>
              <span style={{fontSize:9,color:T.txM,fontWeight:600,letterSpacing:"0.06em"}}>{m.l}</span>
            </div>
            <input value={ing[m.k]||""} onChange={e=>setIng(p=>({...p,[m.k]:+e.target.value||0}))} type="number" placeholder="0" style={{...smallInput}}/>
          </div>
        )}
      </div>

      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>{setShowAdd(false);setIng({...empty})}} style={{flex:1,padding:12,borderRadius:10,border:`1px solid ${T.bd}`,background:"transparent",color:T.tx2,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:T.font}}>Cancel</button>
        <button onClick={addIngredient} style={{flex:1,padding:12,borderRadius:10,border:"none",background:T.acc,color:T.bg,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:T.font,opacity:ing.name?1:0.4,pointerEvents:ing.name?"auto":"none"}}>Add</button>
      </div>
    </Card>}

    {!showAdd && <button onClick={()=>setShowAdd(true)} style={{
      width:"100%",padding:14,borderRadius:T.r,border:`1px dashed ${T.bd}`,
      background:"transparent",color:T.acc,fontSize:13,fontWeight:600,
      cursor:"pointer",fontFamily:T.font,marginTop:8,marginBottom:20,
      display:"flex",alignItems:"center",justifyContent:"center",gap:6
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
      Add Ingredient
    </button>}

    {/* Save */}
    <button onClick={()=>{if(name&&ingredients.length)onSave({name,ingredients,totals:{cal:Math.round(totals.cal),p:Math.round(totals.p),c:Math.round(totals.c),f:Math.round(totals.f)}})}} style={{
      width:"100%",padding:16,borderRadius:T.r,border:"none",
      background:T.acc,color:T.bg,fontSize:15,fontWeight:700,
      cursor:"pointer",fontFamily:T.font,
      opacity:(name&&ingredients.length)?1:0.3,
      pointerEvents:(name&&ingredients.length)?"auto":"none"
    }}>
      Save Meal
    </button>
  </div>;
};

const getDefaultMealType = () => {
  const h = new Date().getHours();
  if(h>=5&&h<10) return 'breakfast';
  if(h>=10&&h<14) return 'lunch';
  if(h>=14&&h<17) return 'snack';
  if(h>=17&&h<22) return 'dinner';
  return 'snack';
};

const MealTypePicker = ({value, onChange}) => (
  <div style={{marginBottom:14}}>
    <Lbl>Meal Type</Lbl>
    <div style={{display:'flex',gap:6,marginTop:6}}>
      {MEAL_CATS.map(t=>(
        <button key={t} onClick={()=>onChange(t)} style={{
          flex:1,padding:'8px 4px',borderRadius:8,
          border:`1px solid ${value===t?T.acc:T.bd}`,
          background:value===t?T.accM:'transparent',
          color:value===t?T.acc:T.tx2,
          fontSize:11,fontWeight:value===t?700:500,
          cursor:'pointer',fontFamily:T.font,
          textTransform:'capitalize'
        }}>
          {t.charAt(0).toUpperCase()+t.slice(1)}
        </button>
      ))}
    </div>
  </div>
);

const LogMeal = ({savedMeals=[],onSaveMeal,todayLog=[],onLogMeal,userId,onDeleteSavedMeal,defaultMealType}) => {
  const [view,setView]=useState("main"); // main | create | manual | saved | custom
  const [loggedId,setLoggedId]=useState(null);
  const [manualForm,setManualForm]=useState({name:"",cal:"",p:"",c:"",f:""});
  const [manualSuccess,setManualSuccess]=useState(false);
  // Frequent meals — loaded from meal_log (count >= 2), no hardcoded defaults
  const [frequentMeals,setFrequentMeals]=useState([]);
  const [freqLoaded,setFreqLoaded]=useState(false);
  const [hiddenNames,setHiddenNames]=useState([]); // locally hidden from "Frequently Logged"
  const [mealType,setMealType]=useState(()=>defaultMealType||getDefaultMealType());
  const [savedRecipeModal,setSavedRecipeModal]=useState(null); // meal object or null

  useEffect(()=>{
    if(!userId||freqLoaded) return;
    (async()=>{
      const meals = await getFrequentMeals(userId);
      setFrequentMeals(meals);
      setFreqLoaded(true);
    })();
  },[userId,freqLoaded]);

  // ── Food search state ──
  const [searchQuery,setSearchQuery]=useState("");
  const [savedResults,setSavedResults]=useState([]);
  const [usdaResults,setUsdaResults]=useState([]);
  const [searchLoading,setSearchLoading]=useState(false);
  const [searchError,setSearchError]=useState("");
  const [selectedFood,setSelectedFood]=useState(null);
  const [selectedPortion,setSelectedPortion]=useState(null);
  const [qtyValue,setQtyValue]=useState("1");
  const [qtyUnit,setQtyUnit]=useState("servings"); // servings | g | oz
  const [editNutrition,setEditNutrition]=useState(null);
  const [searchLogSuccess,setSearchLogSuccess]=useState(false);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  // Parse gram weight from a serving_size string like "215g", "1 burger (215g)", "150 ml"
  const parseServingGrams = (str) => {
    if(!str) return null;
    const m = str.match(/\(?\s*(\d+(?:\.\d+)?)\s*g\s*\)?/i);
    if(m) return parseFloat(m[1]);
    const ml = str.match(/\(?\s*(\d+(?:\.\d+)?)\s*ml\s*\)?/i);
    if(ml) return parseFloat(ml[1]); // approximate ml≈g for liquids
    return null;
  };

  const clearSearch = () => {
    if(abortRef.current) abortRef.current.abort();
    if(debounceRef.current) clearTimeout(debounceRef.current);
    setSearchQuery("");setSavedResults([]);setUsdaResults([]);
    setSelectedFood(null);setSelectedPortion(null);setQtyValue("1");setQtyUnit("servings");
    setSearchError("");setEditNutrition(null);setSearchLogSuccess(false);setSearchLoading(false);
  };

  // Convert USDA servingSize + servingSizeUnit → grams.
  // Returns null if the unit can't be resolved or the result is implausible.
  // Convert USDA servingSize + servingSizeUnit → grams.
  const usdaServingGrams = (size, unit) => {
    if(!size || size<=0) return null;
    const u = (unit||"").toLowerCase().trim();
    let g;
    if(u==="g"||u==="gram"||u==="grams")     g = size;
    else if(u==="ml"||u.startsWith("millil")) g = size;
    else if(u==="oz"||u.startsWith("ounce")) g = size*28.3495;
    else                                      g = size; // heuristic: treat as grams
    if(g<3||g>3000) return null;
    return Math.round(g);
  };

  // Keyword-based default serving size for fast food / restaurant items
  // that have no servingSize in the USDA database.
  const keywordServingGrams = (description) => {
    const d = description.toLowerCase();
    if(/\b(burger|sandwich|wrap|taco)\b/.test(d))        return {g:150, est:true};
    if(/\b(fries|chips)\b/.test(d))                      return {g:117, est:true};
    if(/\b(nuggets?|tenders?|strips?)\b/.test(d))        return {g:100, est:true};
    if(/\bsalad\b/.test(d))                              return {g:300, est:true};
    if(/\b(shake|smoothie|drink|beverage)\b/.test(d))    return {g:350, est:true};
    if(/\b(cookie|muffin|donut|doughnut)\b/.test(d))     return {g:57,  est:true};
    if(/\bpizza\b/.test(d))                              return {g:107, est:true};
    return null;
  };

  const searchFoods = async (query) => {
    if(!query||query.length<2){setSavedResults([]);setUsdaResults([]);setSearchError("");return;}

    if(abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;

    const qLow = query.toLowerCase();
    const words = qLow.split(/\s+/).filter(Boolean);
    // Brand search heuristic: any word starts with a capital letter in original query
    const isBrandSearch = words.length>=2 && query.split(/\s+/).some(w=>/^[A-Z]/.test(w));
    // For generic 2-word food queries (all lowercase): require only 1 word match
    const minMatch = words.length<=1 ? 1
                   : isBrandSearch   ? Math.min(2, words.length)
                   : 1; // generic multi-word: relaxed — just need 1 word

    // Saved meals — instant local match
    const localMatches = savedMeals.filter(m=>m.name.toLowerCase().includes(qLow)).slice(0,5).map(m=>({
      id:"saved-"+m.id, name:m.name, brand:"", servingLabel:"Per 1 meal", servingGrams:null,
      cal:m.totals.cal, protein:m.totals.p, carbs:m.totals.c, fat:m.totals.f,
      basePer100:null, hasNutrition:true, source:"saved",
    }));
    setSavedResults(localMatches);
    setSearchLoading(true); setSearchError("");

    try {
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=25&dataType=Branded,SR%20Legacy,Foundation`;
      const res = await fetch(url, {signal});
      if(signal.aborted) return;
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rawCount = (data.foods||[]).length;

      let items = (data.foods||[]).map(f=>{
        const getNut = (id) => {const n=f.foodNutrients?.find(n=>n.nutrientId===id);return n?Math.round(n.value*10)/10:0;};
        const base = {cal:getNut(1008), protein:getNut(1003), carbs:getNut(1005), fat:getNut(1004)};

        // Build portions: branded serving → foodMeasures → keyword default → 100g
        const portions = [];
        const sg = usdaServingGrams(f.servingSize, f.servingSizeUnit);
        if(sg){
          const sizeLabel = `${Math.round((f.servingSize||sg)*10)/10}${f.servingSizeUnit||"g"}`;
          portions.push({label:sizeLabel, gramWeight:sg, est:false});
        }
        (f.foodMeasures||[]).forEach(m=>{
          if(m.gramWeight>0 && m.disseminationText && m.disseminationText!=="Quantity not specified")
            portions.push({label:m.disseminationText, gramWeight:Math.round(m.gramWeight), est:false});
        });
        if(portions.length===0){
          const kw = keywordServingGrams(f.description||"");
          if(kw) portions.push({label:`est. ${kw.g}g`, gramWeight:kw.g, est:true});
        }
        portions.push({label:"100g", gramWeight:100, est:false});

        const defP = portions[0];
        const mult = defP.gramWeight/100;
        const brand = f.brandOwner || f.brandName || "";
        const hasServing = defP.label!=="100g";

        return {
          id:"usda-"+f.fdcId, name:f.description||"", brand,
          servingLabel: hasServing
            ? (defP.est ? `Per serving (est. ${defP.gramWeight}g)` : `Per serving (${defP.gramWeight}g)`)
            : "Per 100g",
          servingGrams: defP.gramWeight,
          cal:Math.round(base.cal*mult), protein:Math.round(base.protein*mult),
          carbs:Math.round(base.carbs*mult), fat:Math.round(base.fat*mult),
          basePer100:base, portions, activePortion:0,
          hasNutrition:base.cal>0, source:"usda",
        };
      }).filter(f=>f.name);

      // Filter: remove zero-cal items
      const afterCalFilter = items.filter(f=>f.hasNutrition);
      items = afterCalFilter;

      // Relevance scoring
      const scoreItem = (item) => {
        const name     = item.name.toLowerCase();
        const brand    = item.brand.toLowerCase();
        const combined = name+" "+brand;
        const matchCount = words.filter(w=>combined.includes(w)).length;
        if(matchCount<minMatch) return Infinity;
        if(name.startsWith(qLow))                   return 0;
        if(words.every(w=>name.includes(w)))         return 1;
        if(combined.includes(qLow))                  return 2;
        if(matchCount===words.length)                return 3;
        if(matchCount/words.length>=0.75)            return 4;
        return 5;
      };

      const afterRelevance = items.filter(item=>scoreItem(item)<Infinity);
      const final = afterRelevance
        .map(item=>({...item, _s:scoreItem(item)}))
        .sort((a,b)=>a._s-b._s)
        .slice(0,8)
        .map(({_s,...item})=>item);

      console.log(`[usda] "${query}" — raw:${rawCount} after-cal:${afterCalFilter.length} after-relevance:${afterRelevance.length} shown:${final.length} | isBrand:${isBrandSearch} minMatch:${minMatch}`);

      if(!signal.aborted) setUsdaResults(final);
    } catch(e){
      if(e.name==="AbortError"||signal.aborted) return;
      console.error("[usda] search error:", e.message);
      setUsdaResults([]);
      if(localMatches.length===0) setSearchError("Food search temporarily unavailable. Try manual entry.");
    } finally {
      if(!signal.aborted) setSearchLoading(false);
    }
  };

  const allResults = (() => {
    const seen = new Set();
    const dedup = (items) => items.filter(r => {
      const key = r.name.toLowerCase().replace(/\s+/g," ").trim();
      if(seen.has(key)) return false;
      seen.add(key); return true;
    });
    return {saved:dedup(savedResults), usda:dedup(usdaResults)};
  })();
  const hasResults = allResults.saved.length>0||allResults.usda.length>0;

  const handleSearchInput = (val) => {
    setSearchQuery(val);
    setSelectedFood(null);setSelectedPortion(null);setSearchLogSuccess(false);
    if(!val||val.length<2){
      if(abortRef.current) abortRef.current.abort();
      setSavedResults([]);setUsdaResults([]);setSearchError("");setSearchLoading(false);
      if(debounceRef.current) clearTimeout(debounceRef.current);
      return;
    }
    if(debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(()=>searchFoods(val),500);
  };

  const selectFood = (food) => {
    setSelectedFood(food);setQtyValue("1");setQtyUnit("servings");
    if(food.portions && food.portions.length>1){
      setSelectedPortion(food.activePortion||0);
    } else {
      setSelectedPortion(null);
    }
    if(!food.hasNutrition) setEditNutrition({cal:food.cal,p:food.protein,c:food.carbs,f:food.fat});
    else setEditNutrition(null);
  };

  // Get the per-1-serving macros for the current portion selection
  const getPerServing = () => {
    if(!selectedFood) return {cal:0,p:0,c:0,f:0,grams:100};
    if(selectedFood.portions && selectedPortion!==null && selectedFood.basePer100){
      const pt = selectedFood.portions[selectedPortion];
      const m = pt.gramWeight/100;
      const b = selectedFood.basePer100;
      return {cal:Math.round(b.cal*m),p:Math.round(b.protein*m),c:Math.round(b.carbs*m),f:Math.round(b.fat*m),grams:pt.gramWeight};
    }
    return {cal:selectedFood.cal,p:selectedFood.protein,c:selectedFood.carbs,f:selectedFood.fat,grams:selectedFood.servingGrams||100};
  };

  // Calculate final macros based on qty + unit
  const getFinalMacros = () => {
    if(editNutrition) return {cal:+editNutrition.cal||0,p:+editNutrition.p||0,c:+editNutrition.c||0,f:+editNutrition.f||0};
    const ps = getPerServing();
    const qty = parseFloat(qtyValue)||0;
    if(qtyUnit==="servings"){
      return {cal:Math.round(ps.cal*qty),p:Math.round(ps.p*qty),c:Math.round(ps.c*qty),f:Math.round(ps.f*qty)};
    }
    // Convert g/oz to a multiplier relative to per-serving
    const grams = qtyUnit==="oz" ? qty*28.3495 : qty;
    const servGrams = ps.grams||100;
    const mult = grams/servGrams;
    return {cal:Math.round(ps.cal*mult),p:Math.round(ps.p*mult),c:Math.round(ps.c*mult),f:Math.round(ps.f*mult)};
  };

  const logSearchedFood = () => {
    if(!selectedFood||!onLogMeal) return;
    const fm = getFinalMacros();
    onLogMeal({type:mealType,name:selectedFood.name+(selectedFood.brand?` (${selectedFood.brand})`:""),cal:fm.cal,p:fm.p,c:fm.c,f:fm.f});
    setSearchLogSuccess(true);
    setTimeout(()=>{setSearchLogSuccess(false);setSelectedFood(null);setSelectedPortion(null);setSearchQuery("");setQtyValue("1");setQtyUnit("servings");setEditNutrition(null);setSavedResults([]);setUsdaResults([]);},1500);
  };

  const quickLog = (item, feedbackId) => {
    if(!onLogMeal) return;
    onLogMeal({type:mealType,name:item.n||item.name,cal:item.cal||item.totals?.cal||0,p:item.p||item.totals?.p||0,c:item.c||item.totals?.c||0,f:item.f||item.totals?.f||0});
    setLoggedId(feedbackId);
    setTimeout(()=>setLoggedId(null),1200);
  };

  const handleManualLog = () => {
    if(!manualForm.name||!manualForm.cal||!onLogMeal) return;
    onLogMeal({type:mealType,name:manualForm.name,cal:+manualForm.cal||0,p:+manualForm.p||0,c:+manualForm.c||0,f:+manualForm.f||0});
    setManualSuccess(true);
    setTimeout(()=>{setManualSuccess(false);setManualForm({name:"",cal:"",p:"",c:"",f:""});setView("main")},1500);
  };

  if(view==="create") return <MealCreator onBack={()=>setView("custom")} onSave={(meal)=>{if(onSaveMeal)onSaveMeal(meal);setView("custom")}}/>;

  // ── Saved Meals sub-view ──
  if(view==="saved") {
    const savedList = savedMeals.filter(m=>m.source!=='custom');
    const BackBtn2 = () => <button onClick={()=>setView("main")} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:6,padding:"0 0 16px",color:T.acc,fontSize:14,fontWeight:600,fontFamily:T.font}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>Back</button>;
    return <div style={{padding:"0 20px 24px"}}>
      <BackBtn2/>
      <h1 style={{fontSize:22,fontWeight:700,color:T.tx,margin:"0 0 4px",letterSpacing:"-0.02em"}}>Saved Meals</h1>
      <p style={{fontSize:13,color:T.txM,margin:"0 0 12px"}}>Hearted meals from your plan and logs.</p>
      <MealTypePicker value={mealType} onChange={setMealType}/>
      {savedList.length===0 && <Card style={{padding:"24px 16px",textAlign:"center"}}>
        <p style={{fontSize:13,color:T.txM,margin:0}}>No saved meals yet. Heart a meal in the Plan tab or on a logged entry to save it here.</p>
      </Card>}
      {savedList.map(m=>{
        const fk="savedv-"+m.id;
        const isLogged=loggedId===fk;
        return <SwipeableRow key={m.id} onDelete={()=>onDeleteSavedMeal&&onDeleteSavedMeal(m.id)}>
          <Card style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginBottom:0,cursor:"pointer"}} onClick={()=>setSavedRecipeModal(m)}>
            <div style={{flex:1}}>
              <p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>{m.name}</p>
              <div style={{display:"flex",gap:8,marginTop:3}}>
                {[{v:m.totals.cal,l:"cal",c:T.acc},{v:m.totals.p+"g",l:"P",c:T.pro},{v:m.totals.c+"g",l:"C",c:T.carb},{v:m.totals.f+"g",l:"F",c:T.fat}].map(x=>
                  <span key={x.l} style={{fontSize:10,fontFamily:T.mono,color:x.c}}>{x.v}<span style={{color:T.txM,fontSize:8}}> {x.l}</span></span>
                )}
              </div>
              {m.ingredients?.length>0&&<p style={{fontSize:10,color:T.txM,margin:"3px 0 0"}}>Tap to view recipe</p>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <button onClick={(e)=>{e.stopPropagation();onDeleteSavedMeal&&onDeleteSavedMeal(m.id);}} style={{background:"none",border:"none",cursor:"pointer",padding:4,display:"flex",alignItems:"center"}}>
                <HeartIcon filled size={18}/>
              </button>
              {/* Quick-log button — logs immediately without opening recipe */}
              <button onClick={(e)=>{e.stopPropagation();quickLog({name:m.name,cal:m.totals.cal,p:m.totals.p,c:m.totals.c,f:m.totals.f},fk);}} style={{width:28,height:28,borderRadius:"50%",background:isLogged?T.ok:T.accM,border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all 0.3s ease",flexShrink:0}}>
                {isLogged
                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>}
              </button>
            </div>
          </Card>
        </SwipeableRow>;
      })}

      {/* Recipe modal for saved meals */}
      {savedRecipeModal&&(
        <div onClick={()=>setSavedRecipeModal(null)} style={{position:"fixed",inset:0,zIndex:11000,display:"flex",alignItems:"flex-end",justifyContent:"center",background:"rgba(0,0,0,0.75)"}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:430,maxHeight:"85vh",overflowY:"auto",background:T.sf,borderRadius:"20px 20px 0 0",border:`1px solid ${T.bd}`,borderBottom:"none",padding:"20px 20px 44px",position:"relative"}}>
            <div style={{width:36,height:4,borderRadius:2,background:T.bd,margin:"0 auto 18px"}}/>
            <button onClick={()=>setSavedRecipeModal(null)} style={{position:"absolute",top:20,right:20,background:"none",border:"none",color:T.txM,fontSize:18,cursor:"pointer",padding:4,lineHeight:1}}>✕</button>
            <h2 style={{fontSize:18,fontWeight:700,color:T.tx,margin:"0 0 10px",letterSpacing:"-0.01em",paddingRight:28}}>{savedRecipeModal.name}</h2>
            <div style={{display:"flex",gap:12,marginBottom:16}}>
              {[{v:savedRecipeModal.totals.cal,l:"cal",c:T.acc},{v:savedRecipeModal.totals.p+"g",l:"Protein",c:T.pro},{v:savedRecipeModal.totals.c+"g",l:"Carbs",c:T.carb},{v:savedRecipeModal.totals.f+"g",l:"Fat",c:T.fat}].map(x=>
                <div key={x.l} style={{flex:1,textAlign:"center",padding:"8px 4px",background:T.accG,borderRadius:10,border:`1px solid ${T.accM}`}}>
                  <p style={{fontSize:14,fontWeight:700,color:x.c,margin:0,fontFamily:T.mono}}>{x.v}</p>
                  <p style={{fontSize:9,color:T.txM,margin:0,fontWeight:600}}>{x.l.toUpperCase()}</p>
                </div>
              )}
            </div>
            {savedRecipeModal.ingredients?.length>0&&<>
              <p style={{fontSize:11,fontWeight:700,color:T.acc,letterSpacing:"0.1em",textTransform:"uppercase",margin:"0 0 8px"}}>Ingredients</p>
              {savedRecipeModal.ingredients.map((ing,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:i<savedRecipeModal.ingredients.length-1?`1px solid ${T.bd}`:"none"}}>
                  <span style={{fontSize:13,color:T.tx}}>{ing.name}</span>
                  <span style={{fontSize:12,color:T.txM,fontFamily:T.mono}}>{ing.qty} {ing.unit}</span>
                </div>
              ))}
            </>}
            <button onClick={()=>{quickLog({name:savedRecipeModal.name,cal:savedRecipeModal.totals.cal,p:savedRecipeModal.totals.p,c:savedRecipeModal.totals.c,f:savedRecipeModal.totals.f},"savedv-"+savedRecipeModal.id);setSavedRecipeModal(null);}} style={{width:"100%",padding:"13px",borderRadius:T.r,border:"none",background:T.acc,color:T.bg,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:T.font,marginTop:20}}>
              Log This Meal
            </button>
          </div>
        </div>
      )}
    </div>;
  }

  // ── Custom Meals sub-view ──
  if(view==="custom") {
    const customList = savedMeals.filter(m=>m.source==='custom'||!m.source);
    const BackBtn2 = () => <button onClick={()=>setView("main")} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:6,padding:"0 0 16px",color:T.acc,fontSize:14,fontWeight:600,fontFamily:T.font}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>Back</button>;
    return <div style={{padding:"0 20px 24px"}}>
      <BackBtn2/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <h1 style={{fontSize:22,fontWeight:700,color:T.tx,margin:0,letterSpacing:"-0.02em"}}>Custom Meals</h1>
        <button onClick={()=>setView("create")} style={{padding:"8px 16px",borderRadius:T.r,border:"none",background:T.acc,color:T.bg,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:T.font}}>+ Create New</button>
      </div>
      <p style={{fontSize:13,color:T.txM,margin:"0 0 12px"}}>Your hand-built recipes and meal templates.</p>
      <MealTypePicker value={mealType} onChange={setMealType}/>
      {customList.length===0 && <Card style={{padding:"24px 16px",textAlign:"center"}}>
        <p style={{fontSize:13,color:T.txM,margin:0}}>No custom meals yet. Tap Create New to build your own recipe.</p>
      </Card>}
      {customList.map((m,i)=>{
        const fk="customv-"+m.id;
        const isLogged=loggedId===fk;
        return <SwipeableRow key={m.id||i} onDelete={()=>onDeleteSavedMeal&&onDeleteSavedMeal(m.id)}>
          <Card style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginBottom:0,cursor:"pointer"}} onClick={()=>quickLog({name:m.name,cal:m.totals.cal,p:m.totals.p,c:m.totals.c,f:m.totals.f},fk)}>
            <div style={{flex:1}}>
              <p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>{m.name}</p>
              <div style={{display:"flex",gap:8,marginTop:3}}>
                {[{v:m.totals.cal,l:"cal",c:T.acc},{v:m.totals.p+"g",l:"P",c:T.pro},{v:m.totals.c+"g",l:"C",c:T.carb},{v:m.totals.f+"g",l:"F",c:T.fat}].map(x=>
                  <span key={x.l} style={{fontSize:10,fontFamily:T.mono,color:x.c}}>{x.v}<span style={{color:T.txM,fontSize:8}}> {x.l}</span></span>
                )}
              </div>
              {m.ingredients.length>0&&<p style={{fontSize:10,color:T.txM,margin:"3px 0 0"}}>{m.ingredients.length} ingredient{m.ingredients.length!==1?"s":""}</p>}
            </div>
            <div style={{width:28,height:28,borderRadius:"50%",background:isLogged?T.ok:T.accM,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.3s ease"}}>
              {isLogged
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>}
            </div>
          </Card>
        </SwipeableRow>;
      })}
    </div>;
  }

  const inputStyle={width:"100%",padding:"12px 14px",borderRadius:10,border:`1px solid ${T.bd}`,background:T.sf,color:T.tx,fontSize:14,fontFamily:T.font,fontWeight:500,outline:"none",boxSizing:"border-box"};

  return <div style={{padding:"0 20px 24px"}}>
    <h1 style={{fontSize:26,fontWeight:700,color:T.tx,margin:"4px 0 4px",letterSpacing:"-0.02em"}}>Log Meal</h1>
    <p style={{fontSize:13,color:T.txM,margin:"0 0 20px"}}>What did you eat?</p>

    {/* ── Search Bar ── */}
    <div style={{position:"relative",marginBottom:hasResults||selectedFood?8:20}}>
      <Card style={{padding:"0",display:"flex",alignItems:"center",overflow:"hidden"}}>
        <div style={{padding:"13px 0 13px 16px",display:"flex",alignItems:"center"}}>
          {searchLoading
            ? <><div style={{width:17,height:17,borderRadius:"50%",border:`2px solid ${T.bd}`,borderTopColor:T.acc,animation:"spin 1s linear infinite"}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></>
            : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.txM} strokeWidth="1.5" strokeLinecap="round"><circle cx="11" cy="11" r="7.5"/><path d="M21 21l-4.35-4.35"/></svg>}
        </div>
        <input value={searchQuery} onChange={e=>handleSearchInput(e.target.value)} placeholder="Search foods... e.g. chicken breast, Chobani" style={{flex:1,padding:"13px 10px",border:"none",background:"transparent",color:T.tx,fontSize:14,fontFamily:T.font,fontWeight:500,outline:"none"}}/>
        {searchQuery && <div onClick={clearSearch} style={{padding:"13px 16px 13px 0",cursor:"pointer"}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.txM} strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </div>}
      </Card>

      {/* Expanding soon note */}
      {!searchQuery && <p style={{fontSize:11,color:T.txM,margin:"6px 4px 0",lineHeight:1.5}}>Food database expanding soon — manual entry always available for unlisted items.</p>}

      {/* Search error — only when both APIs fail */}
      {searchError && !searchLoading && !hasResults && <Card style={{padding:"14px 16px",marginTop:4}}>
        <p style={{fontSize:13,color:T.txM,margin:0}}>{searchError}</p>
      </Card>}

      {/* Search results */}
      {hasResults && !selectedFood && <div style={{marginTop:4,maxHeight:400,overflowY:"auto",borderRadius:T.r,border:`1px solid ${T.bd}`,background:T.sf}}>
        {[{label:"Your Meals",items:allResults.saved,color:T.ok},{label:"Foods",items:allResults.usda,color:T.acc}].map(group=>
          group.items.length>0 && <div key={group.label}>
            <div style={{padding:"7px 16px 5px",background:T.bg,borderBottom:`1px solid ${T.bd}`,position:"sticky",top:0,zIndex:1}}>
              <span style={{fontSize:10,fontWeight:700,color:group.color,letterSpacing:"0.1em",textTransform:"uppercase"}}>{group.label}</span>
            </div>
            {group.items.map(r=><div key={r.id} onClick={()=>selectFood(r)} style={{padding:"12px 16px",borderBottom:`1px solid ${T.bd}`,cursor:"pointer"}}>
              <p style={{fontSize:14,fontWeight:600,color:T.tx,margin:"0 0 2px",lineHeight:1.3}}>{r.name}</p>
              {r.brand && <p style={{fontSize:11,color:T.txM,margin:"0 0 5px"}}>{r.brand}</p>}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  {[{v:`${r.protein}g`,l:"P",c:T.pro},{v:`${r.carbs}g`,l:"C",c:T.carb},{v:`${r.fat}g`,l:"F",c:T.fat}].map(x=>
                    <span key={x.l} style={{fontSize:10,fontFamily:T.mono,color:x.c,display:"flex",alignItems:"center",gap:2}}>
                      <span style={{width:4,height:4,borderRadius:"50%",background:x.c,flexShrink:0,display:"inline-block"}}/>
                      {x.v}<span style={{color:T.txM,fontSize:8}}> {x.l}</span>
                    </span>
                  )}
                  {r.servingLabel && <span style={{fontSize:10,color:T.txM}}>· {r.servingLabel}</span>}
                </div>
                <span style={{fontSize:12,fontFamily:T.mono,color:r.hasNutrition?T.acc:T.txM,fontWeight:700,flexShrink:0,marginLeft:8}}>{r.hasNutrition?`${r.cal} cal`:"No data"}</span>
              </div>
            </div>)}
          </div>
        )}
        {searchLoading && <div style={{padding:"10px 16px",display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:14,height:14,borderRadius:"50%",border:`2px solid ${T.bd}`,borderTopColor:T.acc,animation:"spin 1s linear infinite"}}/>
          <span style={{fontSize:12,color:T.txM}}>Searching...</span>
        </div>}
      </div>}

      {/* No results after search completes */}
      {searchQuery.length>=2 && !searchLoading && !hasResults && !searchError && !selectedFood && <Card style={{padding:"14px 16px",marginTop:4}}>
        <p style={{fontSize:13,color:T.txM,margin:0}}>No results found for "{searchQuery}". Try a different name or use manual entry.</p>
      </Card>}
    </div>

    {/* ── Selected food detail card ── */}
    {selectedFood && !searchLogSuccess && (()=>{
      const fm = getFinalMacros();
      const ps = getPerServing();
      const portionLabel = selectedFood.portions && selectedPortion!==null
        ? selectedFood.portions[selectedPortion].label+(selectedFood.portions[selectedPortion].gramWeight!==100?" ("+selectedFood.portions[selectedPortion].gramWeight+"g)":"")
        : selectedFood.servingLabel||"Per serving";
      return <Card style={{padding:18,marginBottom:20,border:`1px solid ${T.acc}30`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <div style={{flex:1}}>
          <p style={{fontSize:16,fontWeight:600,color:T.tx,margin:"0 0 2px"}}>{selectedFood.name}</p>
          {selectedFood.brand && <p style={{fontSize:12,color:T.txM,margin:0}}>{selectedFood.brand}</p>}
          <p style={{fontSize:11,color:T.acc,margin:"4px 0 0",fontWeight:500}}>{portionLabel}</p>
        </div>
        <div onClick={()=>{setSelectedFood(null);setSelectedPortion(null);setEditNutrition(null);setQtyValue("1");setQtyUnit("servings")}} style={{cursor:"pointer",padding:4}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.txM} strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </div>
      </div>

      {/* USDA portion picker */}
      {selectedFood.portions && selectedFood.portions.length>1 && <div style={{marginBottom:14}}>
        <Lbl>Portion Size</Lbl>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6}}>
          {selectedFood.portions.map((pt,pi)=>
            <button key={pi} onClick={()=>{setSelectedPortion(pi);setQtyValue("1");setQtyUnit("servings")}} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${selectedPortion===pi?T.acc:T.bd}`,background:selectedPortion===pi?T.accM:"transparent",color:selectedPortion===pi?T.acc:T.tx2,fontSize:12,fontWeight:selectedPortion===pi?600:400,cursor:"pointer",fontFamily:T.font}}>
              {pt.label}{pt.gramWeight!==100?` (${pt.gramWeight}g)`:""}
            </button>
          )}
        </div>
      </div>}

      {!selectedFood.hasNutrition && <div style={{padding:"8px 12px",borderRadius:8,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.15)",marginBottom:14}}>
        <p style={{fontSize:12,color:"#EF4444",margin:0,fontWeight:500}}>Nutrition data unavailable — edit values below before logging.</p>
      </div>}

      {/* Macro display / edit */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:16}}>
        {[{k:"cal",l:"Calories",v:editNutrition?editNutrition.cal:fm.cal,c:T.acc},{k:"p",l:"Protein",v:editNutrition?editNutrition.p:fm.p,c:T.pro},{k:"c",l:"Carbs",v:editNutrition?editNutrition.c:fm.c,c:T.carb},{k:"f",l:"Fat",v:editNutrition?editNutrition.f:fm.f,c:T.fat}].map(x=>
          <div key={x.k} style={{textAlign:"center"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:3,marginBottom:4}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:x.c}}/>
              <span style={{fontSize:9,color:T.txM,fontWeight:600}}>{x.l}</span>
            </div>
            {editNutrition ? <input value={x.v} onChange={e=>setEditNutrition(p=>({...p,[x.k]:e.target.value}))} type="number" style={{...inputStyle,textAlign:"center",padding:"8px 4px",fontSize:15,fontWeight:700,color:x.c,fontFamily:T.mono}}/> : <p style={{fontSize:18,fontWeight:700,color:x.c,margin:0,fontFamily:T.mono}}>{x.v}</p>}
            {!editNutrition && x.k!=="cal" && <span style={{fontSize:9,color:T.txM}}>g</span>}
          </div>
        )}
      </div>

      {/* Quantity selector with unit toggle */}
      <div style={{marginBottom:16}}>
        <Lbl>Quantity</Lbl>
        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
          <button onClick={()=>{const v=parseFloat(qtyValue)||0;setQtyValue(String(Math.max(qtyUnit==="g"?1:0.5,qtyUnit==="g"?v-50:qtyUnit==="oz"?+(v-1).toFixed(1):v-1)))}} style={{width:36,height:36,borderRadius:8,border:`1px solid ${T.bd}`,background:T.sf,color:T.tx,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font,flexShrink:0}}>−</button>
          <input value={qtyValue} onChange={e=>setQtyValue(e.target.value)} type="number" inputMode="decimal" style={{...inputStyle,textAlign:"center",padding:"8px 6px",fontSize:18,fontWeight:700,fontFamily:T.mono,width:70,flexShrink:0}}/>
          <button onClick={()=>{const v=parseFloat(qtyValue)||0;setQtyValue(String(qtyUnit==="g"?v+50:qtyUnit==="oz"?+(v+1).toFixed(1):v+1))}} style={{width:36,height:36,borderRadius:8,border:`1px solid ${T.bd}`,background:T.sf,color:T.tx,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font,flexShrink:0}}>+</button>
          <div style={{display:"flex",borderRadius:8,border:`1px solid ${T.bd}`,overflow:"hidden",flexShrink:0}}>
            {["servings","g","oz"].map(u=>
              <button key={u} onClick={()=>{
                if(u===qtyUnit) return;
                const curQty = parseFloat(qtyValue)||1;
                const curGrams = qtyUnit==="servings" ? curQty*(ps.grams||100) : qtyUnit==="oz" ? curQty*28.3495 : curQty;
                if(u==="servings"){setQtyValue(String(Math.round(curGrams/(ps.grams||100)*10)/10));}
                else if(u==="g"){setQtyValue(String(Math.round(curGrams)));}
                else{setQtyValue(String(Math.round(curGrams/28.3495*10)/10));}
                setQtyUnit(u);
              }} style={{padding:"7px 10px",border:"none",background:qtyUnit===u?T.accM:"transparent",color:qtyUnit===u?T.acc:T.txM,fontSize:11,fontWeight:qtyUnit===u?700:500,cursor:"pointer",fontFamily:T.font,borderRight:u!=="oz"?`1px solid ${T.bd}`:"none"}}>
                {u==="servings"?"srv":u}
              </button>
            )}
          </div>
        </div>
        {qtyUnit!=="servings" && ps.grams && <p style={{fontSize:10,color:T.txM,margin:"6px 0 0"}}>1 serving = {ps.grams}g</p>}
      </div>

      <MealTypePicker value={mealType} onChange={setMealType}/>
      {(() => {
        const canLog = fm.cal > 0;
        return <button onClick={logSearchedFood} style={{width:"100%",padding:14,borderRadius:T.r,border:"none",background:T.acc,color:T.bg,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:T.font,opacity:canLog?1:0.4,pointerEvents:canLog?"auto":"none"}}>
          Log It — {fm.cal} cal
        </button>;
      })()}
    </Card>;
    })()}

    {/* Search log success */}
    {searchLogSuccess && <Card style={{padding:"24px 18px",marginBottom:20,textAlign:"center"}}>
      <div style={{width:44,height:44,borderRadius:"50%",background:T.ok,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:12}}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
      </div>
      <p style={{fontSize:15,fontWeight:600,color:T.tx,margin:0}}>Meal Logged!</p>
    </Card>}
    {/* ── Quick action buttons ── */}
    <div data-tour="log-options" style={{display:"flex",gap:8,marginBottom:24}}>
      {[
        {l:"Manual",i:"✎",h:view==="manual",action:()=>setView(view==="manual"?"main":"manual")},
        {l:"Saved",i:"♥",h:view==="saved",action:()=>setView("saved")},
        {l:"Custom",i:"✦",h:view==="custom",action:()=>setView("custom")},
      ].map(a=>
        <button key={a.l} onClick={a.action||undefined} style={{flex:1,padding:"14px 4px",borderRadius:T.r,border:a.h?`1.5px solid ${T.acc}`:`1px solid ${T.bd}`,background:a.h?T.accM:T.sf,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
          <span style={{fontSize:16,color:a.h?T.acc:T.tx2}}>{a.i}</span>
          <span style={{fontSize:10,fontWeight:600,color:a.h?T.acc:T.tx2}}>{a.l}</span>
        </button>)}
    </div>

    {/* Manual Entry Form */}
    {view==="manual" && <Card style={{padding:18,marginBottom:24,border:`1px solid ${T.acc}30`}}>
      {manualSuccess ? <div style={{textAlign:"center",padding:"20px 0"}}>
        <div style={{width:44,height:44,borderRadius:"50%",background:T.ok,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:12}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <p style={{fontSize:15,fontWeight:600,color:T.tx,margin:0}}>Meal Logged!</p>
        <p style={{fontSize:12,color:T.txM,margin:"4px 0 0"}}>Check the Home tab to see your updated macros.</p>
      </div> : <>
        <p style={{fontSize:13,fontWeight:600,color:T.acc,margin:"0 0 14px",letterSpacing:"0.04em"}}>Quick Entry</p>
        <Lbl>Meal Name</Lbl>
        <input value={manualForm.name} onChange={e=>setManualForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Chicken salad" style={{...inputStyle,marginTop:6,marginBottom:14}}/>
        <Lbl>Calories</Lbl>
        <input value={manualForm.cal} onChange={e=>setManualForm(p=>({...p,cal:e.target.value}))} placeholder="e.g. 450" type="number" style={{...inputStyle,marginTop:6,marginBottom:14}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
          {[{k:"p",l:"Protein (g)",c:T.pro},{k:"c",l:"Carbs (g)",c:T.carb},{k:"f",l:"Fat (g)",c:T.fat}].map(x=>
            <div key={x.k}>
              <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:4}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:x.c}}/>
                <span style={{fontSize:9,color:T.txM,fontWeight:600}}>{x.l}</span>
              </div>
              <input value={manualForm[x.k]} onChange={e=>setManualForm(p=>({...p,[x.k]:e.target.value}))} placeholder="0" type="number" style={{...inputStyle,textAlign:"center",padding:"10px 8px"}}/>
            </div>
          )}
        </div>
        <MealTypePicker value={mealType} onChange={setMealType}/>
        <button onClick={handleManualLog} style={{width:"100%",padding:14,borderRadius:T.r,border:"none",background:T.acc,color:T.bg,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:T.font,opacity:(manualForm.name&&manualForm.cal)?1:0.4,pointerEvents:(manualForm.name&&manualForm.cal)?"auto":"none"}}>
          Log It
        </button>
      </>}
    </Card>}
    {/* ── Frequently Logged ── */}
    <MealTypePicker value={mealType} onChange={setMealType}/>
    <Lbl>Frequently Logged</Lbl>
    <div style={{marginTop:10}}>
      {frequentMeals.filter(m=>!hiddenNames.includes(m.name)).length === 0 && freqLoaded && (
        <Card style={{padding:"16px",textAlign:"center",marginBottom:6}}>
          <p style={{fontSize:13,color:T.txM,margin:0}}>Meals you log 2+ times will appear here for quick re-logging.</p>
        </Card>
      )}
      {frequentMeals.filter(m=>!hiddenNames.includes(m.name)).map((m)=>{
        const feedbackId = "freq-"+m.name;
        const isLogged = loggedId===feedbackId;
        return <SwipeableRow key={m.name} onDelete={()=>setHiddenNames(prev=>[...prev,m.name])}>
          <Card style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginBottom:0}}>
            <div><p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>{m.name}</p>
              <div style={{display:"flex",gap:8,marginTop:3}}>
                {[{v:m.cal,l:"cal",c:T.acc},{v:(m.p||0)+"g",l:"P",c:T.pro},{v:(m.c||0)+"g",l:"C",c:T.carb},{v:(m.f||0)+"g",l:"F",c:T.fat}].map(x=>
                  <span key={x.l} style={{fontSize:10,fontFamily:T.mono,color:x.c}}>{x.v}<span style={{color:T.txM,fontSize:8}}> {x.l}</span></span>
                )}
              </div>
            </div>
            <div onClick={(e)=>{e.stopPropagation();quickLog(m,feedbackId)}} style={{width:30,height:30,borderRadius:"50%",background:isLogged?T.ok:T.accM,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.3s ease",cursor:"pointer"}}>
              {isLogged
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>}
            </div>
          </Card>
        </SwipeableRow>;
      })}
    </div>
  </div>;
};

// ─── GROCERY ───────────────────────────────────────────────────
const Grocery = ({isPro,setIsPro,weekPlans={},userId,onUpgrade}) => {
  const [activeTab,setActiveTab]=useState("mylist"); // "planlist" | "mylist"

  // ── My List state (FREE) ──
  const [myItems,setMyItems]=useState([]);
  const [myListLoaded,setMyListLoaded]=useState(false);
  const [addForm,setAddForm]=useState({name:"",qty:"1",unit:"lbs",category:"Other"});
  const [showAdd,setShowAdd]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const [editForm,setEditForm]=useState({name:"",qty:"",unit:"",category:"Other"});

  // ── Plan List state (PRO) ──
  const [planChecked,setPlanChecked]=useState({});

  const myListUnits=["lbs","oz","dozen","gallon","liter","box","package","bunch","bag","can","jar","count"];
  const myListCategories=["Produce","Dairy","Meat & Seafood","Grains & Pantry","Frozen","Beverages","Snacks","Other"];
  const inputStyle={width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${T.bd}`,background:T.sf,color:T.tx,fontSize:14,fontFamily:T.font,fontWeight:500,outline:"none",boxSizing:"border-box"};

  // Load custom list from Supabase
  useEffect(()=>{
    if(!userId||myListLoaded) return;
    (async()=>{
      const items = await getCustomGroceryList(userId);
      setMyItems(items||[]);
      setMyListLoaded(true);
    })();
  },[userId,myListLoaded]);

  const persistMyList = async (items) => {
    setMyItems(items);
    if(userId) await saveCustomGroceryList(userId, items);
  };

  const addMyItem = async () => {
    if(!addForm.name.trim()) return;
    const newItems = [...myItems, {id:Date.now().toString(),name:addForm.name.trim(),qty:addForm.qty,unit:addForm.unit,category:addForm.category||"Other",checked:false}];
    await persistMyList(newItems);
    setAddForm({name:"",qty:"1",unit:"lbs",category:"Other"});
    setShowAdd(false);
  };

  const deleteMyItem = async (id) => {
    await persistMyList(myItems.filter(x=>x.id!==id));
  };

  const toggleMyItem = async (id) => {
    await persistMyList(myItems.map(x=>x.id===id?{...x,checked:!x.checked}:x));
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({name:item.name,qty:item.qty,unit:item.unit,category:item.category||"Other"});
  };

  const saveEdit = async () => {
    if(!editForm.name.trim()) return;
    await persistMyList(myItems.map(x=>x.id===editingId?{...x,name:editForm.name.trim(),qty:editForm.qty,unit:editForm.unit,category:editForm.category||"Other"}:x));
    setEditingId(null);
  };

  // ── Parse plan ingredients for Meal Plan List ──
  const categorize = (name) => {
    const n = name.toLowerCase();
    if(/chicken|beef|turkey|salmon|tuna|shrimp|pork|steak|cod|tilapia|ground|egg|tofu|tempeh|whey|protein powder|bison|lamb|crab|lobster/.test(n)) return "Protein & Meat";
    if(/spinach|kale|lettuce|tomato|pepper|broccoli|onion|garlic|potato|avocado|banana|apple|berr|lemon|lime|cucumber|zucchini|mushroom|carrot|celery|herb|cilantro|parsley|dill|ginger|mango|peach|pear|grape|orange|asparagus|cauliflower|arugula/.test(n)) return "Produce";
    if(/milk|yogurt|cheese|butter|cream|cottage|feta|mozzarella|parmesan|sour cream|ricotta|cheddar/.test(n)) return "Dairy";
    if(/rice|oat|bread|pasta|quinoa|flour|tortilla|granola|cereal|wrap|bagel|bean|lentil|chickpea|almond butter|peanut butter|oil|sauce|vinegar|soy|honey|maple|nut|seed|chia|flax|walnuts|almonds/.test(n)) return "Grains & Pantry";
    return "Other";
  };

  const parsePlanItems = () => {
    const dayA = weekPlans[0] || []; // A: Mon/Wed/Fri/Sun = 4×
    const dayB = weekPlans[1] || []; // B: Tue/Thu/Sat = 3×
    const combined = {};

    const absorb = (meals, mult) => {
      meals.forEach(meal => {
        (meal.ingredients||[]).forEach(ing => {
          const key = ing.name.toLowerCase().trim()+"|"+ing.unit.toLowerCase().trim();
          if(combined[key]){
            combined[key].qty += (parseFloat(ing.qty)||0)*mult;
          } else {
            combined[key] = {
              id: key,
              name: ing.name,
              qty: (parseFloat(ing.qty)||0)*mult,
              unit: ing.unit,
              category: categorize(ing.name),
            };
          }
        });
      });
    };

    absorb(dayA, 4);
    absorb(dayB, 3);

    // Group by category
    const catOrder = ["Protein & Meat","Produce","Dairy","Grains & Pantry","Other"];
    const groups = {};
    Object.values(combined).forEach(it=>{
      if(!groups[it.category]) groups[it.category]=[];
      groups[it.category].push(it);
    });

    return catOrder.filter(c=>groups[c]?.length>0).map(c=>({name:c,items:groups[c]}));
  };

  const hasPlan = (weekPlans[0]?.length>0)||(weekPlans[1]?.length>0);
  const planCategories = hasPlan ? parsePlanItems() : [];
  const allPlanItems = planCategories.flatMap(c=>c.items);
  const planCheckedCount = Object.values(planChecked).filter(Boolean).length;

  async function handleSharePlanList() {
    const lines = ["🛒 Macra Weekly Grocery List\n"];
    planCategories.forEach(cat => {
      lines.push(`— ${cat.name} —`);
      cat.items.forEach(it => {
        const q = Number.isInteger(it.qty) ? it.qty : Math.round(it.qty*10)/10;
        lines.push(`• ${it.name} — ${q} ${it.unit}`);
      });
      lines.push("");
    });
    const text = lines.join("\n").trim();
    if (navigator.share) {
      try { await navigator.share({ title: "Macra Grocery List", text }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(text);
      alert("Grocery list copied to clipboard!");
    } catch {
      alert("Could not share — please copy manually.");
    }
  }

  const TabBtn = ({k,label,badge}) => (
    <button onClick={()=>setActiveTab(k)} style={{flex:1,padding:"10px 8px",borderRadius:8,border:"none",background:activeTab===k?T.acc:"transparent",color:activeTab===k?T.bg:T.txM,fontSize:13,fontWeight:700,cursor:"pointer",transition:"all 0.2s",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
      {label}
      {badge && <span style={{fontSize:8,fontWeight:700,color:activeTab===k?T.bg:T.acc,background:activeTab===k?"rgba(0,0,0,0.15)":T.accM,padding:"2px 5px",borderRadius:4}}>{badge}</span>}
    </button>
  );

  const CheckRow = ({id,name,qty,unit,done,onToggle,onEdit,onDelete,fmtQty}) => (
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",marginBottom:4,background:done?"transparent":T.sf,borderRadius:10,border:`1px solid ${done?"transparent":T.bd}`,transition:"all 0.2s",opacity:done?0.5:1}}>
      <div onClick={onToggle} style={{width:20,height:20,borderRadius:6,flexShrink:0,border:done?`1.5px solid ${T.ok}`:`1.5px solid ${T.bd}`,background:done?T.ok:"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s",cursor:"pointer"}}>
        {done&&<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={T.bg} strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
      </div>
      <p style={{flex:1,fontSize:14,fontWeight:500,color:T.tx,margin:0,textDecoration:done?"line-through":"none"}}>{name}</p>
      <span style={{fontSize:12,color:T.txM,fontFamily:T.mono,flexShrink:0}}>{fmtQty||`${qty} ${unit}`}</span>
      {onEdit && <button onClick={onEdit} style={{background:"none",border:"none",color:T.txM,cursor:"pointer",padding:"2px 4px",fontSize:13}}>✎</button>}
      {onDelete && <button onClick={onDelete} style={{background:"none",border:"none",color:"rgba(239,68,68,0.6)",cursor:"pointer",padding:"2px 4px",fontSize:14}}>×</button>}
    </div>
  );

  return <div style={{padding:"0 20px 24px"}}>
    <h1 style={{fontSize:26,fontWeight:700,color:T.tx,margin:"4px 0 16px",letterSpacing:"-0.02em"}}>List</h1>

    {/* Tabs */}
    <Card data-tour="grocery-list" style={{display:"flex",padding:4,marginBottom:20}}>
      <TabBtn k="planlist" label="Meal Plan List" badge="PRO"/>
      <TabBtn k="mylist" label="My List"/>
    </Card>

    {/* ── MEAL PLAN LIST (PRO) ── */}
    {activeTab==="planlist" && <>
      {!isPro ? (
        <div>
          <Card style={{padding:28,background:T.accG,border:`1px solid ${T.accM}`,textAlign:"center",marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:12}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              <span style={{fontSize:10,fontWeight:700,color:T.acc,letterSpacing:"0.12em"}}>PRO FEATURE</span>
            </div>
            <h3 style={{fontSize:20,fontWeight:700,color:T.tx,margin:"0 0 8px"}}>Smart Meal Plan List</h3>
            <p style={{fontSize:13,color:T.tx2,margin:"0 0 6px",lineHeight:1.5}}>Auto-generated from your A/B meal plan. Ingredients are multiplied by days used and organized by category.</p>
            <p style={{fontSize:12,color:T.txM,margin:"0 0 20px"}}>Day A × 4 days · Day B × 3 days · All deduplicated</p>
            <button onClick={onUpgrade} style={{padding:"14px 36px",borderRadius:T.r,border:"none",background:T.acc,color:T.bg,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:T.font,marginBottom:8}}>
              Upgrade to Macra Pro
            </button>
          </Card>
          <div style={{opacity:0.18,filter:"blur(4px)",pointerEvents:"none"}}>
            {["Protein & Meat","Produce","Grains & Pantry"].map(c=><div key={c} style={{marginBottom:14}}>
              <span style={{fontSize:11,fontWeight:600,color:T.acc,letterSpacing:"0.1em"}}>{c.toUpperCase()}</span>
              {[1,2,3].map(i=><div key={i} style={{padding:"11px 14px",marginTop:5,background:T.sf,borderRadius:10,border:`1px solid ${T.bd}`,display:"flex",justifyContent:"space-between",gap:12}}>
                <div style={{height:13,width:"60%",background:T.bd,borderRadius:3}}/>
                <div style={{height:13,width:50,background:T.bd,borderRadius:3}}/>
              </div>)}
            </div>)}
          </div>
        </div>
      ) : !hasPlan ? (
        <Card style={{padding:"32px 20px",textAlign:"center"}}>
          <span style={{fontSize:32,display:"block",marginBottom:12}}>📋</span>
          <h3 style={{fontSize:16,fontWeight:600,color:T.tx,margin:"0 0 8px"}}>No meal plan yet</h3>
          <p style={{fontSize:13,color:T.txM,margin:0,lineHeight:1.5}}>Generate your AI meal plan first, then your weekly grocery list will appear here automatically.</p>
        </Card>
      ) : (
        <>
          <Card style={{padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:12,color:T.tx2,fontWeight:500}}>{planCheckedCount} of {allPlanItems.length} items</span>
                <span style={{fontSize:12,color:T.acc,fontFamily:T.mono,fontWeight:600}}>{allPlanItems.length>0?Math.round((planCheckedCount/allPlanItems.length)*100):0}%</span>
              </div>
              <div style={{height:4,borderRadius:2,background:T.bd}}>
                <div style={{height:"100%",borderRadius:2,background:T.acc,width:`${allPlanItems.length>0?(planCheckedCount/allPlanItems.length)*100:0}%`,transition:"width 0.3s"}}/>
              </div>
            </div>
          </Card>
          <Card style={{padding:"8px 14px",marginBottom:16,background:T.accG,border:`1px solid ${T.accM}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            <p style={{fontSize:11,color:T.tx2,margin:0}}>✦ Day A × 4 days + Day B × 3 days · quantities combined and deduplicated</p>
            <button onClick={handleSharePlanList} style={{flexShrink:0,padding:"6px 12px",borderRadius:8,border:`1px solid ${T.acc}`,background:"transparent",color:T.acc,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:T.font,display:"flex",alignItems:"center",gap:5}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              Share
            </button>
          </Card>
          {planCategories.map(cat=>{
            const catDone = cat.items.filter(it=>planChecked[it.id]).length;
            return <div key={cat.name} style={{marginBottom:20}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontSize:11,fontWeight:600,color:catDone===cat.items.length?T.ok:T.acc,letterSpacing:"0.1em",textTransform:"uppercase"}}>{cat.name}</span>
                <span style={{fontSize:11,color:T.txM,fontFamily:T.mono}}>{catDone}/{cat.items.length}</span>
              </div>
              {cat.items.map(it=>{
                const done=!!planChecked[it.id];
                const dispQty = Number.isInteger(it.qty) ? it.qty : Math.round(it.qty*10)/10;
                return <CheckRow key={it.id} id={it.id} name={it.name} fmtQty={`${dispQty} ${it.unit}`} done={done}
                  onToggle={()=>setPlanChecked(p=>({...p,[it.id]:!p[it.id]}))}
                />;
              })}
            </div>;
          })}
        </>
      )}
    </>}

    {/* ── MY LIST (FREE) ── */}
    {activeTab==="mylist" && <>
      {/* Add item form */}
      {!showAdd ? (
        <button onClick={()=>setShowAdd(true)} style={{width:"100%",padding:14,borderRadius:T.r,border:`1px dashed ${T.bd}`,background:"transparent",color:T.acc,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:T.font,marginBottom:20,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Add Item
        </button>
      ) : (
        <Card style={{padding:"16px",marginBottom:20,border:`1px solid ${T.acc}30`}}>
          <p style={{fontSize:13,fontWeight:600,color:T.acc,margin:"0 0 12px"}}>New Item</p>
          <Lbl>Item Name</Lbl>
          <input value={addForm.name} onChange={e=>setAddForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Chicken breast" style={{...inputStyle,marginTop:6,marginBottom:12}} onKeyDown={e=>e.key==="Enter"&&addMyItem()}/>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <div style={{flex:"0 0 80px"}}>
              <Lbl>Qty</Lbl>
              <input value={addForm.qty} onChange={e=>setAddForm(p=>({...p,qty:e.target.value}))} type="number" style={{...inputStyle,marginTop:6,textAlign:"center"}}/>
            </div>
            <div style={{flex:1}}>
              <Lbl>Unit</Lbl>
              <select value={addForm.unit} onChange={e=>setAddForm(p=>({...p,unit:e.target.value}))} style={{...inputStyle,marginTop:6,appearance:"none"}}>
                {myListUnits.map(u=><option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div style={{marginBottom:14}}>
            <Lbl>Category</Lbl>
            <select value={addForm.category} onChange={e=>setAddForm(p=>({...p,category:e.target.value}))} style={{...inputStyle,marginTop:6,appearance:"none"}}>
              {myListCategories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setShowAdd(false);setAddForm({name:"",qty:"1",unit:"lbs",category:"Other"})}} style={{flex:1,padding:11,borderRadius:10,border:`1px solid ${T.bd}`,background:"transparent",color:T.tx2,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:T.font}}>Cancel</button>
            <button onClick={addMyItem} style={{flex:1,padding:11,borderRadius:10,border:"none",background:T.acc,color:T.bg,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:T.font,opacity:addForm.name?1:0.4,pointerEvents:addForm.name?"auto":"none"}}>Add</button>
          </div>
        </Card>
      )}

      {/* My items list */}
      {myItems.length === 0 && !showAdd && <Card style={{padding:"32px 20px",textAlign:"center"}}>
        <span style={{fontSize:32,display:"block",marginBottom:12}}>🛒</span>
        <h3 style={{fontSize:16,fontWeight:600,color:T.tx,margin:"0 0 8px"}}>Your list is empty</h3>
        <p style={{fontSize:13,color:T.txM,margin:0}}>Tap "Add Item" above to start building your grocery list.</p>
      </Card>}

      {/* Summary */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <Lbl>My List{myItems.length>0?` (${myItems.length})`:""}</Lbl>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button data-tour="share-list" disabled={myItems.length===0} onClick={async()=>{const text=myItems.map(it=>`• ${it.qty} ${it.unit} ${it.name}`).join("\n");try{await navigator.share({title:"My Grocery List",text});}catch{try{await navigator.clipboard.writeText(text);}catch{}}}} style={{background:"none",border:"none",color:T.acc,fontSize:12,cursor:myItems.length===0?"default":"pointer",fontFamily:T.font,fontWeight:500,display:"flex",alignItems:"center",gap:3,padding:0,opacity:myItems.length===0?0.35:1}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            Share
          </button>
          {myItems.some(x=>x.checked) && <button onClick={async()=>await persistMyList(myItems.filter(x=>!x.checked))} style={{background:"none",border:"none",color:"rgba(239,68,68,0.7)",fontSize:12,cursor:"pointer",fontFamily:T.font,fontWeight:500}}>Clear checked</button>}
        </div>
      </div>

      {/* Items grouped by category */}
      {myListCategories.filter(cat=>myItems.some(x=>(x.category||"Other")===cat)).map(cat=>(
        <div key={cat} style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:11,fontWeight:600,color:T.acc,letterSpacing:"0.1em",textTransform:"uppercase"}}>{cat}</span>
            <span style={{fontSize:11,color:T.txM,fontFamily:T.mono}}>{myItems.filter(x=>(x.category||"Other")===cat&&x.checked).length}/{myItems.filter(x=>(x.category||"Other")===cat).length}</span>
          </div>
          {myItems.filter(x=>(x.category||"Other")===cat).map(item=>{
        if(editingId===item.id) return (
          <Card key={item.id} style={{padding:"14px",marginBottom:6,border:`1px solid ${T.acc}40`}}>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <input value={editForm.name} onChange={e=>setEditForm(p=>({...p,name:e.target.value}))} style={{...inputStyle,flex:2}} onKeyDown={e=>e.key==="Enter"&&saveEdit()}/>
              <input value={editForm.qty} onChange={e=>setEditForm(p=>({...p,qty:e.target.value}))} type="number" style={{...inputStyle,flex:"0 0 60px",textAlign:"center"}}/>
              <select value={editForm.unit} onChange={e=>setEditForm(p=>({...p,unit:e.target.value}))} style={{...inputStyle,flex:"0 0 80px",appearance:"none"}}>
                {myListUnits.map(u=><option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <select value={editForm.category} onChange={e=>setEditForm(p=>({...p,category:e.target.value}))} style={{...inputStyle,marginBottom:8,appearance:"none"}}>
              {myListCategories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setEditingId(null)} style={{flex:1,padding:9,borderRadius:8,border:`1px solid ${T.bd}`,background:"transparent",color:T.tx2,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:T.font}}>Cancel</button>
              <button onClick={saveEdit} style={{flex:1,padding:9,borderRadius:8,border:"none",background:T.acc,color:T.bg,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:T.font}}>Save</button>
            </div>
          </Card>
        );
        return <CheckRow key={item.id} id={item.id} name={item.name} qty={item.qty} unit={item.unit} done={!!item.checked}
          onToggle={()=>toggleMyItem(item.id)}
          onEdit={()=>startEdit(item)}
          onDelete={()=>deleteMyItem(item.id)}
        />;
      })}
        </div>
      ))}
    </>}
  </div>;
};

// ─── PROFILE ───────────────────────────────────────────────────
const CUISINE_LIST = [
  "Mediterranean","Japanese","Mexican","Indian","Middle Eastern","American Southern",
  "Thai","Korean","Greek","West African","German","Italian","French","Brazilian",
  "Caribbean","Ethiopian","Vietnamese","Chinese","Spanish","American BBQ",
];
const DIET_OPTIONS = ["None","Vegan","Vegetarian","Keto","Carnivore","Gluten-Free","Dairy-Free","Halal","Kosher","Paleo","High Protein","High Fiber"];

const ProfileScreen = ({profile, userId, userEmail, isPro, onProfileUpdate, onSignOut, onUpgrade, onSetIsPro}) => {
  const m = profile?.macros;
  const isAdmin = userEmail === ADMIN_EMAIL;
  // view: null | "diet" | "foods" | "cuisines" | "name" | "sex" | "age" | "weight" | "height" | "activity" | "goal" | "macrosplit"
  const [view, setView] = useState(null);
  const [savedToast, setSavedToast] = useState(false);
  const [adminToast, setAdminToast] = useState(null);
  // Drafts for preference sub-views
  const [draftDiet, setDraftDiet] = useState([]);
  const [draftFoods, setDraftFoods] = useState([]);
  const [draftCuisines, setDraftCuisines] = useState([]);
  const [foodInput, setFoodInput] = useState("");
  // Drafts for stat sub-views
  const [draftName, setDraftName] = useState("");
  const [draftSex, setDraftSex] = useState("male");
  const [draftAge, setDraftAge] = useState(28);
  const [draftWeight, setDraftWeight] = useState(185);
  const [draftHeightFt, setDraftHeightFt] = useState(5);
  const [draftHeightIn, setDraftHeightIn] = useState(11);
  const [draftActivity, setDraftActivity] = useState("moderate");
  const [draftGoal, setDraftGoal] = useState("maintain");
  const [draftBudget, setDraftBudget] = useState("");
  const [draftPickiness, setDraftPickiness] = useState(3);
  const [draftTracking, setDraftTracking] = useState('ai_plan');
  // Drafts for macro split editor
  const [draftProPct, setDraftProPct] = useState(37);
  const [draftCarbPct, setDraftCarbPct] = useState(32);
  const [draftFatPct, setDraftFatPct] = useState(31);
  const [draftIsCustom, setDraftIsCustom] = useState(false);

  const showSaved = () => { setSavedToast(true); setTimeout(()=>setSavedToast(false),2000); };
  const showAdminToast = (msg) => { setAdminToast(msg); setTimeout(()=>setAdminToast(null),2500); };

  const handleToggleProMode = async () => {
    const newIsPro = !isPro;
    try {
      const { error } = await supabase.from("profiles").update({ is_pro: newIsPro }).eq("id", userId);
      if (error) throw error;
      await onSetIsPro(newIsPro);
      showAdminToast(`Switched to ${newIsPro ? "PRO" : "FREE"} tier — reloading…`);
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      console.error("[admin] toggle pro error:", err);
      showAdminToast("Toggle failed — check console");
    }
  };

  const handleResetGenerations = async () => {
    try {
      const { error } = await supabase.from("generation_log").delete().eq("user_id", userId);
      if (error) throw error;
      showAdminToast("Generation log cleared — 3 intro gens restored");
    } catch (err) {
      console.error("[admin] reset generations error:", err);
      showAdminToast("Reset failed — check console");
    }
  };

  const saveField = async (updates, returnTo=null) => {
    const merged = {...profile, ...updates};
    const recalcKeys = ["sex","age","weightLbs","heightFt","heightIn","activity","goal"];
    const needsRecalc = Object.keys(updates).some(k => recalcKeys.includes(k));
    const updated = needsRecalc ? {...merged, macros: calcMacros(merged)} : merged;
    onProfileUpdate(updated);
    if(userId) await saveProfile(userId, updated);
    showSaved();
    setView(returnTo);
  };

  const enterView = (v) => {
    if(v==="diet") setDraftDiet(profile?.diet||[]);
    if(v==="foods"){ setDraftFoods(profile?.dislikedFoods||[]); setFoodInput(""); }
    if(v==="cuisines") setDraftCuisines(profile?.dislikedCuisines||[]);
    if(v==="name") setDraftName(profile?.name||"");
    if(v==="sex") setDraftSex(profile?.sex||"male");
    if(v==="age") setDraftAge(profile?.age||28);
    if(v==="weight") setDraftWeight(profile?.weightLbs||185);
    if(v==="height"){ setDraftHeightFt(profile?.heightFt||5); setDraftHeightIn(profile?.heightIn||11); }
    if(v==="activity") setDraftActivity(profile?.activity||"moderate");
    if(v==="goal") setDraftGoal(profile?.goal||"maintain");
    if(v==="budget"){
      const b = profile?.weeklyBudget;
      setDraftBudget(b && b !== "null" && Number(b) > 0 ? String(b) : "");
    }
    if(v==="pickiness") setDraftPickiness(profile?.pickinessLevel ?? 3);
    if(v==="tracking") setDraftTracking(profile?.trackingMode||'ai_plan');
    if(v==="macrosplit") {
      if(profile?.customMacroSplit && profile?.customProteinPct != null) {
        setDraftProPct(profile.customProteinPct);
        setDraftCarbPct(profile.customCarbsPct);
        setDraftFatPct(profile.customFatPct);
        setDraftIsCustom(true);
      } else if(m) {
        const rec = calcMacros(profile);
        const recPro = Math.round((rec.proteinG * 4 / rec.target) * 100);
        const recFat = Math.round((rec.fatG * 9 / rec.target) * 100);
        setDraftProPct(recPro); setDraftCarbPct(100 - recPro - recFat); setDraftFatPct(recFat);
        setDraftIsCustom(false);
      } else {
        setDraftProPct(37); setDraftCarbPct(32); setDraftFatPct(31); setDraftIsCustom(false);
      }
    }
    setView(v);
  };

  const dietLabel = () => {
    const d = (profile?.diet||[]).filter(x=>x!=="No Restrictions"&&x!=="None");
    return d.length > 0 ? d.join(", ") : "No restrictions";
  };

  // Declared early so view==="stats" sub-screen can access them
  const actLabel = {sedentary:"Sedentary",light:"Light",moderate:"Moderate",active:"Active",very_active:"Very Active"};
  const goalLabel = {cut:"Cut",maintain:"Maintain",lean_bulk:"Lean Bulk",bulk:"Bulk"};
  const statRows = [
    {l:"Name",     v: profile?.name||"—",                                          view:"name"},
    {l:"Sex",      v: profile?.sex==="female"?"Female":"Male",                     view:"sex"},
    {l:"Age",      v: `${profile?.age||"—"} yrs`,                                 view:"age"},
    {l:"Weight",   v: `${profile?.weightLbs||"—"} lbs`,                           view:"weight"},
    {l:"Height",   v: `${profile?.heightFt??'—'}'${profile?.heightIn??'—'}"`,     view:"height"},
    {l:"Activity", v: actLabel[profile?.activity]||"—",                            view:"activity"},
    {l:"Goal",     v: goalLabel[profile?.goal]||"—",                               view:"goal"},
  ];
  const statsSummary = [
    profile?.age ? `${profile.age} yrs` : null,
    profile?.weightLbs ? `${profile.weightLbs} lbs` : null,
    (profile?.heightFt != null) ? `${profile.heightFt}'${profile.heightIn??0}"` : null,
    actLabel[profile?.activity] || null,
  ].filter(Boolean).join(" · ") || "Tap to update";

  // Current macro split percentages (from saved custom or derived from current macros)
  const splitPct = (() => {
    if(!m) return {pro:37, carb:32, fat:31};
    if(profile?.customMacroSplit && profile?.customProteinPct != null)
      return {pro:profile.customProteinPct, carb:profile.customCarbsPct, fat:profile.customFatPct};
    const pro = Math.round((m.proteinG * 4 / m.target) * 100);
    const fat = Math.round((m.fatG * 9 / m.target) * 100);
    return {pro, carb: 100 - pro - fat, fat};
  })();

  const Chevron = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.txM} strokeWidth="1.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>;
  const SaveBtn = ({onClick,label="Save"}) => <button onClick={onClick} style={{width:"100%",padding:14,borderRadius:T.r,border:"none",background:T.acc,color:T.bg,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:T.font,marginTop:24}}>{label}</button>;
  // Reusable single-select option button
  const SelBtn = ({label,desc,selected,onClick}) => (
    <button onClick={onClick} style={{padding:"14px 16px",borderRadius:T.r,border:`1.5px solid ${selected?T.acc:T.bd}`,background:selected?T.accM:"transparent",color:selected?T.acc:T.tx,fontSize:14,fontWeight:selected?600:500,cursor:"pointer",fontFamily:T.font,textAlign:"left",display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",transition:"all 0.15s"}}>
      <div>
        <span>{label}</span>
        {desc&&<p style={{fontSize:12,color:selected?T.acc:T.txM,margin:"2px 0 0",fontWeight:400}}>{desc}</p>}
      </div>
      {selected&&<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
    </button>
  );

  // ── Diet sub-view ──
  if(view==="diet"){
    const toggleDiet = (d) => {
      if(d==="None"){ setDraftDiet([]); return; }
      const already = draftDiet.includes(d);
      if(already){ setDraftDiet(draftDiet.filter(x=>x!==d)); }
      else if(draftDiet.length < 3){ setDraftDiet([...draftDiet, d]); }
    };
    return <div style={{padding:"0 20px 24px"}}>
      <BackBtn onBack={()=>setView(null)}/>
      <h1 style={{fontSize:22,fontWeight:700,color:T.tx,margin:"0 0 6px",letterSpacing:"-0.02em"}}>Dietary Preferences</h1>
      <p style={{fontSize:13,color:T.txM,margin:"0 0 6px"}}>Select up to 3. The AI enforces all as hard rules.</p>
      <p style={{fontSize:11,color:T.txM,margin:"0 0 20px"}}>{draftDiet.length===0?"None selected":`${draftDiet.length} selected`}{draftDiet.length===3?" (max)":""}</p>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {DIET_OPTIONS.map(d=>{
          const isNone = d==="None";
          const sel = isNone ? draftDiet.length===0 : draftDiet.includes(d);
          const disabled = !sel && !isNone && draftDiet.length>=3;
          return <button key={d} onClick={()=>toggleDiet(d)} disabled={disabled} style={{padding:"14px 16px",borderRadius:T.r,border:`1.5px solid ${sel?T.acc:T.bd}`,background:sel?T.accM:"transparent",color:disabled?T.txM:sel?T.acc:T.tx,fontSize:14,fontWeight:sel?600:500,cursor:disabled?"default":"pointer",fontFamily:T.font,textAlign:"left",display:"flex",alignItems:"center",justifyContent:"space-between",transition:"all 0.15s",opacity:disabled?0.4:1}}>
            {d}
            {sel&&!isNone&&<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
          </button>;
        })}
      </div>
      <SaveBtn onClick={()=>saveField({diet:draftDiet})} label="Save Preferences"/>
    </div>;
  }

  // ── Foods sub-view ──
  if(view==="foods"){
    const addFood = () => {
      const t=foodInput.trim();
      if(!t||draftFoods.includes(t.toLowerCase())) return;
      setDraftFoods(p=>[...p,t]);
      setFoodInput("");
    };
    return <div style={{padding:"0 20px 24px"}}>
      <BackBtn onBack={()=>setView(null)}/>
      <h1 style={{fontSize:22,fontWeight:700,color:T.tx,margin:"0 0 6px",letterSpacing:"-0.02em"}}>Foods I Don't Eat</h1>
      <p style={{fontSize:13,color:T.txM,margin:"0 0 20px"}}>The AI will never use these as ingredients in any meal.</p>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <input value={foodInput} onChange={e=>setFoodInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addFood();}} placeholder="e.g. mushrooms, cilantro…" style={{flex:1,padding:"12px 14px",borderRadius:T.r,border:`1px solid ${T.bd}`,background:T.sf,color:T.tx,fontSize:14,fontFamily:T.font,outline:"none"}}/>
        <button onClick={addFood} style={{padding:"12px 20px",borderRadius:T.r,border:"none",background:T.acc,color:T.bg,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:T.font}}>Add</button>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,minHeight:40,marginBottom:24}}>
        {draftFoods.length===0 && <p style={{fontSize:13,color:T.txM,margin:0}}>No foods excluded yet.</p>}
        {draftFoods.map(f=><div key={f} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",borderRadius:20,background:T.sf,border:`1px solid ${T.bd}`}}>
          <span style={{fontSize:13,color:T.tx}}>{f}</span>
          <button onClick={()=>setDraftFoods(p=>p.filter(x=>x!==f))} style={{background:"none",border:"none",cursor:"pointer",color:T.txM,fontSize:15,lineHeight:1,padding:0,marginLeft:2}}>✕</button>
        </div>)}
      </div>
      <SaveBtn onClick={()=>saveField({dislikedFoods:draftFoods})}/>
    </div>;
  }

  // ── Cuisines sub-view ──
  if(view==="cuisines"){
    return <div style={{padding:"0 20px 24px"}}>
      <BackBtn onBack={()=>setView(null)}/>
      <h1 style={{fontSize:22,fontWeight:700,color:T.tx,margin:"0 0 6px",letterSpacing:"-0.02em"}}>Cuisines I Don't Want</h1>
      <p style={{fontSize:13,color:T.txM,margin:"0 0 20px"}}>Tapped cuisines are excluded. The AI will skip them when picking a theme.</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        {CUISINE_LIST.map(c=>{
          const excl=draftCuisines.includes(c);
          return <button key={c} onClick={()=>setDraftCuisines(p=>excl?p.filter(x=>x!==c):[...p,c])} style={{padding:"14px 10px",borderRadius:T.r,border:`1.5px solid ${excl?"rgba(239,68,68,0.5)":T.bd}`,background:excl?"rgba(239,68,68,0.08)":"transparent",color:excl?"#EF4444":T.tx2,fontSize:13,fontWeight:excl?600:500,cursor:"pointer",fontFamily:T.font,textAlign:"center",transition:"all 0.15s"}}>
            {excl?"✕ ":""}{c}
          </button>;
        })}
      </div>
      <p style={{fontSize:11,color:T.txM,textAlign:"center",margin:"0 0 4px"}}>{draftCuisines.length===0?"All cuisines enabled":`${draftCuisines.length} cuisine${draftCuisines.length!==1?"s":""} excluded`}</p>
      <SaveBtn onClick={()=>saveField({dislikedCuisines:draftCuisines})}/>
    </div>;
  }

  // ── Macro Split sub-view ──
  if(view==="macrosplit") {
    // Lock screen for free users
    if(!isPro) return <div style={{padding:"0 20px 24px"}}>
      <BackBtn onBack={()=>setView(null)}/>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',paddingTop:40,gap:16}}>
        <div style={{fontSize:48}}>🔒</div>
        <h2 style={{fontSize:20,fontWeight:700,color:T.tx,margin:0,letterSpacing:'-0.02em'}}>Custom Macro Split</h2>
        <p style={{fontSize:14,color:T.tx2,margin:0,lineHeight:1.6,maxWidth:280}}>Upgrade to Pro to customize your protein, carbs, and fat targets.</p>
        <button onClick={onUpgrade} style={{marginTop:8,padding:'14px 32px',borderRadius:T.r,border:'none',background:T.acc,color:T.bg,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>
          Upgrade to Pro
        </button>
      </div>
    </div>;

    const cals = m?.target || 2000;
    const total = draftProPct + draftCarbPct + draftFatPct;
    const valid = total === 100;
    const proG  = Math.round((cals * draftProPct  / 100) / 4);
    const carbG = Math.round((cals * draftCarbPct / 100) / 4);
    const fatG  = Math.round((cals * draftFatPct  / 100) / 9);

    // Recommended percentages derived from calcMacros()
    const rec = m ? calcMacros(profile) : null;
    const recPro = rec ? Math.round((rec.proteinG * 4 / rec.target) * 100) : 37;
    const recFat = rec ? Math.round((rec.fatG * 9 / rec.target) * 100) : 31;
    const recCarb = 100 - recPro - recFat;

    const applyPreset = (pro, carb, fat, isCustom) => {
      setDraftProPct(pro); setDraftCarbPct(carb); setDraftFatPct(fat); setDraftIsCustom(isCustom);
    };

    const handleSaveSplit = async () => {
      let updates;
      if(!draftIsCustom) {
        const recalced = calcMacros(profile);
        updates = {
          macros: {...m, proteinG:recalced.proteinG, carbG:recalced.carbG, fatG:recalced.fatG},
          customProteinPct:null, customCarbsPct:null, customFatPct:null, customMacroSplit:false,
        };
      } else {
        updates = {
          macros: {...m, proteinG:proG, carbG, fatG},
          customProteinPct:draftProPct, customCarbsPct:draftCarbPct, customFatPct:draftFatPct, customMacroSplit:true,
        };
      }
      await saveField(updates);
    };

    const PRESETS = [
      {label:'Recommended', pro:recPro, carb:recCarb, fat:recFat, custom:false},
      {label:'High Protein', pro:45, carb:30, fat:25, custom:true},
      {label:'Balanced',     pro:33, carb:34, fat:33, custom:true},
    ];

    const sliders = [
      {label:'Protein', pct:draftProPct, setPct:v=>{setDraftProPct(v);setDraftIsCustom(true);}, g:proG,  c:T.pro},
      {label:'Carbs',   pct:draftCarbPct,setPct:v=>{setDraftCarbPct(v);setDraftIsCustom(true);},g:carbG, c:T.carb},
      {label:'Fat',     pct:draftFatPct, setPct:v=>{setDraftFatPct(v);setDraftIsCustom(true);}, g:fatG,  c:T.fat},
    ];

    // Adjust one macro and proportionally redistribute the remaining % to the other two
    const handlePctInput = (changedIdx, rawVal) => {
      const v = Math.max(10, Math.min(65, parseInt(rawVal) || 10));
      const all = [draftProPct, draftCarbPct, draftFatPct];
      const otherIdxs = [0,1,2].filter(i => i !== changedIdx);
      const othersTotal = otherIdxs.reduce((s, i) => s + all[i], 0);
      all[changedIdx] = v;
      if (othersTotal > 0) {
        const [ia, ib] = otherIdxs;
        all[ia] = Math.max(10, Math.round(all[ia] / othersTotal * (100 - v)));
        all[ib] = Math.max(10, 100 - v - all[ia]);
      }
      setDraftProPct(all[0]); setDraftCarbPct(all[1]); setDraftFatPct(all[2]);
      setDraftIsCustom(true);
    };

    return <div style={{padding:"0 20px 40px"}}>
      <style>{`
        input[type=range]{-webkit-appearance:none;appearance:none;width:100%;background:transparent;cursor:pointer;margin:0;user-select:none;-webkit-user-select:none;touch-action:pan-y}
        input[type=range]::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:${T.bd}}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;margin-top:-9px}
        input[type=range]::-moz-range-track{height:4px;border-radius:2px;background:${T.bd}}
        input[type=range]::-moz-range-thumb{width:22px;height:22px;border-radius:50%;border:none}
        .macro-pct-input{width:52px;background:transparent;border:none;border-bottom:1.5px solid;text-align:right;font-size:18px;font-weight:700;font-family:${T.mono};outline:none;padding:0;-moz-appearance:textfield}
        .macro-pct-input::-webkit-inner-spin-button,.macro-pct-input::-webkit-outer-spin-button{-webkit-appearance:none}
      `}</style>
      <BackBtn onBack={()=>setView(null)}/>
      <h1 style={{fontSize:22,fontWeight:700,color:T.tx,margin:"0 0 4px",letterSpacing:"-0.02em"}}>Macro Split</h1>
      <p style={{fontSize:13,color:T.tx2,margin:"0 0 4px"}}>Based on <span style={{color:T.acc,fontWeight:600,fontFamily:T.mono}}>{cals.toLocaleString()} cal</span> daily target</p>
      <p style={{fontSize:11,color:T.txM,margin:"0 0 24px"}}>Calories stay fixed — adjust how they are distributed between macros</p>

      {/* Sliders */}
      <Card style={{padding:'16px 20px',marginBottom:16,overflow:'hidden',userSelect:'none',WebkitUserSelect:'none'}}>
        {sliders.map((s,i)=>(
          <div key={s.label} style={{marginBottom:i<sliders.length-1?24:0}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
              <span style={{fontSize:13,fontWeight:600,color:T.tx}}>{s.label}</span>
              <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                {/* Editable % input — tap to type a value, others adjust proportionally */}
                <input type="number" className="macro-pct-input" min={10} max={65} value={s.pct}
                  style={{color:s.c,borderBottomColor:s.c}}
                  onChange={e=>handlePctInput(i, e.target.value)}/>
                <span style={{fontSize:14,fontWeight:700,color:s.c,fontFamily:T.mono}}>%</span>
                <span style={{fontSize:12,color:T.txM,fontFamily:T.mono,minWidth:40}}>{s.g}g</span>
              </div>
            </div>
            <input type="range" min={10} max={65} value={s.pct}
              onChange={e=>s.setPct(Number(e.target.value))}
              style={{'--thumb-color':s.c}}/>
            <style>{`input[type=range]::-webkit-slider-thumb{background:${s.c}} input[type=range]::-moz-range-thumb{background:${s.c}}`}</style>
          </div>
        ))}
      </Card>

      {/* Total indicator */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:16,padding:'10px',borderRadius:T.r,background:valid?'rgba(107,203,119,0.08)':'rgba(239,68,68,0.08)',border:`1px solid ${valid?'rgba(107,203,119,0.3)':'rgba(239,68,68,0.3)'}`}}>
        <span style={{fontSize:14,fontWeight:600,color:valid?T.ok:'#EF4444',fontFamily:T.mono}}>Total: {total}%</span>
        {valid && <span style={{fontSize:14,color:T.ok}}>✓</span>}
        {!valid && <span style={{fontSize:11,color:'#EF4444'}}>{total < 100 ? `(${100-total}% remaining)` : `(${total-100}% over)`}</span>}
      </div>

      {/* Preset buttons */}
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        {PRESETS.map(p=>{
          const isActive = draftProPct===p.pro && draftCarbPct===p.carb && draftFatPct===p.fat;
          return <button key={p.label} onClick={()=>applyPreset(p.pro,p.carb,p.fat,p.custom)}
            style={{flex:1,padding:'9px 4px',borderRadius:T.r,border:`1px solid ${isActive?T.acc:T.bd}`,background:isActive?T.accM:'transparent',color:isActive?T.acc:T.tx2,fontSize:11,fontWeight:isActive?700:500,cursor:'pointer',fontFamily:T.font}}>
            {p.label}
          </button>;
        })}
      </div>

      {/* Save */}
      <button onClick={handleSaveSplit} disabled={!valid}
        style={{width:'100%',padding:14,borderRadius:T.r,border:'none',background:valid?T.acc:T.bd,color:valid?T.bg:T.txM,fontSize:14,fontWeight:700,cursor:valid?'pointer':'default',fontFamily:T.font,transition:'all 0.2s'}}>
        Save
      </button>
    </div>;
  }

  // ── Stats sub-screen (lists all 7 editable rows) ──
  if(view==="stats"){
    return <div style={{padding:"0 20px 24px"}}>
      <BackBtn onBack={()=>setView(null)}/>
      <h1 style={{fontSize:22,fontWeight:700,color:T.tx,margin:"0 0 20px",letterSpacing:"-0.02em"}}>Adjust Your Stats</h1>
      <Card style={{overflow:"hidden"}}>
        {statRows.map((s,i)=>(
          <div key={s.l} onClick={()=>enterView(s.view)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 16px",borderBottom:i<statRows.length-1?`1px solid ${T.bd}`:"none",cursor:"pointer"}}>
            <div>
              <Lbl>{s.l}</Lbl>
              <p style={{fontSize:15,fontWeight:600,color:T.tx,margin:"3px 0 0"}}>{s.v}</p>
            </div>
            <Chevron/>
          </div>
        ))}
      </Card>
    </div>;
  }

  // ── Name sub-view ──
  if(view==="name"){
    return <div style={{padding:"0 20px 24px"}}>
      <BackBtn onBack={()=>setView("stats")}/>
      <h1 style={{fontSize:22,fontWeight:700,color:T.tx,margin:"0 0 20px",letterSpacing:"-0.02em"}}>Your Name</h1>
      <Lbl>Name</Lbl>
      <input value={draftName} onChange={e=>setDraftName(e.target.value)} placeholder="Your name" autoFocus style={{width:"100%",padding:"14px 16px",borderRadius:T.r,border:`1px solid ${T.bd}`,background:T.sf,color:T.tx,fontSize:16,fontFamily:T.font,fontWeight:500,outline:"none",boxSizing:"border-box",marginTop:8}}/>
      <SaveBtn onClick={()=>saveField({name:draftName.trim()||profile?.name},"stats")}/>
    </div>;
  }

  // ── Sex sub-view ──
  if(view==="sex"){
    return <div style={{padding:"0 20px 24px"}}>
      <BackBtn onBack={()=>setView("stats")}/>
      <h1 style={{fontSize:22,fontWeight:700,color:T.tx,margin:"0 0 20px",letterSpacing:"-0.02em"}}>Sex</h1>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <SelBtn label="Male" selected={draftSex==="male"} onClick={()=>setDraftSex("male")}/>
        <SelBtn label="Female" selected={draftSex==="female"} onClick={()=>setDraftSex("female")}/>
      </div>
      <SaveBtn onClick={()=>saveField({sex:draftSex},"stats")}/>
    </div>;
  }

  // ── Age sub-view ──
  if(view==="age"){
    return <div style={{padding:"0 20px 24px"}}>
      <BackBtn onBack={()=>setView("stats")}/>
      <h1 style={{fontSize:22,fontWeight:700,color:T.tx,margin:"0 0 20px",letterSpacing:"-0.02em"}}>Age</h1>
      <NumInput label="Age" value={draftAge} onChange={setDraftAge} min={13} max={99} unit="yrs"/>
      <SaveBtn onClick={()=>saveField({age:draftAge},"stats")}/>
    </div>;
  }

  // ── Weight sub-view ──
  if(view==="weight"){
    return <div style={{padding:"0 20px 24px"}}>
      <BackBtn onBack={()=>setView("stats")}/>
      <h1 style={{fontSize:22,fontWeight:700,color:T.tx,margin:"0 0 20px",letterSpacing:"-0.02em"}}>Weight</h1>
      <NumInput label="Weight" value={draftWeight} onChange={setDraftWeight} min={50} max={600} unit="lbs"/>
      <SaveBtn onClick={()=>saveField({weightLbs:draftWeight},"stats")}/>
    </div>;
  }

  // ── Height sub-view ──
  if(view==="height"){
    return <div style={{padding:"0 20px 24px"}}>
      <BackBtn onBack={()=>setView("stats")}/>
      <h1 style={{fontSize:22,fontWeight:700,color:T.tx,margin:"0 0 20px",letterSpacing:"-0.02em"}}>Height</h1>
      <div style={{display:"flex",gap:12}}>
        <NumInput label="Feet" value={draftHeightFt} onChange={setDraftHeightFt} min={3} max={8} unit="ft"/>
        <NumInput label="Inches" value={draftHeightIn} onChange={setDraftHeightIn} min={0} max={11} unit="in"/>
      </div>
      <SaveBtn onClick={()=>saveField({heightFt:draftHeightFt,heightIn:draftHeightIn},"stats")}/>
    </div>;
  }

  // ── Activity sub-view ──
  if(view==="activity"){
    const actOpts = [
      {v:"sedentary",l:"Sedentary",d:"Little or no exercise"},
      {v:"light",l:"Light",d:"1–3 days/week"},
      {v:"moderate",l:"Moderate",d:"3–5 days/week"},
      {v:"active",l:"Active",d:"6–7 days/week"},
      {v:"very_active",l:"Very Active",d:"Twice a day or physical job"},
    ];
    return <div style={{padding:"0 20px 24px"}}>
      <BackBtn onBack={()=>setView("stats")}/>
      <h1 style={{fontSize:22,fontWeight:700,color:T.tx,margin:"0 0 20px",letterSpacing:"-0.02em"}}>Activity Level</h1>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {actOpts.map(o=><SelBtn key={o.v} label={o.l} desc={o.d} selected={draftActivity===o.v} onClick={()=>setDraftActivity(o.v)}/>)}
      </div>
      <SaveBtn onClick={()=>saveField({activity:draftActivity},"stats")}/>
    </div>;
  }

  // ── Goal sub-view ──
  if(view==="goal"){
    const goalOpts = [
      {v:"cut",l:"Cut",d:"Lose fat — 500 cal deficit"},
      {v:"maintain",l:"Maintain",d:"Hold current weight"},
      {v:"lean_bulk",l:"Lean Bulk",d:"+250 cal surplus"},
      {v:"bulk",l:"Bulk",d:"+500 cal surplus"},
    ];
    return <div style={{padding:"0 20px 24px"}}>
      <BackBtn onBack={()=>setView("stats")}/>
      <h1 style={{fontSize:22,fontWeight:700,color:T.tx,margin:"0 0 20px",letterSpacing:"-0.02em"}}>Goal</h1>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {goalOpts.map(o=><SelBtn key={o.v} label={o.l} desc={o.d} selected={draftGoal===o.v} onClick={()=>setDraftGoal(o.v)}/>)}
      </div>
      <SaveBtn onClick={()=>saveField({goal:draftGoal},"stats")}/>
    </div>;
  }

  // ── Budget sub-view ──
  if(view==="budget"){
    return <div style={{padding:"0 20px 24px"}}>
      <BackBtn onBack={()=>setView(null)}/>
      <h1 style={{fontSize:22,fontWeight:700,color:T.tx,margin:"0 0 20px",letterSpacing:"-0.02em"}}>Weekly Grocery Budget</h1>
      <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:8}}>
        <span style={{padding:"14px 0 14px 16px",borderRadius:`${T.r} 0 0 ${T.r}`,border:`1px solid ${T.bd}`,borderRight:"none",background:T.sf,color:T.txM,fontSize:16,fontWeight:600,display:"flex",alignItems:"center"}}>$</span>
        <input type="number" inputMode="numeric" placeholder="e.g. 100" value={draftBudget} onChange={e=>setDraftBudget(e.target.value.replace(/[^0-9]/g,""))} style={{flex:1,padding:"14px 16px",borderRadius:`0 ${T.r} ${T.r} 0`,border:`1px solid ${T.bd}`,background:T.sf,color:T.tx,fontSize:16,fontFamily:T.font,fontWeight:500,outline:"none",boxSizing:"border-box"}}/>
      </div>
      <p style={{fontSize:12,color:T.txM,margin:"0 0 10px",lineHeight:1.6}}>This helps us tailor your meal plans to fit your budget. Without a budget set, suggested meals and ingredients may be more extensive or costly.</p>
      <p style={{fontSize:10,color:T.txM,margin:"0 0 24px",lineHeight:1.6,opacity:0.7}}>Note: Macra cannot guarantee exact budget accuracy. Grocery prices vary by location, store, and season. Budget guidance is approximate and intended as a helpful starting point only.</p>
      <SaveBtn onClick={()=>{
        const val = draftBudget ? parseInt(draftBudget, 10) : null;
        saveField({weeklyBudget: val && val > 0 ? val : null}, null);
      }}/>
      <button onClick={()=>saveField({weeklyBudget:null},null)} style={{width:"100%",padding:12,borderRadius:T.r,border:`1px solid ${T.bd}`,background:"transparent",color:T.tx2,fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:T.font,marginTop:10}}>Clear Budget</button>
    </div>;
  }

  // ── Pickiness sub-view ──
  if(view==="pickiness"){
    const PICKINESS_OPTS = [
      {v:1,l:"Very adventurous",d:"Love trying new cuisines and bold flavors"},
      {v:2,l:"Somewhat adventurous",d:"Enjoy variety and global flavors"},
      {v:3,l:"Balanced",d:"Mix of familiar and new"},
      {v:4,l:"Somewhat picky",d:"Prefer mostly familiar dishes"},
      {v:5,l:"Very picky",d:"Prefer simple, familiar everyday meals"},
    ];
    return <div style={{padding:"0 20px 24px"}}>
      <BackBtn onBack={()=>setView(null)}/>
      <h1 style={{fontSize:22,fontWeight:700,color:T.tx,margin:"0 0 6px",letterSpacing:"-0.02em"}}>Meal Complexity</h1>
      <p style={{fontSize:13,color:T.txM,margin:"0 0 20px",lineHeight:1.5}}>How adventurous are you with food?</p>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {PICKINESS_OPTS.map(o=>(
          <SelBtn key={o.v} label={o.l} desc={o.d} selected={draftPickiness===o.v} onClick={()=>setDraftPickiness(o.v)}/>
        ))}
      </div>
      {draftPickiness>=4&&<div style={{marginTop:16,padding:"12px 14px",borderRadius:T.r,border:`1px solid ${T.acc}40`,background:T.accM}}>
        <p style={{fontSize:12,color:T.tx2,margin:0,lineHeight:1.6}}>For the best experience, visit <strong style={{color:T.acc}}>Foods I Don't Eat</strong> below to add anything you'd like to avoid. This helps us skip meals you won't enjoy.</p>
      </div>}
      <SaveBtn onClick={()=>saveField({pickinessLevel:draftPickiness},null)}/>
    </div>;
  }

  // ── Tracking Mode sub-view ──
  if(view==="tracking"){
    return <div style={{padding:"0 20px 24px"}}>
      <BackBtn onBack={()=>setView(null)}/>
      <h2 style={{fontSize:20,fontWeight:700,color:T.tx,margin:"0 0 6px",letterSpacing:"-0.02em"}}>Tracking Mode</h2>
      <p style={{fontSize:13,color:T.tx2,margin:"0 0 20px"}}>Choose how you want to track your nutrition.</p>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <SelBtn label="AI Plan Mode" desc="Generate a weekly meal plan and follow it" selected={draftTracking==='ai_plan'} onClick={()=>setDraftTracking('ai_plan')}/>
        <SelBtn label="Manual Track Mode" desc="Log meals freely without a generated plan" selected={draftTracking==='manual'} onClick={()=>setDraftTracking('manual')}/>
      </div>
      <SaveBtn onClick={()=>saveField({trackingMode:draftTracking},null)}/>
    </div>;
  }

  // ── Main profile view ──
  const foodsCount = (profile?.dislikedFoods||[]).length;
  const cuisinesCount = (profile?.dislikedCuisines||[]).length;

  return <div style={{padding:"0 20px 24px"}}>
    {savedToast&&<div style={{position:"fixed",top:60,left:"50%",transform:"translateX(-50%)",background:T.ok,color:T.bg,padding:"8px 22px",borderRadius:20,fontSize:13,fontWeight:700,zIndex:200,display:"flex",alignItems:"center",gap:6,boxShadow:"0 4px 20px rgba(0,0,0,0.3)"}}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.bg} strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg> Saved
    </div>}
    <h1 style={{fontSize:26,fontWeight:700,color:T.tx,margin:"4px 0 20px",letterSpacing:"-0.02em"}}>Profile</h1>

    {/* Avatar + name card */}
    <Card style={{padding:20,marginBottom:20,display:"flex",alignItems:"center",gap:16}}>
      <div style={{width:52,height:52,borderRadius:"50%",background:T.acc,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:T.bg,flexShrink:0}}>{(profile?.name||"U")[0].toUpperCase()}</div>
      <div style={{flex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
          <h2 style={{fontSize:18,fontWeight:600,color:T.tx,margin:0}}>{profile?.name||"User"}</h2>
          {isAdmin&&<span style={{fontSize:9,fontWeight:700,color:"#fff",background:"#C4714A",borderRadius:4,padding:"2px 6px",letterSpacing:"0.08em"}}>ADMIN</span>}
        </div>
        {isPro
          ? <span style={{fontSize:12,color:T.acc,fontWeight:600}}>Macra Pro</span>
          : <><span style={{fontSize:12,color:T.txM}}>Macra Free</span><span onClick={onUpgrade} style={{fontSize:12,color:T.acc,marginLeft:8,fontWeight:500,cursor:"pointer"}}>Go Pro →</span></>
        }
      </div>
    </Card>

    {/* Macro targets */}
    {m&&<Card style={{padding:"14px 16px",marginBottom:20,background:T.accG,border:`1px solid ${T.accM}`}}>
      <Lbl>Your Targets</Lbl>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:10}}>
        {[{l:"Calories",v:`${m.target}`,c:T.acc},{l:"Protein",v:`${m.proteinG}g`,c:T.pro},{l:"Carbs",v:`${m.carbG}g`,c:T.carb},{l:"Fat",v:`${m.fatG}g`,c:T.fat}].map(x=>
          <div key={x.l} style={{textAlign:"center"}}><p style={{fontSize:15,fontWeight:700,color:x.c,margin:0,fontFamily:T.mono}}>{x.v}</p><Lbl>{x.l}</Lbl></div>
        )}
      </div>
    </Card>}

    {/* Adjust Your Stats — single tappable row */}
    <Lbl>Adjust Your Stats</Lbl>
    <Card data-tour="adjust-stats" onClick={()=>enterView("stats")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginTop:8,marginBottom:6,cursor:"pointer"}}>
      <div>
        <p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>Adjust Your Stats</p>
        <p style={{fontSize:11,color:T.txM,margin:"2px 0 0"}}>{statsSummary}</p>
      </div>
      <Chevron/>
    </Card>
    <Card data-tour="weekly-budget" onClick={()=>enterView("budget")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginBottom:6,cursor:"pointer"}}>
      <div>
        <p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>Weekly Budget</p>
        <p style={{fontSize:11,color:T.txM,margin:"2px 0 0"}}>{profile?.weeklyBudget?`~$${profile.weeklyBudget}/week`:"Not set"}</p>
      </div>
      <Chevron/>
    </Card>
    <Card onClick={()=>enterView("tracking")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginBottom:6,cursor:"pointer"}}>
      <div>
        <p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>Tracking Mode</p>
        <p style={{fontSize:11,color:T.txM,margin:"2px 0 0"}}>{profile?.trackingMode==='manual'?"Manual Track Mode":"AI Plan Mode"}</p>
      </div>
      <Chevron/>
    </Card>
    <Card data-tour="macro-split" onClick={()=>enterView("macrosplit")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginBottom:6,cursor:"pointer"}}>
      <div>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>Macro Split</p>
          {!isPro&&<span style={{fontSize:9,fontWeight:600,color:T.acc,border:`1px solid ${T.acc}40`,borderRadius:8,padding:"2px 7px",letterSpacing:"0.05em"}}>PRO</span>}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6,marginTop:2}}>
          <p style={{fontSize:11,color:T.txM,margin:0}}>Protein {splitPct.pro}% · Carbs {splitPct.carb}% · Fat {splitPct.fat}%</p>
          <span style={{fontSize:9,fontWeight:600,color:profile?.customMacroSplit?T.acc:T.txM,border:`1px solid ${profile?.customMacroSplit?T.acc+'40':T.bd}`,borderRadius:8,padding:"1px 6px"}}>
            {profile?.customMacroSplit?'Custom':'Recommended'}
          </span>
        </div>
      </div>
      {isPro ? <Chevron/> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.txM} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
    </Card>
    <div style={{marginBottom:20}}/>

    {/* Food preferences */}
    <Lbl>Food Preferences</Lbl>
    <Card data-tour="dietary-prefs" onClick={()=>enterView("diet")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginTop:8,marginBottom:6,cursor:"pointer"}}>
      <div><p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>Dietary Preference</p><p style={{fontSize:11,color:T.txM,margin:"2px 0 0"}}>{dietLabel()}</p></div>
      <Chevron/>
    </Card>
    <Card data-tour="disliked-foods" onClick={()=>enterView("foods")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginBottom:6,cursor:"pointer"}}>
      <div><p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>Foods I Don't Eat</p><p style={{fontSize:11,color:T.txM,margin:"2px 0 0"}}>{foodsCount>0?`${foodsCount} item${foodsCount!==1?"s":""} excluded`:"None added"}</p></div>
      <Chevron/>
    </Card>
    <Card onClick={()=>enterView("cuisines")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginBottom:6,cursor:"pointer"}}>
      <div><p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>Cuisines I Don't Want</p><p style={{fontSize:11,color:T.txM,margin:"2px 0 0"}}>{cuisinesCount>0?`${cuisinesCount} cuisine${cuisinesCount!==1?"s":""} excluded`:"All cuisines enabled"}</p></div>
      <Chevron/>
    </Card>
    <Card data-tour="pickiness" onClick={()=>enterView("pickiness")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginBottom:20,cursor:"pointer"}}>
      <div>
        <p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>Meal Complexity</p>
        <p style={{fontSize:11,color:T.txM,margin:"2px 0 0"}}>
          {(()=>{const lvl=profile?.pickinessLevel??3;const labels={1:"Very adventurous",2:"Somewhat adventurous",3:"Balanced",4:"Somewhat picky",5:"Very picky"};return `Level ${lvl} — ${labels[lvl]||"Balanced"}`;})()}
        </p>
      </div>
      <Chevron/>
    </Card>

    {/* App settings */}
    <Lbl>App Settings</Lbl>
    {/* Household Tracking — coming soon, not tappable */}
    <Card style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginTop:8,marginBottom:6}}>
      <div>
        <p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>Household Tracking</p>
        <p style={{fontSize:11,color:T.txM,margin:"2px 0 0"}}>Track multiple household members</p>
      </div>
      <span style={{fontSize:10,fontWeight:600,color:T.txM,border:`1px solid ${T.bd}`,borderRadius:10,padding:"3px 9px",letterSpacing:"0.04em"}}>Coming Soon</span>
    </Card>
    {/* Subscription */}
    <Card style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginTop:8,marginBottom:6,cursor:"pointer"}}>
      <div>
        <p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>Subscription</p>
        <p style={{fontSize:11,color:T.txM,margin:"2px 0 0"}}>Macra Free</p>
      </div>
      <Chevron/>
    </Card>
    {/* Admin panel — only visible to admin email */}
    {isAdmin&&<div style={{marginTop:28,padding:"16px 18px",border:"1.5px solid #C4714A",borderRadius:T.r,background:"rgba(196,113,74,0.08)"}}>
      <p style={{fontSize:10,fontWeight:700,color:"#C4714A",letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 4px"}}>🔧 Dev Admin Panel</p>
      <p style={{fontSize:12,color:T.tx2,margin:"0 0 14px"}}>Current tier: <strong style={{color:T.tx}}>{isPro?"Pro":"Free"}</strong></p>
      <button onClick={handleToggleProMode} style={{width:"100%",padding:"11px",borderRadius:T.r,border:"none",background:isPro?"#5A8A5E":"#C4714A",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:T.font,marginBottom:8}}>
        {isPro?"Switch to Free Tier":"Switch to Pro Tier"}
      </button>
      <button onClick={handleResetGenerations} style={{width:"100%",padding:"10px",borderRadius:T.r,border:`1px solid #C9A84C`,background:"transparent",color:"#C9A84C",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:T.font}}>
        Reset Generation Limits
      </button>
    </div>}

    {adminToast&&<div style={{position:"fixed",bottom:100,left:"50%",transform:"translateX(-50%)",background:"#C4714A",color:"#fff",padding:"10px 20px",borderRadius:12,fontSize:12,fontWeight:700,zIndex:200,whiteSpace:"nowrap",boxShadow:"0 4px 20px rgba(0,0,0,0.4)"}}>{adminToast}</div>}

    {onSignOut&&<button onClick={onSignOut} style={{width:"100%",padding:14,borderRadius:T.r,border:`1px solid rgba(239,68,68,0.3)`,background:"rgba(239,68,68,0.08)",color:"#EF4444",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:T.font,marginTop:20}}>Sign Out</button>}
  </div>;
};

// ─── MAIN ──────────────────────────────────────────────────────
// ─── PWA INSTALL PROMPT ────────────────────────────────────────
// Shown as a bottom sheet after 30s in-app or after first plan generation.
// iOS Safari: no beforeinstallprompt — show manual share instructions instead.
const PwaPrompt = ({type, onInstall, onDismiss}) => (
  <>
    {/* Backdrop */}
    <div onClick={onDismiss} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:99}}/>
    {/* Sheet */}
    <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,zIndex:100,background:T.sf,borderTop:`1px solid ${T.bd}`,borderRadius:"20px 20px 0 0",padding:"8px 20px 44px",boxShadow:"0 -8px 40px rgba(0,0,0,0.5)"}}>
      {/* Drag handle */}
      <div style={{width:36,height:4,borderRadius:2,background:T.bd,margin:"0 auto 20px"}}/>
      {/* App icon + headline */}
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
        <div style={{width:52,height:52,borderRadius:14,background:`linear-gradient(135deg,${T.acc},#A89560)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:`0 4px 16px rgba(200,184,138,0.25)`}}>
          <span style={{fontSize:24,fontWeight:800,color:T.bg,fontFamily:T.font}}>M</span>
        </div>
        <div>
          <p style={{margin:0,fontSize:16,fontWeight:700,color:T.tx,letterSpacing:"-0.01em"}}>Add Macra to your home screen</p>
          <p style={{margin:"4px 0 0",fontSize:13,color:T.tx2}}>For the best experience</p>
        </div>
      </div>

      {type === "native" ? (
        <div style={{display:"flex",gap:10}}>
          <button onClick={onDismiss} style={{flex:1,padding:"13px 0",borderRadius:T.r,border:`1px solid ${T.bd}`,background:"transparent",color:T.tx2,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:T.font}}>Not Now</button>
          <button onClick={onInstall} style={{flex:2,padding:"13px 0",borderRadius:T.r,border:"none",background:T.acc,color:T.bg,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:T.font}}>Add to Home Screen</button>
        </div>
      ) : (
        /* iOS Safari — manual instructions */
        <>
          <div style={{background:T.bg,borderRadius:T.r,border:`1px solid ${T.bd}`,padding:"14px 16px",marginBottom:16}}>
            <p style={{margin:0,fontSize:14,color:T.tx2,lineHeight:1.7}}>
              1. Tap the{" "}
              <svg style={{display:"inline",verticalAlign:"-3px"}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>
              </svg>{" "}
              <span style={{color:T.acc,fontWeight:600}}>Share</span> button in Safari
            </p>
            <p style={{margin:"8px 0 0",fontSize:14,color:T.tx2,lineHeight:1.7}}>
              2. Scroll down and tap <span style={{color:T.acc,fontWeight:600}}>"Add to Home Screen"</span>
            </p>
          </div>
          {/* Arrow pointing down toward the browser UI */}
          <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
          </div>
          <button onClick={onDismiss} style={{width:"100%",padding:"13px 0",borderRadius:T.r,border:`1px solid ${T.bd}`,background:"transparent",color:T.tx2,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:T.font}}>Got It</button>
        </>
      )}
    </div>
  </>
);

// ─── STATS TAB ─────────────────────────────────────────────────
const ACHIEVEMENTS_DEF = [
  // Logging
  {key:'first_bite',    name:'First Bite',    desc:'Log your first meal',                   icon:IcoFork,   cat:'Logging',  total:1,   prog:d=>Math.min(d.totalMeals,1),    chk:d=>d.totalMeals>=1},
  {key:'consistent',    name:'Consistent',    desc:'3-day logging streak',                  icon:IcoFlame,  cat:'Logging',  total:3,   prog:d=>Math.min(d.bestLogging,3),   chk:d=>d.bestLogging>=3},
  {key:'week_warrior',  name:'Week Warrior',  desc:'7-day logging streak',                  icon:IcoFlame,  cat:'Logging',  total:7,   prog:d=>Math.min(d.bestLogging,7),   chk:d=>d.bestLogging>=7},
  {key:'month_strong',  name:'Month Strong',  desc:'30-day logging streak',                 icon:IcoFlame,  cat:'Logging',  total:30,  prog:d=>Math.min(d.bestLogging,30),  chk:d=>d.bestLogging>=30},
  {key:'century',       name:'Century',       desc:'Log 100 total meals',                   icon:IcoTrophy, cat:'Logging',  total:100, prog:d=>Math.min(d.totalMeals,100),  chk:d=>d.totalMeals>=100},
  // Macros
  {key:'on_target',     name:'On Target',     desc:'Hit your calorie goal once',            icon:IcoTarget, cat:'Macros',   total:1,   prog:d=>Math.min(d.bestMacros,1),    chk:d=>d.bestMacros>=1},
  {key:'macro_master',  name:'Macro Master',  desc:'Calorie goal 7 days in a row',          icon:IcoTrophy, cat:'Macros',   total:7,   prog:d=>Math.min(d.bestMacros,7),    chk:d=>d.bestMacros>=7},
  {key:'precision',     name:'Precision',     desc:'All 3 macros within 10% in one day',   icon:IcoChart,  cat:'Macros',   total:1,   prog:d=>d.hasPrecision?1:0,          chk:d=>d.hasPrecision},
  {key:'balanced_week', name:'Balanced Week', desc:'All macros within 10% for 7 days',     icon:IcoScale,  cat:'Macros',   total:7,   prog:d=>Math.min(d.bestPrecision,7), chk:d=>d.bestPrecision>=7},
  // Plan
  {key:'planner',       name:'Planner',       desc:'Generate your first meal plan',         icon:IcoClip,   cat:'Plan',     total:1,   prog:d=>Math.min(d.lifetimeGens,1),  chk:d=>d.lifetimeGens>=1},
  {key:'committed',     name:'Committed',     desc:'Follow your plan for 3 days',           icon:IcoTrophy, cat:'Plan',     total:3,   prog:d=>Math.min(d.bestPlan,3),      chk:d=>d.bestPlan>=3},
  {key:'dedicated',     name:'Dedicated',     desc:'Follow your plan for 7 days',           icon:IcoTrophy, cat:'Plan',     total:7,   prog:d=>Math.min(d.bestPlan,7),      chk:d=>d.bestPlan>=7},
  // Health
  {key:'hydrated',      name:'Hydrated',      desc:'Hit your water goal once',              icon:IcoDrop,   cat:'Health',   total:1,   prog:d=>Math.min(d.waterGoalHit,1),  chk:d=>d.waterGoalHit>=1},
  {key:'water_week',    name:'Water Week',    desc:'Hit water goal 7 days in a row',        icon:IcoDrop,   cat:'Health',   total:7,   prog:d=>Math.min(d.waterStreak,7),   chk:d=>d.waterStreak>=7},
  {key:'weight_watcher',name:'Weight Watcher',desc:'Log your weight 7 times',               icon:IcoChart,  cat:'Health',   total:7,   prog:d=>Math.min(d.weightEntries,7), chk:d=>d.weightEntries>=7},
  {key:'transformation',name:'Transformation',desc:'Log weight 30 times',                   icon:IcoStar,   cat:'Health',   total:30,  prog:d=>Math.min(d.weightEntries,30),chk:d=>d.weightEntries>=30},
  // Fasting
  {key:'first_fast',     name:'First Fast',     desc:'Complete your first fast',             icon:IcoMoon,   cat:'Fasting',  total:1,   prog:d=>Math.min(d.totalFasts,1),         chk:d=>d.totalFasts>=1},
  {key:'half_day',       name:'Half Day',       desc:'Complete a 12-hour fast',              icon:IcoMoon,   cat:'Fasting',  total:1,   prog:d=>d.has12hFast?1:0,                chk:d=>d.has12hFast},
  {key:'extended_fast',  name:'Extended Fast',  desc:'Complete an 18-hour fast',             icon:IcoMoon,   cat:'Fasting',  total:1,   prog:d=>d.has18hFast?1:0,                chk:d=>d.has18hFast},
  {key:'fasting_streak', name:'Fasting Streak', desc:'Fast 7 days in a row',                 icon:IcoFlame,  cat:'Fasting',  total:7,   prog:d=>Math.min(d.bestFastingStreak,7),  chk:d=>d.bestFastingStreak>=7},
  {key:'fasting_master', name:'Fasting Master', desc:'Complete 30 total fasts',              icon:IcoMoon,   cat:'Fasting',  total:30,  prog:d=>Math.min(d.totalFasts,30),        chk:d=>d.totalFasts>=30},
  // Milestone
  {key:'early_adopter', name:'Early Adopter', desc:'One of the first Macra users',          icon:IcoStar,   cat:'Milestone',total:1,   prog:d=>1,                           chk:d=>true},
  {key:'pro_member',        name:'Pro Member',        desc:'Upgraded to Macra Pro',               icon:IcoStar,   cat:'Milestone',total:1,   prog:d=>d.isPro?1:0,   chk:d=>d.isPro},
  {key:'tutorial_complete', name:'Tutorial Complete', desc:'Completed the full onboarding tour',  icon:IcoStar,   cat:'Milestone',total:1,   prog:d=>0,             chk:d=>false},
];

const StatsTab = ({profile, userId, isPro}) => {
  const [statsData, setStatsData] = useState(null);
  const [unlockedKeys, setUnlockedKeys] = useState(new Set());
  const [toast, setToast] = useState(null);
  const toastRef = useRef(null);

  useEffect(() => { if(userId) load(); }, [userId]);

  const load = async () => {
    const now = new Date();
    const todayStr = localDate();
    const d90 = new Date(now.getTime() - 90*24*60*60*1000);
    const d30 = new Date(now.getTime() - 30*24*60*60*1000);
    const start90 = localDate(d90);
    const start30 = localDate(d30);

    const [logData, summary, waterHist, weightLog, dbAch, genUsage, fastingLog] = await Promise.all([
      getMealLogRange(userId, start90, todayStr),
      getMealLogSummary(userId),
      getWaterHistory(userId),
      getWeightLog(userId),
      getAchievements(userId),
      getGenerationUsage(userId),
      getFastingLog(userId),
    ]);

    // Group 90-day log by date
    const byDate = {};
    logData.forEach(r => { if(!byDate[r.date]) byDate[r.date]=[]; byDate[r.date].push(r); });

    // Build ordered date array for 90-day window
    const dates = [];
    const d = new Date(d90);
    while(d <= now){ dates.push(localDate(d)); d.setDate(d.getDate()+1); }

    const m = profile?.macros || {target:2200,proteinG:180,carbG:240,fatG:70};

    // Generic streak calculators
    const calcCurrent = pred => {
      let streak = 0;
      for(let i=dates.length-1; i>=0; i--){
        const dl = byDate[dates[i]]||[];
        if(pred(dl)) { streak++; }
        else if(dates[i]===todayStr) { continue; } // today not done yet
        else { break; }
      }
      return streak;
    };
    const calcBest = pred => {
      let best=0,cur=0;
      dates.forEach(ds=>{ const dl=byDate[ds]||[]; if(pred(dl)){cur++;best=Math.max(best,cur);}else{cur=0;} });
      return best;
    };

    const logPred  = dl => dl.length>=1;
    const calPred  = dl => { const c=dl.reduce((s,r)=>s+(r.calories||0),0); return dl.length>=1&&c>=m.target*0.9&&c<=m.target*1.1; };
    const planPred = dl => dl.length>=3;
    const precPred = dl => {
      if(!dl.length) return false;
      const cal=dl.reduce((s,r)=>s+(r.calories||0),0);
      const pro=dl.reduce((s,r)=>s+(r.protein||0),0);
      const car=dl.reduce((s,r)=>s+(r.carbs||0),0);
      const fat=dl.reduce((s,r)=>s+(r.fat||0),0);
      return cal>=m.target*0.9&&cal<=m.target*1.1&&pro>=m.proteinG*0.9&&pro<=m.proteinG*1.1&&car>=m.carbG*0.9&&car<=m.carbG*1.1&&fat>=m.fatG*0.9&&fat<=m.fatG*1.1;
    };

    const loggingStreak = calcCurrent(logPred);
    const macroStreak   = calcCurrent(calPred);
    const planStreak    = calcCurrent(planPred);
    const precStreak    = calcCurrent(precPred);
    const bestLogging   = calcBest(logPred);
    const bestMacros    = calcBest(calPred);
    const bestPlan      = calcBest(planPred);
    const bestPrecision = calcBest(precPred);

    // 30-day avg calories
    const log30 = logData.filter(r=>r.date>=start30);
    const by30 = {}; log30.forEach(r=>{ if(!by30[r.date])by30[r.date]=0; by30[r.date]+=(r.calories||0); });
    const days30 = Object.values(by30);
    const avgCal = days30.length>0 ? Math.round(days30.reduce((s,v)=>s+v,0)/days30.length) : 0;

    // Water (7-day history)
    const waterGoalHit = waterHist.filter(w=>w.glasses>=(w.goal||8)).length;
    let waterStreak=0;
    for(let i=0;i<7;i++){
      const d2=new Date(now); d2.setDate(d2.getDate()-i);
      const ds=localDate(d2);
      const entry=waterHist.find(w=>w.log_date===ds);
      if(entry&&entry.glasses>=(entry.goal||8)){ waterStreak++; }
      else if(ds===todayStr){ continue; }
      else { break; }
    }

    // Weight
    const weightEntries = weightLog.length;
    const weightProgress = weightLog.length>=2 ? weightLog[weightLog.length-1].weight_lbs - weightLog[0].weight_lbs : null;

    // Fasting stats
    const completedFasts = fastingLog.filter(f => f.completed);
    const totalFasts = completedFasts.length;
    const fastDurations = completedFasts.map(f => f.ended_at ? (new Date(f.ended_at) - new Date(f.started_at)) / 3600000 : 0);
    const avgFastHours = fastDurations.length > 0 ? fastDurations.reduce((s,v)=>s+v,0)/fastDurations.length : 0;
    const longestFastHours = fastDurations.length > 0 ? Math.max(...fastDurations) : 0;
    const has12hFast = fastDurations.some(h=>h>=12);
    const has18hFast = fastDurations.some(h=>h>=18);
    // Fasting streak: consecutive calendar days (by started_at date) with a completed fast
    const fastByDate = {};
    completedFasts.forEach(f=>{ const dd=localDate(new Date(f.started_at)); fastByDate[dd]=true; });
    let fastingStreak=0;
    for(let i=dates.length-1;i>=0;i--){
      if(fastByDate[dates[i]]){fastingStreak++;}
      else if(dates[i]===todayStr){continue;}
      else{break;}
    }
    let bestFastingStreak=0,curFS=0;
    dates.forEach(ds=>{ if(fastByDate[ds]){curFS++;bestFastingStreak=Math.max(bestFastingStreak,curFS);}else{curFS=0;} });
    // 7-day fasting bar chart
    const fastBarData=[];
    for(let i=6;i>=0;i--){
      const d2=new Date(now); d2.setDate(d2.getDate()-i);
      const ds=localDate(d2);
      const dayFasts=completedFasts.filter(f=>localDate(new Date(f.started_at))===ds);
      const maxH=dayFasts.length>0?Math.max(...dayFasts.map(f=>f.ended_at?(new Date(f.ended_at)-new Date(f.started_at))/3600000:0)):0;
      fastBarData.push({date:ds,hours:maxH});
    }

    const computed = {
      totalMeals:summary.totalMeals, totalDays:summary.totalDays, avgCal,
      loggingStreak, macroStreak, planStreak, precisionStreak:precStreak,
      bestLogging, bestMacros, bestPlan, bestPrecision,
      hasPrecision:bestPrecision>=1,
      lifetimeGens:genUsage?.lifetimeCount||0,
      waterGoalHit, waterStreak, weightEntries, weightProgress, isPro,
      totalFasts, avgFastHours, longestFastHours, has12hFast, has18hFast,
      fastingStreak, bestFastingStreak, fastBarData,
    };

    // Unlock new achievements
    const dbKeys = new Set(dbAch.map(a=>a.achievement_key));
    const newlyUnlocked = [];
    for(const ach of ACHIEVEMENTS_DEF){
      if(!dbKeys.has(ach.key)&&ach.chk(computed)){
        await unlockAchievement(userId, ach.key);
        newlyUnlocked.push(ach);
        dbKeys.add(ach.key);
      }
    }
    setUnlockedKeys(new Set(dbKeys));
    setStatsData(computed);

    // Show toasts for newly unlocked (stagger if multiple)
    newlyUnlocked.forEach((ach,i)=>{
      setTimeout(()=>{
        setToast(ach);
        if(toastRef.current) clearTimeout(toastRef.current);
        toastRef.current = setTimeout(()=>setToast(null), 2800);
      }, i*3500);
    });
  };

  if(!statsData) return <div style={{padding:'60px 20px',textAlign:'center'}}>
    <div style={{width:28,height:28,borderRadius:'50%',border:`2px solid ${T.bd}`,borderTopColor:T.acc,animation:'spin 1s linear infinite',margin:'0 auto 16px'}}/>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    <p style={{fontSize:13,color:T.txM,margin:0}}>Calculating your stats…</p>
  </div>;

  const unlockedCount = unlockedKeys.size;

  return <div style={{padding:'0 20px 32px'}}>
    {/* Toast */}
    {toast&&<div style={{position:'fixed',top:56,left:'50%',transform:'translateX(-50%)',zIndex:400,background:T.acc,color:T.bg,padding:'10px 20px',borderRadius:T.r,fontSize:13,fontWeight:700,boxShadow:'0 4px 20px rgba(0,0,0,0.5)',whiteSpace:'nowrap',maxWidth:'90vw',textAlign:'center',transition:'opacity 0.3s'}}>
      🏆 Achievement Unlocked: {toast.name}!
    </div>}

    <h1 style={{fontSize:26,fontWeight:700,color:T.tx,margin:'4px 0 20px',letterSpacing:'-0.02em'}}>Stats</h1>

    {/* ── Streaks ── */}
    <div data-tour="streaks">
    <Lbl>Streaks</Lbl>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:10,marginBottom:28}}>
      {[
        {label:'Logging', val:statsData.loggingStreak, best:statsData.bestLogging,  icon:IcoFlame},
        {label:'Macros',  val:statsData.macroStreak,   best:statsData.bestMacros,   icon:IcoTarget},
        ...(profile?.trackingMode!=='manual'?[{label:'Plan', val:statsData.planStreak, best:statsData.bestPlan, icon:IcoClip}]:[]),
        {label:'Fasting', val:statsData.fastingStreak, best:statsData.bestFastingStreak, icon:IcoMoon},
      ].map(s=><Card key={s.label} style={{padding:'16px 8px',textAlign:'center',border:s.val>0?`1px solid ${T.acc}40`:`1px solid ${T.bd}`}}>
        <div style={{fontSize:22,marginBottom:6}}>{s.icon}</div>
        <p style={{fontSize:28,fontWeight:700,color:s.val>0?T.acc:T.txM,margin:'0 0 3px',fontFamily:T.mono,lineHeight:1}}>{s.val}</p>
        <p style={{fontSize:10,fontWeight:600,color:T.txM,margin:'0 0 5px',letterSpacing:'0.05em',textTransform:'uppercase'}}>{s.label}</p>
        <p style={{fontSize:9,color:T.txM,margin:0}}>Best: {s.best}d</p>
      </Card>)}
    </div>
    </div>

    {/* ── Achievements ── */}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
      <Lbl>Achievements</Lbl>
      <span style={{fontSize:11,color:T.txM,fontFamily:T.mono}}>{unlockedCount} of {ACHIEVEMENTS_DEF.length} unlocked</span>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:28}}>
      {ACHIEVEMENTS_DEF.map(ach=>{
        const unlocked = unlockedKeys.has(ach.key);
        const progress = unlocked ? ach.total : ach.prog(statsData);
        const pct = Math.min((progress/ach.total)*100, 100);
        return <div key={ach.key} style={{
          background:T.sf,borderRadius:T.r,padding:'14px 12px',
          border:unlocked?`1px solid ${T.acc}30`:`1px solid ${T.bd}`,
          opacity:unlocked?1:0.62,position:'relative',overflow:'hidden',
          boxShadow:unlocked?`0 0 18px ${T.acc}0D`:undefined,
        }}>
          <span style={{fontSize:26,display:'block',marginBottom:8,lineHeight:1}}>{ach.icon}</span>
          <p style={{fontSize:12,fontWeight:700,color:unlocked?T.tx:T.tx2,margin:'0 0 3px',lineHeight:1.2}}>{ach.name}</p>
          <p style={{fontSize:10,color:T.txM,margin:'0 0 10px',lineHeight:1.4}}>{ach.desc}</p>
          <div style={{height:3,borderRadius:2,background:T.bd,marginBottom:4}}>
            <div style={{height:'100%',borderRadius:2,background:unlocked?T.acc:T.tx2,width:`${pct}%`,transition:'width 0.8s ease'}}/>
          </div>
          <p style={{fontSize:9,color:T.txM,margin:0,textAlign:'right',fontFamily:T.mono}}>{Math.round(progress)}/{ach.total}</p>
          {unlocked
            ? <div style={{position:'absolute',top:8,right:8,width:18,height:18,borderRadius:'50%',background:T.acc,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={T.bg} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
            : <div style={{position:'absolute',top:8,right:8}}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={T.txM} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              </div>
          }
        </div>;
      })}
    </div>

    {/* ── Summary ── */}
    <Lbl>Summary</Lbl>
    <Card style={{marginTop:10,overflow:'hidden'}}>
      {[
        {label:'Total meals logged',    val:String(statsData.totalMeals)},
        {label:'Days tracked',          val:String(statsData.totalDays)},
        {label:'Avg daily calories (30d)',val:statsData.avgCal>0?`${statsData.avgCal.toLocaleString()} cal`:'—'},
        {label:'Best logging streak',   val:`${statsData.bestLogging} day${statsData.bestLogging!==1?'s':''}`},
      ].map((s,i,arr)=><div key={s.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'13px 16px',borderBottom:i<arr.length-1||(statsData.weightProgress!==null)?`1px solid ${T.bd}`:'none'}}>
        <span style={{fontSize:13,color:T.tx2}}>{s.label}</span>
        <span style={{fontSize:13,fontWeight:600,color:T.tx,fontFamily:T.mono}}>{s.val}</span>
      </div>)}
      {statsData.weightProgress!==null&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'13px 16px'}}>
        <span style={{fontSize:13,color:T.tx2}}>Weight progress</span>
        <span style={{fontSize:13,fontWeight:600,fontFamily:T.mono,color:statsData.weightProgress<0?T.ok:statsData.weightProgress>0?'#EF4444':T.tx}}>
          {statsData.weightProgress<0?`↓ ${Math.abs(statsData.weightProgress).toFixed(1)} lbs`:statsData.weightProgress>0?`↑ ${statsData.weightProgress.toFixed(1)} lbs`:'No change'}
        </span>
      </div>}
    </Card>

    {/* ── Fasting History ── */}
    {statsData.totalFasts > 0 && (()=>{
      const todayForChart = localDate();
      const FDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const maxH = Math.max(...statsData.fastBarData.map(b=>b.hours), 1);
      const BAR_H = 60;
      return <>
        <div style={{marginTop:28,marginBottom:10}}><Lbl>Fasting</Lbl></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12}}>
          {[
            {label:'Total Fasts',  val:String(statsData.totalFasts)},
            {label:'Avg Duration', val:statsData.avgFastHours>0?`${statsData.avgFastHours.toFixed(1)}h`:'—'},
            {label:'Longest Fast', val:statsData.longestFastHours>0?`${statsData.longestFastHours.toFixed(1)}h`:'—'},
          ].map(s=><Card key={s.label} style={{padding:'12px 8px',textAlign:'center'}}>
            <p style={{fontSize:18,fontWeight:700,color:T.acc,margin:'0 0 3px',fontFamily:T.mono}}>{s.val}</p>
            <p style={{fontSize:9,fontWeight:600,color:T.txM,margin:0,letterSpacing:'0.05em',textTransform:'uppercase'}}>{s.label}</p>
          </Card>)}
        </div>
        <Card style={{padding:'16px',marginBottom:28}}>
          <p style={{fontSize:10,fontWeight:600,color:T.txM,margin:'0 0 12px',letterSpacing:'0.08em',textTransform:'uppercase'}}>Last 7 Days</p>
          <div style={{display:'flex',alignItems:'flex-end',gap:4,justifyContent:'space-between'}}>
            {statsData.fastBarData.map((b)=>{
              const barH = (b.hours/maxH)*BAR_H;
              const dayIdx = new Date(b.date+'T12:00:00').getDay();
              const isTodayBar = b.date===todayForChart;
              return <div key={b.date} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                <div style={{width:'100%',height:BAR_H,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
                  <div style={{width:'70%',height:Math.max(barH,2),borderRadius:'3px 3px 0 0',background:isTodayBar?T.acc:`${T.acc}60`,transition:'height 0.3s ease'}}/>
                </div>
                <span style={{fontSize:9,color:isTodayBar?T.acc:T.txM,fontWeight:isTodayBar?700:400}}>{FDAYS[dayIdx]}</span>
                {b.hours>0&&<span style={{fontSize:8,color:T.txM,fontFamily:T.mono}}>{b.hours.toFixed(0)}h</span>}
              </div>;
            })}
          </div>
        </Card>
      </>;
    })()}
  </div>;
};

const navTabs=[
  {id:"home", label:"Home",  d:"M3 9.5L12 3l9 6.5V20a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 20V9.5z"},
  {id:"plan", label:"Plan",  d:"M3,4h18v18H3zM16 2v4M8 2v4M3 10h18"},
  {id:"log",  label:"Log",   d:"M12,3a9,9 0 1,0 0,18a9,9 0 1,0 0,-18M12 7v5l3.5 2"},
  {id:"stats",label:"Stats", d:"M3 20V10|M8 20V4|M13 20V13|M18 20V7"},
  {id:"grocery",label:"List",d:"M9 5h11M9 12h11M9 19h11"},
  {id:"profile",label:"You", d:"M12,3.5a4.5,4.5 0 1,0 0,9a4.5,4.5 0 1,0 0,-9M4.5 21c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5"},
];

export default function App() {
  const [phase,setPhase] = useState("splash"); // splash | auth | onboarding | app
  const [user,setUser] = useState(null);
  const [profile,setProfile] = useState(null);
  const [tab,setTab] = useState("home");
  const [savedMeals,setSavedMeals] = useState([]);
  const [isPro,setIsPro] = useState(false);
  const [todayLog,setTodayLog] = useState([]);
  const [todayPlan,setTodayPlan] = useState([]);
  const [weekPlans,setWeekPlans] = useState({});
  const [defaultLogMealType,setDefaultLogMealType] = useState(null);
  const [isFasting,setIsFasting] = useState(false);
  const [fastStartedAt,setFastStartedAt] = useState(null);
  const [fastingGoal,setFastingGoal] = useState(16);

  // ── Pricing modal ───────────────────────────────────────────────
  const [showPricingModal, setShowPricingModal] = useState(false);

  // ── PWA install prompt ──────────────────────────────────────────
  const [pwaPrompt,setPwaPrompt] = useState(null); // null | 'native' | 'ios'
  const deferredInstallEvent = useRef(null); // stores the beforeinstallprompt event
  const pwaTimerRef = useRef(null);          // 30-second delay timer
  const pwaTypeRef = useRef(null);           // 'native' | 'ios', set when ready

  // Set up PWA listeners once the user reaches the app phase.
  // Timers are guarded by onboardingCompleted so the prompt never interrupts the tutorial.
  useEffect(() => {
    if(phase !== "app") return;

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || !!window.navigator.standalone;
    if(isStandalone) return;
    if(localStorage.getItem("pwa-dismissed")) return;

    const onboardingDone = profile?.onboardingCompleted ?? false;
    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios|edgios/i.test(ua);

    if(isIos && isSafari){
      pwaTypeRef.current = "ios";
      // Only start 30s timer after tutorial is complete
      if(onboardingDone){
        pwaTimerRef.current = setTimeout(() => setPwaPrompt("ios"), 30000);
      }
      return () => clearTimeout(pwaTimerRef.current);
    }

    // If onboarding just completed and we already have the deferred event, show after 2s
    if(onboardingDone && deferredInstallEvent.current && !pwaTimerRef.current){
      pwaTimerRef.current = setTimeout(() => setPwaPrompt("native"), 2000);
    }

    // Chrome / Android / Edge — capture event; start timer only after tutorial
    const handleBip = (e) => {
      e.preventDefault();
      deferredInstallEvent.current = e;
      pwaTypeRef.current = "native";
      if(onboardingDone && !pwaTimerRef.current){
        pwaTimerRef.current = setTimeout(() => setPwaPrompt("native"), 30000);
      }
    };

    const handleInstalled = () => {
      clearTimeout(pwaTimerRef.current);
      pwaTimerRef.current = null;
      deferredInstallEvent.current = null;
      setPwaPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBip);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      clearTimeout(pwaTimerRef.current);
      pwaTimerRef.current = null;
      window.removeEventListener("beforeinstallprompt", handleBip);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [phase, profile?.onboardingCompleted]);

  // Called when first plan is generated — shows prompt immediately (skips 30s timer).
  // Guard: never fires during tutorial to avoid interrupting the onboarding flow.
  const triggerPwaEarly = () => {
    if(!profile?.onboardingCompleted) return;
    if(localStorage.getItem("pwa-dismissed")) return;
    if(pwaPrompt) return; // already visible
    const type = pwaTypeRef.current;
    if(!type) return;
    clearTimeout(pwaTimerRef.current);
    pwaTimerRef.current = null;
    setPwaPrompt(type);
  };

  const dismissPwa = () => {
    localStorage.setItem("pwa-dismissed","1");
    setPwaPrompt(null);
  };

  const handleInstallClick = async () => {
    const evt = deferredInstallEvent.current;
    if(!evt) return;
    evt.prompt();
    const { outcome } = await evt.userChoice;
    deferredInstallEvent.current = null;
    setPwaPrompt(null);
    if(outcome === "accepted") localStorage.setItem("pwa-dismissed","1");
  };

  // ── Supabase auth state listener ───────────────────────────────
  // Runs once on mount (not tied to phase) so token refreshes and sign-outs
  // from Supabase are always reflected in app state, including in PWA mode.
  useEffect(() => {
    if(!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[onAuthStateChange]", event, session?.user?.id ?? "no user");
      if(event === "TOKEN_REFRESHED" && session?.user) {
        // Silently update user ref — no phase change needed, already in app
        setUser(session.user);
      }
      if(event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
        setSavedMeals([]);
        setTodayLog([]);
        setTodayPlan([]);
        setWeekPlans({});
        setPhase("auth");
      }
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Check auth state after splash
  // Uses getSession() (reads local storage — no network round-trip, reliable on Safari ITP)
  // instead of getUser() (makes API call that can fail on expired/missing tokens)
  const checkAuth = async () => {
    // Timezone diagnostics — verify local vs UTC date on app load
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.log(`[timezone] detected: ${tz}`);
    console.log(`[timezone] local today: ${localDate()}`);
    console.log(`[timezone] UTC today:   ${new Date().toISOString().split('T')[0]}`);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const u = session?.user ?? null;
      if(u){
        setUser(u);
        // Load profile from Supabase
        const {data} = await getProfile(u.id);
        if(data){
          const proFlag = data.is_pro === true;
          console.log(`[auth] userId: ${u.id} isPro: ${proFlag}`);
          setIsPro(proFlag);
          const pBase = {
            name:data.name, sex:data.sex, age:data.age,
            weightLbs:data.weight_lbs, heightFt:data.height_ft, heightIn:data.height_in,
            activity:data.activity, goal:data.goal, diet:data.diet||[],
            dislikedFoods:data.disliked_foods||[], dislikedCuisines:data.disliked_cuisines||[],
            weeklyBudget:data.weekly_budget??null, pickinessLevel:data.pickiness_level??3,
            trackingMode:data.tracking_mode||'ai_plan', waterGoal:data.water_goal??8,
            customProteinPct:data.custom_protein_pct??null, customCarbsPct:data.custom_carbs_pct??null,
            customFatPct:data.custom_fat_pct??null, customMacroSplit:data.custom_macro_split??false,
            onboardingCompleted:data.onboarding_completed??false,
          };
          const hasStats = pBase.sex && pBase.age && pBase.weightLbs && pBase.heightFt != null && pBase.activity && pBase.goal;
          // If user has a custom split, load saved macro grams directly; otherwise recalculate
          const freshMacros = pBase.customMacroSplit
            ? {target:data.target_calories,proteinG:data.target_protein,carbG:data.target_carbs,fatG:data.target_fat}
            : hasStats ? calcMacros(pBase) : {target:data.target_calories,proteinG:data.target_protein,carbG:data.target_carbs,fatG:data.target_fat};
          const p = {...pBase, macros: freshMacros};
          if(hasStats && !pBase.customMacroSplit) saveProfile(u.id, p).catch(e=>console.error("[checkAuth] macro resave failed:",e));
          setProfile(p);
          // Load saved meals
          const meals = await getSavedMeals(u.id);
          setSavedMeals(meals.map(m=>({id:m.id,name:m.name,source:m.source||'custom',ingredients:m.ingredients||[],totals:{cal:m.total_calories,p:m.total_protein,c:m.total_carbs,f:m.total_fat}})));
          // Load today's log
          const log = await getTodayLog(u.id);
          setTodayLog(log);
          // Load meal plans (A/B format: key 0=Day A, key 1=Day B)
          const plans = await getWeekPlans(u.id);
          setWeekPlans(plans);
          const todayDow = new Date().getDay();
          const dowIndex = todayDow === 0 ? 6 : todayDow - 1; // Mon=0..Sun=6
          const abKey = dowIndex % 2 === 0 ? 0 : 1;
          if(plans[abKey]) setTodayPlan(plans[abKey]);
          // Restore fasting state
          if(data.is_fasting && data.fast_started_at){
            setIsFasting(true);
            setFastStartedAt(data.fast_started_at);
            setFastingGoal(data.fasting_goal || 16);
          }
          setPhase("app");
          return;
        }
        // User exists but no profile — needs onboarding
        console.log(`[auth] userId: ${u.id} isPro: false (no profile yet)`);
        setPhase("onboarding");
        return;
      }
    } catch(e) {
      console.error("[checkAuth] session check failed:", e);
    }
    setPhase("auth");
  };

  const handleAuth = async (u) => {
    setUser(u);
    const {data} = await getProfile(u.id);
    if(data){
      const proFlag = data.is_pro === true;
      console.log(`[auth] userId: ${u.id} isPro: ${proFlag}`);
      setIsPro(proFlag);
      const pBase = {
        name:data.name, sex:data.sex, age:data.age,
        weightLbs:data.weight_lbs, heightFt:data.height_ft, heightIn:data.height_in,
        activity:data.activity, goal:data.goal, diet:data.diet||[],
        dislikedFoods:data.disliked_foods||[], dislikedCuisines:data.disliked_cuisines||[],
        weeklyBudget:data.weekly_budget??null, pickinessLevel:data.pickiness_level??3,
        trackingMode:data.tracking_mode||'ai_plan', waterGoal:data.water_goal??8,
        customProteinPct:data.custom_protein_pct??null, customCarbsPct:data.custom_carbs_pct??null,
        customFatPct:data.custom_fat_pct??null, customMacroSplit:data.custom_macro_split??false,
        onboardingCompleted:data.onboarding_completed??false,
      };
      const hasStats = pBase.sex && pBase.age && pBase.weightLbs && pBase.heightFt != null && pBase.activity && pBase.goal;
      const freshMacros = pBase.customMacroSplit
        ? {target:data.target_calories,proteinG:data.target_protein,carbG:data.target_carbs,fatG:data.target_fat}
        : hasStats ? calcMacros(pBase) : {target:data.target_calories,proteinG:data.target_protein,carbG:data.target_carbs,fatG:data.target_fat};
      const p = {...pBase, macros: freshMacros};
      if(hasStats && !pBase.customMacroSplit) saveProfile(u.id, p).catch(e=>console.error("[handleAuth] macro resave failed:",e));
      setProfile(p);
      const meals = await getSavedMeals(u.id);
      setSavedMeals(meals.map(m=>({id:m.id,name:m.name,source:m.source||'custom',ingredients:m.ingredients||[],totals:{cal:m.total_calories,p:m.total_protein,c:m.total_carbs,f:m.total_fat}})));
      const log = await getTodayLog(u.id);
      setTodayLog(log);
      const plans = await getWeekPlans(u.id);
      setWeekPlans(plans);
      const todayDow = new Date().getDay();
      const dowIndex = todayDow === 0 ? 6 : todayDow - 1;
      const abKey = dowIndex % 2 === 0 ? 0 : 1;
      if(plans[abKey]) setTodayPlan(plans[abKey]);
      if(data.is_fasting && data.fast_started_at){
        setIsFasting(true); setFastStartedAt(data.fast_started_at); setFastingGoal(data.fasting_goal || 16);
      }
      setPhase("app");
    } else {
      console.log(`[auth] userId: ${u.id} isPro: false (new user — no profile yet)`);
      setPhase("onboarding");
    }
  };

  const handleComplete = async (p) => {
    setProfile(p);
    if(user) await saveProfile(user.id, p);
    setPhase("app");
  };

  const handleStartFast = async (goalHours, startedAt) => {
    setIsFasting(true); setFastStartedAt(startedAt); setFastingGoal(goalHours);
    if(user) await startFast(user.id, goalHours, startedAt);
  };

  const handleEndFast = async (startedAt, endedAt, goalHours, completed) => {
    setIsFasting(false); setFastStartedAt(null);
    if(user) await endFast(user.id, startedAt, endedAt, goalHours, completed);
  };

  const handleTourComplete = () => {
    setProfile(p => p ? { ...p, onboardingCompleted: true } : p);
  };

  const handleSignOut = async () => {
    await signOut();
    setUser(null);setProfile(null);setSavedMeals([]);setTodayLog([]);setTodayPlan([]);setWeekPlans({});
    setIsFasting(false);setFastStartedAt(null);setFastingGoal(16);
    setTab("home");setPhase("auth");
  };

  // Persists pro status to DB so it survives refresh and is ready for Stripe webhooks
  const handleSetIsPro = async (value) => {
    setIsPro(value);
    if(user) await saveProStatus(user.id, value);
  };

  const refreshTodayLog = async () => {
    if(user) { const log = await getTodayLog(user.id); setTodayLog(log); }
  };

  const handleLogMeal = async (meal) => {
    if(user) await logMeal(user.id, meal);
    await refreshTodayLog();
  };

  const handleUnlogMeal = async (logId) => {
    if(user) await deleteMealLog(logId);
    await refreshTodayLog();
  };

  const mapSavedMeals = (rows) =>
    rows.map(m=>({id:m.id,name:m.name,source:m.source||'custom',ingredients:m.ingredients||[],totals:{cal:m.total_calories,p:m.total_protein,c:m.total_carbs,f:m.total_fat}}));

  const handleSaveMeal = async (meal) => {
    if(user) await saveMeal(user.id, meal);
    const meals = user ? await getSavedMeals(user.id) : [];
    setSavedMeals(mapSavedMeals(meals));
  };

  // Toggle heart on a meal — optimistically updates state, syncs to DB
  const handleHeartToggle = async (meal, source) => {
    const existing = savedMeals.find(s => s.name === meal.name);
    if(existing){
      // Already saved — unsave it
      setSavedMeals(prev => prev.filter(s => s.id !== existing.id));
      await deleteSavedMeal(existing.id);
    } else {
      // Not saved — save it with given source
      const { data } = await heartMeal(user.id, meal, source);
      if(data){
        setSavedMeals(prev => [...prev, {id:data.id,name:data.name,source:data.source||source,ingredients:data.ingredients||[],totals:{cal:data.total_calories,p:data.total_protein,c:data.total_carbs,f:data.total_fat}}]);
      } else {
        // Fallback: reload from DB
        const rows = await getSavedMeals(user.id);
        setSavedMeals(mapSavedMeals(rows));
      }
    }
  };

  const handleDeleteSavedMeal = async (id) => {
    setSavedMeals(prev => prev.filter(s => s.id !== id));
    await deleteSavedMeal(id);
  };

  const switchTab = (t) => {
    if(t==="home") refreshTodayLog();
    if(t!=="log") setDefaultLogMealType(null);
    setTab(t);
  };

  const goToLogWithCategory = (cat) => {
    setDefaultLogMealType(cat);
    setTab("log");
  };

  if(phase==="splash") return <Splash onFinish={checkAuth}/>;
  if(phase==="auth") return <AuthScreen onAuth={handleAuth}/>;
  if(phase==="onboarding") return <Onboarding onComplete={handleComplete}/>;

  const screens = {
    home:<Dashboard setTab={switchTab} onLogCategory={goToLogWithCategory} profile={profile} todayLog={todayLog} onLogMeal={handleLogMeal} onUnlogMeal={handleUnlogMeal} todayPlan={todayPlan} weekPlans={weekPlans} userId={user?.id} savedMeals={savedMeals} onHeartMeal={handleHeartToggle} isFasting={isFasting} fastStartedAt={fastStartedAt} fastingGoal={fastingGoal} onStartFast={handleStartFast} onEndFast={handleEndFast}/>,
    plan:<Plan profile={profile} userId={user?.id} isPro={isPro} savedMeals={savedMeals} onHeartMeal={handleHeartToggle} onLogMeal={handleLogMeal} setTab={switchTab} onUpgrade={()=>setShowPricingModal(true)} onWeekPlanUpdate={(plans)=>{
      // plans = { 0: dayA[], 1: dayB[] }
      const wasEmpty = Object.keys(weekPlans).length === 0;
      setWeekPlans(plans);
      const dow=new Date().getDay();
      const idx=dow===0?6:dow-1;
      const abKey=idx%2===0?0:1;
      if(plans[abKey]) setTodayPlan(plans[abKey]);
      // Show PWA prompt on first plan generation (whichever trigger fires first)
      if(wasEmpty) triggerPwaEarly();
    }}/>,
    log:<LogMeal savedMeals={savedMeals} onSaveMeal={handleSaveMeal} todayLog={todayLog} onLogMeal={handleLogMeal} userId={user?.id} onDeleteSavedMeal={handleDeleteSavedMeal} defaultMealType={defaultLogMealType}/>,
    stats:<StatsTab profile={profile} userId={user?.id} isPro={isPro}/>,
    grocery:<Grocery isPro={isPro} setIsPro={handleSetIsPro} weekPlans={weekPlans} userId={user?.id} onUpgrade={()=>setShowPricingModal(true)}/>,
    profile:<ProfileScreen profile={profile} userId={user?.id} userEmail={user?.email} isPro={isPro} onProfileUpdate={p=>setProfile(p)} onSignOut={handleSignOut} onUpgrade={()=>setShowPricingModal(true)} onSetIsPro={handleSetIsPro}/>
  };

  return <div style={{maxWidth:430,margin:"0 auto",minHeight:"100vh",background:T.bg,fontFamily:T.font,position:"relative"}}>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
    <div style={{padding:"12px 20px 8px",display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:600,color:T.txM}}>
      <span>9:41</span>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        <svg width="16" height="12" viewBox="0 0 16 12" fill={T.txM}><rect x="0" y="4" width="3" height="8" rx=".5"/><rect x="4.5" y="2" width="3" height="10" rx=".5"/><rect x="9" y="0" width="3" height="12" rx=".5"/><rect x="13.5" y="3" width="2.5" height="9" rx=".5" opacity=".3"/></svg>
        <svg width="22" height="12" viewBox="0 0 22 12" fill="none"><rect x=".5" y=".5" width="19" height="11" rx="2" stroke={T.txM}/><rect x="2" y="2" width="14" height="8" rx="1" fill={T.acc}/><rect x="20" y="4" width="2" height="4" rx=".5" fill={T.txM}/></svg>
      </div>
    </div>
    <div style={{paddingBottom:88,overflowY:"auto"}}>{screens[tab]}</div>

    {tab==="home"&&<button onClick={()=>switchTab("log")} style={{position:"fixed",bottom:86,right:"calc(50% - 195px)",width:52,height:52,borderRadius:"50%",background:T.acc,border:"none",cursor:"pointer",boxShadow:`0 4px 20px ${T.accM}`,display:"flex",alignItems:"center",justifyContent:"center",zIndex:20}}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.bg} strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
    </button>}

    {pwaPrompt && <PwaPrompt type={pwaPrompt} onInstall={handleInstallClick} onDismiss={dismissPwa}/>}

    {/* ── Pricing modal ── */}
    {showPricingModal && <PricingModal onClose={() => setShowPricingModal(false)}/>}

    {/* ── First-login onboarding tour — rendered at App level so tab navigation works ── */}
    {profile && !profile.onboardingCompleted && user && (
      <OnboardingTour userId={user.id} onSwitchTab={switchTab} onComplete={handleTourComplete}/>
    )}

    <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:"rgba(9,9,11,0.95)",backdropFilter:"blur(24px)",borderTop:`1px solid ${T.bd}`,display:"flex",justifyContent:"space-around",padding:"6px 0 22px",zIndex:10}}>
      {navTabs.map(t=>{
        const a=tab===t.id;
        return <button key={t.id} data-tour={`nav-${t.id}`} onClick={()=>switchTab(t.id)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"4px 7px",transition:"all 0.2s"}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a?T.acc:"#8E8E93"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {t.d.split("|").map((p,i)=><path key={i} d={p}/>)}
          </svg>
          <span style={{fontSize:10,fontWeight:a?600:500,color:a?T.acc:"#8E8E93"}}>{t.label}</span>
        </button>;
      })}
    </div>
  </div>;
}
