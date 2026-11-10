const E = require('./engine.js');
let pass = 0, fail = 0;
const ok = (name, cond, info) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, info || ''); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const d = E.defaultInput;

// T1 conversions
ok('T1 12000 BTU/h = 1 TR', near(E.units.wToTR(12000 / E.units.BTU_PER_W), 1, 0.001));
ok('T1 3.517 kW = 1 TR', near(E.units.wToTR(3517), 1, 0.002));
ok('T1 1 W = 3.412 BTU/h', near(E.units.BTU_PER_W, 3.412, 0.001));
// T2 area
ok('T2 120 sqft = 11.15 m2', near(E.units.toM2(120), 11.15, 0.01));
ok('T2 ft<->m round trip', near(E.units.toM(10) * E.units.FT_PER_M, 10, 0.0001));
// T3 psychrometrics
const P0 = E.psychro.sitePressure(0), Pb = E.psychro.sitePressure(920);
ok('T3 w indoor sea level 9.30', near(E.psychro.humidityRatioRH(24, 0.5, P0), 9.30, 0.1), E.psychro.humidityRatioRH(24, 0.5, P0));
ok('T3 w indoor Bengaluru 10.40', near(E.psychro.humidityRatioRH(24, 0.5, Pb), 10.40, 0.15), E.psychro.humidityRatioRH(24, 0.5, Pb));
ok('T3 Ahmedabad 43.1/23 -> 9.34', near(E.psychro.humidityRatio(43.1, 23, P0), 9.34, 0.3), E.psychro.humidityRatio(43.1, 23, P0));
ok('T3 Monsoon 33/27.5 -> 21.0', near(E.psychro.humidityRatio(33, 27.5, P0), 21.0, 0.6), E.psychro.humidityRatio(33, 27.5, P0));

// Example A1: Ahmedabad top floor west-facing, day-mode as in report (full solar)
const A1 = Object.assign(d(), { city: 'Ahmedabad', lengthFt: 12, widthFt: 10, heightFt: 10, floor: 'top', roofType: 'rccBare', roofFinish: 'grey',
  walls: [{ orient: 'W', windows: [{ areaFt2: 16, glass: 'single', shades: ['curtains'] }] }, { orient: 'S', windows: [] }],
  peopleDay: 2, usage: 'day', appliances: ['fan'], lightingW: 60, ach: 'average' });
const rA1 = E.calculate(A1);
console.log('A1 caseA designW', rA1.caseA.designW.toFixed(0), 'TR', rA1.caseA.designTR.toFixed(2), 'HW TR', rA1.heatWaveTR.toFixed(2), 'rec', rA1.selection.recommended.label);
ok('T4 A1 design ~3946 W ±10%', near(rA1.caseA.designW, 3946, 395), rA1.caseA.designW);
ok('T4 A1 recommends 1.2–1.5 ton inverter', [1.2, 1.4, 1.5].includes(rA1.selection.recommended.ton), rA1.selection.recommended.ton);
ok('T4 A1 roof ~41% of sensible', near(rA1.caseA.sensible.roof / rA1.caseA.sensibleW, 0.41, 0.06), rA1.caseA.sensible.roof / rA1.caseA.sensibleW);
// A2 cool roof
const rA2 = E.calculate(Object.assign({}, A1, { roofFinish: 'white' }));
console.log('A2 designW', rA2.caseA.designW.toFixed(0), 'TR', rA2.caseA.designTR.toFixed(2), 'rec', rA2.selection.recommended.label);
ok('T5 A2 ~3460 W ±10%', near(rA2.caseA.designW, 3460, 346), rA2.caseA.designW);
ok('T5 A2 recommends 1.0–1.2 ton', [1.0, 1.2].includes(rA2.selection.recommended.ton), rA2.selection.recommended.ton);

// Example B: Bengaluru middle floor, east window
const B = Object.assign(d(), { city: 'Bengaluru', lengthFt: 12, widthFt: 10, heightFt: 10, floor: 'middle',
  walls: [{ orient: 'E', windows: [{ areaFt2: 16, glass: 'single', shades: ['curtains'] }] }], peopleDay: 2, usage: 'day', appliances: ['fan'], lightingW: 60 });
const rB = E.calculate(B);
console.log('B designW', rB.designW.toFixed(0), 'TR', rB.designTR.toFixed(2), 'rec', rB.selection.recommended.label);
ok('T6 B ~1436 W ±10%', near(rB.caseA.designW, 1436, 150), rB.caseA.designW);
ok('T6 B recommends 0.8–1.0 ton', [0.8, 1.0].includes(rB.selection.recommended.ton), rB.selection.recommended.ton);
ok('T6 B 1.5 ton flagged oversized', rB.selection.candidates.find(c => c.ton === 1.5).ok === false);
ok('T16 Bengaluru rho ~0.90', near(rB.caseA.rho, 0.90, 0.01), rB.caseA.rho);

// Example C: Delhi living room
const Cx = Object.assign(d(), { city: 'Delhi', lengthFt: 16, widthFt: 12.5, heightFt: 10, floor: 'middle',
  walls: [{ orient: 'W', windows: [{ areaFt2: 24, glass: 'single', shades: ['curtains'] }] }, { orient: 'S', windows: [] }],
  peopleDay: 4, usage: 'day', appliances: ['fan', 'tv', 'router'], lightingW: 100, ach: 'leaky' });
const rC = E.calculate(Cx);
console.log('C A', rC.caseA.designW.toFixed(0), 'B', rC.caseB.designW.toFixed(0), 'latB', rC.caseB.latentW.toFixed(0), 'HW', rC.heatWaveW.toFixed(0), 'gov', rC.governing, 'rec', rC.selection.recommended.label);
ok('T7 C case A ~3759 ±10%', near(rC.caseA.designW, 3759, 400), rC.caseA.designW);
ok('T7 C monsoon latent >= 900 W', rC.caseB.latentW >= 900, rC.caseB.latentW);
ok('T7 C governing TR ~1.15 ±0.12', near(rC.heatWaveTR, 1.15, 0.12), rC.heatWaveTR);
ok('T7 C recommends 1.2–1.5 ton', [1.2, 1.4, 1.5].includes(rC.selection.recommended.ton), rC.selection.recommended.ton);
ok('T7 C 2 ton flagged oversized', rC.selection.candidates.find(c => c.ton === 2.0).ok === false);

// Example D: Mumbai kitchen-adjacent
const Dx = Object.assign(d(), { city: 'Mumbai', lengthFt: 12, widthFt: 12, heightFt: 9.5, floor: 'middle',
  walls: [{ orient: 'N', windows: [{ areaFt2: 16, glass: 'single', shades: ['curtains'] }] }], peopleDay: 2, usage: 'day', appliances: ['fan'], lightingW: 60, kitchen: 'door' });
const rD = E.calculate(Dx);
const rD2 = E.calculate(Object.assign({}, Dx, { kitchen: 'open' }));
console.log('D gov TR', rD.designTR.toFixed(2), 'D2 TR', rD2.designTR.toFixed(2), 'recs', rD.selection.recommended.label, '/', rD2.selection.recommended.label);
ok('T8 D ~0.68 TR ±0.1', near(rD.designTR, 0.68, 0.1), rD.designTR);
ok('T8 D2 ~1.10 TR ±0.12', near(rD2.designTR, 1.10, 0.12), rD2.designTR);
ok('T8 D recommends 0.8–1.0', [0.8, 1.0].includes(rD.selection.recommended.ton), rD.selection.recommended.ton);
ok('T8 D2 recommends 1.2–1.5', [1.2, 1.4, 1.5].includes(rD2.selection.recommended.ton), rD2.selection.recommended.ton);

// T9 monotonicity
const base = Object.assign(d(), { city: 'Delhi', usage: 'day' });
const L = i => E.calculate(i).designW;
ok('T9 top >= middle', L({ ...base, floor: 'top' }) > L({ ...base, floor: 'middle' }));
ok('T9 W glass >= N glass', L({ ...base, walls: [{ orient: 'W', windows: [{ areaFt2: 16, glass: 'single', shades: [] }] }] }) > L({ ...base, walls: [{ orient: 'N', windows: [{ areaFt2: 16, glass: 'single', shades: [] }] }] }));
ok('T9 more people up', L({ ...base, peopleDay: 4 }) > L({ ...base, peopleDay: 2 }));
ok('T9 AAC < brick < RCC', L({ ...base, wallType: 'aac200' }) < L({ ...base, wallType: 'brick9' }) && L({ ...base, wallType: 'brick9' }) < L({ ...base, wallType: 'rcc' }));
ok('T9 setpoint 26 < 24', L({ ...base, setpoint: 26 }) < L({ ...base, setpoint: 24 }));
ok('T9 DGU < single', L({ ...base, walls: [{ orient: 'W', windows: [{ areaFt2: 16, glass: 'lowe', shades: [] }] }] }) < L({ ...base, walls: [{ orient: 'W', windows: [{ areaFt2: 16, glass: 'single', shades: [] }] }] }));
// T10 latent clamp
const dry = E.calculate(Object.assign({}, base, { customClimate: { A: [44, 18], B: null, alt: 0, zone: 'Hot-dry' } }));
ok('T10 latent infiltration >= 0 when dry', dry.caseA.latent.infiltration >= 0);
// T11 zero windows/zero walls
const bare = E.calculate(Object.assign({}, base, { walls: [] }));
ok('T11 no NaN with zero external walls', isFinite(bare.designW) && bare.designW > 0 && bare.caseA.sensible.walls === 0);
// T12 area rule flag
ok('T12 area-rule divergence flagged for B', rB.warnings.some(w => /rule of thumb/i.test(w.text)));
// T13 inverter min-capacity warning exists in candidates
ok('T13 min-capacity cycling flag computed', rB.selection.candidates.every(c => typeof c.cycles === 'boolean'));
// T14 fixed-speed band
const fx = E.calculate(Object.assign({}, B, { acType: 'fixed' }));
ok('T14 fixed: 1.5 ton flagged oversized for 0.4 TR load', fx.selection.candidates.find(c => c.ton === 1.5).ok === false);
// T15 missing city / proxy badge
const vad = E.calculate(Object.assign(d(), { city: 'Vadodara' }));
ok('T15 proxy climate warning for Vadodara', vad.warnings.some(w => /nearest ASHRAE station/i.test(w.text)));
let threw = false; try { E.calculate(Object.assign(d(), { city: 'Nowhere' })); } catch (e) { threw = true; }
ok('T15 unknown city throws cleanly', threw);
// T17 star table versioning
ok('T17 ISEER 5.2 in 2026 -> 4 star', E.starFromISEER(5.2, 'split', '2026-06-01').star === 4);
ok('T17 ISEER 5.2 in 2025 -> 5 star', E.starFromISEER(5.2, 'split', '2025-06-01').star === 5);
ok('T17 ISEER 5.3 in 2026 -> 5 star', E.starFromISEER(5.3, 'split', '2026-06-01').star === 5);
// T18 electrical
ok('T18 1.5 ton electrical mentions 4 mm2 and DP', /4 mm²/.test(E.electricalAdvice(1.5).wire) && /DP/.test(E.electricalAdvice(1.5).point));
// Cost sanity
ok('Cost: 5-star cheaper than 3-star', rA1.cost.star5.rs_month < rA1.cost.star3.rs_month);
ok('Cost: Ahmedabad bedroom night 5-star in 700-2500 Rs/month', E.calculate(Object.assign({}, A1, { usage: 'night' })).cost.star5.rs_month > 700 && E.calculate(Object.assign({}, A1, { usage: 'night' })).cost.star5.rs_month < 2500, E.calculate(Object.assign({}, A1, { usage: 'night' })).cost.star5.rs_month);

// T19 heat load sheet rows reconcile with totals
const sumS = rA1.caseA.rows.reduce((a,r)=>a+r.sensible,0), sumL = rA1.caseA.rows.reduce((a,r)=>a+r.latent,0);
ok('T19 sheet rows sum to sensible total', near(sumS, rA1.caseA.sensibleW, 1), sumS - rA1.caseA.sensibleW);
ok('T19 sheet rows sum to latent total', near(sumL, rA1.caseA.latentW, 1), sumL - rA1.caseA.latentW);
ok('T19 A1 has roof, 2 wall, glass rows', rA1.caseA.rows.filter(r=>r.group==='Walls').length===2 && rA1.caseA.rows.some(r=>r.group==='Roof') && rA1.caseA.rows.filter(r=>r.group==='Glass').length===2);
// T20 airflow
const af = rA1.caseA.airflow;
console.log('A1 airflow CFM', af.cfm.toFixed(0), 'CFM/ton', af.cfmPerTon.toFixed(0), 'ACH', af.ach.toFixed(1), 'fresh', af.freshCfm.toFixed(0));
ok('T20 CFM formula: 3477 W sensible -> ~549 CFM at 20F', near(af.cfm, rA1.caseA.sensibleW*3.412/(1.08*20), 1));
ok('T20 CFM/ton in plausible 300-520 band', af.cfmPerTon > 300 && af.cfmPerTon < 520, af.cfmPerTon);
ok('T20 humid room uses 18F and lower CFM/ton', rC.caseB.airflow.supplyDeltaF===18 && rC.caseB.airflow.SHR < 0.78);
ok('T20 fresh air 2 people 120 sqft = 18.6 CFM', near(af.freshCfm, 7.5*2+0.03*120, 0.2), af.freshCfm);
ok('T20 air changes from supply ~ 20-35', af.ach > 15 && af.ach < 40, af.ach);

// T21 city table sanity
let bad=[]; const names=new Set();
E.CITIES.forEach(c=>{ if(names.has(c.name)) bad.push('dup '+c.name); names.add(c.name);
  if(!(c.A[0]>=26 && c.A[0]<=47)) bad.push(c.name+' DB'); if(!(c.A[1]>=15 && c.A[1]<=30)) bad.push(c.name+' WB');
  if(c.A[1]>=c.A[0]) bad.push(c.name+' WB>=DB'); if(c.B && c.B[1]>=c.B[0]) bad.push(c.name+' B WB>=DB');
  if(c.B && !(c.B[1] >= c.A[1]-1.5)) bad.push(c.name+' monsoon drier than peak'); if(!E.CONFIG.tariffs[c.state]) bad.push(c.name+' no tariff for '+c.state);
  if((c.proxy||c.approx) && !c.station) bad.push(c.name+' flagged but no station');
  if(c.src==='ashrae2021' && !(c.wmo>400000 && c.wmo<440000)) bad.push(c.name+' bad wmo');
  if(!c.proxy && !c.approx && !c.estimated && c.src!=='ashrae2021') bad.push(c.name+' unflagged without station source');
  if(!/Hot-dry|Composite|Warm-humid|Temperate|Cold/.test(c.zone)) bad.push(c.name+' zone'); });
ok('T21 city table sane ('+E.CITIES.length+' cities)', bad.length===0, bad.join('; '));
ok('T21 every city calculates', E.CITIES.every(c=>{ try{ return isFinite(E.calculate(Object.assign(d(),{city:c.name})).designW); }catch(e){ return false; } }));
// T22 custom climate
const cc = E.customClimate('Warm-humid', 36, 0);
const rcc = E.calculate(Object.assign(d(), { city: 'Custom', customClimate: cc }));
ok('T22 custom climate computes and warns', isFinite(rcc.designW) && rcc.warnings.some(w=>/own climate/.test(w.text)) && rcc.confidence!=='High');
ok('T22 custom WB below DB and monsoon consistent', cc.A[1] < cc.A[0] && cc.B[1] < cc.B[0]);
ok('T22 Srinagar cold-zone note', E.calculate(Object.assign(d(),{city:'Srinagar'})).warnings.some(w=>/Cold-zone/.test(w.text)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
