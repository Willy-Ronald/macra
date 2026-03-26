import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

// Mirror the app-level design tokens (kept in sync with App.jsx T object)
const T = {
  acc: "#C8B88A", bg: "#09090B", sf: "#121215", bd: "#1E1E22",
  tx: "#FAFAF9", tx2: "#A1A1AA", txM: "#52525B",
  r: 14, font: "'Outfit',sans-serif",
};

const STEPS = [
  {
    sel: '[data-tour="macro-ring"]',
    title: "Your Daily Macros",
    body: "Track your protein, carbs, and fat with this visual ring. Tap to see full details.",
    place: "below",
  },
  {
    sel: '[data-tour="week-strip"]',
    title: "Your Weekly Progress",
    body: "See your logging history at a glance. Tap any day to view that day's meals.",
    place: "below",
  },
  {
    sel: '[data-tour="nav-plan"]',
    title: "AI Meal Plans",
    body: "Generate personalized meal plans with one tap. Get Day A and Day B options that hit your exact macros.",
    place: "above",
  },
  {
    sel: '[data-tour="nav-log"]',
    title: "Quick Logging",
    body: "Log meals from your saved favorites, custom entries, or frequently logged items.",
    place: "above",
  },
  {
    sel: '[data-tour="nav-you"]',
    title: "Adjust Anytime",
    body: "Update your stats, food preferences, and macro split whenever your goals change.",
    place: "above",
  },
  {
    sel: null,
    title: "You're All Set!",
    body: "Start by generating your first meal plan or logging a meal. We'll help you hit your goals.",
    place: "center",
  },
];

export default function OnboardingTour({ userId, onComplete }) {
  const [step, setStep] = useState(0);
  const [spotRect, setSpotRect] = useState(null);
  const [visible, setVisible] = useState(false);
  const containerRef = useRef(null);

  const cur = STEPS[step];
  const total = STEPS.length;
  const isLast = step === total - 1;

  // Fade in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Measure target element whenever step changes
  useEffect(() => {
    if (cur.sel) {
      const el = document.querySelector(cur.sel);
      setSpotRect(el ? el.getBoundingClientRect() : null);
    } else {
      setSpotRect(null);
    }
    // Focus the container for keyboard navigation
    containerRef.current?.focus();
  }, [step, cur.sel]);

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

  function advance() {
    if (isLast) { dismiss(); return; }
    setStep(s => s + 1);
  }

  function handleKey(e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); advance(); }
    if (e.key === "Escape") dismiss();
  }

  // Layout constants
  const BW = 280;   // bubble width
  const GAP = 14;   // gap between spotlight and bubble
  const PAD = 16;   // minimum distance from screen edge
  const SP = 8;     // spotlight padding around element
  const SR = 16;    // spotlight border-radius

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Spotlight dimensions (element bounds + padding)
  const sl = spotRect
    ? { l: spotRect.left - SP, t: spotRect.top - SP, w: spotRect.width + SP * 2, h: spotRect.height + SP * 2 }
    : null;

  // Bubble position
  let bubStyle = { position: "fixed", width: BW, zIndex: 10001 };
  if (cur.place === "center" || !sl) {
    bubStyle = { ...bubStyle, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  } else if (cur.place === "above") {
    const left = Math.max(PAD, Math.min(sl.l + sl.w / 2 - BW / 2, vw - BW - PAD));
    bubStyle = { ...bubStyle, bottom: vh - sl.t + GAP, left };
  } else {
    const left = Math.max(PAD, Math.min(sl.l + sl.w / 2 - BW / 2, vw - BW - PAD));
    bubStyle = { ...bubStyle, top: sl.t + sl.h + GAP, left };
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
        // Box-shadow trick: massive outset shadow creates the dark overlay,
        // leaving the element's bounding box as a transparent "hole".
        // The inset shadow creates the golden highlight border.
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            left: sl.l, top: sl.t, width: sl.w, height: sl.h,
            borderRadius: SR,
            boxShadow: `0 0 0 9999px rgba(0,0,0,0.80), inset 0 0 0 2px ${T.acc}`,
            transition: "left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease",
            pointerEvents: "none",
            zIndex: 10000,
          }}
        />
      ) : (
        // No spotlight target — plain full-screen overlay
        <div
          aria-hidden="true"
          style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.80)",zIndex:10000,pointerEvents:"none" }}
        />
      )}

      {/* ── Click blocker to prevent background interaction ── */}
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
        {/* Skip — only shown on non-final steps */}
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
        <div style={{ display: "flex", justifyContent: "center", gap: 5, marginBottom: 16 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 18 : 5,
              height: 5, borderRadius: 3,
              background: i === step ? T.acc : T.bd,
              transition: "width 0.3s ease, background 0.3s ease",
            }} />
          ))}
        </div>

        {/* Next / Done button */}
        <button
          onClick={advance}
          autoFocus
          style={{
            width: "100%", padding: 12, borderRadius: T.r,
            border: "none", background: "#C4714A",
            color: "#fff", fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: T.font,
            letterSpacing: "0.02em",
          }}
        >
          {isLast ? "Done" : "Next →"}
        </button>
      </div>
    </div>
  );
}
