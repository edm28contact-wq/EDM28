:root {
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #101827;
  background: #f3f5f8;
}
* { box-sizing: border-box; }
body { margin: 0; }
button, input { font: inherit; }
main { min-height: 100vh; }
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px clamp(18px, 5vw, 60px);
  background: rgba(255,255,255,0.92);
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  backdrop-filter: blur(12px);
  z-index: 10;
}
.brand { font-weight: 900; letter-spacing: 0.08em; }
.hero, .panel {
  width: min(1100px, calc(100% - 28px));
  margin: 30px auto;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 28px;
  padding: clamp(22px, 5vw, 54px);
  box-shadow: 0 22px 70px rgba(15, 23, 42, 0.08);
}
.hero {
  min-height: 72vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: radial-gradient(circle at top right, #e8f0ff, transparent 36%), #fff;
}
.narrow { width: min(780px, calc(100% - 28px)); }
.badge {
  width: fit-content;
  margin: 0 0 14px;
  padding: 8px 13px;
  border-radius: 999px;
  background: #edf4ff;
  color: #1559c7;
  font-weight: 800;
  font-size: 0.86rem;
}
h1, h2 { margin: 0 0 14px; line-height: 1.04; }
h1 { font-size: clamp(2.4rem, 7vw, 5.3rem); letter-spacing: -0.06em; }
h2 { font-size: clamp(2rem, 5vw, 3.2rem); letter-spacing: -0.05em; }
h3 { margin: 8px 0; }
.lead { max-width: 720px; font-size: 1.22rem; color: #465366; line-height: 1.7; }
.muted { color: #667085; line-height: 1.65; }
.actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 24px; }
.primary, .secondary, .ghost {
  border: 0;
  border-radius: 16px;
  padding: 13px 18px;
  font-weight: 850;
  cursor: pointer;
  transition: transform .15s ease, box-shadow .15s ease;
}
.primary { background: #111827; color: white; box-shadow: 0 14px 28px rgba(17,24,39,.18); }
.secondary { background: #eef2f7; color: #111827; }
.ghost { background: transparent; color: #111827; }
.primary:hover, .secondary:hover { transform: translateY(-1px); }
button:disabled { opacity: .65; cursor: not-allowed; }
.link { display: block; text-align: center; text-decoration: none; margin-top: 18px; }
.full { width: 100%; margin-top: 12px; }
.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 36px; }
.cards div, .service-row, .select-card, .grade-box, .annexe, .summary, .notice, .oil-box {
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  background: #fbfcfe;
}
.cards div { padding: 18px; display: grid; gap: 8px; }
.cards span, small { color: #667085; }
.service-list { display: grid; gap: 14px; margin: 22px 0; }
.service-row { padding: 18px; display: flex; gap: 18px; align-items: center; justify-content: space-between; }
.service-row p { color: #475467; margin: 6px 0; }
.service-row strong { font-size: 1.35rem; white-space: nowrap; }
.chip { display: inline-block; padding: 5px 9px; border-radius: 999px; background: #eef2ff; color: #3447b0; font-size: .78rem; font-weight: 900; text-transform: uppercase; letter-spacing: .04em; }
.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 18px; }
label { display: grid; gap: 8px; font-weight: 800; }
input {
  width: 100%;
  padding: 14px 15px;
  border: 1px solid #d0d5dd;
  border-radius: 14px;
  outline: none;
  background: #fff;
}
input:focus { border-color: #111827; box-shadow: 0 0 0 4px rgba(17,24,39,.08); }
.notice { margin-top: 16px; padding: 16px; color: #344054; background: #fff8e7; border-color: #fedf89; }
.selector { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 20px; }
.select-card { padding: 18px; text-align: left; cursor: pointer; color: #101827; }
.select-card.active { border-color: #111827; background: #f7fbff; box-shadow: inset 0 0 0 2px #111827; }
.select-card p { color: #667085; line-height: 1.5; margin-bottom: 0; }
.grade-box, .annexe { padding: 20px; margin-top: 18px; }
.segmented { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0; }
.segmented button {
  border: 1px solid #d0d5dd;
  background: white;
  border-radius: 999px;
  padding: 10px 15px;
  font-weight: 850;
  text-transform: capitalize;
  cursor: pointer;
}
.segmented button.active { background: #111827; color: white; border-color: #111827; }
.check { display: flex; align-items: center; gap: 10px; }
.check input { width: auto; transform: scale(1.2); }
.oil-box { padding: 16px; margin-top: 14px; background: white; }
.summary { padding: 6px; display: grid; gap: 6px; }
.summary div { padding: 14px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-radius: 14px; }
.summary span { color: #667085; }
.summary strong { font-size: 1.1rem; text-align: right; }
.summary .total { background: #111827; color: white; }
.summary .total span { color: #d1d5db; }
.summary .total strong { font-size: 1.5rem; }
.explain {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 14px;
  background: #f3f6fb;
  color: #344054 !important;
  line-height: 1.55;
}
.explain strong { color: #111827; }
.explain.mini {
  font-size: .92rem;
  background: #fff;
  border: 1px solid #e5e7eb;
}
.lookup-box { display: flex; flex-direction: column; justify-content: end; gap: 8px; }
.success { color: #0f766e; font-weight: 700; margin: 6px 0 0; }
@media (max-width: 760px) {
  .topbar { padding: 14px; }
  .cards, .grid, .selector { grid-template-columns: 1fr; }
  .hero, .panel { margin: 14px auto; border-radius: 22px; }
  .service-row { align-items: flex-start; }
  .summary div { align-items: flex-start; flex-direction: column; }
}
