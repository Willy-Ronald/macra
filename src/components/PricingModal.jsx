import { useState, useEffect } from "react";

const T = {
  bg:"#09090B", sf:"#121215", bd:"#1E1E22", acc:"#C8B88A",
  accM:"rgba(200,184,138,0.12)", accG:"rgba(200,184,138,0.06)",
  tx:"#FAFAF9", tx2:"#A1A1AA", txM:"#52525B",
  r:14, font:"'Outfit',sans-serif",
};

const PLANS = [
  {
    id:       "monthly",
    name:     "Pro Monthly",
    price:    "$6.99",
    period:   "/ month",
    sub:      "7-day free trial — cancel anytime",
    badge:    null,
    highlight: false,
    cta:      "Start Free Trial",
  },
  {
    id:        "annual",
    name:      "Pro Annual",
    price:     "$59.99",
    period:    "/ year",
    sub:       "$5 / month · Save 29%",
    badge:     "BEST VALUE",
    highlight: true,
    cta:       "Subscribe",
  },
  {
    id:          "lifetime",
    name:        "Lifetime",
    price:       "$99",
    period:      "one-time",
    sub:         "First 200 users only — then gone",
    badge:       "LIMITED",
    badgeColor:  "#E05252",
    highlight:   false,
    cta:         "Get Lifetime Access",
  },
];

const FEATURES = [
  "2 AI meal plans per day (30/month cap)",
  "Smart grocery lists, auto-organized by category",
  "Custom macro split — precision percentage sliders",
  "Budget-aware meal generation",
  "Pickiness scale — 1 to 5 cuisine complexity",
  "20+ global cuisine styles",
  "All achievements & streak tracking",
];

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke={T.acc} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, marginTop: 1 }}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

export default function PricingModal({ onClose }) {
  const [toast,   setToast]   = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  // Global ESC listener (the outer div may not have focus, so we use window)
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 260);
  }

  function handleSubscribe(plan) {
    console.log("[stripe] redirect:", plan.id);
    setToast("Stripe integration launching soon — check back at launch! 🚀");
    setTimeout(() => setToast(null), 3500);
  }

  return (
    <div
      tabIndex={-1}
      onKeyDown={e => e.key === "Escape" && handleClose()}
      onClick={e => e.target === e.currentTarget && handleClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 11000,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        background: "rgba(0,0,0,0.82)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.25s ease",
      }}
    >
      <div style={{
        width: "100%", maxWidth: 430, maxHeight: "92vh", overflowY: "auto",
        background: T.sf,
        borderRadius: "20px 20px 0 0",
        border: `1px solid ${T.bd}`, borderBottom: "none",
        padding: "24px 20px 44px",
        position: "relative",
        transform: visible ? "translateY(0)" : "translateY(40px)",
        transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)",
      }}>
        {/* Drag handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: T.bd, margin: "0 auto 22px" }}/>

        {/* Close button */}
        <button
          onClick={handleClose}
          aria-label="Close"
          style={{
            position: "absolute", top: 20, right: 20,
            background: "none", border: "none",
            color: T.txM, fontSize: 18, cursor: "pointer",
            padding: 4, lineHeight: 1, fontFamily: T.font,
          }}
        >✕</button>

        {/* Header */}
        <h2 style={{
          fontSize: 22, fontWeight: 700, color: T.tx,
          margin: "0 0 4px", textAlign: "center",
          letterSpacing: "-0.02em", fontFamily: T.font,
        }}>
          Upgrade to Macra Pro
        </h2>
        <p style={{
          fontSize: 13, color: T.tx2, textAlign: "center",
          margin: "0 0 22px", lineHeight: 1.55, fontFamily: T.font,
        }}>
          AI plans, smart grocery lists, and full macro control — built around your goals.
        </p>

        {/* Plan cards */}
        <div style={{display:"flex",flexDirection:"column",gap:20,paddingTop:8}}>
        {PLANS.map(plan => (
          <div key={plan.id} style={{
            border: `1.5px solid ${plan.highlight ? T.acc : T.bd}`,
            borderRadius: T.r,
            padding: "16px 18px",
            background: plan.highlight ? T.accG : "transparent",
            position: "relative",
          }}>
            {/* Badge */}
            {plan.badge && (
              <span style={{
                position: "absolute", top: -10, right: 14,
                background: plan.badgeColor || T.acc,
                color: plan.badgeColor ? "#fff" : T.bg,
                fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                padding: "3px 10px", borderRadius: 20,
                fontFamily: T.font,
              }}>
                {plan.badge}
              </span>
            )}

            {/* Plan header row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: T.tx, margin: "0 0 3px", fontFamily: T.font }}>{plan.name}</p>
                <p style={{ fontSize: 11, color: T.txM, margin: 0, fontFamily: T.font, lineHeight: 1.4 }}>{plan.sub}</p>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: plan.highlight ? T.acc : T.tx, fontFamily: T.font }}>{plan.price}</span>
                <span style={{ fontSize: 11, color: T.txM, display: "block", fontFamily: T.font }}>{plan.period}</span>
              </div>
            </div>

            {/* Subscribe button */}
            <button
              onClick={() => handleSubscribe(plan)}
              style={{
                width: "100%", padding: "12px",
                borderRadius: T.r, border: "none",
                background: plan.highlight ? T.acc : T.bd,
                color: plan.highlight ? T.bg : T.tx,
                fontSize: 14, fontWeight: 700,
                cursor: "pointer", fontFamily: T.font,
                letterSpacing: "0.02em",
              }}
            >
              {plan.cta}
            </button>
          </div>
        ))}
        </div>

        {/* Feature list */}
        <div style={{
          marginTop: 20, padding: "16px 18px",
          background: T.accG, borderRadius: T.r,
          border: `1px solid ${T.accM}`,
        }}>
          <p style={{
            fontSize: 10, fontWeight: 700, color: T.acc,
            letterSpacing: "0.12em", margin: "0 0 12px",
            fontFamily: T.font, textTransform: "uppercase",
          }}>
            All Pro Plans Include
          </p>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: i < FEATURES.length - 1 ? 9 : 0 }}>
              <CheckIcon/>
              <span style={{ fontSize: 12, color: T.tx2, fontFamily: T.font, lineHeight: 1.45 }}>{f}</span>
            </div>
          ))}
        </div>

        {/* Free tier note */}
        <p style={{
          fontSize: 11, color: T.txM, textAlign: "center",
          margin: "16px 0 0", lineHeight: 1.6, fontFamily: T.font,
        }}>
          Free plan: 3 intro plans, then 1/week · No grocery lists · Standard macros only
        </p>

        {/* Toast */}
        {toast && (
          <div style={{
            position: "fixed", bottom: 110, left: "50%", transform: "translateX(-50%)",
            background: T.acc, color: T.bg,
            padding: "11px 22px", borderRadius: 12,
            fontSize: 12, fontWeight: 700,
            textAlign: "center", maxWidth: 320, width: "max-content",
            boxShadow: "0 4px 24px rgba(0,0,0,0.55)",
            zIndex: 12000, fontFamily: T.font,
          }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
