import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────
// GOOGLE FONTS INJECTION
// ─────────────────────────────────────────────────────────────────
(() => {
  if (document.getElementById("gf-gridpulse")) return;
  const l = document.createElement("link");
  l.id = "gf-gridpulse";
  l.href = "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Mono:wght@300;400;500&family=Playfair+Display:wght@600;700&display=swap";
  l.rel = "stylesheet";
  document.head.appendChild(l);
  const s = document.createElement("style");
  s.id = "gridpulse-css";
  s.textContent = `
    @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
    @keyframes softPulse { 0%,100% { opacity:1; } 50% { opacity:0.55; } }
    @keyframes barFill { from { width:0; } to { width:var(--w); } }
    .gp-card { transition: box-shadow 0.25s ease, transform 0.2s ease; }
    .gp-card:hover { box-shadow: 0 6px 28px rgba(90,100,140,0.13) !important; transform: translateY(-1px); }
    .gp-house { transition: box-shadow 0.2s ease, transform 0.18s ease, border-color 0.2s ease; cursor:pointer; }
    .gp-house:hover { transform: translateY(-2px) scale(1.025); box-shadow: 0 4px 18px rgba(90,100,140,0.18) !important; }
    .gp-btn { transition: background 0.18s ease, box-shadow 0.18s ease, transform 0.1s ease; }
    .gp-btn:hover { transform: translateY(-1px); }
    .gp-btn:active { transform: translateY(0); }
    .gp-toast { transition: transform 0.38s cubic-bezier(.4,0,.2,1), opacity 0.3s ease; }
    .gp-modal-bg { animation: fadeUp 0.22s ease; }
    .gp-modal-box { animation: fadeUp 0.28s ease; }
  `;
  document.head.appendChild(s);
})();

// ─────────────────────────────────────────────────────────────────
// THEME
// ─────────────────────────────────────────────────────────────────
const C = {
  page:        "#F8F9FA",
  card:        "#FFFFFF",
  cardInner:   "#FAFBFC",
  border:      "#D1D5DB",
  borderLight: "#E5E7EB",
  text:        "#111827",
  textSec:     "#4B5563",
  textTer:     "#6B7280",
  
  // Professional, understated palette
  primary:     "#2563EB",     // Professional blue
  primaryLt:   "#DBEAFE",
  
  success:     "#059669",     // Forest green
  successLt:   "#D1FAE5",
  
  warning:     "#D97706",     // Amber/orange
  warningLt:   "#FEF3C7",
  
  danger:      "#DC2626",     // Deep red
  dangerLt:    "#FEE2E2",
  
  info:        "#0891B2",     // Teal
  infoLt:      "#CFFAFE",
  
  neutral:     "#6B7280",     // Gray
  neutralLt:   "#F3F4F6",
};

const FONTS = {
  display: "system-ui, -apple-system, sans-serif",
  body:    "system-ui, -apple-system, sans-serif",
  mono:    "'SF Mono', 'Monaco', 'Consolas', monospace",
};

// ─────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────
const APPLIANCES = {
  ac:         { name: "Air Conditioning", watt: 3500, type: "hvac",  color: C.primary },
  washer:     { name: "Washer",           watt: 2100, type: "cycle", color: C.info },
  dryer:      { name: "Dryer",            watt: 5000, type: "cycle", color: C.warning },
  dishwasher: { name: "Dishwasher",       watt: 1800, type: "cycle", color: C.info },
};

const STRESS_THRESHOLD = 85; // When stress exceeds this, emergency load shedding kicks in
const TRANSFORMER_CAPACITY = 225000; // 225 kVA transformer (typical for residential neighborhood)

// ─────────────────────────────────────────────────────────────────
// DATA GENERATION
// ─────────────────────────────────────────────────────────────────
function seed(n) { 
  let s = n; 
  return () => { 
    s = (s * 16807) % 2147483647; 
    return (s - 1) / 2147483646; 
  }; 
}

function generateHouses() {
  const r = seed(42);
  return Array.from({ length: 50 }, (_, i) => {
    const hasEV = r() < 0.4;
    return {
      id: i + 1, 
      hasEV,
      battery: hasEV ? 15 + r() * 70 : 0,
      isAcSuppressed: false,
      appliances: {
        ac: r() < 0.7,
        washer:     { active: r() < 0.3, progress: r() * 60 },
        dryer:      { active: r() < 0.2, progress: r() * 40 },
        dishwasher: { active: r() < 0.4, progress: r() * 50 },
      },
    };
  });
}

// ─────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────
function fmtTime(m) { 
  const h = Math.floor(m/60)%24, mn = m%60; 
  return `${String(h).padStart(2,"0")}:${String(mn).padStart(2,"0")}`; 
}

function fmtKw(w) { 
  return w >= 1000 ? (w/1000).toFixed(1)+" kW" : w+" W"; 
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export function Overview() {
  const [houses, setHouses] = useState(generateHouses);
  const [cycle, setCycle] = useState(0);
  const [rawTime, setRawTime] = useState(960);
  const [isNight, setIsNight] = useState(false);
  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [autoRun, setAutoRun] = useState(false);
  const [filter, setFilter] = useState("all");
  const [stressMode, setStressMode] = useState(false);
  const [totalCO2Saved, setTotalCO2Saved] = useState(0);
  const [totalMoneySaved, setTotalMoneySaved] = useState(0);
  
  const autoRef = useRef(null);
  const toastRef = useRef(null);

  // ── Calculate Metrics ──
  const metrics = useCallback(() => {
    let load = 0, evPower = 0, acOn = 0, acSup = 0, cycleActive = 0, evCharging = 0, evV2G = 0;
    let co2SavedThisCycle = 0, moneySavedThisCycle = 0;
    
    houses.forEach(h => {
      // AC units
      if (h.appliances.ac) {
        if (h.isAcSuppressed) {
          acSup++;
          // CO2 saved: ~0.92 lbs per kWh, AC uses 3.5kW
          // 15 min cycle = 0.25 hours, so 3.5 * 0.25 = 0.875 kWh
          co2SavedThisCycle += 0.875 * 0.92; // pounds of CO2
          // Money saved: ~$0.13 per kWh during peak hours
          moneySavedThisCycle += 0.875 * 0.13;
        } else { 
          load += 3500; 
          acOn++; 
        }
      }
      
      // Cycle appliances
      ["washer","dryer","dishwasher"].forEach(k => {
        if (h.appliances[k]?.active) {
          load += APPLIANCES[k].watt;
          cycleActive++;
        }
      });
      
      // EV behavior
      if (h.hasEV) {
        if (isNight && h.battery < 100) {
          evPower -= 7000;
          evCharging++;
          moneySavedThisCycle += 7 * 0.25 * 0.07;
        } else if (!isNight && cycle % 2 === 0 && h.battery > 40) {
          evPower += 3200;
          evV2G++;
          co2SavedThisCycle += 3.2 * 0.25 * 0.92;
          moneySavedThisCycle += 3.2 * 0.25 * 0.13;
        }
      }
    });
    
    const evCount = houses.filter(h => h.hasEV).length;
    const avgBat = evCount ? houses.filter(h => h.hasEV).reduce((s,h) => s + h.battery, 0) / evCount : 0;
    const netLoad = load - evPower;
    const stress = Math.min(100, (netLoad / TRANSFORMER_CAPACITY) * 100);
    
    return { 
      netLoad, rawLoad: load, evPower, acOn, acSup, cycleActive, 
      evCharging, evV2G, evCount, avgBat, stress,
      co2SavedThisCycle, moneySavedThisCycle
    };
  }, [houses, isNight, cycle]);

  const M = metrics();

  useEffect(() => {
    setHistory(prev => [...prev, { net: M.netLoad, stress: M.stress, t: rawTime }].slice(-40));
    setTotalCO2Saved(prev => prev + M.co2SavedThisCycle);
    setTotalMoneySaved(prev => prev + M.moneySavedThisCycle);
  }, [cycle]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const emergencyLoadShed = useCallback(() => {
    setHouses(prev => prev.map((h, idx) => {
      const updated = { ...h, appliances: { ...h.appliances } };
      
      if (h.appliances.ac && !h.isAcSuppressed) {
        updated.isAcSuppressed = true;
      }
      
      ["washer", "dryer", "dishwasher"].forEach(k => {
        if (h.appliances[k]?.active && Math.random() < 0.4) {
          updated.appliances[k] = { active: false, progress: 0 };
        }
      });
      
      return updated;
    }));
    showToast("Emergency load shedding - reducing transformer stress");
  }, [showToast]);

  // ── Step Day (Peak Shaving) ──
  const stepDay = useCallback(() => {
    setIsNight(false);
    
    setHouses(prev => prev.map((house, idx) => {
      let h = { ...house, appliances: { ...house.appliances } };
      
      // Rotate AC suppression
      if (h.appliances.ac) {
        h.isAcSuppressed = (idx + cycle) % 3 === 0;
      }
      
      // Update cycle appliances
      ["washer","dryer","dishwasher"].forEach(k => {
        if (h.appliances[k].active) {
          h.appliances[k] = { 
            ...h.appliances[k], 
            progress: h.appliances[k].progress + 25 
          };
          if (h.appliances[k].progress >= 100) {
            h.appliances[k] = { active: false, progress: 0 };
          }
        } else if (Math.random() < 0.08) {
          h.appliances[k] = { active: true, progress: 0 };
        }
      });
      
      // EV behavior during day
      if (h.hasEV) {
        if (cycle % 2 === 0 && h.battery > 40) {
          h.battery = Math.max(0, h.battery - 3); // V2G discharge
        } else if (h.battery < 90) {
          h.battery += 1; // Trickle charge
        }
      }
      
      return h;
    }));
    
    setRawTime(p => p + 15);
    setCycle(p => p + 1);
    showToast("Peak shave cycle complete - 15 min elapsed");
  }, [cycle, showToast]);

  // ── Step Night (Economic Fill) ──
  const stepNight = useCallback(() => {
    setIsNight(true);
    
    setHouses(prev => prev.map(house => {
      let h = { 
        ...house, 
        appliances: { ...house.appliances }, 
        isAcSuppressed: false 
      };
      
      // Turn off cycle appliances at night
      ["washer","dryer","dishwasher"].forEach(k => {
        if (h.appliances[k].active) {
          h.appliances[k] = { active: false, progress: 0 };
        }
      });
      
      // Charge EVs
      if (h.hasEV && h.battery < 100) {
        h.battery = Math.min(100, h.battery + 20);
      }
      
      return h;
    }));
    
    setRawTime(p => p < 1320 ? 1320 : p + 60);
    setCycle(p => p + 1);
    showToast("Valley fill initiated - EV charging active");
  }, [showToast]);

  // ── Transformer Stress Simulation ──
  const toggleStressMode = useCallback(() => {
    if (!stressMode) {
      // Activate stress mode - ramp up load
      setHouses(prev => prev.map(h => {
        const updated = { ...h, appliances: { ...h.appliances }, isAcSuppressed: false };
        
        // Turn on all ACs
        if (h.appliances.ac) {
          updated.isAcSuppressed = false;
        }
        
        // Activate more appliances
        ["washer", "dryer", "dishwasher"].forEach(k => {
          if (!h.appliances[k]?.active && Math.random() < 0.6) {
            updated.appliances[k] = { active: true, progress: 0 };
          }
        });
        
        return updated;
      }));
      showToast("Transformer stress simulation initiated");
    } else {
      // Deactivate - normalize
      emergencyLoadShed();
    }
    setStressMode(prev => !prev);
  }, [stressMode, emergencyLoadShed, showToast]);

  // ── Auto-manage stress when in stress mode ──
  useEffect(() => {
    if (stressMode && M.stress > STRESS_THRESHOLD) {
      emergencyLoadShed();
    }
  }, [stressMode, M.stress, emergencyLoadShed]);

  // ── Auto Run ──
  useEffect(() => {
    if (autoRun) {
      autoRef.current = setInterval(() => {
        (Math.floor(Date.now() / 1000) % 60 < 30 ? stepDay : stepNight)();
      }, 2400);
    } else {
      clearInterval(autoRef.current);
    }
    return () => clearInterval(autoRef.current);
  }, [autoRun, stepDay, stepNight]);

  // ── Filter Houses ──
  const filtered = houses.filter(h => {
    if (filter === "ev") return h.hasEV;
    if (filter === "suppressed") return h.appliances.ac && h.isAcSuppressed;
    if (filter === "active") return ["washer","dryer","dishwasher"].some(k => h.appliances[k]?.active);
    return true;
  });

  return (
    <div style={{ background: C.page, minHeight: "100vh", fontFamily: FONTS.body, color: C.text, padding: "32px 36px", boxSizing: "border-box" }}>

      {/* ──────── HEADER ──────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "30px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontFamily: FONTS.display, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>Transformer Management</h1>
          <div style={{ fontSize: 13, color: C.textSec, marginTop: 4 }}>Residential Energy Distribution System</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 26, fontFamily: FONTS.mono, fontWeight: 500, color: C.text, letterSpacing: "0.04em" }}>{fmtTime(rawTime)}</div>
            <div style={{ fontSize: 11, color: C.textTer }}>{isNight ? "Off-Peak Period" : "Peak Demand Period"}</div>
          </div>
          <div style={{ padding: "6px 14px", borderRadius: 4, background: isNight ? C.infoLt : C.warningLt, border: `1px solid ${isNight ? C.info : C.warning}` }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: isNight ? C.info : C.warning, letterSpacing: "0.03em" }}>{isNight ? "VALLEY FILL" : "PEAK SHAVE"}</span>
          </div>
        </div>
      </div>

      {/* ──────── ACTION BAR ──────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <ActionBtn label="Step Day +15m" color={C.primary} onClick={stepDay} />
          <ActionBtn label="Step Night +1h" color={C.info} onClick={stepNight} />
          <ActionBtn label={autoRun ? "Stop Auto" : "Auto Run"} color={autoRun ? C.danger : C.success} onClick={() => setAutoRun(p => !p)} filled={autoRun} />
          <ActionBtn 
            label={stressMode ? "End Stress Test" : "Simulate Stress"} 
            color={stressMode ? C.danger : C.warning} 
            onClick={toggleStressMode} 
            filled={stressMode}
          />
        </div>
        <div style={{ fontSize: 11, color: C.textTer, fontFamily: FONTS.mono }}>Cycle <strong style={{ color: C.textSec }}>#{cycle}</strong> · 50 households</div>
      </div>

      {/* ──────── STRESS WARNING ──────── */}
      {M.stress > STRESS_THRESHOLD && (
        <div style={{ 
          background: C.dangerLt, 
          border: `2px solid ${C.danger}`, 
          borderRadius: 6, 
          padding: "14px 18px", 
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 12,
          animation: "fadeUp 0.3s ease"
        }}>
          <div style={{ 
            width: 6, 
            height: 6, 
            borderRadius: "50%", 
            background: C.danger,
            flexShrink: 0,
            animation: "softPulse 1.5s infinite"
          }}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.danger }}>TRANSFORMER OVERLOAD WARNING</div>
            <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>
              Capacity at {M.stress.toFixed(1)}% ({fmtKw(M.netLoad)} / {fmtKw(TRANSFORMER_CAPACITY)}) - Load shedding in progress
            </div>
          </div>
        </div>
      )}

      {/* ──────── TOP METRICS ──────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 14, marginBottom: 20 }}>
        <MetricCard label="Net Load" value={fmtKw(M.netLoad)} sub={`Gross ${fmtKw(M.rawLoad)}`} color={M.stress > 80 ? C.danger : C.primary} bg={M.stress > 80 ? C.dangerLt : C.primaryLt} />
        <MetricCard label={isNight ? "EV Charging" : "V2G Discharge"} value={fmtKw(Math.abs(M.evPower))} sub={`${isNight ? M.evCharging : M.evV2G} vehicles`} color={isNight ? C.info : C.success} bg={isNight ? C.infoLt : C.successLt} />
        <MetricCard label="Capacity" value={`${M.stress.toFixed(1)}%`} sub={M.stress > 80 ? "Critical" : M.stress > 60 ? "Elevated" : "Normal"} color={M.stress > 80 ? C.danger : M.stress > 60 ? C.warning : C.success} bg={M.stress > 80 ? C.dangerLt : M.stress > 60 ? C.warningLt : C.successLt} />
        <MetricCard label="EV Fleet SOC" value={`${M.avgBat.toFixed(0)}%`} sub={`${M.evCount} vehicles`} color={M.avgBat < 30 ? C.danger : M.avgBat < 60 ? C.warning : C.success} bg={M.avgBat < 30 ? C.dangerLt : M.avgBat < 60 ? C.warningLt : C.successLt} />
        <MetricCard label="Load Shed" value={`${M.acSup}`} sub={`${M.acOn + M.acSup} AC total`} color={C.warning} bg={C.warningLt} />
        <MetricCard label="CO₂ Avoided" value={`${totalCO2Saved.toFixed(1)}`} sub={`lbs carbon`} color={C.success} bg={C.successLt} />
        <MetricCard label="Peak Savings" value={`$${totalMoneySaved.toFixed(2)}`} sub={`cumulative`} color={C.success} bg={C.successLt} />
      </div>

      {/* ──────── MIDDLE ROW: Sparkline + Fleet ──────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 14, marginBottom: 20 }}>
        <SparkPanel history={history} isNight={isNight} />
        <FleetPanel M={M} />
      </div>

      {/* ──────── FILTER BAR + HOUSE GRID ──────── */}
      <div className="gp-card" style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: "20px 22px", boxShadow: "0 2px 12px rgba(90,100,140,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {[["all","All Houses"],["ev","EV Only"],["suppressed","Suppressed"],["active","Cycle Active"]].map(([k, lbl]) => (
              <button key={k} onClick={() => setFilter(k)} style={{
                padding: "5px 12px", 
                borderRadius: 18, 
                border: `1px solid ${filter === k ? C.primary : C.borderLight}`,
                background: filter === k ? C.primaryLt : "transparent", 
                color: filter === k ? C.primary : C.textSec,
                fontSize: 11, 
                fontWeight: filter === k ? 600 : 500, 
                fontFamily: FONTS.body, 
                cursor: "pointer"
              }}>{lbl}</button>
            ))}
          </div>
          <span style={{ fontSize: 11, color: C.textTer }}>{filtered.length} houses shown</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)", gap: 8 }}>
          {filtered.map(h => <HouseCard key={h.id} house={h} isNight={isNight} cycle={cycle} onOpen={() => setModal(h)} />)}
        </div>
      </div>

      {/* ──────── MODAL ──────── */}
      {modal && <HouseModal house={modal} isNight={isNight} cycle={cycle} onClose={() => setModal(null)} />}

      {/* ──────── TOAST ──────── */}
      <div className="gp-toast" style={{
        position: "fixed", 
        bottom: 28, 
        left: "50%", 
        transform: `translateX(-50%) translateY(${toast ? 0 : 70}px)`,
        opacity: toast ? 1 : 0, 
        pointerEvents: "none", 
        zIndex: 999,
        background: C.card, 
        border: `1px solid ${C.border}`, 
        borderRadius: 8,
        padding: "10px 20px", 
        boxShadow: "0 6px 24px rgba(90,100,140,0.14)",
        display: "flex", 
        alignItems: "center", 
        gap: 10
      }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.success, boxShadow: `0 0 6px ${C.success}66` }}/>
        <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{toast}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ACTION BUTTON
// ─────────────────────────────────────────────────────────────────
function ActionBtn({ icon, label, color, onClick, filled }) {
  return (
    <button className="gp-btn" onClick={onClick} style={{
      padding: "7px 15px", 
      borderRadius: 8, 
      border: `1px solid ${filled ? color : color + "44"}`,
      background: filled ? color : C.card, 
      color: filled ? "#fff" : color,
      fontSize: 12, 
      fontWeight: 600, 
      fontFamily: FONTS.body, 
      cursor: "pointer",
      display: "flex", 
      alignItems: "center", 
      gap: 6,
      boxShadow: filled ? `0 3px 10px ${color}44` : "0 1px 4px rgba(90,100,140,0.08)"
    }}>
      {icon && <span>{icon}</span>} {label}
    </button>
  );
}

function MetricCard({ label, value, sub, color, bg }) {
  return (
    <div className="gp-card" style={{
      background: C.card, 
      border: `1px solid ${C.border}`, 
      borderRadius: 14,
      padding: "16px 18px", 
      boxShadow: "0 2px 10px rgba(90,100,140,0.06)", 
      position: "relative", 
      overflow: "hidden"
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}, ${color}88)` }}/>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <span style={{ fontSize: 10.5, color: C.textTer, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: FONTS.mono, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.textTer, marginTop: 5 }}>{sub}</div>
    </div>
  );
}
function SparkPanel({ history, isNight }) {
  const W = 700, H = 110;
  const pts = history.length;

  if (pts < 2) {
    return (
      <div className="gp-card" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, boxShadow: "0 2px 10px rgba(90,100,140,0.06)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: 160 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: C.primaryLt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: C.primary }}>
          ...
        </div>
        <span style={{ fontSize: 12, color: C.textTer, marginTop: 10 }}>Awaiting grid data...</span>
      </div>
    );
  }

  const maxV = Math.max(...history.map(d => d.net), 1);
  const minV = Math.min(...history.map(d => d.net), 0);
  const rng = maxV - minV || 1;
  const toX = i => (i / (pts - 1)) * W;
  const toY = v => H - ((v - minV) / rng) * (H - 20) - 10;

  const line = history.map((d, i) => `${toX(i)},${toY(d.net)}`).join(" ");
  const area = `0,${H} ${line} ${W},${H}`;

  const maxS = 100, sToY = v => H - (v / maxS) * (H - 20) - 10;
  const sLine = history.map((d, i) => `${toX(i)},${sToY(d.stress)}`).join(" ");

  return (
    <div className="gp-card" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px", boxShadow: "0 2px 10px rgba(90,100,140,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Load & Stress History</div>
          <div style={{ fontSize: 10.5, color: C.textTer, marginTop: 2 }}>Last {pts} cycles · real-time tracking</div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          <LegendDot color={C.primary} label="Net Load" />
          <LegendDot color={C.warning} label="Stress %" />
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 110 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="grd1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.primary} stopOpacity="0.18"/>
            <stop offset="100%" stopColor={C.primary} stopOpacity="0"/>
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(f => <line key={f} x1="0" y1={H * f} x2={W} y2={H * f} stroke={C.border} strokeWidth="0.7"/>)}
        <polygon points={area} fill="url(#grd1)"/>
        <polyline points={line} fill="none" stroke={C.primary} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
        <polyline points={sLine} fill="none" stroke={C.warning} strokeWidth="1.5" strokeDasharray="5,3" strokeLinejoin="round"/>
        <circle cx={toX(pts - 1)} cy={toY(history[pts - 1].net)} r="3.5" fill={C.primary} stroke="#fff" strokeWidth="2"/>
        <circle cx={toX(pts - 1)} cy={sToY(history[pts - 1].stress)} r="2.5" fill={C.warning} stroke="#fff" strokeWidth="1.5"/>
      </svg>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: 10, height: 3, borderRadius: 2, background: color }}/>
      <span style={{ fontSize: 10, color: C.textTer }}>{label}</span>
    </div>
  );
}

function FleetPanel({ M }) {
  const rows = [
    { label: "AC Units Running", val: M.acOn, total: M.acOn + M.acSup, color: C.primary },
    { label: "AC Suppressed", val: M.acSup, total: M.acOn + M.acSup, color: C.warning },
    { label: "Cycle Appliances", val: M.cycleActive, total: 150, color: C.info },
    { label: "EVs on Grid", val: M.evCount, total: 50, color: C.success },
  ];
  
  return (
    <div className="gp-card" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px", boxShadow: "0 2px 10px rgba(90,100,140,0.06)" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 14 }}>Fleet Overview</div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: i < rows.length - 1 ? `1px solid ${C.borderLight}` : "none" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 500, color: C.text }}>{r.label}</div>
            <div style={{ height: 4, borderRadius: 2, background: C.borderLight, marginTop: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, (r.val / r.total) * 100)}%`, background: r.color, borderRadius: 2, transition: "width 0.5s ease" }}/>
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: r.color, fontFamily: FONTS.mono }}>{r.val}</span>
            <span style={{ fontSize: 10, color: C.textTer }}><br/>/ {r.total}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function HouseCard({ house, isNight, cycle, onOpen }) {
  const isCharging = isNight && house.hasEV && house.battery < 100;
  const isV2G = !isNight && house.hasEV && house.battery > 40 && cycle % 2 === 0;
  const hasSup = house.appliances.ac && house.isAcSuppressed;
  const activeCy = ["washer","dryer","dishwasher"].filter(k => house.appliances[k]?.active);

  let bdr = C.border, bg = C.card, shadow = "0 1px 4px rgba(90,100,140,0.07)";
  if (hasSup) { bdr = C.warning; bg = C.warningLt; shadow = `0 2px 10px ${C.warning}22`; }
  else if (isV2G) { bdr = C.success; bg = C.successLt; shadow = `0 2px 10px ${C.success}22`; }
  else if (isCharging) { bdr = C.info; bg = C.infoLt; shadow = `0 2px 10px ${C.info}22`; }

  return (
    <div className="gp-house" onClick={onOpen} style={{
      background: bg, 
      border: `1px solid ${bdr}`, 
      borderRadius: 10,
      padding: "9px 10px", 
      boxShadow: shadow, 
      position: "relative"
    }}>
      {(hasSup || isV2G || isCharging) && (
        <div style={{ 
          position: "absolute", 
          top: 6, 
          right: 6, 
          width: 6, 
          height: 6, 
          borderRadius: "50%",
          background: hasSup ? C.warning : isV2G ? C.success : C.info,
          boxShadow: `0 0 5px ${hasSup ? C.warning : isV2G ? C.success : C.info}88`,
          animation: "softPulse 2s infinite"
        }}/>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 5, fontFamily: FONTS.mono }}>{house.id}</div>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", minHeight: 18, alignItems: "center" }}>
        {house.appliances.ac && (
          <span style={{ 
            fontSize: 9, 
            padding: "1px 5px", 
            borderRadius: 3,
            background: hasSup ? C.warningLt : C.primaryLt,
            color: hasSup ? C.warning : C.primary, 
            fontWeight: 600 
          }}>
            {hasSup ? "SHED" : "AC"}
          </span>
        )}
        {activeCy.map(k => (
          <span key={k} style={{ 
            fontSize: 9, 
            padding: "1px 5px",
            borderRadius: 3,
            background: APPLIANCES[k].color + "22",
            color: APPLIANCES[k].color,
            fontWeight: 600
          }}>
            {k.charAt(0).toUpperCase()}
          </span>
        ))}
      </div>

      {house.hasEV && (
        <div style={{ marginTop: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
            <span style={{ fontSize: 8, color: isCharging ? C.info : isV2G ? C.success : C.textTer, fontWeight: 600 }}>
              {isCharging ? "Charging" : isV2G ? "V2G" : "EV"}
            </span>
            <span style={{ fontSize: 8, color: C.textTer, fontFamily: FONTS.mono }}>{house.battery.toFixed(0)}%</span>
          </div>
          <div style={{ height: 3, borderRadius: 2, background: C.borderLight, overflow: "hidden" }}>
            <div style={{ 
              height: "100%", 
              width: `${house.battery}%`,
              background: house.battery === 100 ? C.success : isCharging ? C.info : C.primary,
              borderRadius: 2, 
              transition: "width 0.45s ease"
            }}/>
          </div>
        </div>
      )}
    </div>
  );
}
function HouseModal({ house, isNight, cycle, onClose }) {
  const isCharging = isNight && house.hasEV && house.battery < 100;
  const isV2G = !isNight && house.hasEV && house.battery > 40 && cycle % 2 === 0;

  return (
    <div className="gp-modal-bg" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,24,36,0.45)", backdropFilter: "blur(5px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="gp-modal-box" onClick={e => e.stopPropagation()} style={{
        background: C.card, 
        borderRadius: 18, 
        border: `1px solid ${C.border}`,
        width: 380, 
        maxWidth: "92vw", 
        boxShadow: "0 24px 60px rgba(90,100,140,0.18)", 
        overflow: "hidden"
      }}>
        <div style={{ background: `linear-gradient(135deg, ${C.primaryLt}, ${C.infoLt})`, padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 18, fontFamily: FONTS.display, fontWeight: 600, color: C.text }}>House <span style={{ color: C.primary }}>{house.id}</span></div>
            <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>Residential Node · Sector {Math.ceil(house.id / 10)}</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.8)", border: "none", borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 14, color: C.textSec, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        <div style={{ padding: "20px 24px 24px" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
            {house.appliances.ac && house.isAcSuppressed && <Pill color={C.warning} label="AC Suppressed" />}
            {house.appliances.ac && !house.isAcSuppressed && <Pill color={C.success} label="AC Running" />}
            {isCharging && <Pill color={C.info} label="EV Charging" />}
            {isV2G && <Pill color={C.success} label="V2G Active" />}
            {!house.hasEV && <Pill color={C.neutral} label="No EV" />}
          </div>

          <div style={{ fontSize: 10.5, fontWeight: 600, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Appliance Status</div>
          {Object.entries(APPLIANCES).map(([key, app]) => {
            const data = house.appliances[key];
            const isAct = app.type === "cycle" ? data?.active : !!data;
            const isSup = key === "ac" && house.isAcSuppressed;
            const stColor = isSup ? C.warning : isAct ? C.success : C.textTer;
            
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.borderLight}` }}>
                <div style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: 9, 
                  background: isAct ? app.color + "12" : C.cardInner, 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  fontSize: 10, 
                  fontWeight: 700,
                  color: isAct ? app.color : C.textTer,
                  flexShrink: 0, 
                  border: `1px solid ${isAct ? app.color + "22" : C.border}` 
                }}>
                  {key.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: stColor }}>{app.name}</span>
                    <span style={{ fontSize: 10, color: C.textTer, fontFamily: FONTS.mono }}>{fmtKw(app.watt)}</span>
                  </div>
                  {app.type === "cycle" && data?.active && (
                    <>
                      <div style={{ height: 4, borderRadius: 2, background: C.borderLight, marginTop: 5, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${data.progress}%`, background: app.color, borderRadius: 2, transition: "width 0.4s" }}/>
                      </div>
                      <div style={{ fontSize: 9.5, color: C.textTer, marginTop: 3 }}>{data.progress.toFixed(0)}% complete · ~{Math.ceil((100 - data.progress) / 25)} cycles remaining</div>
                    </>
                  )}
                  {app.type === "cycle" && !data?.active && <div style={{ fontSize: 9.5, color: C.textTer, marginTop: 2 }}>Idle</div>}
                  {key === "ac" && isSup && <div style={{ fontSize: 9.5, color: C.warning, marginTop: 2 }}>Demand response — suppressed by grid AI</div>}
                  {key === "ac" && isAct && !isSup && <div style={{ fontSize: 9.5, color: C.success, marginTop: 2 }}>Running normally</div>}
                </div>
              </div>
            );
          })}

          {house.hasEV && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Electric Vehicle</div>
              <div style={{ background: C.cardInner, borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Battery Level</div>
                    <div style={{ fontSize: 10.5, color: isCharging ? C.info : isV2G ? C.success : C.textTer, marginTop: 1 }}>
                      {isCharging ? "Charging at ~20%/cycle" : isV2G ? "Discharging via V2G (~3 kW)" : "Idle"}
                    </div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: FONTS.mono, color: isCharging ? C.info : isV2G ? C.success : C.primary }}>{house.battery.toFixed(1)}<span style={{ fontSize: 12, fontWeight: 400, color: C.textTer }}>%</span></div>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: C.borderLight, overflow: "hidden" }}>
                  <div style={{ 
                    height: "100%", 
                    width: `${house.battery}%`,
                    background: house.battery === 100 ? C.success : isCharging ? C.info : C.primary,
                    borderRadius: 4, 
                    transition: "width 0.5s ease"
                  }}/>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span style={{ fontSize: 9.5, color: C.textTer }}>0%</span>
                  <span style={{ fontSize: 9.5, color: C.textTer }}>50%</span>
                  <span style={{ fontSize: 9.5, color: C.textTer }}>100%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Pill({ color, label }) {
  return (
    <span style={{
      fontSize: 10.5, 
      fontWeight: 600, 
      padding: "4px 10px", 
      borderRadius: 20,
      background: color + "18", 
      color, 
      border: `1px solid ${color}33`
    }}>{label}</span>
  );
}
