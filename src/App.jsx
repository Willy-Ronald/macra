import { useState, useEffect, useRef } from "react";
import {
  supabase, signUp, signIn, signOut, getUser,
  saveProfile, getProfile,
  saveMeal, getSavedMeals,
  logMeal, getTodayLog, deleteMealLog,
  saveMealPlan, getWeekPlans,
} from "./lib/supabase";

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
function calcMacros(profile) {
  const {sex,age,weightLbs,heightFt,heightIn,activity,goal} = profile;
  const weightKg = weightLbs * 0.453592;
  const heightCm = (heightFt * 12 + heightIn) * 2.54;
  // Mifflin-St Jeor
  let bmr = sex === "male"
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  const actMult = {sedentary:1.2,light:1.375,moderate:1.55,active:1.725,very_active:1.9};
  let tdee = Math.round(bmr * (actMult[activity] || 1.55));
  const goalAdj = {cut:-500,maintain:0,lean_bulk:250,bulk:500};
  let target = Math.round(tdee + (goalAdj[goal] || 0));
  // Macro split
  let proteinG = Math.round(weightLbs * (goal==="cut"?1.2:goal==="bulk"?0.9:1.0));
  let fatG = Math.round((target * 0.25) / 9);
  let carbG = Math.round((target - proteinG*4 - fatG*9) / 4);
  if(carbG < 50) carbG = 50;
  return {tdee,target,proteinG,fatG,carbG};
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

  const NumInput = ({label,value,onChange,min,max,unit}) => (
    <div style={{flex:1}}>
      <Lbl>{label}</Lbl>
      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
        <button onClick={()=>onChange(Math.max(min,value-1))} style={{width:40,height:40,borderRadius:10,border:`1px solid ${T.bd}`,background:T.sf,color:T.tx,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font}}>−</button>
        <div style={{flex:1,textAlign:"center"}}>
          <span style={{fontSize:28,fontWeight:700,color:T.tx,fontFamily:T.mono}}>{value}</span>
          {unit && <span style={{fontSize:13,color:T.txM,marginLeft:4}}>{unit}</span>}
        </div>
        <button onClick={()=>onChange(Math.min(max,value+1))} style={{width:40,height:40,borderRadius:10,border:`1px solid ${T.bd}`,background:T.sf,color:T.tx,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font}}>+</button>
      </div>
    </div>
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

// ─── DASHBOARD ─────────────────────────────────────────────────
const Dashboard = ({setTab,profile,todayLog=[],onLogMeal,onUnlogMeal,todayPlan=[]}) => {
  const m = profile?.macros || {target:2200,proteinG:180,carbG:240,fatG:70};
  // Calculate consumed from real log data
  const consumed = todayLog.reduce((a,x)=>({cal:a.cal+(x.calories||0),p:a.p+(x.protein||0),c:a.c+(x.carbs||0),f:a.f+(x.fat||0)}),{cal:0,p:0,c:0,f:0});
  const cal={cur:consumed.cal,tgt:m.target};
  const mac=[{k:"Protein",cur:consumed.p,tgt:m.proteinG,c:T.pro},{k:"Carbs",cur:consumed.c,tgt:m.carbG,c:T.carb},{k:"Fat",cur:consumed.f,tgt:m.fatG,c:T.fat}];

  // Build meals list from today's plan, checking which are logged
  const defaultPlanMeals = [
    {type:"BREAKFAST",name:"Egg & Avocado Toast",cal:420,p:22,c:34,f:24,time:"10 min"},
    {type:"LUNCH",name:"Grilled Chicken Bowl",cal:580,p:48,c:52,f:22,time:"15 min"},
    {type:"SNACK",name:"Protein Shake + Banana",cal:340,p:35,c:28,f:8,time:"2 min"},
    {type:"DINNER",name:"Salmon & Sweet Potato",cal:680,p:52,c:48,f:24,time:"30 min"},
  ];
  const planMeals = todayPlan.length > 0 ? todayPlan : defaultPlanMeals;
  const meals = planMeals.map(pm => {
    const logEntry = todayLog.find(x=>(x.name||"").toLowerCase()===pm.name.toLowerCase());
    return { n:pm.name, cal:pm.cal, p:pm.p, c:pm.c, f:pm.f, type:pm.type, done:!!logEntry, logId:logEntry?.id };
  });

  const remaining = Math.max(0, cal.tgt - cal.cur);
  const proteinLeft = Math.max(0,m.proteinG - consumed.p);
  const carbsLeft = Math.max(0,m.carbG - consumed.c);
  const fatLeft = Math.max(0,m.fatG - consumed.f);
  const mealsLeft = meals.filter(x=>!x.done).length;

  // Dynamic insight based on real data
  const insightText = consumed.cal === 0
    ? `Start your day! Your target is ${m.target} calories with ${m.proteinG}g protein.`
    : proteinLeft > 20 && mealsLeft > 0
    ? `You need ${proteinLeft}g protein in your remaining ${mealsLeft} meal${mealsLeft>1?"s":""} to hit target.`
    : proteinLeft <= 20 && consumed.cal < m.target
    ? `Protein on track! You have ${remaining} cal remaining for the day.`
    : consumed.cal >= m.target
    ? `You've reached your ${m.target} cal target for today. Great job!`
    : `${remaining} calories remaining. Keep it up!`;

  const now = new Date();
  const dayNames = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];
  const monthNames = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const dateStr = `${dayNames[now.getDay()]}, ${monthNames[now.getMonth()]} ${now.getDate()}`;

  return <div style={{padding:"0 20px 24px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:28,paddingTop:4}}>
      <div>
        <p style={{fontSize:11,color:T.txM,fontWeight:500,margin:0,letterSpacing:"0.08em"}}>{dateStr}</p>
        <h1 style={{fontSize:26,fontWeight:700,color:T.tx,margin:"6px 0 0",letterSpacing:"-0.02em"}}>
          {profile?.name ? `Hey, ${profile.name}` : "Daily Overview"}
        </h1>
      </div>
      <div style={{width:38,height:38,borderRadius:"50%",background:T.acc,display:"flex",alignItems:"center",justifyContent:"center"}}>
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

    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"24px 0 14px"}}>
      <h2 style={{fontSize:15,fontWeight:600,color:T.tx,margin:0}}>Today's Meals</h2>
      <span onClick={()=>setTab("plan")} style={{fontSize:12,color:T.acc,fontWeight:500,cursor:"pointer"}}>View Plan</span>
    </div>
    {meals.map((x,i)=><Card key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginBottom:6,border:x.done?`1px solid ${T.bd}`:`1px dashed ${T.bd}`,background:x.done?T.sf:"transparent",cursor:"pointer"}} onClick={()=>{
      if(x.done && x.logId && onUnlogMeal) {
        onUnlogMeal(x.logId);
      } else if(!x.done && onLogMeal) {
        onLogMeal({type:x.type||"meal",name:x.n,cal:x.cal,p:x.p||0,c:x.c||0,f:x.f||0});
      }
    }}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:7,height:7,borderRadius:"50%",background:x.done?T.ok:T.txM,boxShadow:x.done?`0 0 8px ${T.ok}40`:"none"}}/>
        <div><p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>{x.n}</p><p style={{fontSize:11,color:T.txM,margin:"2px 0 0"}}>{x.type}</p></div>
      </div>
      <span style={{fontSize:13,fontWeight:600,fontFamily:T.mono,color:x.done?T.tx2:T.acc}}>{x.done?`${x.cal} ✕`:"Log →"}</span>
    </Card>)}

    <Card style={{padding:"14px 16px",marginTop:16,background:T.accG,border:`1px solid ${T.accM}`,display:"flex",alignItems:"flex-start",gap:10}}>
      <span style={{fontSize:14}}>✦</span>
      <p style={{fontSize:13,color:T.tx2,margin:0,lineHeight:1.5}}>{insightText}</p>
    </Card>
  </div>;
};

// ─── PLAN (AI-POWERED) ─────────────────────────────────────────
const Plan = ({profile,userId}) => {
  const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const [sel,setSel]=useState(2);
  const [loading,setLoading]=useState(false);
  const [loadMsg,setLoadMsg]=useState("");
  const [weekPlan,setWeekPlan]=useState({});
  const [genCount,setGenCount]=useState(0);
  const [plansLoaded,setPlansLoaded]=useState(false);

  // Load saved plans from Supabase on mount
  useEffect(()=>{
    if(!userId||plansLoaded) return;
    (async()=>{
      const plans = await getWeekPlans(userId);
      if(Object.keys(plans).length>0) setWeekPlan(plans);
      setPlansLoaded(true);
    })();
  },[userId,plansLoaded]);

  const defaultMeals=[
    {type:"BREAKFAST",name:"Greek Yogurt Parfait",desc:"Greek yogurt, granola, berries, honey",cal:380,p:28,c:45,f:12,time:"10 min"},
    {type:"LUNCH",name:"Southwest Chicken Wrap",desc:"Grilled chicken, black beans, corn, avocado",cal:620,p:48,c:52,f:22,time:"15 min"},
    {type:"SNACK",name:"Protein Shake + Almonds",desc:"Whey isolate, almond milk, raw almonds",cal:310,p:35,c:12,f:14,time:"2 min"},
    {type:"DINNER",name:"Herb-Crusted Salmon",desc:"Wild salmon, sweet potato, broccoli",cal:680,p:52,c:48,f:24,time:"30 min"},
  ];

  // AI-generated sample plans to simulate API response
  const aiPlans = [
    [
      {type:"BREAKFAST",name:"Spinach & Feta Egg Cups",desc:"Whole eggs, fresh spinach, crumbled feta, cherry tomatoes",cal:340,p:26,c:8,f:24,time:"20 min"},
      {type:"LUNCH",name:"Thai Peanut Chicken Bowl",desc:"Grilled chicken thigh, brown rice, shredded cabbage, peanut sauce",cal:650,p:52,c:58,f:20,time:"20 min"},
      {type:"SNACK",name:"Cottage Cheese & Berries",desc:"Full-fat cottage cheese, mixed berries, chia seeds",cal:280,p:24,c:22,f:10,time:"3 min"},
      {type:"DINNER",name:"Steak Fajita Plate",desc:"Flank steak, bell peppers, onions, guacamole, corn tortillas",cal:720,p:56,c:48,f:30,time:"25 min"},
    ],
    [
      {type:"BREAKFAST",name:"Overnight Protein Oats",desc:"Rolled oats, whey protein, almond butter, banana",cal:420,p:32,c:52,f:14,time:"5 min prep"},
      {type:"LUNCH",name:"Mediterranean Tuna Plate",desc:"Seared tuna steak, quinoa tabbouleh, hummus, cucumber",cal:580,p:48,c:42,f:18,time:"15 min"},
      {type:"SNACK",name:"Turkey Roll-Ups",desc:"Deli turkey, avocado, mustard, wrapped in lettuce",cal:240,p:22,c:6,f:14,time:"5 min"},
      {type:"DINNER",name:"Lemon Herb Chicken Thighs",desc:"Bone-in thighs, roasted potatoes, green beans, garlic",cal:750,p:58,c:52,f:28,time:"40 min"},
    ],
    [
      {type:"BREAKFAST",name:"Smoked Salmon Toast",desc:"Sourdough, cream cheese, smoked salmon, capers, dill",cal:390,p:28,c:34,f:16,time:"8 min"},
      {type:"LUNCH",name:"Chipotle-Style Burrito Bowl",desc:"Chicken, cilantro lime rice, black beans, pico, sour cream",cal:640,p:50,c:62,f:18,time:"15 min"},
      {type:"SNACK",name:"Protein Smoothie",desc:"Whey isolate, frozen mango, spinach, coconut water",cal:260,p:30,c:28,f:4,time:"3 min"},
      {type:"DINNER",name:"Garlic Butter Shrimp Pasta",desc:"Jumbo shrimp, whole wheat linguine, broccolini, parmesan",cal:700,p:52,c:60,f:24,time:"20 min"},
    ],
  ];

  const generatePlan = async () => {
    setLoading(true);
    const messages = [
      "Analyzing your macro targets...",
      "Building meals around your preferences...",
      "Balancing protein distribution...",
      "Optimizing meal timing...",
      "Finalizing your plan..."
    ];
    let i=0;
    setLoadMsg(messages[0]);
    const interval = setInterval(()=>{i++;if(i<messages.length)setLoadMsg(messages[i])},800);

    // ── PRODUCTION API CALL (uncomment when deploying) ──
    /*
    try {
      const m = profile?.macros || {target:2200,proteinG:180,carbG:240,fatG:70};
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `Generate a single day meal plan as JSON. Target: ${m.target} calories, ${m.proteinG}g protein, ${m.carbG}g carbs, ${m.fatG}g fat. Diet: ${(profile?.diet||[]).join(", ")||"no restrictions"}. Goal: ${profile?.goal||"lean_bulk"}.
Return ONLY a JSON array of 4 meals with this exact structure, no other text:
[{"type":"BREAKFAST","name":"...","desc":"ingredients list","cal":000,"p":00,"c":00,"f":00,"time":"X min"},...]
Types must be: BREAKFAST, LUNCH, SNACK, DINNER. Macros must sum close to targets.`
          }]
        })
      });
      const data = await response.json();
      const text = data.content.map(i=>i.text||"").join("");
      const clean = text.replace(/```json|```/g,"").trim();
      const meals = JSON.parse(clean);
      clearInterval(interval);
      setWeekPlan(prev=>({...prev,[sel]:meals}));
      setGenCount(c=>c+1);
      setLoading(false);
    } catch(err) {
      clearInterval(interval);
      setLoading(false);
      console.error("AI generation failed:", err);
    }
    */

    // ── PROTOTYPE SIMULATION ──
    await new Promise(r=>setTimeout(r,4000));
    clearInterval(interval);
    const plan = aiPlans[genCount % aiPlans.length];
    setWeekPlan(prev=>({...prev,[sel]:plan}));
    setGenCount(c=>c+1);
    setLoading(false);
    // Save to Supabase
    if(userId) saveMealPlan(userId, sel, plan);
  };

  const meals = weekPlan[sel] || defaultMeals;
  const dayTotals = meals.reduce((a,m)=>({cal:a.cal+m.cal,p:a.p+m.p,c:a.c+m.c,f:a.f+m.f}),{cal:0,p:0,c:0,f:0});

  return <div style={{padding:"0 20px 24px"}}>
    <h1 style={{fontSize:26,fontWeight:700,color:T.tx,margin:"4px 0 20px",letterSpacing:"-0.02em"}}>Meal Plan</h1>
    <Card style={{display:"flex",padding:4,marginBottom:20}}>
      {days.map((d,i)=><button key={d} onClick={()=>setSel(i)} style={{flex:1,padding:"8px 0",borderRadius:8,border:"none",background:sel===i?T.acc:"transparent",color:sel===i?T.bg:T.txM,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.2s ease"}}>{d}</button>)}
    </Card>
    <div style={{display:"flex",justifyContent:"space-between",padding:"0 4px",marginBottom:18}}>
      {[{l:"Calories",v:dayTotals.cal.toLocaleString(),c:T.acc},{l:"Protein",v:dayTotals.p+"g",c:T.pro},{l:"Carbs",v:dayTotals.c+"g",c:T.carb},{l:"Fat",v:dayTotals.f+"g",c:T.fat}].map(s=>
        <div key={s.l} style={{textAlign:"center"}}><p style={{fontSize:17,fontWeight:700,color:s.c,margin:0,fontFamily:T.mono}}>{s.v}</p><Lbl>{s.l}</Lbl></div>
      )}
    </div>

    {/* Loading State */}
    {loading && <Card style={{padding:"40px 20px",textAlign:"center",marginBottom:12}}>
      <div style={{marginBottom:16}}>
        <div style={{width:40,height:40,margin:"0 auto",borderRadius:"50%",border:`3px solid ${T.bd}`,borderTopColor:T.acc,animation:"spin 1s linear infinite"}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
      <p style={{fontSize:14,fontWeight:600,color:T.tx,margin:"0 0 4px"}}>{loadMsg}</p>
      <p style={{fontSize:12,color:T.txM,margin:0}}>Powered by AI</p>
    </Card>}

    {/* Meal Cards */}
    {!loading && meals.map((m,i)=><Card key={i+"-"+sel+"-"+genCount} style={{padding:18,marginBottom:8,animation:"fadeUp 0.4s ease both",animationDelay:`${i*0.08}s`}}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
        <span style={{fontSize:10,fontWeight:600,color:T.acc,letterSpacing:"0.14em"}}>{m.type}</span>
        <span style={{fontSize:11,color:T.txM}}>{m.time}</span>
      </div>
      <h3 style={{fontSize:16,fontWeight:600,color:T.tx,margin:"0 0 4px"}}>{m.name}</h3>
      <p style={{fontSize:12,color:T.txM,margin:"0 0 14px"}}>{m.desc}</p>
      <div style={{display:"flex",gap:16}}>
        {[{l:"cal",v:m.cal,c:T.acc},{l:"P",v:m.p+"g",c:T.pro},{l:"C",v:m.c+"g",c:T.carb},{l:"F",v:m.f+"g",c:T.fat}].map(x=>
          <span key={x.l} style={{fontSize:12,fontFamily:T.mono,color:T.tx}}><span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:x.c,marginRight:4,verticalAlign:"middle"}}/>{x.v} <span style={{color:T.txM,fontSize:10}}>{x.l}</span></span>
        )}
      </div>
    </Card>)}

    {!loading && <>
      {weekPlan[sel] && <Card style={{padding:"10px 14px",marginBottom:10,background:T.accG,border:`1px solid ${T.accM}`,display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:13}}>✦</span>
        <p style={{fontSize:12,color:T.tx2,margin:0}}>AI-generated plan · Tap regenerate for new options</p>
      </Card>}
      <button onClick={generatePlan} style={{width:"100%",padding:15,borderRadius:T.r,border:"none",background:T.acc,color:T.bg,fontSize:14,fontWeight:700,cursor:"pointer",marginTop:4,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        <span>✦</span> {weekPlan[sel] ? "Regenerate Plan" : "Generate AI Plan"}
      </button>
      {genCount===0 && <p style={{fontSize:11,color:T.txM,textAlign:"center",margin:"10px 0 0"}}>Macra Free: 1 AI plan per week · Go Pro for unlimited</p>}
    </>}
  </div>;
};

// ─── LOG ───────────────────────────────────────────────────────
const MealCreator = ({onSave,onBack}) => {
  const [name,setName]=useState("");
  const [ingredients,setIngredients]=useState([]);
  const [showAdd,setShowAdd]=useState(false);
  const [ing,setIng]=useState({name:"",servingSize:"",servingUnit:"g",cal:0,p:0,c:0,f:0,qty:1});
  const empty={name:"",servingSize:"",servingUnit:"g",cal:0,p:0,c:0,f:0,qty:1};

  const totals = ingredients.reduce((a,x)=>{
    const m = x.qty * (x.servingUnit==="g" && x.servingSize ? 1 : 1);
    return {cal:a.cal+x.cal*x.qty,p:a.p+x.p*x.qty,c:a.c+x.c*x.qty,f:a.f+x.f*x.qty};
  },{cal:0,p:0,c:0,f:0});

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
            <p style={{fontSize:11,color:T.txM,margin:"2px 0 0"}}>{x.servingSize}{x.servingUnit} per serving</p>
            <div style={{display:"flex",gap:8,marginTop:6}}>
              {[{v:Math.round(x.cal*x.qty),l:"cal",c:T.acc},{v:Math.round(x.p*x.qty)+"g",l:"P",c:T.pro},{v:Math.round(x.c*x.qty)+"g",l:"C",c:T.carb},{v:Math.round(x.f*x.qty)+"g",l:"F",c:T.fat}].map(m=>
                <span key={m.l} style={{fontSize:11,fontFamily:T.mono,color:m.c}}>{m.v}<span style={{color:T.txM,fontSize:9}}> {m.l}</span></span>
              )}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <button onClick={()=>updateQty(x.id,-0.25)} style={{width:28,height:28,borderRadius:8,border:`1px solid ${T.bd}`,background:T.sf,color:T.tx,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font}}>−</button>
            <span style={{fontSize:14,fontWeight:600,color:T.tx,fontFamily:T.mono,minWidth:28,textAlign:"center"}}>{x.qty}</span>
            <button onClick={()=>updateQty(x.id,0.25)} style={{width:28,height:28,borderRadius:8,border:`1px solid ${T.bd}`,background:T.sf,color:T.tx,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font}}>+</button>
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

      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <div style={{flex:1}}>
          <Lbl>Serving Size</Lbl>
          <input value={ing.servingSize} onChange={e=>setIng(p=>({...p,servingSize:e.target.value}))} placeholder="150" type="number" style={{...smallInput,marginTop:6,textAlign:"left"}}/>
        </div>
        <div style={{flex:1}}>
          <Lbl>Unit</Lbl>
          <div style={{display:"flex",gap:4,marginTop:6}}>
            {["g","oz","ml","cup"].map(u=>
              <button key={u} onClick={()=>setIng(p=>({...p,servingUnit:u}))} style={{
                flex:1,padding:"10px 0",borderRadius:8,border:"none",
                background:ing.servingUnit===u?T.acc:"transparent",
                color:ing.servingUnit===u?T.bg:T.txM,
                fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:T.font
              }}>{u}</button>
            )}
          </div>
        </div>
      </div>

      <p style={{fontSize:11,color:T.txM,margin:"0 0 10px"}}>Macros per serving</p>
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

const getMealTypeByTime = () => {
  const h = new Date().getHours();
  if(h < 11) return "breakfast";
  if(h < 14) return "lunch";
  if(h < 17) return "snack";
  return "dinner";
};

const LogMeal = ({savedMeals,onSaveMeal,todayLog=[],onLogMeal}) => {
  const [view,setView]=useState("main"); // main | create
  const savedRef = useRef(null);
  const [loggedId,setLoggedId]=useState(null); // tracks which item just got logged for feedback
  const recent=[{id:"r0",n:"Grilled Chicken Bowl",cal:580,p:48,c:52,f:22},{id:"r1",n:"Protein Shake + Banana",cal:340,p:35,c:28,f:8},{id:"r2",n:"Egg & Avocado Toast",cal:420,p:22,c:34,f:24},{id:"r3",n:"Turkey & Hummus Wrap",cal:490,p:38,c:42,f:18}];

  const quickLog = (item, feedbackId) => {
    if(!onLogMeal) return;
    const type = getMealTypeByTime();
    onLogMeal({type,name:item.n||item.name,cal:item.cal||item.totals?.cal||0,p:item.p||item.totals?.p||0,c:item.c||item.totals?.c||0,f:item.f||item.totals?.f||0});
    setLoggedId(feedbackId);
    setTimeout(()=>setLoggedId(null),1200);
  };

  if(view==="create") return <MealCreator onBack={()=>setView("main")} onSave={(meal)=>{if(onSaveMeal)onSaveMeal(meal);setView("main")}}/>;

  return <div style={{padding:"0 20px 24px"}}>
    <h1 style={{fontSize:26,fontWeight:700,color:T.tx,margin:"4px 0 4px",letterSpacing:"-0.02em"}}>Log Meal</h1>
    <p style={{fontSize:13,color:T.txM,margin:"0 0 20px"}}>What did you eat?</p>
    <Card style={{padding:"13px 16px",marginBottom:20,display:"flex",alignItems:"center",gap:10}}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.txM} strokeWidth="1.5" strokeLinecap="round"><circle cx="11" cy="11" r="7.5"/><path d="M21 21l-4.35-4.35"/></svg>
      <span style={{fontSize:14,color:T.txM}}>Search food or scan barcode...</span>
    </Card>
    <div style={{display:"flex",gap:8,marginBottom:24}}>
      {[{l:"AI Suggest",i:"✦",h:true},{l:"Scan",i:"⎘",h:false},{l:"Custom",i:"✎",h:false,action:()=>setView("create")},{l:"Saved",i:"♡",h:false,action:()=>savedRef.current?.scrollIntoView({behavior:"smooth"})}].map(a=>
        <button key={a.l} onClick={a.action||undefined} style={{flex:1,padding:"14px 4px",borderRadius:T.r,border:a.h?"none":`1px solid ${T.bd}`,background:a.h?T.acc:T.sf,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
          <span style={{fontSize:16,color:a.h?T.bg:T.tx2}}>{a.i}</span>
          <span style={{fontSize:10,fontWeight:600,color:a.h?T.bg:T.tx2}}>{a.l}</span>
        </button>)}
    </div>
    <Lbl>Frequently Logged</Lbl>
    <div style={{marginTop:10}}>
      {recent.map((m)=>{
        const isLogged = loggedId===m.id;
        return <Card key={m.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginBottom:6,cursor:"pointer"}}>
          <div><p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>{m.n}</p><p style={{fontSize:11,color:T.txM,margin:"2px 0 0"}}>{m.cal} cal</p></div>
          <div onClick={(e)=>{e.stopPropagation();quickLog(m,m.id)}} style={{width:30,height:30,borderRadius:"50%",background:isLogged?T.ok:T.accM,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.3s ease",cursor:"pointer"}}>
            {isLogged
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>}
          </div>
        </Card>;
      })}
    </div>
    <div ref={savedRef} style={{marginTop:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <Lbl>My Saved Meals ({savedMeals.length})</Lbl>
        <span onClick={()=>setView("create")} style={{fontSize:11,color:T.acc,fontWeight:500,cursor:"pointer"}}>+ Create New</span>
      </div>
      {savedMeals.map((m,i)=>{
        const feedbackKey = "saved-"+i;
        const isLogged = loggedId===feedbackKey;
        return <Card key={i} style={{padding:"14px 16px",marginBottom:6,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>{m.name}</p>
            <div style={{display:"flex",gap:10,marginTop:4}}>
              {[{v:m.totals.cal,l:"cal",c:T.acc},{v:m.totals.p+"g",l:"P",c:T.pro},{v:m.totals.c+"g",l:"C",c:T.carb},{v:m.totals.f+"g",l:"F",c:T.fat}].map(x=>
                <span key={x.l} style={{fontSize:11,fontFamily:T.mono,color:x.c}}>{x.v}<span style={{color:T.txM,fontSize:9}}> {x.l}</span></span>
              )}
            </div>
            <p style={{fontSize:10,color:T.txM,margin:"4px 0 0"}}>{m.ingredients.length} ingredient{m.ingredients.length!==1?"s":""}</p>
          </div>
          <div onClick={(e)=>{e.stopPropagation();quickLog({n:m.name,cal:m.totals.cal,p:m.totals.p,c:m.totals.c,f:m.totals.f},feedbackKey)}} style={{width:30,height:30,borderRadius:"50%",background:isLogged?T.ok:T.accM,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.3s ease",cursor:"pointer"}}>
            {isLogged
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>}
          </div>
        </Card>;
      })}
      {savedMeals.length===0 && <Card style={{padding:"20px 16px",textAlign:"center"}}>
        <p style={{fontSize:13,color:T.txM,margin:0}}>No saved meals yet. Create your first custom meal to log it quickly later.</p>
      </Card>}
    </div>
  </div>;
};

// ─── GROCERY ───────────────────────────────────────────────────
const Grocery = ({isPro,setIsPro}) => {
  const [checked,setChecked]=useState({});
  const toggle=(id)=>setChecked(p=>({...p,[id]:!p[id]}));

  const categories=[
    {name:"Protein & Meat",items:[
      {id:"g1",name:"Chicken breast, boneless skinless",qty:"2 lbs",aisle:"Meat"},
      {id:"g2",name:"Wild salmon fillets",qty:"1 lb",aisle:"Seafood"},
      {id:"g3",name:"Flank steak",qty:"1 lb",aisle:"Meat"},
      {id:"g4",name:"Large eggs",qty:"1 dozen",aisle:"Dairy"},
      {id:"g5",name:"Deli turkey slices",qty:"8 oz",aisle:"Deli"},
      {id:"g6",name:"Jumbo shrimp, peeled",qty:"1 lb",aisle:"Seafood"},
    ]},
    {name:"Dairy & Eggs",items:[
      {id:"g7",name:"Greek yogurt, plain",qty:"32 oz",aisle:"Dairy"},
      {id:"g8",name:"Feta cheese, crumbled",qty:"6 oz",aisle:"Dairy"},
      {id:"g9",name:"Cottage cheese, full-fat",qty:"16 oz",aisle:"Dairy"},
      {id:"g10",name:"Parmesan, shredded",qty:"4 oz",aisle:"Dairy"},
      {id:"g11",name:"Cream cheese",qty:"8 oz",aisle:"Dairy"},
      {id:"g12",name:"Sour cream",qty:"8 oz",aisle:"Dairy"},
    ]},
    {name:"Produce",items:[
      {id:"g13",name:"Fresh spinach",qty:"5 oz bag",aisle:"Produce"},
      {id:"g14",name:"Sweet potatoes",qty:"3 medium",aisle:"Produce"},
      {id:"g15",name:"Broccoli crowns",qty:"2 heads",aisle:"Produce"},
      {id:"g16",name:"Bell peppers, mixed",qty:"3 count",aisle:"Produce"},
      {id:"g17",name:"Avocados",qty:"4 count",aisle:"Produce"},
      {id:"g18",name:"Cherry tomatoes",qty:"1 pint",aisle:"Produce"},
      {id:"g19",name:"Mixed berries",qty:"12 oz",aisle:"Produce"},
      {id:"g20",name:"Bananas",qty:"1 bunch",aisle:"Produce"},
      {id:"g21",name:"Lemons",qty:"3 count",aisle:"Produce"},
      {id:"g22",name:"Green beans",qty:"12 oz",aisle:"Produce"},
      {id:"g23",name:"Yellow onions",qty:"2 count",aisle:"Produce"},
      {id:"g24",name:"Fresh dill & cilantro",qty:"1 bunch each",aisle:"Produce"},
    ]},
    {name:"Grains & Pantry",items:[
      {id:"g25",name:"Brown rice",qty:"1 lb",aisle:"Grains"},
      {id:"g26",name:"Whole wheat linguine",qty:"1 box",aisle:"Pasta"},
      {id:"g27",name:"Rolled oats",qty:"18 oz",aisle:"Cereal"},
      {id:"g28",name:"Corn tortillas",qty:"1 pack",aisle:"Bread"},
      {id:"g29",name:"Sourdough bread",qty:"1 loaf",aisle:"Bakery"},
      {id:"g30",name:"Granola",qty:"12 oz",aisle:"Cereal"},
      {id:"g31",name:"Quinoa",qty:"12 oz",aisle:"Grains"},
      {id:"g32",name:"Black beans, canned",qty:"2 cans",aisle:"Canned"},
    ]},
    {name:"Oils, Sauces & Condiments",items:[
      {id:"g33",name:"Almond butter",qty:"12 oz",aisle:"Spreads"},
      {id:"g34",name:"Hummus",qty:"10 oz",aisle:"Deli"},
      {id:"g35",name:"Chipotle sauce",qty:"1 bottle",aisle:"Condiments"},
      {id:"g36",name:"Peanut sauce",qty:"1 jar",aisle:"International"},
      {id:"g37",name:"Honey",qty:"12 oz",aisle:"Baking"},
      {id:"g38",name:"Capers",qty:"1 jar",aisle:"Condiments"},
    ]},
    {name:"Supplements & Snacks",items:[
      {id:"g39",name:"Whey protein isolate",qty:"check supply",aisle:"Supplements"},
      {id:"g40",name:"Raw almonds",qty:"8 oz",aisle:"Snacks"},
      {id:"g41",name:"Chia seeds",qty:"6 oz",aisle:"Baking"},
      {id:"g42",name:"Almond milk, unsweetened",qty:"½ gallon",aisle:"Dairy Alt"},
      {id:"g43",name:"Coconut water",qty:"4-pack",aisle:"Beverages"},
    ]},
  ];

  const totalItems = categories.reduce((a,c)=>a+c.items.length,0);
  const checkedCount = Object.values(checked).filter(Boolean).length;

  // Locked state (free tier)
  if(!isPro) return <div style={{padding:"0 20px 24px"}}>
    <h1 style={{fontSize:26,fontWeight:700,color:T.tx,margin:"4px 0 4px",letterSpacing:"-0.02em"}}>Grocery List</h1>
    <p style={{fontSize:13,color:T.txM,margin:"0 0 20px"}}>Based on this week's meal plan</p>
    <Card style={{padding:28,background:T.accG,border:`1px solid ${T.accM}`,textAlign:"center",marginBottom:20}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:12}}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        <span style={{fontSize:10,fontWeight:700,color:T.acc,letterSpacing:"0.12em"}}>PRO FEATURE</span>
      </div>
      <h3 style={{fontSize:20,fontWeight:700,color:T.tx,margin:"0 0 8px"}}>Smart Grocery Lists</h3>
      <p style={{fontSize:13,color:T.tx2,margin:"0 0 6px",lineHeight:1.5}}>Auto-generated weekly lists organized by store aisle, with quantity optimization and one-tap sharing.</p>
      <p style={{fontSize:12,color:T.txM,margin:"0 0 20px"}}>{totalItems} items from your current meal plan</p>
      <button onClick={()=>setIsPro(true)} style={{padding:"14px 36px",borderRadius:T.r,border:"none",background:T.acc,color:T.bg,fontSize:14,fontWeight:700,cursor:"pointer",marginBottom:8}}>
        Upgrade to Macra Pro — $4.99/mo
      </button>
      <p style={{fontSize:11,color:T.txM,margin:"8px 0 0"}}>Tap to preview (simulated for prototype)</p>
    </Card>
    <div style={{opacity:0.2,filter:"blur(3px)",pointerEvents:"none"}}>
      {categories.slice(0,3).map(c=><div key={c.name} style={{marginBottom:14}}>
        <span style={{fontSize:11,fontWeight:600,color:T.acc,letterSpacing:"0.1em"}}>{c.name}</span>
        {c.items.slice(0,3).map(it=><div key={it.id} style={{padding:"11px 14px",marginTop:5,background:T.sf,borderRadius:10,border:`1px solid ${T.bd}`,display:"flex",justifyContent:"space-between"}}>
          <div style={{height:13,width:`${50+Math.random()*30}%`,background:T.bd,borderRadius:3}}/>
          <div style={{height:13,width:40,background:T.bd,borderRadius:3}}/>
        </div>)}
      </div>)}
    </div>
  </div>;

  // Unlocked state (Pro)
  return <div style={{padding:"0 20px 24px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:4,paddingTop:4}}>
      <div>
        <h1 style={{fontSize:26,fontWeight:700,color:T.tx,margin:"0 0 4px",letterSpacing:"-0.02em"}}>Grocery List</h1>
        <p style={{fontSize:13,color:T.txM,margin:0}}>Generated from your weekly meal plan</p>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:4}}>
        <span style={{fontSize:8,fontWeight:700,color:T.bg,background:T.acc,padding:"3px 7px",borderRadius:4}}>PRO</span>
      </div>
    </div>

    {/* Progress bar */}
    <Card style={{padding:"14px 16px",marginTop:16,marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
      <div style={{flex:1}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
          <span style={{fontSize:12,color:T.tx2,fontWeight:500}}>{checkedCount} of {totalItems} items</span>
          <span style={{fontSize:12,color:T.acc,fontFamily:T.mono,fontWeight:600}}>{totalItems>0?Math.round((checkedCount/totalItems)*100):0}%</span>
        </div>
        <div style={{height:4,borderRadius:2,background:T.bd}}>
          <div style={{height:"100%",borderRadius:2,background:T.acc,width:`${totalItems>0?(checkedCount/totalItems)*100:0}%`,transition:"width 0.3s ease"}}/>
        </div>
      </div>
    </Card>

    {/* Share button */}
    <button style={{width:"100%",padding:12,borderRadius:T.r,border:`1px solid ${T.bd}`,background:T.sf,color:T.tx2,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:T.font,marginBottom:20,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.tx2} strokeWidth="1.5" strokeLinecap="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
      Share List
    </button>

    {/* Categories */}
    {categories.map(cat=>{
      const catChecked = cat.items.filter(it=>checked[it.id]).length;
      const allDone = catChecked === cat.items.length;
      return <div key={cat.name} style={{marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:11,fontWeight:600,color:allDone?T.ok:T.acc,letterSpacing:"0.1em",textTransform:"uppercase"}}>{cat.name}</span>
            {allDone && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.ok} strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
          </div>
          <span style={{fontSize:11,color:T.txM,fontFamily:T.mono}}>{catChecked}/{cat.items.length}</span>
        </div>
        {cat.items.map(it=>{
          const done=checked[it.id];
          return <div key={it.id} onClick={()=>toggle(it.id)} style={{
            display:"flex",alignItems:"center",gap:12,
            padding:"12px 14px",marginBottom:4,
            background:done?"transparent":T.sf,
            borderRadius:10,border:`1px solid ${done?"transparent":T.bd}`,
            cursor:"pointer",transition:"all 0.2s",
            opacity:done?0.45:1
          }}>
            <div style={{
              width:20,height:20,borderRadius:6,flexShrink:0,
              border:done?`1.5px solid ${T.ok}`:`1.5px solid ${T.bd}`,
              background:done?T.ok:"transparent",
              display:"flex",alignItems:"center",justifyContent:"center",
              transition:"all 0.2s"
            }}>
              {done&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.bg} strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
            </div>
            <div style={{flex:1}}>
              <p style={{fontSize:14,fontWeight:500,color:T.tx,margin:0,textDecoration:done?"line-through":"none"}}>{it.name}</p>
            </div>
            <span style={{fontSize:12,color:T.txM,fontFamily:T.mono,flexShrink:0}}>{it.qty}</span>
          </div>;
        })}
      </div>;
    })}

    {/* Switch back to free for testing */}
    <button onClick={()=>setIsPro(false)} style={{width:"100%",padding:10,borderRadius:T.r,border:`1px dashed ${T.bd}`,background:"transparent",color:T.txM,fontSize:11,cursor:"pointer",fontFamily:T.font,marginTop:8}}>
      ↩ Switch to Free tier (prototype toggle)
    </button>
  </div>;
};

// ─── PROFILE ───────────────────────────────────────────────────
const ProfileScreen = ({profile,onSignOut}) => {
  const m = profile?.macros;
  const stats=[{l:"Goal",v:(profile?.goal||"lean bulk").replace("_"," ")},{l:"Weight",v:`${profile?.weightLbs||185} lbs`},{l:"Height",v:`${profile?.heightFt||5}'${profile?.heightIn||11}"`},{l:"Activity",v:(profile?.activity||"active").replace("_"," ")}];
  const items=[{l:"Personal Stats",d:"Age, weight, height, activity"},{l:"Dietary Preferences",d:(profile?.diet||[]).join(", ")||"None set"},{l:"Household Mode",d:"Add partner's profile",pro:true},{l:"Notifications",d:"Meal reminders, reports"},{l:"Subscription",d:"Macra Free"}];
  return <div style={{padding:"0 20px 24px"}}>
    <h1 style={{fontSize:26,fontWeight:700,color:T.tx,margin:"4px 0 20px",letterSpacing:"-0.02em"}}>Profile</h1>
    <Card style={{padding:20,marginBottom:20,display:"flex",alignItems:"center",gap:16}}>
      <div style={{width:52,height:52,borderRadius:"50%",background:T.acc,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:T.bg}}>{(profile?.name||"U")[0]}</div>
      <div>
        <h2 style={{fontSize:18,fontWeight:600,color:T.tx,margin:"0 0 2px"}}>{profile?.name||"User"}</h2>
        <span style={{fontSize:12,color:T.txM}}>Macra Free</span>
        <span style={{fontSize:12,color:T.acc,marginLeft:8,fontWeight:500,cursor:"pointer"}}>Go Pro →</span>
      </div>
    </Card>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20}}>
      {stats.map(s=><Card key={s.l} style={{padding:"12px 14px"}}><Lbl>{s.l}</Lbl><p style={{fontSize:15,fontWeight:600,color:T.tx,margin:"4px 0 0",textTransform:"capitalize"}}>{s.v}</p></Card>)}
    </div>
    {m&&<Card style={{padding:"14px 16px",marginBottom:20,background:T.accG,border:`1px solid ${T.accM}`}}>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        {[{l:"Target",v:`${m.target} cal`,c:T.acc},{l:"Protein",v:`${m.proteinG}g`,c:T.pro},{l:"Carbs",v:`${m.carbG}g`,c:T.carb},{l:"Fat",v:`${m.fatG}g`,c:T.fat}].map(x=>
          <div key={x.l} style={{textAlign:"center"}}><p style={{fontSize:15,fontWeight:700,color:x.c,margin:0,fontFamily:T.mono}}>{x.v}</p><Lbl>{x.l}</Lbl></div>
        )}
      </div>
    </Card>}
    {items.map((s,i)=><Card key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",marginBottom:6,cursor:"pointer"}}>
      <div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <p style={{fontSize:14,fontWeight:600,color:T.tx,margin:0}}>{s.l}</p>
          {s.pro&&<span style={{fontSize:8,fontWeight:700,color:T.bg,background:T.acc,padding:"2px 6px",borderRadius:4}}>PRO</span>}
        </div>
        <p style={{fontSize:11,color:T.txM,margin:"2px 0 0"}}>{s.d}</p>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.txM} strokeWidth="1.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
    </Card>)}
    {onSignOut && <button onClick={onSignOut} style={{width:"100%",padding:14,borderRadius:T.r,border:`1px solid rgba(239,68,68,0.3)`,background:"rgba(239,68,68,0.08)",color:"#EF4444",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:T.font,marginTop:20}}>
      Sign Out
    </button>}
  </div>;
};

// ─── MAIN ──────────────────────────────────────────────────────
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

  // Check auth state after splash
  const checkAuth = async () => {
    const u = await getUser();
    if(u){
      setUser(u);
      // Load profile from Supabase
      const {data} = await getProfile(u.id);
      if(data){
        const p = {
          name:data.name, sex:data.sex, age:data.age,
          weightLbs:data.weight_lbs, heightFt:data.height_ft, heightIn:data.height_in,
          activity:data.activity, goal:data.goal, diet:data.diet||[],
          macros:{target:data.target_calories,proteinG:data.target_protein,carbG:data.target_carbs,fatG:data.target_fat}
        };
        setProfile(p);
        // Load saved meals
        const meals = await getSavedMeals(u.id);
        setSavedMeals(meals.map(m=>({id:m.id,name:m.name,ingredients:m.ingredients||[],totals:{cal:m.total_calories,p:m.total_protein,c:m.total_carbs,f:m.total_fat}})));
        // Load today's log
        const log = await getTodayLog(u.id);
        setTodayLog(log);
        // Load today's meal plan
        const plans = await getWeekPlans(u.id);
        const todayDow = new Date().getDay();
        const dowIndex = todayDow === 0 ? 6 : todayDow - 1; // Mon=0..Sun=6
        if(plans[dowIndex]) setTodayPlan(plans[dowIndex]);
        setPhase("app");
        return;
      }
      // User exists but no profile — needs onboarding
      setPhase("onboarding");
      return;
    }
    setPhase("auth");
  };

  const handleAuth = async (u) => {
    setUser(u);
    const {data} = await getProfile(u.id);
    if(data){
      const p = {
        name:data.name, sex:data.sex, age:data.age,
        weightLbs:data.weight_lbs, heightFt:data.height_ft, heightIn:data.height_in,
        activity:data.activity, goal:data.goal, diet:data.diet||[],
        macros:{target:data.target_calories,proteinG:data.target_protein,carbG:data.target_carbs,fatG:data.target_fat}
      };
      setProfile(p);
      const meals = await getSavedMeals(u.id);
      setSavedMeals(meals.map(m=>({id:m.id,name:m.name,ingredients:m.ingredients||[],totals:{cal:m.total_calories,p:m.total_protein,c:m.total_carbs,f:m.total_fat}})));
      const log = await getTodayLog(u.id);
      setTodayLog(log);
      const plans = await getWeekPlans(u.id);
      const todayDow = new Date().getDay();
      const dowIndex = todayDow === 0 ? 6 : todayDow - 1;
      if(plans[dowIndex]) setTodayPlan(plans[dowIndex]);
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
    setUser(null);setProfile(null);setSavedMeals([]);setTodayLog([]);setTodayPlan([]);
    setTab("home");setPhase("auth");
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

  const handleSaveMeal = async (meal) => {
    if(user) await saveMeal(user.id, meal);
    const meals = user ? await getSavedMeals(user.id) : [];
    setSavedMeals(meals.map(m=>({id:m.id,name:m.name,ingredients:m.ingredients||[],totals:{cal:m.total_calories,p:m.total_protein,c:m.total_carbs,f:m.total_fat}})));
  };

  const switchTab = (t) => {
    if(t==="home") refreshTodayLog();
    setTab(t);
  };

  if(phase==="splash") return <Splash onFinish={checkAuth}/>;
  if(phase==="auth") return <AuthScreen onAuth={handleAuth}/>;
  if(phase==="onboarding") return <Onboarding onComplete={handleComplete}/>;

  const screens = {
    home:<Dashboard setTab={switchTab} profile={profile} todayLog={todayLog} onLogMeal={handleLogMeal} onUnlogMeal={handleUnlogMeal} todayPlan={todayPlan}/>,
    plan:<Plan profile={profile} userId={user?.id}/>,
    log:<LogMeal savedMeals={savedMeals} onSaveMeal={handleSaveMeal} todayLog={todayLog} onLogMeal={handleLogMeal}/>,
    grocery:<Grocery isPro={isPro} setIsPro={setIsPro}/>,
    profile:<ProfileScreen profile={profile} onSignOut={handleSignOut}/>
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
