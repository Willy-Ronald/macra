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
} from "./lib/supabase";
import { generateMealPlan } from "./lib/claude";

const T = {
  bg:"#09090B",sf:"#121215",bd:"#1E1E22",acc:"#C8B88A",
  accM:"rgba(200,184,138,0.12)",accG:"rgba(200,184,138,0.06)",
  tx:"#FAFAF9",tx2:"#A1A1AA",txM:"#52525B",
  pro:"#7C9CF5",carb:"#D4A853",fat:"#C084A6",ok:"#6BCB77",
  r:14,font:"'Outfit',sans-serif",mono:"'DM Mono',monospace"
};

const Card=({children,style:s={},onClick})=><div onClick={onClick} style={{background:T.sf,borderRadius:T.r,border:`1px solid ${T.bd}`,...s}}>{children}</div>;
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
      <div style={{width:64,height:64,borderRadius:16,background:`linear-gradient(135deg, ${T.acc}, #A89560)`,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:16,boxShadow:`0 8px 32px rgba(200,184,138,0.2)`}}>
        <span style={{fontSize:28,fontWeight:800,color:T.bg,fontFamily:T.font}}>M</span>
      </div>
      <h1 style={{fontSize:32,fontWeight:800,color:T.tx,margin:"0 0 6px",letterSpacing:"-0.03em"}}>Macra</h1>
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
  const fatG = Math.round((target * 0.25) / 9);
  const carbG = Math.max(50, Math.round((target - proteinG * 4 - fatG * 9) / 4));
  const rule = bmi > 35 ? "BMI>35 cap" : diet.includes("High Protein") ? "high_protein preference" : `${goal}+${activity}`;
  console.log(`[macros] protein rule: ${rule} → ${proteinMult}g/lb = ${proteinG}g | BMR:${Math.round(bmr)} TDEE:${tdee} target:${target} C:${carbG}g F:${fatG}g`);
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
    <div style={{
      width:80,height:80,borderRadius:20,
      background:`linear-gradient(135deg, ${T.acc}, #A89560)`,
      display:"flex",alignItems:"center",justifyContent:"center",
      marginBottom:24,
      boxShadow:`0 8px 32px rgba(200,184,138,0.2)`,
      opacity:phase>=0?1:0,transform:phase>=0?"scale(1)":"scale(0.8)",
      transition:"all 0.6s cubic-bezier(0.22, 1, 0.36, 1)"
    }}>
      <span style={{fontSize:36,fontWeight:800,color:T.bg,fontFamily:T.font,letterSpacing:"-0.04em"}}>M</span>
    </div>
    {/* Wordmark */}
    <h1 style={{
      fontSize:38,fontWeight:800,color:T.tx,margin:"0 0 8px",
      letterSpacing:"-0.03em",fontFamily:T.font,
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
    activity:"active",goal:"lean_bulk",diet:[]
  });

  const set = (k,v) => setProfile(p=>({...p,[k]:v}));
  const next = () => {setDir(1);setStep(s=>s+1)};
  const back = () => {setDir(-1);setStep(s=>s-1)};

  const totalSteps = 6;
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

  const macros = step===5 ? calcMacros(profile) : null;

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

    // 5: Results
    <div key="5">
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
          {l:"Protein",v:`${macros?.proteinG}g`,c:T.pro,sub:`${macros?macros.proteinG*4:0} cal`},
          {l:"Carbs",v:`${macros?.carbG}g`,c:T.carb,sub:`${macros?macros.carbG*4:0} cal`},
          {l:"Fat",v:`${macros?.fatG}g`,c:T.fat,sub:`${macros?macros.fatG*9:0} cal`},
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
        if(step < totalSteps - 1) next();
        else onComplete({...profile,macros:calcMacros(profile)});
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
const SwipeableRow = ({onDelete, children}) => {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(null);
  const startY = useRef(null);
  const isHoriz = useRef(false);
  const REVEAL = 80;

  const onTS = (e) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
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
    if (dx < 0) setOffset(Math.max(dx, -REVEAL));
  };
  const onTE = () => {
    setDragging(false);
    startX.current = null;
    setOffset(prev => prev < -(REVEAL / 2) ? -REVEAL : 0);
  };

  return (
    <div style={{position:"relative", overflow:"hidden", borderRadius:T.r, marginBottom:6}}>
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

// ─── DASHBOARD ─────────────────────────────────────────────────
const Dashboard = ({setTab,profile,todayLog=[],onLogMeal,onUnlogMeal,todayPlan=[],weekPlans={},userId,savedMeals=[],onHeartMeal}) => {
  const [viewDate,setViewDate]=useState(()=>new Date());
  const [historyLog,setHistoryLog]=useState(null); // null = showing today
  const [loggingId,setLoggingId]=useState(null);
  const m = profile?.macros || {target:2200,proteinG:180,carbG:240,fatG:70};

  const todayStr = new Date().toISOString().split("T")[0];
  const viewStr = viewDate.toISOString().split("T")[0];
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

  const dayNames = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];
  const monthNames = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const dateStr = `${dayNames[viewDate.getDay()]}, ${monthNames[viewDate.getMonth()]} ${viewDate.getDate()}`;

  const goDay = (delta) => {
    const d = new Date(viewDate);
    d.setDate(d.getDate()+delta);
    if(d > new Date()) return; // can't go to future
    setViewDate(d);
  };

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

  return <div style={{padding:"0 20px 24px"}}>
    {/* Date navigation bar */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:4,marginBottom:isToday?0:8}}>
      <button onClick={()=>goDay(-1)} style={{background:"none",border:"none",color:T.tx2,fontSize:18,cursor:"pointer",padding:"8px 12px 8px 0"}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.tx2} strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <div style={{textAlign:"center"}}>
        <p style={{fontSize:11,color:isToday?T.txM:T.acc,fontWeight:600,margin:0,letterSpacing:"0.08em"}}>{isToday?"TODAY":dateStr}</p>
        {isToday && <p style={{fontSize:11,color:T.txM,fontWeight:500,margin:"2px 0 0",letterSpacing:"0.08em"}}>{dateStr}</p>}
      </div>
      <button onClick={()=>goDay(1)} style={{background:"none",border:"none",color:isToday?T.bd:T.tx2,fontSize:18,cursor:isToday?"default":"pointer",padding:"8px 0 8px 12px"}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isToday?T.bd:T.tx2} strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>

    {/* Back to Today button */}
    {!isToday && <button onClick={()=>setViewDate(new Date())} style={{width:"100%",padding:10,borderRadius:10,border:`1px solid ${T.acc}40`,background:T.accG,color:T.acc,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:T.font,marginBottom:12}}>
      ← Back to Today
    </button>}

    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:28}}>
      <div>
        <h1 style={{fontSize:26,fontWeight:700,color:T.tx,margin:"6px 0 0",letterSpacing:"-0.02em"}}>
          {isEmpty
            ? (profile?.name ? `Welcome, ${profile.name}.` : "Welcome.")
            : isToday ? (profile?.name ? `Hey, ${profile.name}` : "Daily Overview") : "Day Review"}
        </h1>
        {isEmpty && <p style={{fontSize:14,color:T.tx2,margin:"4px 0 0",fontWeight:400}}>Let's get started.</p>}
      </div>
      <div style={{width:38,height:38,borderRadius:"50%",background:T.acc,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <span style={{fontSize:14,fontWeight:700,color:T.bg}}>{(profile?.name||"U")[0]}</span>
      </div>
    </div>

    <Card style={{padding:"28px 24px",marginBottom:16}}>
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

    {/* ── Empty state: no log + no plan yet ── */}
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
      {/* ── Day's Plan ── */}
      {dayPlanMeals.length > 0 && <>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"24px 0 14px"}}>
          <div>
            <h2 style={{fontSize:15,fontWeight:600,color:T.tx,margin:0}}>{isToday?"Today's Plan":"Day's Plan"}</h2>
            <span style={{fontSize:10,color:T.txM,fontWeight:500}}>{planLabel}</span>
          </div>
          <span onClick={()=>setTab("plan")} style={{fontSize:12,color:T.acc,fontWeight:500,cursor:"pointer"}}>View Plan</span>
        </div>
        {unloggedPlan.length === 0 && <Card style={{padding:"16px",textAlign:"center",marginBottom:6}}>
          <p style={{fontSize:13,color:T.txM,margin:0}}>All planned meals logged! Nice work.</p>
        </Card>}
        {unloggedPlan.map((pm,i)=>{
          const isLogging = loggingId === pm.name;
          return <Card key={"plan-"+i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginBottom:6,border:`1px dashed ${T.bd}`,background:"transparent",cursor:"pointer"}} onClick={()=>handleLogForDate({type:pm.type||"meal",name:pm.name,cal:pm.cal,p:pm.p||0,c:pm.c||0,f:pm.f||0})}>
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
      </>}

      {/* ── Eaten / Meals Logged ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"24px 0 14px"}}>
        <h2 style={{fontSize:15,fontWeight:600,color:T.tx,margin:0}}>{isToday?"Eaten Today":"Meals Logged"}</h2>
        <span style={{fontSize:12,color:T.txM,fontFamily:T.mono}}>{displayLog.length} meal{displayLog.length!==1?"s":""}</span>
      </div>
      {displayLog.length === 0 && <Card style={{padding:"16px",textAlign:"center",marginBottom:6}}>
        <p style={{fontSize:13,color:T.txM,margin:0}}>{isToday?"Nothing logged yet. Tap a meal above or go to the Log tab.":"No meals logged on this day. Tap any planned meal above to log it."}</p>
      </Card>}
      {displayLog.map((x)=><SwipeableRow key={x.id} onDelete={()=>handleUnlogForDate(x.id)}>
        <Card style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginBottom:0}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:T.ok,boxShadow:`0 0 8px ${T.ok}40`}}/>
            <div>
              <p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>{x.name}</p>
              <div style={{display:"flex",gap:8,marginTop:3}}>
                {[{v:x.calories||0,l:"cal",c:T.acc},{v:x.protein||0,l:"P",c:T.pro,u:"g"},{v:x.carbs||0,l:"C",c:T.carb,u:"g"},{v:x.fat||0,l:"F",c:T.fat,u:"g"}].map(z=>
                  <span key={z.l} style={{fontSize:10,fontFamily:T.mono,color:z.c}}>{z.v}{z.u||""}<span style={{color:T.txM,fontSize:8}}> {z.l}</span></span>
                )}
              </div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={(e)=>{e.stopPropagation();onHeartMeal&&onHeartMeal({name:x.name,cal:x.calories,p:x.protein,c:x.carbs,f:x.fat},'manual');}} style={{background:"none",border:"none",cursor:"pointer",padding:4,display:"flex",alignItems:"center"}}>
              <HeartIcon filled={savedMeals.some(s=>s.name===x.name)}/>
            </button>
            <span style={{fontSize:10,color:T.txM,letterSpacing:"0.05em"}}>swipe ←</span>
          </div>
        </Card>
      </SwipeableRow>)}

      {isToday && <Card style={{padding:"14px 16px",marginTop:16,background:T.accG,border:`1px solid ${T.accM}`,display:"flex",alignItems:"flex-start",gap:10}}>
        <span style={{fontSize:14}}>✦</span>
        <p style={{fontSize:13,color:T.tx2,margin:0,lineHeight:1.5}}>{insightText}</p>
      </Card>}
    </>}
  </div>;
};

// ─── PLAN (AI-POWERED) ─────────────────────────────────────────
// Must mirror the constants in api/generate-plan.js exactly
const FREE_DAILY   = 1;
const FREE_WEEKLY  = 2;
const FREE_MONTHLY = 8;
const PRO_DAILY    = 3;
const PRO_MONTHLY  = 20;

const Plan = ({profile,userId,isPro,onWeekPlanUpdate,savedMeals=[],onHeartMeal}) => {
  const [sel,setSel]=useState("A");
  const [loading,setLoading]=useState(false);
  const [loadMsg,setLoadMsg]=useState("");
  const [genError,setGenError]=useState("");
  const [limitHit,setLimitHit]=useState(false);
  const [abPlan,setAbPlan]=useState({});
  const [genCount,setGenCount]=useState(0);
  const [plansLoaded,setPlansLoaded]=useState(false);
  const [remaining,setRemaining]=useState(null); // null = not yet loaded

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
          const rem={
            daily:   Math.max(0, FREE_DAILY   - usage.dailyCount),
            weekly:  Math.max(0, FREE_WEEKLY  - usage.weeklyCount),
            monthly: Math.max(0, FREE_MONTHLY - usage.monthlyCount),
          };
          setRemaining(rem);
          if(rem.daily===0 || rem.weekly===0 || rem.monthly===0) setLimitHit(true);
        } else {
          const rem={
            daily:   Math.max(0, PRO_DAILY   - usage.dailyCount),
            monthly: Math.max(0, PRO_MONTHLY - usage.monthlyCount),
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
        // Re-evaluate limitHit based on updated remaining counts
        const r = result.remaining;
        const hit = isPro
          ? (r.daily===0 || r.monthly===0)
          : (r.daily===0 || r.weekly===0 || r.monthly===0);
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
  // Always returns a string (never null) when remaining is set, so the
  // counter stays visible even at 0 and alongside the limit-hit banner.
  const usageLine = () => {
    if(!remaining) return null;
    if(!isPro){
      // Show the most restrictive remaining count so the user always knows
      // exactly how many generations they have left right now.
      const d = remaining.daily   ?? 0;
      const w = remaining.weekly  ?? 0;
      const m = remaining.monthly ?? 0;
      return `${d} of ${FREE_DAILY} today · ${w} of ${FREE_WEEKLY} this week · ${m} of ${FREE_MONTHLY} this month`;
    }
    // Pro
    const dayTxt   = `${remaining.daily   ?? 0} of ${PRO_DAILY} left today`;
    const monthTxt = `${remaining.monthly ?? 0} of ${PRO_MONTHLY} left this month`;
    return `${dayTxt} · ${monthTxt}`;
  };

  // Which specific limit did a Pro user hit?
  const proLimitKind = () => {
    if(!remaining||isPro===false) return null;
    if(remaining.daily===0)   return "daily";
    if(remaining.monthly===0) return "monthly";
    return null;
  };

  return <div style={{padding:"0 20px 24px"}}>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    <h1 style={{fontSize:26,fontWeight:700,color:T.tx,margin:"4px 0 16px",letterSpacing:"-0.02em"}}>Meal Plan</h1>

    {/* A/B tabs */}
    <Card style={{display:"flex",padding:4,marginBottom:8}}>
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
    {!loading && meals.map((m,i)=><Card key={i+"-"+sel+"-"+genCount} style={{padding:18,marginBottom:8,animation:"fadeUp 0.4s ease both",animationDelay:`${i*0.08}s`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:10,fontWeight:600,color:T.acc,letterSpacing:"0.14em"}}>{m.type}</span>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={(e)=>{e.stopPropagation();onHeartMeal&&onHeartMeal(m,'ai_plan');}} style={{background:"none",border:"none",cursor:"pointer",padding:4,display:"flex",alignItems:"center"}}>
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
          <button style={{padding:"12px 28px",borderRadius:T.r,border:"none",background:T.acc,color:T.bg,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:T.font}}>
            Upgrade to Pro — $4.99/mo
          </button>
        ) : (
          <p style={{fontSize:12,color:T.txM,margin:0}}>
            {proLimitKind()==="daily" ? "Resets tomorrow at midnight" : "Resets on the 1st of next month"}
          </p>
        )}
      </Card>}

      {/* Generate / Regenerate button */}
      <button
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
      {!isPro && !limitHit && remaining && remaining.weekly > 0 && <p style={{fontSize:11,color:T.txM,textAlign:"center",margin:"4px 0 0"}}>
        Go Pro for 3/day · 20/month generations
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

const LogMeal = ({savedMeals=[],onSaveMeal,todayLog=[],onLogMeal,userId,onDeleteSavedMeal}) => {
  const [view,setView]=useState("main"); // main | create | manual | saved | custom
  const [loggedId,setLoggedId]=useState(null);
  const [manualForm,setManualForm]=useState({name:"",cal:"",p:"",c:"",f:""});
  const [manualSuccess,setManualSuccess]=useState(false);
  // Frequent meals — loaded from meal_log (count >= 2), no hardcoded defaults
  const [frequentMeals,setFrequentMeals]=useState([]);
  const [freqLoaded,setFreqLoaded]=useState(false);
  const [hiddenNames,setHiddenNames]=useState([]); // locally hidden from "Frequently Logged"

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
  const [offResults,setOffResults]=useState([]);
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

  const getMealTypeByTime = () => {
    const h = new Date().getHours();
    if(h<10) return "breakfast";
    if(h<13) return "lunch";
    if(h<16) return "snack";
    return "dinner";
  };

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
    setSearchQuery("");setSavedResults([]);setUsdaResults([]);setOffResults([]);
    setSelectedFood(null);setSelectedPortion(null);setQtyValue("1");setQtyUnit("servings");
    setSearchError("");setEditNutrition(null);setSearchLogSuccess(false);setSearchLoading(false);
  };

  const searchFoods = async (query) => {
    if(!query||query.length<2){setSavedResults([]);setUsdaResults([]);setOffResults([]);setSearchError("");return;}

    if(abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;

    const q = query.toLowerCase();
    const localMatches = savedMeals.filter(m=>m.name.toLowerCase().includes(q)).slice(0,5).map(m=>({
      id:"saved-"+m.id, name:m.name, brand:"", servingLabel:"Per 1 meal", servingGrams:null,
      cal:m.totals.cal, protein:m.totals.p, carbs:m.totals.c, fat:m.totals.f,
      basePer100:null, hasNutrition:true, source:"saved",
    }));
    setSavedResults(localMatches);

    setSearchLoading(true);setSearchError("");
    let usdaOk=false, offOk=false;

    // USDA FoodData Central
    const usdaFetch = async () => {
      try {
        const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY&query=${encodeURIComponent(query)}&pageSize=8&dataType=SR%20Legacy,Foundation`;
        const res = await fetch(url, {signal});
        if(signal.aborted) return;
        if(!res.ok) throw new Error();
        const data = await res.json();
        const items = (data.foods||[]).map(f=>{
          const getNut = (id) => {const n=f.foodNutrients?.find(n=>n.nutrientId===id);return n?Math.round(n.value*10)/10:0;};
          const base = {cal:getNut(1008), protein:getNut(1003), carbs:getNut(1005), fat:getNut(1004)};
          const portions = [{label:"100g",gramWeight:100}];
          (f.foodMeasures||[]).forEach(m=>{
            if(m.gramWeight && m.gramWeight>0 && m.disseminationText && m.disseminationText!=="Quantity not specified"){
              portions.push({label:m.disseminationText, gramWeight:Math.round(m.gramWeight)});
            }
          });
          const defP = portions.length>1 ? portions[1] : portions[0];
          const mult = defP.gramWeight/100;
          return {
            id:"usda-"+f.fdcId, name:f.description||"", brand:f.brandName||"",
            servingLabel:"Per "+defP.label+(defP.gramWeight!==100?" ("+defP.gramWeight+"g)":""),
            servingGrams:defP.gramWeight,
            cal:Math.round(base.cal*mult), protein:Math.round(base.protein*mult),
            carbs:Math.round(base.carbs*mult), fat:Math.round(base.fat*mult),
            basePer100:base, portions, activePortion:portions.indexOf(defP),
            hasNutrition:base.cal>0, source:"usda",
          };
        }).filter(f=>f.name);
        if(!signal.aborted){setUsdaResults(items);usdaOk=true;}
      } catch(e){if(e.name!=="AbortError"&&!signal.aborted) setUsdaResults([]);}
    };

    // OpenFoodFacts — 3-tier serving detection
    const offFetch = async () => {
      try {
        const url = `https://us.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=8&lc=en&cc=us`;
        const res = await fetch(url, {signal});
        if(signal.aborted) return;
        if(!res.ok) throw new Error();
        const data = await res.json();
        const items = (data.products||[]).map(p=>{
          const n=p.nutriments||{};
          const servSize = p.serving_size||"";
          const servGrams = parseServingGrams(servSize);
          const has100 = !!(n["energy-kcal_100g"]);
          let cal,protein,carbs,fat,servingLabel;

          // Tier 1: per-serving nutrient values exist
          if(n["energy-kcal_serving"] && n["energy-kcal_serving"]>0){
            cal=Math.round(n["energy-kcal_serving"]);
            protein=Math.round(n.proteins_serving||0);
            carbs=Math.round(n.carbohydrates_serving||0);
            fat=Math.round(n.fat_serving||0);
            servingLabel=servSize ? "Per "+servSize : "Per serving";
          }
          // Tier 2: no per-serving values, but serving_size has grams + we have per-100g
          else if(servGrams && has100){
            const mult = servGrams/100;
            cal=Math.round((n["energy-kcal_100g"]||0)*mult);
            protein=Math.round((n.proteins_100g||0)*mult);
            carbs=Math.round((n.carbohydrates_100g||0)*mult);
            fat=Math.round((n.fat_100g||0)*mult);
            servingLabel="Per "+servSize;
          }
          // Tier 3: fallback to per-100g
          else {
            cal=Math.round(n["energy-kcal_100g"]||0);
            protein=Math.round(n.proteins_100g||0);
            carbs=Math.round(n.carbohydrates_100g||0);
            fat=Math.round(n.fat_100g||0);
            servingLabel="Per 100g";
          }

          return {
            id:"off-"+(p._id||p.code), name:p.product_name||"", brand:p.brands||"",
            servingLabel, servingGrams: servGrams||(servingLabel==="Per 100g"?100:null),
            cal, protein, carbs, fat,
            basePer100: has100 ? {cal:Math.round(n["energy-kcal_100g"]||0),protein:Math.round(n.proteins_100g||0),carbs:Math.round(n.carbohydrates_100g||0),fat:Math.round(n.fat_100g||0)} : null,
            hasNutrition:cal>0, source:"off",
          };
        }).filter(p=>p.name);
        if(!signal.aborted){setOffResults(items);offOk=true;}
      } catch(e){if(e.name!=="AbortError"&&!signal.aborted) setOffResults([]);}
    };

    const withTimeout = (fn) => Promise.race([fn(), new Promise(r=>setTimeout(r,5000))]);
    await Promise.allSettled([withTimeout(usdaFetch), withTimeout(offFetch)]);

    if(!signal.aborted){
      setSearchLoading(false);
      if(!usdaOk && !offOk && localMatches.length===0) setSearchError("Couldn't reach food databases. Try manual entry instead.");
    }
  };

  const allResults = (() => {
    const seen = new Set();
    const dedup = (items) => items.filter(r => {
      const key = r.name.toLowerCase().replace(/\s+/g," ").trim();
      if(seen.has(key)) return false;
      seen.add(key);return true;
    });
    return {saved:dedup(savedResults), usda:dedup(usdaResults), off:dedup(offResults)};
  })();
  const hasResults = allResults.saved.length>0||allResults.usda.length>0||allResults.off.length>0;

  const handleSearchInput = (val) => {
    setSearchQuery(val);
    setSelectedFood(null);setSelectedPortion(null);setSearchLogSuccess(false);
    if(!val||val.length<2){
      if(abortRef.current) abortRef.current.abort();
      setSavedResults([]);setUsdaResults([]);setOffResults([]);setSearchError("");setSearchLoading(false);
      if(debounceRef.current) clearTimeout(debounceRef.current);
      return;
    }
    if(debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(()=>searchFoods(val),300);
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
    const type = getMealTypeByTime();
    onLogMeal({type,name:selectedFood.name+(selectedFood.brand?` (${selectedFood.brand})`:""),cal:fm.cal,p:fm.p,c:fm.c,f:fm.f});
    setSearchLogSuccess(true);
    setTimeout(()=>{setSearchLogSuccess(false);setSelectedFood(null);setSelectedPortion(null);setSearchQuery("");setQtyValue("1");setQtyUnit("servings");setEditNutrition(null);setSavedResults([]);setUsdaResults([]);setOffResults([])},1500);
  };

  const quickLog = (item, feedbackId) => {
    if(!onLogMeal) return;
    const type = getMealTypeByTime();
    onLogMeal({type,name:item.n||item.name,cal:item.cal||item.totals?.cal||0,p:item.p||item.totals?.p||0,c:item.c||item.totals?.c||0,f:item.f||item.totals?.f||0});
    setLoggedId(feedbackId);
    setTimeout(()=>setLoggedId(null),1200);
  };

  const handleManualLog = () => {
    if(!manualForm.name||!manualForm.cal||!onLogMeal) return;
    const type = getMealTypeByTime();
    onLogMeal({type,name:manualForm.name,cal:+manualForm.cal||0,p:+manualForm.p||0,c:+manualForm.c||0,f:+manualForm.f||0});
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
      <p style={{fontSize:13,color:T.txM,margin:"0 0 20px"}}>Hearted meals from your plan and logs.</p>
      {savedList.length===0 && <Card style={{padding:"24px 16px",textAlign:"center"}}>
        <p style={{fontSize:13,color:T.txM,margin:0}}>No saved meals yet. Heart a meal in the Plan tab or on a logged entry to save it here.</p>
      </Card>}
      {savedList.map(m=>{
        const fk="savedv-"+m.id;
        const isLogged=loggedId===fk;
        return <SwipeableRow key={m.id} onDelete={()=>onDeleteSavedMeal&&onDeleteSavedMeal(m.id)}>
          <Card style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginBottom:0,cursor:"pointer"}} onClick={()=>quickLog({name:m.name,cal:m.totals.cal,p:m.totals.p,c:m.totals.c,f:m.totals.f},fk)}>
            <div style={{flex:1}}>
              <p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>{m.name}</p>
              <div style={{display:"flex",gap:8,marginTop:3}}>
                {[{v:m.totals.cal,l:"cal",c:T.acc},{v:m.totals.p+"g",l:"P",c:T.pro},{v:m.totals.c+"g",l:"C",c:T.carb},{v:m.totals.f+"g",l:"F",c:T.fat}].map(x=>
                  <span key={x.l} style={{fontSize:10,fontFamily:T.mono,color:x.c}}>{x.v}<span style={{color:T.txM,fontSize:8}}> {x.l}</span></span>
                )}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <button onClick={(e)=>{e.stopPropagation();onDeleteSavedMeal&&onDeleteSavedMeal(m.id);}} style={{background:"none",border:"none",cursor:"pointer",padding:4,display:"flex",alignItems:"center"}}>
                <HeartIcon filled size={18}/>
              </button>
              <div style={{width:28,height:28,borderRadius:"50%",background:isLogged?T.ok:T.accM,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.3s ease"}}>
                {isLogged
                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>}
              </div>
            </div>
          </Card>
        </SwipeableRow>;
      })}
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
      <p style={{fontSize:13,color:T.txM,margin:"0 0 20px"}}>Your hand-built recipes and meal templates.</p>
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

      {/* Search error — only when both APIs fail */}
      {searchError && !searchLoading && !hasResults && <Card style={{padding:"14px 16px",marginTop:4}}>
        <p style={{fontSize:13,color:T.txM,margin:0}}>{searchError}</p>
      </Card>}

      {/* Search results grouped by source */}
      {hasResults && !selectedFood && <div style={{marginTop:4,maxHeight:380,overflowY:"auto",borderRadius:T.r,border:`1px solid ${T.bd}`,background:T.sf}}>
        {[{label:"Your Meals",items:allResults.saved,color:T.ok},{label:"Foods",items:allResults.usda,color:T.acc},{label:"Branded Products",items:allResults.off,color:T.tx2}].map(group=>
          group.items.length>0 && <div key={group.label}>
            <div style={{padding:"8px 16px 4px",background:T.bg,borderBottom:`1px solid ${T.bd}`,position:"sticky",top:0,zIndex:1}}>
              <span style={{fontSize:10,fontWeight:700,color:group.color,letterSpacing:"0.1em",textTransform:"uppercase"}}>{group.label}</span>
            </div>
            {group.items.map((r,i)=><div key={r.id} onClick={()=>selectFood(r)} style={{padding:"11px 16px",borderBottom:`1px solid ${T.bd}`,cursor:"pointer"}}>
              <p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0,lineHeight:1.3}}>{r.name}</p>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:3}}>
                <span style={{fontSize:11,color:T.txM}}>{r.brand||""}{r.brand&&r.servingLabel?" · ":""}<span style={{color:T.txM}}>{r.servingLabel||""}</span></span>
                <span style={{fontSize:12,fontFamily:T.mono,color:r.hasNutrition?T.acc:T.txM,fontWeight:600}}>{r.hasNutrition?`${r.cal} cal`:"No cal data"}</span>
              </div>
            </div>)}
          </div>
        )}
        {searchLoading && <div style={{padding:"10px 16px",display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:14,height:14,borderRadius:"50%",border:`2px solid ${T.bd}`,borderTopColor:T.acc,animation:"spin 1s linear infinite"}}/>
          <span style={{fontSize:12,color:T.txM}}>Loading more results...</span>
        </div>}
      </div>}

      {/* No results after search completes */}
      {searchQuery.length>=2 && !searchLoading && !hasResults && !searchError && !selectedFood && <Card style={{padding:"14px 16px",marginTop:4}}>
        <p style={{fontSize:13,color:T.txM,margin:0}}>No results found. Try a different term or use manual entry.</p>
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
    <div style={{display:"flex",gap:8,marginBottom:24}}>
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
        <p style={{fontSize:11,color:T.txM,margin:"0 0 14px"}}>Type: <span style={{color:T.acc,fontWeight:600}}>{getMealTypeByTime()}</span> (based on current time)</p>
        <button onClick={handleManualLog} style={{width:"100%",padding:14,borderRadius:T.r,border:"none",background:T.acc,color:T.bg,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:T.font,opacity:(manualForm.name&&manualForm.cal)?1:0.4,pointerEvents:(manualForm.name&&manualForm.cal)?"auto":"none"}}>
          Log It
        </button>
      </>}
    </Card>}
    {/* ── Frequently Logged ── */}
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
const Grocery = ({isPro,setIsPro,weekPlans={},userId}) => {
  const [activeTab,setActiveTab]=useState("mylist"); // "planlist" | "mylist"

  // ── My List state (FREE) ──
  const [myItems,setMyItems]=useState([]);
  const [myListLoaded,setMyListLoaded]=useState(false);
  const [addForm,setAddForm]=useState({name:"",qty:"1",unit:"lbs"});
  const [showAdd,setShowAdd]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const [editForm,setEditForm]=useState({name:"",qty:"",unit:""});

  // ── Plan List state (PRO) ──
  const [planChecked,setPlanChecked]=useState({});

  const myListUnits=["lbs","oz","dozen","gallon","liter","box","package","bunch","bag","can","jar","count"];
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
    const newItems = [...myItems, {id:Date.now().toString(),name:addForm.name.trim(),qty:addForm.qty,unit:addForm.unit,checked:false}];
    await persistMyList(newItems);
    setAddForm({name:"",qty:"1",unit:"lbs"});
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
    setEditForm({name:item.name,qty:item.qty,unit:item.unit});
  };

  const saveEdit = async () => {
    if(!editForm.name.trim()) return;
    await persistMyList(myItems.map(x=>x.id===editingId?{...x,name:editForm.name.trim(),qty:editForm.qty,unit:editForm.unit}:x));
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
    <Card style={{display:"flex",padding:4,marginBottom:20}}>
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
            <button onClick={()=>setIsPro(true)} style={{padding:"14px 36px",borderRadius:T.r,border:"none",background:T.acc,color:T.bg,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:T.font,marginBottom:8}}>
              Upgrade to Macra Pro — $4.99/mo
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
          <Card style={{padding:"8px 14px",marginBottom:16,background:T.accG,border:`1px solid ${T.accM}`}}>
            <p style={{fontSize:11,color:T.tx2,margin:0}}>✦ Day A × 4 days + Day B × 3 days · quantities combined and deduplicated</p>
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
          <button onClick={()=>setIsPro(false)} style={{width:"100%",padding:10,borderRadius:T.r,border:`1px dashed ${T.bd}`,background:"transparent",color:T.txM,fontSize:11,cursor:"pointer",fontFamily:T.font,marginTop:4}}>
            ↩ Switch to Free tier (dev toggle)
          </button>
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
          <div style={{display:"flex",gap:8,marginBottom:14}}>
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
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setShowAdd(false);setAddForm({name:"",qty:"1",unit:"lbs"})}} style={{flex:1,padding:11,borderRadius:10,border:`1px solid ${T.bd}`,background:"transparent",color:T.tx2,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:T.font}}>Cancel</button>
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
      {myItems.length > 0 && <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <Lbl>My Items ({myItems.length})</Lbl>
        {myItems.some(x=>x.checked) && <button onClick={async()=>await persistMyList(myItems.filter(x=>!x.checked))} style={{background:"none",border:"none",color:"rgba(239,68,68,0.7)",fontSize:12,cursor:"pointer",fontFamily:T.font,fontWeight:500}}>Clear checked</button>}
      </div>}

      {myItems.map(item=>{
        if(editingId===item.id) return (
          <Card key={item.id} style={{padding:"14px",marginBottom:6,border:`1px solid ${T.acc}40`}}>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <input value={editForm.name} onChange={e=>setEditForm(p=>({...p,name:e.target.value}))} style={{...inputStyle,flex:2}} onKeyDown={e=>e.key==="Enter"&&saveEdit()}/>
              <input value={editForm.qty} onChange={e=>setEditForm(p=>({...p,qty:e.target.value}))} type="number" style={{...inputStyle,flex:"0 0 60px",textAlign:"center"}}/>
              <select value={editForm.unit} onChange={e=>setEditForm(p=>({...p,unit:e.target.value}))} style={{...inputStyle,flex:"0 0 80px",appearance:"none"}}>
                {myListUnits.map(u=><option key={u} value={u}>{u}</option>)}
              </select>
            </div>
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

const ProfileScreen = ({profile, userId, onProfileUpdate, onSignOut}) => {
  const m = profile?.macros;
  // view: null | "diet" | "foods" | "cuisines" | "name" | "sex" | "age" | "weight" | "height" | "activity" | "goal"
  const [view, setView] = useState(null);
  const [savedToast, setSavedToast] = useState(false);
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

  const showSaved = () => { setSavedToast(true); setTimeout(()=>setSavedToast(false),2000); };

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

  const Chevron = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.txM} strokeWidth="1.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>;
  const BackBtn = ({onBack}) => <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:6,padding:0,color:T.acc,fontSize:14,fontWeight:600,fontFamily:T.font,marginBottom:20}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>Back</button>;
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
        <h2 style={{fontSize:18,fontWeight:600,color:T.tx,margin:"0 0 2px"}}>{profile?.name||"User"}</h2>
        <span style={{fontSize:12,color:T.txM}}>Macra Free</span>
        <span style={{fontSize:12,color:T.acc,marginLeft:8,fontWeight:500,cursor:"pointer"}}>Go Pro →</span>
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
    <Card onClick={()=>enterView("stats")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginTop:8,marginBottom:6,cursor:"pointer"}}>
      <div>
        <p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>Adjust Your Stats</p>
        <p style={{fontSize:11,color:T.txM,margin:"2px 0 0"}}>{statsSummary}</p>
      </div>
      <Chevron/>
    </Card>
    <div style={{marginBottom:20}}/>

    {/* Food preferences */}
    <Lbl>Food Preferences</Lbl>
    <Card onClick={()=>enterView("diet")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginTop:8,marginBottom:6,cursor:"pointer"}}>
      <div><p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>Dietary Preference</p><p style={{fontSize:11,color:T.txM,margin:"2px 0 0"}}>{dietLabel()}</p></div>
      <Chevron/>
    </Card>
    <Card onClick={()=>enterView("foods")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginBottom:6,cursor:"pointer"}}>
      <div><p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>Foods I Don't Eat</p><p style={{fontSize:11,color:T.txM,margin:"2px 0 0"}}>{foodsCount>0?`${foodsCount} item${foodsCount!==1?"s":""} excluded`:"None added"}</p></div>
      <Chevron/>
    </Card>
    <Card onClick={()=>enterView("cuisines")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginBottom:20,cursor:"pointer"}}>
      <div><p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>Cuisines I Don't Want</p><p style={{fontSize:11,color:T.txM,margin:"2px 0 0"}}>{cuisinesCount>0?`${cuisinesCount} cuisine${cuisinesCount!==1?"s":""} excluded`:"All cuisines enabled"}</p></div>
      <Chevron/>
    </Card>

    {/* App settings */}
    <Lbl>App Settings</Lbl>
    {[{l:"Household Mode",d:"Add partner's profile",pro:true},{l:"Notifications",d:"Meal reminders, reports"},{l:"Subscription",d:"Macra Free"}].map((s,i)=>(
      <Card key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginTop:8,marginBottom:6,cursor:"pointer"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>{s.l}</p>
            {s.pro&&<span style={{fontSize:8,fontWeight:700,color:T.bg,background:T.acc,padding:"2px 6px",borderRadius:4}}>PRO</span>}
          </div>
          <p style={{fontSize:11,color:T.txM,margin:"2px 0 0"}}>{s.d}</p>
        </div>
        <Chevron/>
      </Card>
    ))}
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

const navTabs=[
  {id:"home",label:"Home",d:"M3 9.5L12 3l9 6.5V20a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 20V9.5z"},
  {id:"plan",label:"Plan",d:"M3,4h18v18H3zM16 2v4M8 2v4M3 10h18"},
  {id:"log",label:"Log",d:"M12,3a9,9 0 1,0 0,18a9,9 0 1,0 0,-18M12 7v5l3.5 2"},
  {id:"grocery",label:"List",d:"M9 5h11M9 12h11M9 19h11"},
  {id:"profile",label:"You",d:"M12,3.5a4.5,4.5 0 1,0 0,9a4.5,4.5 0 1,0 0,-9M4.5 21c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5"},
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

  // ── PWA install prompt ──────────────────────────────────────────
  const [pwaPrompt,setPwaPrompt] = useState(null); // null | 'native' | 'ios'
  const deferredInstallEvent = useRef(null); // stores the beforeinstallprompt event
  const pwaTimerRef = useRef(null);          // 30-second delay timer
  const pwaTypeRef = useRef(null);           // 'native' | 'ios', set when ready

  // Set up PWA listeners once the user reaches the app phase
  useEffect(() => {
    if(phase !== "app") return;

    // Already running as installed PWA — never show
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || !!window.navigator.standalone;
    if(isStandalone) return;

    // User dismissed previously — never show again
    if(localStorage.getItem("pwa-dismissed")) return;

    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios|edgios/i.test(ua);

    if(isIos && isSafari){
      // iOS Safari has no beforeinstallprompt — show manual instructions
      pwaTypeRef.current = "ios";
      pwaTimerRef.current = setTimeout(() => setPwaPrompt("ios"), 30000);
      return () => clearTimeout(pwaTimerRef.current);
    }

    // Chrome / Android / Edge — wait for beforeinstallprompt
    const handleBip = (e) => {
      e.preventDefault();
      deferredInstallEvent.current = e;
      pwaTypeRef.current = "native";
      if(!pwaTimerRef.current){
        pwaTimerRef.current = setTimeout(() => setPwaPrompt("native"), 30000);
      }
    };

    const handleInstalled = () => {
      clearTimeout(pwaTimerRef.current);
      deferredInstallEvent.current = null;
      setPwaPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBip);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      clearTimeout(pwaTimerRef.current);
      window.removeEventListener("beforeinstallprompt", handleBip);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [phase]);

  // Called when first plan is generated — shows prompt immediately (skips 30s timer)
  const triggerPwaEarly = () => {
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
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const u = session?.user ?? null;
      if(u){
        setUser(u);
        // Load profile from Supabase
        const {data} = await getProfile(u.id);
        if(data){
          const proFlag = data.is_pro === true;
          console.log("[checkAuth] profile loaded", { userId: u.id, isPro: proFlag });
          setIsPro(proFlag);
          const pBase = {
            name:data.name, sex:data.sex, age:data.age,
            weightLbs:data.weight_lbs, heightFt:data.height_ft, heightIn:data.height_in,
            activity:data.activity, goal:data.goal, diet:data.diet||[],
            dislikedFoods:data.disliked_foods||[], dislikedCuisines:data.disliked_cuisines||[],
          };
          const hasStats = pBase.sex && pBase.age && pBase.weightLbs && pBase.heightFt != null && pBase.activity && pBase.goal;
          const freshMacros = hasStats ? calcMacros(pBase) : {target:data.target_calories,proteinG:data.target_protein,carbG:data.target_carbs,fatG:data.target_fat};
          const p = {...pBase, macros: freshMacros};
          if(hasStats) saveProfile(u.id, p).catch(e=>console.error("[checkAuth] macro resave failed:",e));
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
          setPhase("app");
          return;
        }
        // User exists but no profile — needs onboarding
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
      console.log("[handleAuth] profile loaded", { userId: u.id, isPro: proFlag });
      setIsPro(proFlag);
      const pBase = {
        name:data.name, sex:data.sex, age:data.age,
        weightLbs:data.weight_lbs, heightFt:data.height_ft, heightIn:data.height_in,
        activity:data.activity, goal:data.goal, diet:data.diet||[],
        dislikedFoods:data.disliked_foods||[], dislikedCuisines:data.disliked_cuisines||[],
      };
      const hasStats = pBase.sex && pBase.age && pBase.weightLbs && pBase.heightFt != null && pBase.activity && pBase.goal;
      const freshMacros = hasStats ? calcMacros(pBase) : {target:data.target_calories,proteinG:data.target_protein,carbG:data.target_carbs,fatG:data.target_fat};
      const p = {...pBase, macros: freshMacros};
      if(hasStats) saveProfile(u.id, p).catch(e=>console.error("[handleAuth] macro resave failed:",e));
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
      setPhase("app");
    } else {
      setPhase("onboarding");
    }
  };

  const handleComplete = async (p) => {
    setProfile(p);
    if(user) await saveProfile(user.id, p);
    setPhase("app");
  };

  const handleSignOut = async () => {
    await signOut();
    setUser(null);setProfile(null);setSavedMeals([]);setTodayLog([]);setTodayPlan([]);setWeekPlans({});
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
    setTab(t);
  };

  if(phase==="splash") return <Splash onFinish={checkAuth}/>;
  if(phase==="auth") return <AuthScreen onAuth={handleAuth}/>;
  if(phase==="onboarding") return <Onboarding onComplete={handleComplete}/>;

  const screens = {
    home:<Dashboard setTab={switchTab} profile={profile} todayLog={todayLog} onLogMeal={handleLogMeal} onUnlogMeal={handleUnlogMeal} todayPlan={todayPlan} weekPlans={weekPlans} userId={user?.id} savedMeals={savedMeals} onHeartMeal={handleHeartToggle}/>,
    plan:<Plan profile={profile} userId={user?.id} isPro={isPro} savedMeals={savedMeals} onHeartMeal={handleHeartToggle} onWeekPlanUpdate={(plans)=>{
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
    log:<LogMeal savedMeals={savedMeals} onSaveMeal={handleSaveMeal} todayLog={todayLog} onLogMeal={handleLogMeal} userId={user?.id} onDeleteSavedMeal={handleDeleteSavedMeal}/>,
    grocery:<Grocery isPro={isPro} setIsPro={handleSetIsPro} weekPlans={weekPlans} userId={user?.id}/>,
    profile:<ProfileScreen profile={profile} userId={user?.id} onProfileUpdate={p=>setProfile(p)} onSignOut={handleSignOut}/>
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

    <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:"rgba(9,9,11,0.95)",backdropFilter:"blur(24px)",borderTop:`1px solid ${T.bd}`,display:"flex",justifyContent:"space-around",padding:"6px 0 22px",zIndex:10}}>
      {navTabs.map(t=>{
        const a=tab===t.id;
        return <button key={t.id} onClick={()=>switchTab(t.id)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"4px 12px",transition:"all 0.2s"}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a?T.acc:"#8E8E93"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {t.d.split("|").map((p,i)=><path key={i} d={p}/>)}
          </svg>
          <span style={{fontSize:10,fontWeight:a?600:500,color:a?T.acc:"#8E8E93"}}>{t.label}</span>
        </button>;
      })}
    </div>
  </div>;
}
