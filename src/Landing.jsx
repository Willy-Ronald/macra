import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
const Landing = () => {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [vis, setVis] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  // featVis removed — steps use CSS animation instead of JS IntersectionObserver
  const [activeScreen, setActiveScreen] = useState(0);
  const carouselRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({data:{session}}) => {
      if(session) { navigate("/app", {replace:true}); return; }
      setAuthChecked(true);
    }).catch(() => setAuthChecked(true));
  }, [navigate]);
  useEffect(() => {
    if(!authChecked) return;
    setTimeout(() => setVis(true), 100);
    const h = () => setScrollY(window.scrollY);
    const r = () => setIsMobile(window.innerWidth < 768);
    r();
    window.addEventListener("scroll", h, { passive: true });
    window.addEventListener("resize", r);
    return () => { window.removeEventListener("scroll", h); window.removeEventListener("resize", r); };
  }, [authChecked]);
  // IntersectionObserver removed — it ran before authChecked rendered the content,
  // so elements were never found. Steps animate in via CSS keyframes instead.
  useEffect(() => {
    const el = carouselRef.current;
    if (!el || !isMobile) return;
    const onScroll = () => {
      const scrollLeft = el.scrollLeft;
      const cardWidth = el.firstChild?.offsetWidth || 260;
      const gap = 16;
      const idx = Math.round(scrollLeft / (cardWidth + gap));
      setActiveScreen(Math.min(idx, 4));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [isMobile]);
  const a = "#C8B88A";
  const bg = "#09090B";
  const sf = "#121215";
  const bd = "#1E1E22";
  const txM = "#52525B";
  const tx2 = "#A1A1AA";
  const pro = "#7C9CF5";
  const carb = "#D4A853";
  const fat = "#C084A6";
  const ok = "#6BCB77";
  const Check = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={a} strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>;
  const MacroRow = ({cal,p,c,f,size=9}) => (
    <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
      <span style={{fontSize:size,fontFamily:"'DM Mono',monospace",color:a,fontWeight:600}}>{cal}<span style={{color:txM}}> cal</span></span>
      <span style={{fontSize:size,fontFamily:"'DM Mono',monospace",color:pro,fontWeight:500}}>{p}g<span style={{color:txM}}> P</span></span>
      <span style={{fontSize:size,fontFamily:"'DM Mono',monospace",color:carb,fontWeight:500}}>{c}g<span style={{color:txM}}> C</span></span>
      <span style={{fontSize:size,fontFamily:"'DM Mono',monospace",color:fat,fontWeight:500}}>{f}g<span style={{color:txM}}> F</span></span>
    </div>
  );
  const screenLabels = ["Dashboard", "AI Meal Plan", "Grocery List", "Food Search", "Manual Entry"];
  const screenCards = [
    <div key="dash" style={{minWidth:isMobile?280:260,width:isMobile?280:260,padding:"18px 16px",background:sf,borderRadius:24,border:"1px solid "+bd,boxShadow:"0 12px 48px rgba(0,0,0,0.4)"}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,fontWeight:600,color:txM,marginBottom:12}}><span>9:41</span><span style={{fontSize:9}}>●●● ■</span></div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:16}}>
        <div><p style={{fontSize:9,color:txM,margin:0,letterSpacing:"0.08em"}}>WEDNESDAY</p><p style={{fontSize:17,fontWeight:700,margin:"2px 0 0"}}>Daily Overview</p></div>
        <div style={{width:28,height:28,borderRadius:"50%",background:a,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:12,fontWeight:700,color:bg}}>7</span></div>
      </div>
      <div style={{background:bg,borderRadius:16,padding:"16px 14px",border:"1px solid "+bd,marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={{position:"relative",width:72,height:72,flexShrink:0}}>
            <svg width="72" height="72" viewBox="0 0 72 72"><circle cx="36" cy="36" r="30" fill="none" stroke={bd} strokeWidth="4"/><circle cx="36" cy="36" r="30" fill="none" stroke={a} strokeWidth="4" strokeLinecap="round" strokeDasharray={2*Math.PI*30} strokeDashoffset={2*Math.PI*30*0.39} transform="rotate(-90 36 36)"/></svg>
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:17,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>860</span><span style={{fontSize:6,color:txM,letterSpacing:"0.1em"}}>LEFT</span></div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8,flex:1}}>
            {[{l:"Protein",c:pro,w:"53%",v:"95/180g"},{l:"Carbs",c:carb,w:"50%",v:"120/240g"},{l:"Fat",c:fat,w:"60%",v:"42/70g"}].map(b=>
              <div key={b.l}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:8,color:tx2}}>{b.l}</span><span style={{fontSize:7,color:txM,fontFamily:"'DM Mono',monospace"}}>{b.v}</span></div>
              <div style={{height:3,borderRadius:2,background:bd}}><div style={{height:"100%",width:b.w,borderRadius:2,background:b.c}}/></div></div>
            )}
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:24,marginTop:12,paddingTop:10,borderTop:"1px solid "+bd}}>
          <div style={{textAlign:"center"}}><p style={{fontSize:13,fontWeight:700,margin:0,fontFamily:"'DM Mono',monospace"}}>1,340</p><p style={{fontSize:7,color:txM,margin:0}}>EATEN</p></div>
          <div style={{textAlign:"center"}}><p style={{fontSize:13,fontWeight:700,margin:0,fontFamily:"'DM Mono',monospace",color:a}}>2,200</p><p style={{fontSize:7,color:txM,margin:0}}>TARGET</p></div>
        </div>
      </div>
      <p style={{fontSize:9,fontWeight:600,color:tx2,margin:"0 0 6px"}}>Eaten Today</p>
      {[{n:"Egg & Avocado Toast",cal:420,p:24,c:38,f:18},{n:"Grilled Chicken Bowl",cal:580,p:48,c:52,f:22},{n:"Protein Shake",cal:340,p:35,c:12,f:14}].map((m,i)=>
        <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 8px",marginBottom:3,background:bg,borderRadius:8,border:"1px solid "+bd}}>
          <div><p style={{fontSize:9,fontWeight:600,margin:0}}>{m.n}</p><MacroRow cal={m.cal} p={m.p} c={m.c} f={m.f} size={7}/></div>
          <div style={{width:5,height:5,borderRadius:"50%",background:ok}}/>
        </div>
      )}
    </div>,
    <div key="plan" style={{minWidth:isMobile?280:220,width:isMobile?280:220,padding:"18px 16px",background:sf,borderRadius:24,border:"1px solid "+bd,boxShadow:"0 12px 48px rgba(0,0,0,0.4)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <p style={{fontSize:10,color:txM,margin:0,letterSpacing:"0.1em",fontWeight:600}}>AI MEAL PLAN</p>
        <span style={{fontSize:12,color:a}}>✦</span>
      </div>
      <div style={{display:"flex",gap:3,marginBottom:12}}>
        {["M","T","W","T","F","S","S"].map((d,i)=>
          <div key={i} style={{flex:1,padding:"5px 0",borderRadius:5,background:i===2?a:"transparent",textAlign:"center",fontSize:9,fontWeight:600,color:i===2?bg:txM}}>{d}</div>
        )}
      </div>
      {[{type:"BREAKFAST",name:"Spinach Egg Cups",cal:340,p:26,c:8,f:24,time:"20 min"},{type:"LUNCH",name:"Thai Chicken Bowl",cal:650,p:52,c:58,f:20,time:"20 min"},{type:"SNACK",name:"Cottage Cheese & Berries",cal:280,p:24,c:22,f:10,time:"3 min"},{type:"DINNER",name:"Steak Fajita Plate",cal:720,p:56,c:48,f:30,time:"25 min"}].map((m,i)=>
        <div key={i} style={{padding:"8px 10px",marginBottom:5,background:bg,borderRadius:10,border:"1px solid "+bd}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
            <span style={{fontSize:8,fontWeight:600,color:a,letterSpacing:"0.12em"}}>{m.type}</span>
            <span style={{fontSize:8,color:txM}}>{m.time}</span>
          </div>
          <p style={{fontSize:11,fontWeight:600,margin:"0 0 4px"}}>{m.name}</p>
          <MacroRow cal={m.cal} p={m.p} c={m.c} f={m.f} size={8}/>
        </div>
      )}
      <div style={{padding:"8px",marginTop:6,background:"rgba(200,184,138,0.08)",borderRadius:10,textAlign:"center"}}>
        <span style={{fontSize:10,fontWeight:600,color:a}}>✦ Regenerate Plan</span>
      </div>
    </div>,
    <div key="grocery" style={{minWidth:isMobile?280:220,width:isMobile?280:220,padding:"18px 16px",background:sf,borderRadius:24,border:"1px solid "+bd,boxShadow:"0 12px 48px rgba(0,0,0,0.4)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <p style={{fontSize:10,color:txM,margin:0,letterSpacing:"0.1em",fontWeight:600}}>GROCERY LIST</p>
        <span style={{fontSize:8,fontWeight:700,color:bg,background:a,padding:"2px 6px",borderRadius:3}}>PRO</span>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
        <span style={{fontSize:10,color:tx2}}>18 of 43 items</span>
        <span style={{fontSize:10,color:a,fontFamily:"'DM Mono',monospace"}}>42%</span>
      </div>
      <div style={{height:3,borderRadius:2,background:bd,marginBottom:14}}><div style={{height:"100%",width:"42%",borderRadius:2,background:a}}/></div>
      {[{cat:"Protein & Meat",items:[{n:"Chicken breast, 2 lbs",done:true},{n:"Salmon fillets, 1 lb",done:true},{n:"Large eggs, 1 dozen",done:false},{n:"Flank steak, 1 lb",done:false}]},{cat:"Produce",items:[{n:"Avocados, 4 ct",done:true},{n:"Sweet potatoes, 3",done:false},{n:"Spinach, 5 oz bag",done:false},{n:"Bell peppers, 3 ct",done:false}]}].map(c=>
        <div key={c.cat} style={{marginBottom:10}}>
          <span style={{fontSize:8,fontWeight:600,color:a,letterSpacing:"0.1em"}}>{c.cat}</span>
          {c.items.map((it,i)=>
            <div key={i} style={{display:"flex",alignItems:"center",gap:7,padding:"5px 0",borderBottom:"1px solid "+bd}}>
              <div style={{width:13,height:13,borderRadius:4,border:it.done?"1px solid "+ok:"1px solid "+bd,background:it.done?ok:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {it.done&&<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={bg} strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
              </div>
              <span style={{fontSize:10,color:it.done?txM:tx2,textDecoration:it.done?"line-through":"none"}}>{it.n}</span>
            </div>
          )}
        </div>
      )}
      <div style={{padding:"7px",marginTop:6,background:"rgba(200,184,138,0.06)",borderRadius:8,display:"flex",alignItems:"center",gap:4,justifyContent:"center"}}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={tx2} strokeWidth="1.5"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        <span style={{fontSize:9,color:tx2,fontWeight:500}}>Share List</span>
      </div>
    </div>,
    <div key="search" style={{minWidth:isMobile?280:200,width:isMobile?280:200,padding:"16px 14px",background:sf,borderRadius:24,border:"1px solid "+bd,boxShadow:"0 12px 48px rgba(0,0,0,0.4)"}}>
      <p style={{fontSize:10,fontWeight:600,color:tx2,margin:"0 0 10px"}}>Search Foods</p>
      <div style={{padding:"8px 10px",background:bg,borderRadius:10,border:"1px solid "+bd,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={txM} strokeWidth="1.5"><circle cx="11" cy="11" r="7.5"/><path d="M21 21l-4.35-4.35"/></svg>
        <span style={{fontSize:10,color:a}}>chobani greek</span>
      </div>
      <p style={{fontSize:8,color:txM,margin:"0 0 6px",letterSpacing:"0.06em"}}>RESULTS</p>
      {[{n:"Chobani Greek Yogurt",b:"Chobani · 5.3 oz",cal:120,p:15,c:8,f:3},{n:"Chobani Flip S'mores",b:"Chobani · 4.5 oz",cal:190,p:12,c:22,f:7},{n:"Chobani Oat Milk",b:"Chobani · 1 cup",cal:120,p:3,c:16,f:5},{n:"Chobani Zero Sugar",b:"Chobani · 5.3 oz",cal:60,p:10,c:4,f:0}].map((r,i)=>
        <div key={i} style={{padding:"8px 10px",marginBottom:4,background:bg,borderRadius:9,border:"1px solid "+(i===0?a+"40":bd)}}>
          <p style={{fontSize:10,fontWeight:600,margin:0}}>{r.n}</p>
          <p style={{fontSize:8,color:txM,margin:"2px 0 3px"}}>{r.b}</p>
          <MacroRow cal={r.cal} p={r.p} c={r.c} f={r.f} size={7}/>
        </div>
      )}
    </div>,
    <div key="manual" style={{minWidth:isMobile?280:200,width:isMobile?280:200,padding:"16px 14px",background:sf,borderRadius:24,border:"1px solid "+bd,boxShadow:"0 12px 48px rgba(0,0,0,0.4)"}}>
      <p style={{fontSize:10,fontWeight:600,color:tx2,margin:"0 0 10px"}}>Manual Entry</p>
      {[{l:"Meal Name",v:"Grilled Salmon"},{l:"Calories",v:"480"},{l:"Protein (g)",v:"52"},{l:"Carbs (g)",v:"12"},{l:"Fat (g)",v:"26"}].map((f,i)=>
        <div key={i} style={{marginBottom:7}}>
          <span style={{fontSize:8,color:txM,letterSpacing:"0.06em"}}>{f.l}</span>
          <div style={{padding:"7px 9px",marginTop:3,background:bg,borderRadius:8,border:"1px solid "+bd}}>
            <span style={{fontSize:11,color:i===0?"#FAFAF9":a,fontFamily:i>0?"'DM Mono',monospace":"inherit",fontWeight:i>0?600:500}}>{f.v}</span>
          </div>
        </div>
      )}
      <div style={{padding:"10px",marginTop:8,background:a,borderRadius:10,textAlign:"center"}}>
        <span style={{fontSize:11,fontWeight:700,color:bg}}>Log It — 480 cal</span>
      </div>
    </div>,
  ];
  if(!authChecked) return <div style={{background:"#09090B",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg, #C8B88A, #A89560)",display:"flex",alignItems:"center",justifyContent:"center",animation:"pulse 1.5s ease infinite"}}>
      <span style={{fontSize:17,fontWeight:800,color:"#09090B",fontFamily:"'Outfit',sans-serif"}}>M</span>
    </div>
    <style>{"@keyframes pulse{0%,100%{opacity:.4;transform:scale(0.95)}50%{opacity:1;transform:scale(1)}}"}</style>
  </div>;

  return (
    <div style={{background:bg,color:"#FAFAF9",fontFamily:"'Outfit',sans-serif",minHeight:"100vh",overflowX:"hidden"}}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=DM+Mono:wght@400;500&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet"/>
      <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:100,padding:"18px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",background:scrollY>50?"rgba(9,9,11,0.92)":"linear-gradient(180deg, "+bg+" 60%, transparent)",backdropFilter:scrollY>50?"blur(20px)":"none",borderBottom:scrollY>50?"1px solid "+bd:"1px solid transparent",transition:"all 0.3s"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg, "+a+", #A89560)",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:17,fontWeight:800,color:bg}}>M</span></div>
          <span style={{fontSize:18,fontWeight:700,letterSpacing:"-0.02em"}}>Macra</span>
        </div>
        <a href="/app" style={{padding:"10px 24px",borderRadius:10,background:a,color:bg,fontSize:14,fontWeight:700,textDecoration:"none"}}>Get Started</a>
      </nav>
      <section style={{display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",textAlign:"center",padding:"120px 24px 40px",position:"relative"}}>
        <div style={{position:"absolute",top:"8%",left:"30%",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle, rgba(200,184,138,0.06) 0%, transparent 70%)",pointerEvents:"none"}}/>
        <div style={{opacity:vis?1:0,transform:vis?"translateY(0)":"translateY(20px)",transition:"all 0.8s cubic-bezier(0.22,1,0.36,1)"}}>
          <p style={{fontSize:13,fontWeight:600,color:a,letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:24}}>AI-Powered Nutrition</p>
          <h1 style={{fontSize:"clamp(38px, 8vw, 72px)",fontWeight:800,lineHeight:1.05,letterSpacing:"-0.03em",margin:"0 auto 24px",maxWidth:720}}>Eat with<br/><span style={{fontFamily:"'Playfair Display', serif",fontStyle:"italic",fontWeight:400,color:a}}>intention.</span></h1>
          <p style={{fontSize:"clamp(15px, 2.5vw, 20px)",color:tx2,lineHeight:1.6,maxWidth:520,margin:"0 auto 16px",fontWeight:400}}>AI builds your meal plan. You hit your macros.<br/>No guesswork. No spreadsheets. No wasted meals.</p>
          <p style={{fontSize:14,color:txM,margin:"0 0 40px"}}>Free to start · 7-day Pro trial · No credit card required</p>
          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
            <a href="/app" style={{padding:"16px 36px",borderRadius:12,background:a,color:bg,fontSize:16,fontWeight:700,textDecoration:"none",boxShadow:"0 4px 24px rgba(200,184,138,0.2)"}}>Start Free →</a>
            <a href="#features" style={{padding:"16px 36px",borderRadius:12,border:"1px solid "+bd,background:"transparent",color:tx2,fontSize:16,fontWeight:500,textDecoration:"none"}}>See How It Works</a>
          </div>
        </div>
        {isMobile ? (
          <div style={{marginTop:48,width:"100%",opacity:vis?1:0,transform:vis?"translateY(0)":"translateY(20px)",transition:"all 0.8s ease 0.3s"}}>
            <div ref={carouselRef} style={{display:"flex",gap:16,overflowX:"auto",scrollSnapType:"x mandatory",padding:"0 calc(50% - 148px) 20px",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none"}}>
              <style>{"div::-webkit-scrollbar{display:none}"}</style>
              {screenCards.map((card, i) => (<div key={i} style={{scrollSnapAlign:"center",flexShrink:0}}>{card}</div>))}
            </div>
            <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:12}}>
              {screenLabels.map((label, i) => (
                <div key={i}><div style={{width:activeScreen===i?24:8,height:8,borderRadius:4,background:activeScreen===i?a:txM+"60",transition:"all 0.3s ease"}}/></div>
              ))}
            </div>
            <p style={{fontSize:11,color:txM,textAlign:"center",marginTop:8}}>{screenLabels[activeScreen]}</p>
          </div>
        ) : (
          <div style={{marginTop:56,width:"100%",maxWidth:1100,position:"relative",minHeight:520,display:"flex",justifyContent:"center",alignItems:"flex-start"}}>
            <div style={{position:"relative",zIndex:5,opacity:vis?1:0,transform:vis?"translateY(0) scale(1)":"translateY(30px) scale(0.97)",transition:"all 0.8s cubic-bezier(0.22,1,0.36,1) 0.2s"}}>{screenCards[0]}</div>
            <div style={{position:"absolute",left:"calc(50% - 380px)",top:40,zIndex:3,opacity:vis?1:0,transform:vis?"rotate(-4deg)":"rotate(-4deg) translateX(-20px)",transition:"all 0.8s cubic-bezier(0.22,1,0.36,1) 0.4s"}}>{screenCards[1]}</div>
            <div style={{position:"absolute",right:"calc(50% - 380px)",top:40,zIndex:3,opacity:vis?1:0,transform:vis?"rotate(4deg)":"rotate(4deg) translateX(20px)",transition:"all 0.8s cubic-bezier(0.22,1,0.36,1) 0.5s"}}>{screenCards[2]}</div>
            <div style={{position:"absolute",left:"calc(50% - 540px)",top:100,zIndex:1,opacity:vis?0.7:0,transform:vis?"rotate(-8deg) scale(0.88)":"rotate(-8deg) scale(0.82)",transition:"all 0.8s cubic-bezier(0.22,1,0.36,1) 0.6s"}}>{screenCards[3]}</div>
            <div style={{position:"absolute",right:"calc(50% - 540px)",top:100,zIndex:1,opacity:vis?0.7:0,transform:vis?"rotate(8deg) scale(0.88)":"rotate(8deg) scale(0.82)",transition:"all 0.8s cubic-bezier(0.22,1,0.36,1) 0.7s"}}>{screenCards[4]}</div>
            <div style={{position:"absolute",bottom:-20,left:"50%",transform:"translateX(-50%)",width:200,height:60,background:"radial-gradient(ellipse, rgba(200,184,138,0.08) 0%, transparent 70%)",pointerEvents:"none",zIndex:0}}/>
          </div>
        )}
        <div style={{marginTop:32,opacity:scrollY>100?0:0.4,transition:"opacity 0.3s"}}>
          <div style={{width:24,height:40,borderRadius:12,border:"1.5px solid "+txM,display:"flex",justifyContent:"center",paddingTop:8,margin:"0 auto"}}>
            <div style={{width:3,height:8,borderRadius:2,background:txM,animation:"scrollP 2s ease infinite"}}/>
          </div>
          <style>{"@keyframes scrollP{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:1;transform:translateY(4px)}} @keyframes featIn{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}"}</style>
        </div>
      </section>
      <section style={{padding:"40px 24px",textAlign:"center",borderTop:"1px solid "+bd,borderBottom:"1px solid "+bd}}>
        <div style={{display:"flex",justifyContent:"center",gap:isMobile?24:48,flexWrap:"wrap"}}>
          {[{n:"60 sec",l:"From signup to your first meal plan"},{n:"1,000+",l:"Foods & brands in search database"},{n:"$4.99",l:"Per month for all Pro features"}].map((s,i)=>
            <div key={i} style={{textAlign:"center"}}>
              <p style={{fontSize:isMobile?22:28,fontWeight:800,color:a,margin:"0 0 4px",fontFamily:"'DM Mono',monospace"}}>{s.n}</p>
              <p style={{fontSize:11,color:txM,margin:0,fontWeight:500,letterSpacing:"0.04em"}}>{s.l}</p>
            </div>
          )}
        </div>
      </section>
      <section id="features" style={{padding:isMobile?"60px 20px":"100px 24px",maxWidth:900,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:isMobile?40:64}}>
          <p style={{fontSize:13,fontWeight:600,color:a,letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:16}}>How It Works</p>
          <h2 style={{fontSize:"clamp(28px, 5vw, 44px)",fontWeight:800,letterSpacing:"-0.02em",margin:0}}>Your nutrition,<br/><span style={{color:a}}>engineered.</span></h2>
        </div>
        {[
          {num:"01",title:"Tell us about you",desc:"Age, weight, height, activity level, and goal. Macra calculates your precise daily targets using the Mifflin-St Jeor equation — the gold standard in sports nutrition.",detail:"Personalized calories, protein, carbs, and fat — in 60 seconds."},
          {num:"02",title:"AI builds your meal plan",desc:"One tap generates a full day of meals matched to your exact macros and dietary preferences. Mediterranean, keto, carnivore, high-protein — it adapts to how you eat.",detail:"Breakfast, lunch, snack, dinner — with prep times and real ingredients."},
          {num:"03",title:"Track what you actually eat",desc:"Search thousands of real foods and brands instantly, log saved meals with one tap, or enter anything manually. Your macro dashboard updates in real time.",detail:"No more guessing portions. Search it, tap it, done."},
          {num:"04",title:"Auto-generate your grocery list",desc:"Your meal plan turns into a smart shopping list, organized by aisle with exact quantities. Share it with your partner before hitting the store.",detail:"A Pro feature that saves hours every week. No more forgotten ingredients.",isPro:true},
          {num:"05",title:"Track together as a household",desc:"Sync with your partner and manage nutrition for the whole household from one app. Different goals, different macros, one shared meal plan.",detail:"Coming in Pro — built for couples and families who eat together.",isPro:true},
        ].map((f,i)=>
          <div key={i} style={{display:"flex",gap:isMobile?16:32,marginBottom:isMobile?40:56,alignItems:"flex-start",animation:`featIn 0.6s cubic-bezier(0.22,1,0.36,1) ${i*0.1}s both`}}>
            <span style={{fontSize:isMobile?32:48,fontWeight:900,color:bd,fontFamily:"'DM Mono',monospace",lineHeight:1,flexShrink:0,minWidth:isMobile?44:70}}>{f.num}</span>
            <div>
              <h3 style={{fontSize:isMobile?18:22,fontWeight:700,margin:"0 0 10px",letterSpacing:"-0.01em"}}>{f.title}
                {f.isPro&&<span style={{fontSize:9,fontWeight:700,color:bg,background:a,padding:"3px 7px",borderRadius:4,marginLeft:10,verticalAlign:"middle"}}>PRO</span>}
              </h3>
              <p style={{fontSize:isMobile?14:16,color:tx2,lineHeight:1.6,margin:"0 0 10px"}}>{f.desc}</p>
              <p style={{fontSize:13,color:a,fontWeight:500,margin:0,fontStyle:"italic"}}>{f.detail}</p>
            </div>
          </div>
        )}
      </section>
      <section style={{padding:"80px 20px",maxWidth:1020,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:48}}>
          <p style={{fontSize:13,fontWeight:600,color:a,letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:16}}>Pricing</p>
          <h2 style={{fontSize:"clamp(28px, 5vw, 40px)",fontWeight:800,letterSpacing:"-0.02em",margin:"0 0 8px"}}>Start free. Go Pro when ready.</h2>
          <p style={{fontSize:15,color:txM,margin:0}}>7-day free Pro trial on every new account. No credit card required.</p>
        </div>
        <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap"}}>
          {[
            {tier:"Free",price:"$0",per:"/mo",desc:"Everything to get started",features:["Personalized macro targets","1 AI meal plan per week","Food database search","Manual meal logging","Custom meal builder"],cta:"Get Started Free",ctaStyle:{border:"1px solid "+bd,color:"#FAFAF9",background:"transparent"},highlight:false},
            {tier:"Pro Monthly",price:"$4.99",per:"/mo",desc:"For serious trackers",features:["Everything in Free","5 AI plans/week · 20/month","Smart grocery lists","Household mode","Meal prep & batch cooking","Weekly macro trends","Cancel anytime"],cta:"Start 7-Day Free Trial",ctaStyle:{border:"none",background:a,color:bg,boxShadow:"0 4px 16px rgba(200,184,138,0.15)"},highlight:true,badge:"POPULAR"},
            {tier:"Pro Annual",price:"$34.99",per:"/yr",desc:"Best value — $2.92/mo",features:["Everything in Pro Monthly","5 AI plans/week · 20/month","All future Pro features included","Supports indie development"],cta:"Start 7-Day Free Trial",ctaStyle:{border:"1px solid "+a,color:a,background:"transparent"},highlight:false,save:"SAVE 42%"},
          ].map((p,i)=>
            <div key={i} style={{flex:"1 1 250px",maxWidth:320,padding:28,borderRadius:20,border:p.highlight?"1.5px solid "+a+"40":"1px solid "+bd,background:sf,position:"relative",overflow:"hidden"}}>
              {p.highlight&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg, transparent, "+a+", transparent)"}}/>}
              {p.save&&<div style={{position:"absolute",top:16,right:16}}><span style={{fontSize:10,fontWeight:700,color:ok,background:"rgba(107,203,119,0.1)",padding:"4px 10px",borderRadius:6,border:"1px solid rgba(107,203,119,0.2)"}}>{p.save}</span></div>}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <p style={{fontSize:12,fontWeight:600,color:p.highlight?a:txM,letterSpacing:"0.1em",textTransform:"uppercase",margin:0}}>{p.tier}</p>
                {p.badge&&<span style={{fontSize:9,fontWeight:700,color:bg,background:a,padding:"3px 8px",borderRadius:4}}>{p.badge}</span>}
              </div>
              <p style={{fontSize:34,fontWeight:800,margin:"0 0 4px"}}>{p.price}<span style={{fontSize:15,fontWeight:400,color:txM}}> {p.per}</span></p>
              <p style={{fontSize:13,color:txM,margin:"0 0 24px"}}>{p.desc}</p>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {p.features.map((f,j)=>
                  <div key={j} style={{display:"flex",alignItems:"center",gap:10}}><Check/><span style={{fontSize:13,color:p.highlight?"#FAFAF9":tx2}}>{f}</span></div>
                )}
              </div>
              <a href="/app" style={{display:"block",textAlign:"center",marginTop:24,padding:"13px",borderRadius:12,fontSize:14,fontWeight:p.highlight?700:600,textDecoration:"none",...p.ctaStyle}}>{p.cta}</a>
            </div>
          )}
        </div>
      </section>
      <section style={{padding:"100px 24px 60px",textAlign:"center",position:"relative"}}>
        <div style={{position:"absolute",bottom:"20%",left:"50%",transform:"translateX(-50%)",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle, rgba(200,184,138,0.04) 0%, transparent 70%)",pointerEvents:"none"}}/>
        <h2 style={{fontSize:"clamp(32px, 6vw, 52px)",fontWeight:800,letterSpacing:"-0.03em",margin:"0 0 16px"}}>Your macros won't<br/><span style={{fontFamily:"'Playfair Display', serif",fontStyle:"italic",fontWeight:400,color:a}}>track themselves.</span></h2>
        <p style={{fontSize:18,color:txM,margin:"0 0 12px"}}>Free forever. Pro when you're ready.</p>
        <p style={{fontSize:14,color:txM,margin:"0 0 36px"}}>7-day Pro trial included with every account.</p>
        <a href="/app" style={{display:"inline-block",padding:"18px 48px",borderRadius:14,background:a,color:bg,fontSize:17,fontWeight:700,textDecoration:"none",boxShadow:"0 6px 32px rgba(200,184,138,0.25)"}}>Start Tracking Free →</a>
      </section>
      <footer style={{padding:"40px 24px",borderTop:"1px solid "+bd,display:"flex",justifyContent:"space-between",alignItems:"center",maxWidth:900,margin:"0 auto",flexWrap:"wrap",gap:16}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:24,height:24,borderRadius:6,background:"linear-gradient(135deg, "+a+", #A89560)",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:13,fontWeight:800,color:bg}}>M</span></div>
          <span style={{fontSize:14,fontWeight:600}}>Macra</span>
        </div>
        <p style={{fontSize:12,color:txM,margin:0}}>© 2026 Macra. All rights reserved.</p>
      </footer>
    </div>
  );
};
export default Landing;
