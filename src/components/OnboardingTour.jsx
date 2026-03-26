import { useState, useEffect, useRef } from "react";
import { supabase, unlockAchievement } from "../lib/supabase";

// Mirror the app-level design tokens (kept in sync with App.jsx T object)
const T = {
  acc: "#C8B88A", bg: "#09090B", sf: "#121215", bd: "#1E1E22",
  tx: "#FAFAF9", tx2: "#A1A1AA", txM: "#52525B",
  r: 14, font: "'Outfit',sans-serif",
};

// Each step: { tab, sel, title, body, place, isPro?, isFinal? }
// tab  — which app tab must be active for this step's target to exist
// sel  — CSS selector for spotlight target (null = full overlay, centered bubble)
// place — "above" | "below" | "center"
// isPro — show PRO badge
// isFinal — show two-button final CTA instead of Next →
const STEPS = [
  // ── HOME TAB (3 steps) ──────────────────────────────────────────────────
  {
    tab: "home",
    sel: '[data-tour="macro-ring"]',
    title: "Your Calorie & Macro Ring",
    body: "This ring shows your daily calorie progress. The three bars below track protein, carbs, and fat — updated the moment you log a meal.",
    place: "below",
  },
  {
    tab: "home",
    sel: '[data-tour="week-strip"]',
    title: "Your Weekly Log",
    body: "Each dot marks a day you've logged food. Tap any day to review what you ate — great for spotting patterns over time.",
    place: "below",
  },
  {
    tab: "home",
    sel: '[data-tour="todays-plan"]',
    title: "Today's Plan at a Glance",
    body: "Your AI-generated meals appear right here each day. Tap any meal to log it instantly — no typing needed.",
    place: "below",
  },

  // ── PLAN TAB (3 steps) ─ auto-navigate before step 4 ───────────────────
  {
    tab: "plan",
    sel: '[data-tour="day-tabs"]',
    title: "Day A & Day B Plans",
    body: "Macra gives you two distinct meal plans. Day A runs Mon / Wed / Fri / Sun; Day B covers Tue / Thu / Sat — variety built in, boredom left out.",
    place: "below",
  },
  {
    tab: "plan",
    sel: '[data-tour="save-meal"]',
    title: "Save Any Meal You Love",
    body: "Tap the heart on any meal card to add it to your favourites. Saved meals appear in the Log tab for one-tap logging anytime.",
    place: "below",
  },
  {
    tab: "plan",
    sel: '[data-tour="generate-plan"]',
    title: "Generate Your AI Plan",
    body: "One tap builds a full week of meals personalised to your macros, budget, and food preferences — powered by Claude AI.",
    place: "above",
  },

  // ── GROCERY TAB (2 steps) ─ auto-navigate before step 7 ────────────────
  {
    tab: "grocery",
    sel: '[data-tour="grocery-list"]',
    title: "Auto-Generated Grocery List",
    body: "Every ingredient from your A/B plan is combined, scaled by days used, and sorted by category — ready to shop directly from your phone.",
    place: "below",
    isPro: true,
  },
  {
    tab: "grocery",
    sel: '[data-tour="share-list"]',
    title: "Share Your List",
    body: "Tap Share to send your grocery list to anyone via your phone's native share sheet — perfect for splitting the shopping with a partner.",
    place: "above",
    isPro: true,
  },

  // ── LOG TAB (1 step) ─ auto-navigate before step 9 ─────────────────────
  {
    tab: "log",
    sel: '[data-tour="log-options"]',
    title: "Three Ways to Log",
    body: "Manual entry for quick macro estimates, one-tap from your saved favourites, or build a fully custom meal with detailed ingredients.",
    place: "below",
  },

  // ── STATS TAB (1 step) ─ auto-navigate before step 10 ──────────────────
  {
    tab: "stats",
    sel: '[data-tour="streaks"]',
    title: "Build Your Streaks",
    body: "Log every day and hit your macro goals to build streaks. Keep the chain alive to unlock achievements and prove consistency to yourself.",
    place: "below",
  },

  // ── YOU TAB (6 steps) ─ auto-navigate before step 11 ───────────────────
  {
    tab: "profile",
    sel: '[data-tour="adjust-stats"]',
    title: "Keep Your Stats Current",
    body: "Update your age, weight, height, and activity level whenever life changes. Your daily calorie target recalculates immediately.",
    place: "below",
  },
  {
    tab: "profile",
    sel: '[data-tour="weekly-budget"]',
    title: "Budget-Aware Meal Planning",
    body: "Tell us your weekly grocery budget and the AI will plan meals that fit your wallet — not just your macros.",
    place: "below",
  },
  {
    tab: "profile",
    sel: '[data-tour="dietary-prefs"]',
    title: "Dietary Preferences",
    body: "Vegan, keto, halal, gluten-free — set your diet and the AI will never suggest meals that fall outside your rules.",
    place: "below",
  },
  {
    tab: "profile",
    sel: '[data-tour="disliked-foods"]',
    title: "Foods You Don't Eat",
    body: "Add specific ingredients you hate or can't eat. The AI reads this list before generating every single plan — no more picking things out.",
    place: "below",
  },
  {
    tab: "profile",
    sel: '[data-tour="pickiness"]',
    title: "Meal Complexity Level",
    body: "Rate how adventurous you are. Level 1 = bold global flavours. Level 5 = simple and familiar. The AI adjusts every plan to match.",
    place: "below",
  },
  {
    tab: "profile",
    sel: '[data-tour="macro-split"]',
    title: "Custom Macro Split",
    body: "Override the default 40 / 30 / 30 formula with your own protein / carb / fat percentages. Dial in exactly what your goal demands.",
    place: "below",
    isPro: true,
  },

  // ── FINAL STEP ─ auto-navigate back to home before step 17 ─────────────
  {
    tab: "home",
    sel: null,
    title: "You're Ready to Go!",
    body: "You've seen everything Macra has to offer. Generate your first AI meal plan and start building the body you want — one meal at a time.",
    place: "center",
    isFinal: true,
  },
];

export default function OnboardingTour({ userId, onSwitchTab, onComplete }) {
  const [step, setStep]         = useState(0);
  const [spotRect, setSpotRect] = useState(null);
  const [visible, setVisible]   = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [achToast, setAchToast] = useState(false);
  const containerRef = useRef(null);

  const cur    = STEPS[step];
  const total  = STEPS.length;
  const isLast = step === total - 1;

  // Fade in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Remeasure spotlight target whenever step changes
  useEffect(() => {
    if (cur.sel) {
      const el = document.querySelector(cur.sel);
      setSpotRect(el ? el.getBoundingClientRect() : null);
    } else {
      setSpotRect(null);
    }
    containerRef.current?.focus();
  }, [step, cur.sel]);

  // ── Dismiss (skip at any point) — NO achievement ─────────────────────
  async function dismiss() {
    setVisible(false);
    await new Promise(r => setTimeout(r, 250));
    try {
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", userId);
    } catch (e) {
      console.error("[tour] failed to save completion:", e);
    }
    onComplete();
  }

  // ── Finish (completed all steps) — unlock achievement ────────────────
  async function finish() {
    // Show inline toast before fading
    try { await unlockAchievement(userId, "tutorial_complete"); } catch (e) {}
    setAchToast(true);
    await new Promise(r => setTimeout(r, 1400));
    setVisible(false);
    await new Promise(r => setTimeout(r, 250));
    try {
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", userId);
    } catch (e) {
      console.error("[tour] failed to save completion:", e);
    }
    onComplete();
  }

  // ── Advance (Next button) ────────────────────────────────────────────
  async function advance() {
    if (advancing) return;
    if (isLast) { finish(); return; }

    const nextStep = step + 1;
    const nextTab  = STEPS[nextStep].tab;

    if (nextTab !== cur.tab) {
      setAdvancing(true);
      onSwitchTab(nextTab);
      // Wait for new tab to mount its DOM before spotlighting
      await new Promise(r => setTimeout(r, 300));
      setStep(nextStep);
      setAdvancing(false);
    } else {
      setStep(nextStep);
    }
  }

  // "Generate My First Plan →" — complete tour then navigate to plan
  async function goToPlan() {
    try { await unlockAchievement(userId, "tutorial_complete"); } catch (e) {}
    setAchToast(true);
    await new Promise(r => setTimeout(r, 1400));
    setVisible(false);
    await new Promise(r => setTimeout(r, 250));
    try {
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", userId);
    } catch (e) {}
    onComplete();
    onSwitchTab("plan");
  }

  function handleKey(e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); advance(); }
    if (e.key === "Escape") dismiss();
  }

  // ── Spotlight / bubble geometry ──────────────────────────────────────
  const BW  = 290;  // bubble width
  const GAP = 14;   // gap between spotlight edge and bubble
  const PAD = 16;   // min distance from screen edge
  const SP  = 8;    // spotlight padding around element
  const SR  = 16;   // spotlight border-radius

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const sl = spotRect
    ? { l: spotRect.left - SP, t: spotRect.top - SP, w: spotRect.width + SP * 2, h: spotRect.height + SP * 2 }
    : null;

  let bubStyle = { position: "fixed", width: BW, zIndex: 10001 };
  if (cur.place === "center" || !sl) {
    bubStyle = { ...bubStyle, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  } else if (cur.place === "above") {
    const left = Math.max(PAD, Math.min(sl.l + sl.w / 2 - BW / 2, vw - BW - PAD));
    bubStyle   = { ...bubStyle, bottom: vh - sl.t + GAP, left };
  } else {
    const left = Math.max(PAD, Math.min(sl.l + sl.w / 2 - BW / 2, vw - BW - PAD));
    bubStyle   = { ...bubStyle, top: sl.t + sl.h + GAP, left };
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onKeyDown={handleKey}
      role="dialog"
      aria-modal="true"
      aria-label="Macra app tour"
      style={{
        position: "fixed", inset: 0, zIndex: 9999, outline: "none",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.25s ease",
      }}
    >
      {/* ── Spotlight overlay ── */}
      {sl ? (
        // Box-shadow trick: massive outset shadow = dark overlay with transparent hole;
        // inset shadow = gold highlight border around target element.
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            left: sl.l, top: sl.t, width: sl.w, height: sl.h,
            borderRadius: SR,
            boxShadow: `0 0 0 9999px rgba(0,0,0,0.82), inset 0 0 0 2px ${T.acc}`,
            transition: "left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease",
            pointerEvents: "none",
            zIndex: 10000,
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",zIndex:10000,pointerEvents:"none" }}
        />
      )}

      {/* ── Click blocker — prevent background interaction ── */}
      <div
        aria-hidden="true"
        onClick={e => e.stopPropagation()}
        style={{ position:"fixed",inset:0,zIndex:9999 }}
      />

      {/* ── Tooltip bubble ── */}
      <div
        role="region"
        aria-live="polite"
        style={{
          ...bubStyle,
          background: T.sf,
          borderRadius: T.r,
          border: `1px solid ${T.bd}`,
          padding: "20px 20px 18px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
          transition: "top 0.3s ease, bottom 0.3s ease, left 0.3s ease",
        }}
      >
        {/* Achievement unlock toast — floats above bubble */}
        {achToast && (
          <div style={{
            position: "absolute", bottom: "calc(100% + 10px)", left: "50%",
            transform: "translateX(-50%)",
            background: T.acc, color: "#09090B",
            padding: "9px 18px", borderRadius: 10,
            fontSize: 12, fontWeight: 700,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            fontFamily: T.font,
            animation: "fadeUp 0.3s ease",
          }}>
            🎓 Achievement Unlocked: Tutorial Complete!
          </div>
        )}

        {/* Skip — only on non-final steps */}
        {!isLast && (
          <button
            onClick={dismiss}
            aria-label="Skip tour"
            style={{
              position: "absolute", top: 12, right: 14,
              background: "none", border: "none",
              color: T.txM, fontSize: 12, cursor: "pointer",
              fontFamily: T.font, padding: "2px 4px",
            }}
          >
            Skip
          </button>
        )}

        {/* Step counter */}
        <p style={{
          fontSize: 10, fontWeight: 600, color: T.txM,
          margin: "0 0 8px", letterSpacing: "0.1em",
          textTransform: "uppercase", fontFamily: T.font,
        }}>
          {step + 1} of {total}
        </p>

        {/* PRO badge */}
        {cur.isPro && (
          <span style={{
            display: "inline-block", marginBottom: 8,
            fontSize: 9, fontWeight: 700, color: T.acc,
            border: `1px solid ${T.acc}50`, borderRadius: 8,
            padding: "2px 8px", letterSpacing: "0.08em",
            fontFamily: T.font,
          }}>
            PRO FEATURE
          </span>
        )}

        {/* Title */}
        <p style={{
          fontSize: 17, fontWeight: 700, color: T.tx,
          margin: "0 0 7px", fontFamily: T.font, lineHeight: 1.25,
        }}>
          {cur.title}
        </p>

        {/* Body */}
        <p style={{
          fontSize: 13, color: T.tx2,
          margin: "0 0 18px", fontFamily: T.font, lineHeight: 1.55,
        }}>
          {cur.body}
        </p>

        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 16 : 4,
              height: 4, borderRadius: 2,
              background: i === step ? T.acc : T.bd,
              transition: "width 0.3s ease, background 0.3s ease",
              flexShrink: 0,
            }} />
          ))}
        </div>

        {/* CTA buttons */}
        {cur.isFinal ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={goToPlan}
              autoFocus
              style={{
                width: "100%", padding: 12, borderRadius: T.r,
                border: "none", background: "#C4714A",
                color: "#fff", fontSize: 14, fontWeight: 700,
                cursor: "pointer", fontFamily: T.font,
                letterSpacing: "0.02em",
              }}
            >
              Generate My First Plan →
            </button>
            <button
              onClick={finish}
              style={{
                width: "100%", padding: 10, borderRadius: T.r,
                border: `1px solid ${T.bd}`, background: "transparent",
                color: T.tx2, fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: T.font,
              }}
            >
              Explore on My Own
            </button>
          </div>
        ) : (
          <button
            onClick={advance}
            disabled={advancing}
            autoFocus
            style={{
              width: "100%", padding: 12, borderRadius: T.r,
              border: "none", background: "#C4714A",
              color: "#fff", fontSize: 14, fontWeight: 700,
              cursor: advancing ? "wait" : "pointer",
              fontFamily: T.font, letterSpacing: "0.02em",
              opacity: advancing ? 0.65 : 1,
              transition: "opacity 0.2s",
            }}
          >
            {advancing ? "Loading…" : "Next →"}
          </button>
        )}
      </div>
    </div>
  );
}
