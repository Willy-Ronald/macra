import { useState, useEffect, useRef } from "react";
import { supabase, unlockAchievement } from "../lib/supabase";

// Mirror app-level design tokens
const T = {
  acc: "#C8B88A", bg: "#09090B", sf: "#121215", bd: "#1E1E22",
  tx: "#FAFAF9", tx2: "#A1A1AA", txM: "#52525B",
  r: 14, font: "'Outfit',sans-serif",
};

const STEPS = [
  // ── HOME (3) ────────────────────────────────────────────────────────────
  { tab:"home",    sel:'[data-tour="macro-ring"]',    title:"Your Calorie & Macro Ring",     place:"below",
    body:"This ring shows your daily calorie progress. The three bars below track protein, carbs, and fat — updated the moment you log a meal." },
  { tab:"home",    sel:'[data-tour="week-strip"]',    title:"Your Weekly Log",                place:"below",
    body:"Each dot marks a day you've logged food. Tap any day to review what you ate — great for spotting patterns over time." },
  { tab:"home",    sel:'[data-tour="todays-plan"]',   title:"Today's Plan at a Glance",      place:"below",
    body:"Your AI-generated meals appear right here each day. Tap any meal to log it instantly — no typing needed." },

  // ── PLAN (3) ── auto-navigate before step 4 ─────────────────────────────
  { tab:"plan",    sel:'[data-tour="day-tabs"]',      title:"Day A & Day B Plans",            place:"below",
    body:"Macra creates two distinct meal plans. Day A runs Mon / Wed / Fri / Sun; Day B covers Tue / Thu / Sat — so meals rotate and boredom doesn't." },
  { tab:"plan",    sel:'[data-tour="save-meal"]',     title:"Save Any Meal You Love",         place:"below",
    body:"Tap the heart on any meal card to save it as a favourite. Saved meals appear in the Log tab for one-tap logging anytime." },
  { tab:"plan",    sel:'[data-tour="generate-plan"]', title:"Generate Your AI Plan",          place:"above",
    body:"One tap builds a full week of meals personalised to your macros, budget, and food preferences — powered by Claude AI." },

  // ── GROCERY (2) ── auto-navigate before step 7 ──────────────────────────
  { tab:"grocery", sel:'[data-tour="grocery-list"]',  title:"Auto-Generated Grocery List",   place:"below", isPro:true,
    body:"Every ingredient from your A/B plan is combined, scaled by days used, and sorted by category — ready to shop from your phone." },
  { tab:"grocery", sel:'[data-tour="share-list"]',    title:"Share Your List",                place:"above", isPro:true,
    body:"Tap Share to send your grocery list via your phone's native share sheet — perfect for splitting the shopping with a partner." },

  // ── LOG (1) ── auto-navigate before step 9 ──────────────────────────────
  { tab:"log",     sel:'[data-tour="log-options"]',   title:"Three Ways to Log",              place:"below",
    body:"Manual entry for quick macros, one-tap from saved favourites, or build a fully custom meal with detailed ingredients." },

  // ── STATS (1) ── auto-navigate before step 10 ───────────────────────────
  { tab:"stats",   sel:'[data-tour="streaks"]',       title:"Build Your Streaks",             place:"below",
    body:"Log every day and hit your macro goals to build streaks. Keep the chain alive to unlock achievements and stay consistent." },

  // ── PROFILE (6) ── auto-navigate before step 11 ─────────────────────────
  { tab:"profile", sel:'[data-tour="adjust-stats"]',  title:"Keep Your Stats Current",        place:"below",
    body:"Update your age, weight, height, and activity level whenever life changes. Your daily calorie target recalculates immediately." },
  { tab:"profile", sel:'[data-tour="weekly-budget"]', title:"Budget-Aware Meal Planning",     place:"below",
    body:"Tell us your weekly grocery budget and the AI will plan meals that fit your wallet — not just your macros." },
  { tab:"profile", sel:'[data-tour="dietary-prefs"]', title:"Dietary Preferences",            place:"below",
    body:"Vegan, keto, halal, gluten-free — set your diet and the AI will never suggest meals that fall outside your rules." },
  { tab:"profile", sel:'[data-tour="disliked-foods"]',title:"Foods You Don't Eat",            place:"below",
    body:"Add specific ingredients you want to avoid. The AI reads this list before generating every single plan — no more picking things out." },
  { tab:"profile", sel:'[data-tour="pickiness"]',     title:"Meal Complexity Level",          place:"below",
    body:"Rate how adventurous you are. Level 1 = bold global flavours. Level 5 = simple and familiar. The AI adjusts every plan to match." },
  { tab:"profile", sel:'[data-tour="macro-split"]',   title:"Custom Macro Split",             place:"below", isPro:true,
    body:"Override the default 40 / 30 / 30 formula with your own protein / carb / fat percentages. Dial in exactly what your goal demands." },

  // ── FINAL ── auto-navigate back to home before step 17 ──────────────────
  { tab:"home",    sel:null,                           title:"You're Ready to Go!",            place:"center", isFinal:true,
    body:"You've seen everything Macra has to offer. Generate your first AI meal plan and start building the body you want — one meal at a time." },
];

// ── Robust element measurement: retry up to 5× with 200 ms gaps ──────────
// Scrolls the element into view first so coordinates are viewport-relative.
// Returns null if still not found / zero-size after all retries.
async function measureElement(sel, signal) {
  if (!sel) return null;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (signal.cancelled) return null;
    if (attempt > 0) await new Promise(r => setTimeout(r, 200));
    const el = document.querySelector(sel);
    if (!el) continue;
    // Scroll element into the center of its scroll container
    try { el.scrollIntoView({ behavior: "instant", block: "center" }); } catch (_) {}
    // Let layout settle after scroll
    await new Promise(r => setTimeout(r, 80));
    if (signal.cancelled) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return rect;
  }
  console.warn("[tour] element not found after retries:", sel);
  return null;
}

// ── Viewport-safe bubble position ────────────────────────────────────────
// BH_EST: generous but realistic estimate of bubble height in pixels.
// Accounts for: padding(38) + counter(26) + optional PRO badge(32) +
// title(29) + body(65) + dots(20) + button(44) = ~254 peak.
// Using 270 gives comfortable margin.
const BW     = 290;  // bubble width
const GAP    = 12;   // gap between spotlight edge and bubble
const PAD    = 16;   // min distance from screen edge
const SP     = 8;    // spotlight padding around element
const SR     = 16;   // spotlight corner radius
const BH_EST = 270;  // estimated bubble height for overflow detection

function computeBubbleStyle(cur, sl) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const base = { position: "fixed", width: BW, zIndex: 10001 };

  // No spotlight target or explicit center → always center
  if (cur.place === "center" || !sl) {
    return { ...base, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  const safeLeft = Math.max(PAD, Math.min(sl.l + sl.w / 2 - BW / 2, vw - BW - PAD));

  // Available space above and below the spotlight rect
  const spaceBelow = vh - (sl.t + sl.h + GAP);
  const spaceAbove = sl.t - GAP;

  // Determine effective placement, falling back if there isn't enough room
  let place = cur.place; // "below" | "above"
  if (place === "below" && spaceBelow < BH_EST) {
    place = spaceAbove >= BH_EST ? "above" : "center";
  } else if (place === "above" && spaceAbove < BH_EST) {
    place = spaceBelow >= BH_EST ? "below" : "center";
  }

  if (place === "center") {
    return { ...base, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  if (place === "above") {
    // bottom edge of bubble sits GAP above the spotlight top
    const bottom = vh - sl.t + GAP;
    // Safety: if this would push the bubble's top above the screen, center instead
    if (bottom + BH_EST > vh - PAD) {
      return { ...base, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    }
    return { ...base, bottom: Math.max(PAD, bottom), left: safeLeft };
  }

  // "below": top edge of bubble sits GAP below the spotlight bottom
  const top = sl.t + sl.h + GAP;
  // Safety: if the bubble would overflow the bottom of the screen, center instead
  if (top + BH_EST > vh - PAD) {
    return { ...base, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }
  return { ...base, top: Math.max(80, top), left: safeLeft };
}

export default function OnboardingTour({ userId, onSwitchTab, onComplete }) {
  const [step,      setStep]      = useState(0);
  const [spotRect,  setSpotRect]  = useState(null);
  const [visible,   setVisible]   = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [achToast,  setAchToast]  = useState(false);
  const containerRef = useRef(null);

  const cur    = STEPS[step];
  const total  = STEPS.length;
  const isLast = step === total - 1;

  // Fade in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Measure spotlight target with retry + scroll-into-view whenever step changes
  useEffect(() => {
    const signal = { cancelled: false };
    setSpotRect(null); // clear previous spotlight immediately on step change

    if (!cur.sel) {
      containerRef.current?.focus();
      return () => { signal.cancelled = true; };
    }

    measureElement(cur.sel, signal).then(rect => {
      if (!signal.cancelled) {
        setSpotRect(rect);
        containerRef.current?.focus();
      }
    });

    return () => { signal.cancelled = true; };
  }, [step, cur.sel]);

  // ── Dismiss (skip — no achievement) ────────────────────────────────────
  async function dismiss() {
    setVisible(false);
    await new Promise(r => setTimeout(r, 250));
    try {
      await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", userId);
    } catch (e) {
      console.error("[tour] save failed:", e);
    }
    onComplete();
  }

  // ── Finish (completed all steps — unlock achievement) ───────────────────
  async function finish() {
    try { await unlockAchievement(userId, "tutorial_complete"); } catch (_) {}
    setAchToast(true);
    await new Promise(r => setTimeout(r, 1400));
    setVisible(false);
    await new Promise(r => setTimeout(r, 250));
    try {
      await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", userId);
    } catch (e) {
      console.error("[tour] save failed:", e);
    }
    onComplete();
  }

  // ── Navigate to Plan tab then close ─────────────────────────────────────
  async function goToPlan() {
    try { await unlockAchievement(userId, "tutorial_complete"); } catch (_) {}
    setAchToast(true);
    await new Promise(r => setTimeout(r, 1400));
    setVisible(false);
    await new Promise(r => setTimeout(r, 250));
    try {
      await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", userId);
    } catch (_) {}
    onComplete();
    onSwitchTab("plan");
  }

  // ── Advance to next step ────────────────────────────────────────────────
  async function advance() {
    if (advancing) return;
    if (isLast) { finish(); return; }

    const nextStep = step + 1;
    const nextTab  = STEPS[nextStep].tab;

    if (nextTab !== cur.tab) {
      setAdvancing(true);
      onSwitchTab(nextTab);
      // Give the new tab's components time to mount before the measurement runs
      await new Promise(r => setTimeout(r, 350));
      setStep(nextStep);
      setAdvancing(false);
    } else {
      setStep(nextStep);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); advance(); }
    if (e.key === "Escape") dismiss();
  }

  // Derive spotlight rect (with padding) and bubble style
  const sl = spotRect
    ? { l: spotRect.left - SP, t: spotRect.top - SP, w: spotRect.width + SP * 2, h: spotRect.height + SP * 2 }
    : null;

  const bubStyle = computeBubbleStyle(cur, sl);

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
      {/* ── Dark overlay + spotlight hole ── */}
      {sl ? (
        // Box-shadow trick: 9999px outset shadow = dark overlay; transparent hole at element;
        // inset shadow = gold highlight ring.
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
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", zIndex:10000, pointerEvents:"none" }}
        />
      )}

      {/* ── Click blocker: prevents background interaction ── */}
      <div
        aria-hidden="true"
        onClick={e => e.stopPropagation()}
        style={{ position:"fixed", inset:0, zIndex:9999 }}
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
          // Animate position changes as spotlight moves
          transition: "top 0.3s ease, bottom 0.3s ease, left 0.3s ease",
        }}
      >
        {/* Achievement toast — floats above the bubble */}
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
          fontSize: 10, fontWeight: 600, color: T.txM, margin: "0 0 8px",
          letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: T.font,
        }}>
          {step + 1} of {total}
        </p>

        {/* PRO badge */}
        {cur.isPro && (
          <span style={{
            display: "inline-block", marginBottom: 8,
            fontSize: 9, fontWeight: 700, color: T.acc,
            border: `1px solid ${T.acc}50`, borderRadius: 8,
            padding: "2px 8px", letterSpacing: "0.08em", fontFamily: T.font,
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
              width: i === step ? 16 : 4, height: 4, borderRadius: 2,
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
                cursor: "pointer", fontFamily: T.font, letterSpacing: "0.02em",
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
