/* AC Tonnage Engine — India
   Simplified ASHRAE/ISHRAE CLTD-style room heat balance.
   All coefficients are in CONFIG so they can be calibrated.
   Works in browser (window.ACEngine) and Node (module.exports). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ACEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  const CONFIG = {
    version: '1.0.0',
    safetyFactor: 0.10,
    heatWaveDeltaK: 3,
    combinedMarginCap: 0.20,
    infilSensibleCoef: 0.335, // W per (m3/h·K)
    infilLatentCoef: 0.834,   // W per (m3/h·g/kg)
    // Wall constructions: U in W/m2K
    walls: {
      brick9:   { label: '9-inch (230 mm) brick, plastered', U: 2.0 },
      brick45:  { label: '4.5-inch (115 mm) brick, plastered', U: 3.0, Uint: 2.3 },
      aac200:   { label: '200 mm AAC block', U: 0.78 },
      aac150:   { label: '150 mm AAC block', U: 1.0 },
      aac100:   { label: '100 mm AAC block', U: 1.3 },
      concrete: { label: '200 mm solid concrete block', U: 2.8 },
      hollow:   { label: '200 mm hollow concrete block', U: 2.3 },
      rcc:      { label: 'RCC wall (150 mm) plastered', U: 3.3 },
      cavity:   { label: 'Cavity wall (brick + air gap)', U: 1.1 },
      laterite: { label: '300 mm laterite', U: 1.6 },
      unknown:  { label: "Don't know (assume 9-inch brick)", U: 2.0 }
    },
    partitionU: 2.3,
    partitionDeltaCap: 3,
    partitionDeltaFrac: 0.3,
    kitchenPartitionExtraK: 5,
    roofs: {
      rccBare:  { label: 'Plain RCC slab (uninsulated)', U: 3.3 },
      rccCoba:  { label: 'RCC + brick-bat coba / lime terracing', U: 2.3 },
      rccInsul: { label: 'RCC + insulation (PUF/XPS)', U: 0.55 },
      ens:      { label: 'ENS-compliant roof', U: 1.2 }
    },
    roofFinish: {
      grey:   { label: 'Grey / weathered concrete', dsol: 20 },
      dark:   { label: 'Dark / bitumen / tiles', dsol: 25 },
      white:  { label: 'White cool-roof coating', dsol: 8 },
      shaded: { label: 'Shaded (solar panels / canopy)', dsol: 5 }
    },
    falseCeilingFactor: 0.6,
    glass: {
      single:     { label: 'Single clear glass', U: 5.8, SHGC: 0.80 },
      tinted:     { label: 'Single tinted glass', U: 5.8, SHGC: 0.60 },
      reflective: { label: 'Reflective / sun-control film', U: 5.6, SHGC: 0.35 },
      dgu:        { label: 'Double-glazed (DGU) clear', U: 2.8, SHGC: 0.70 },
      lowe:       { label: 'DGU low-E', U: 1.8, SHGC: 0.40 }
    },
    orient: {
      N:  { dsol: 2, scl: 120 }, NE: { dsol: 3, scl: 200 }, E: { dsol: 6, scl: 300 },
      SE: { dsol: 5, scl: 250 }, S:  { dsol: 4, scl: 150 }, SW: { dsol: 7, scl: 380 },
      W:  { dsol: 8, scl: 450 }, NW: { dsol: 5, scl: 300 }
    },
    wallColour: { light: 0.6, medium: 0.8, dark: 1.0 },
    shade: {
      none: 1.0, curtains: 0.65, blackout: 0.5, overhang: 0.6, overhangE: 0.85,
      awning: 0.35, building: 0.5, floor: 0.25
    },
    people: {
      seated:   { s: 75, l: 55 },
      sleeping: { s: 55, l: 40 },
      active:   { s: 130, l: 150 }
    },
    lightingWm2: { led: 5, cfl: 11, none: 0 },
    appliances: {
      fan:    { label: 'Ceiling fan (conventional)', W: 60 },
      bldc:   { label: 'Ceiling fan (BLDC)', W: 30 },
      tv:     { label: 'LED TV', W: 90 },
      pc:     { label: 'Desktop PC + monitor', W: 200 },
      laptop: { label: 'Laptop', W: 50 },
      fridge: { label: 'Refrigerator', W: 60 },
      router: { label: 'Wi-Fi / set-top box', W: 20 }
    },
    kitchen: {
      none:   { s: 0, l: 0 },
      door:   { s: 300, l: 150 },
      open:   { s: 1200, l: 600 }
    },
    ach: { tight: 0.5, average: 1.0, leaky: 1.75 },
    livingDoorExtraACH: 0.5,
    usage: {
      night:  { label: 'Bedroom — night only', glassSolar: 0.1, dT: 0.8, wallDsol: 0.7, roofDsol: 1.0, people: 'sleeping' },
      day:    { label: 'Daytime use', glassSolar: 1.0, dT: 1.0, wallDsol: 1.0, roofDsol: 1.0, people: 'seated' },
      allday: { label: 'All day & night', glassSolar: 1.0, dT: 1.0, wallDsol: 1.0, roofDsol: 1.0, people: 'seated', forceHeatWave: true }
    },
    // Selection
    inverter: { minRatedFrac: 0.90, maxRatedFrac: 1.25, hwMaxFrac: 1.05, maxOverRated: 1.18, minOverRated: 0.30 },
    fixed:    { maxRatedFrac: 1.15, derateK: 0.012 },
    sizes: [
      { ton: 0.8,  kW: 2.8,  label: '0.75–0.8 ton' },
      { ton: 1.0,  kW: 3.5,  label: '1 ton' },
      { ton: 1.2,  kW: 4.2,  label: '1.2–1.25 ton' },
      { ton: 1.4,  kW: 4.9,  label: '1.4 ton' },
      { ton: 1.5,  kW: 5.1,  label: '1.5 ton' },
      { ton: 1.8,  kW: 6.1,  label: '1.75–1.8 ton' },
      { ton: 2.0,  kW: 7.0,  label: '2 ton' },
      { ton: 2.5,  kW: 8.6,  label: '2.5 ton' }
    ],
    fixedSizes: [0.8, 1.0, 1.5, 2.0],
    // ISEER bands by validity (split / variable speed)
    iseerBands: [
      { from: '2021-01-01', to: '2025-12-31', type: 'split', bands: [3.3, 3.5, 3.8, 4.4, 5.0] },
      { from: '2026-01-01', to: '2027-12-31', type: 'split', bands: [3.5, 3.8, 4.1, 4.7, 5.3] },
      { from: '2028-01-01', to: '2029-12-31', type: 'split', bands: [null, 4.3, 4.7, 5.2, 5.8] },
      { from: '2021-01-01', to: '2025-12-31', type: 'window', bands: [2.7, 2.9, 3.1, 3.3, 3.5] },
      { from: '2026-01-01', to: '2029-12-31', type: 'window', bands: [2.9, 3.1, 3.3, 3.5, 3.7], unverified: true }
    ],
    tariffDefault: 7,
    airflow: { supplyDeltaF: 20, supplyDeltaF_humid: 18, humidSHR: 0.78, unitCfmPerTon: 380, freshPerPerson: 7.5, freshPerFt2: 0.03 },
    tariffs: {
      'Gujarat': 7, 'Delhi': 7.5, 'Maharashtra': 12, 'Karnataka': 7.5, 'Tamil Nadu': 8,
      'Telangana': 8, 'West Bengal': 8, 'Uttar Pradesh': 7, 'Rajasthan': 7.5, 'Madhya Pradesh': 7,
      'Kerala': 7.5, 'Punjab/Chandigarh': 7, 'Andhra Pradesh': 8, 'Assam': 7.5, 'Bihar': 7.5,
      'Haryana': 7, 'Uttarakhand': 6.5, 'Jammu & Kashmir': 5, 'Himachal Pradesh': 5.5, 'Goa': 5, 'Chhattisgarh': 6.5, 'Jharkhand': 6.5, 'Odisha': 6.5, 'Meghalaya': 6, 'Manipur': 6, 'Tripura': 6
    }
  };

  // Case A: ASHRAE 2021 annual cooling 0.4% DB / mean coincident WB. Case B (humid): ASHRAE annual 0.4% WB / mean coincident DB.
  // src 'ashrae2021' = read from ashrae-meteo.info on 2026-11-10. proxy = station within ~100 km, same climate. approx = Case A hand-estimated, Case B from nearest station. estimated = no station nearby.
  const CITIES = [
    { name: 'Delhi', state: 'Delhi', zone: 'Composite', A: [42.3, 23.2], B: [34.6, 28.9], alt: 215, src: 'ashrae2021', wmo: 421820, station: 'New Delhi Safdarjung' },
    { name: 'Gurugram', state: 'Haryana', zone: 'Composite', A: [43.8, 22.2], B: [33.2, 29.2], alt: 237, src: 'ashrae2021', wmo: 421810, station: 'New Delhi Indira Gandhi Intl', note: 'Palam airport station' },
    { name: 'Noida / Ghaziabad', state: 'Uttar Pradesh', zone: 'Composite', A: [42.3, 23.2], B: [34.6, 28.9], alt: 200, src: 'ashrae2021', wmo: 421820, station: 'New Delhi Safdarjung', proxy: true },
    { name: 'Faridabad', state: 'Haryana', zone: 'Composite', A: [43.8, 22.2], B: [33.2, 29.2], alt: 200, src: 'ashrae2021', wmo: 421810, station: 'New Delhi Indira Gandhi Intl', proxy: true },
    { name: 'Meerut', state: 'Uttar Pradesh', zone: 'Composite', A: [42.3, 23.2], B: [34.6, 28.9], alt: 225, src: 'ashrae2021', wmo: 421820, station: 'New Delhi Safdarjung', proxy: true },
    { name: 'Hisar', state: 'Haryana', zone: 'Composite', A: [44.5, 23.7], B: [35.4, 29.0], alt: 213, src: 'ashrae2021', wmo: 421310, station: 'Hissar' },
    { name: 'Chandigarh', state: 'Punjab/Chandigarh', zone: 'Composite', A: [41.8, 24.6], B: [33.9, 29.5], alt: 350, src: 'ashrae2021', wmo: 421010, station: 'Patiala', proxy: true, note: 'Patiala station, 60 km' },
    { name: 'Ludhiana', state: 'Punjab/Chandigarh', zone: 'Composite', A: [41.8, 24.6], B: [33.9, 29.5], alt: 244, src: 'ashrae2021', wmo: 421010, station: 'Patiala', proxy: true, note: 'Patiala station, 80 km' },
    { name: 'Amritsar', state: 'Punjab/Chandigarh', zone: 'Composite', A: [42.5, 24.0], B: [33.9, 29.5], alt: 234, src: 'ashrae2021', wmo: 421010, station: 'Patiala', approx: true },
    { name: 'Jaipur', state: 'Rajasthan', zone: 'Composite', A: [42.7, 20.9], B: [30.8, 27.7], alt: 385, src: 'ashrae2021', wmo: 423480, station: 'Jaipur' },
    { name: 'Jodhpur', state: 'Rajasthan', zone: 'Hot-dry', A: [42.8, 21.7], B: [32.9, 27.8], alt: 219, src: 'ashrae2021', wmo: 423390, station: 'Jodhpur' },
    { name: 'Bikaner', state: 'Rajasthan', zone: 'Hot-dry', A: [44.1, 21.6], B: [34.5, 28.1], alt: 224, src: 'ashrae2021', wmo: 421650, station: 'Bikaner' },
    { name: 'Udaipur', state: 'Rajasthan', zone: 'Hot-dry', A: [41.0, 21.0], B: [32.9, 27.8], alt: 582, src: 'ashrae2021', wmo: 423390, station: 'Jodhpur', approx: true },
    { name: 'Kota', state: 'Rajasthan', zone: 'Hot-dry', A: [44.0, 22.0], B: [33.6, 28.7], alt: 273, src: 'ashrae2021', wmo: 423610, station: 'Gwalior', approx: true },
    { name: 'Agra', state: 'Uttar Pradesh', zone: 'Composite', A: [43.8, 23.4], B: [33.6, 28.7], alt: 170, src: 'ashrae2021', wmo: 423610, station: 'Gwalior', proxy: true, note: 'Gwalior station, 110 km' },
    { name: 'Lucknow', state: 'Uttar Pradesh', zone: 'Composite', A: [42.8, 23.4], B: [34.4, 29.8], alt: 125, src: 'ashrae2021', wmo: 423690, station: 'Lucknow' },
    { name: 'Kanpur', state: 'Uttar Pradesh', zone: 'Composite', A: [42.8, 23.4], B: [34.4, 29.8], alt: 126, src: 'ashrae2021', wmo: 423690, station: 'Lucknow', proxy: true, note: 'Lucknow station, 75 km' },
    { name: 'Prayagraj', state: 'Uttar Pradesh', zone: 'Composite', A: [43.5, 24.0], B: [34.4, 29.8], alt: 98, src: 'ashrae2021', wmo: 423690, station: 'Lucknow', approx: true },
    { name: 'Varanasi', state: 'Uttar Pradesh', zone: 'Composite', A: [42.5, 24.0], B: [34.1, 29.1], alt: 81, src: 'ashrae2021', wmo: 424920, station: 'Patna', approx: true },
    { name: 'Dehradun', state: 'Uttarakhand', zone: 'Composite', A: [38.0, 22.5], B: [31.0, 27.5], alt: 640, src: 'estimate', estimated: true },
    { name: 'Gwalior', state: 'Madhya Pradesh', zone: 'Composite', A: [43.8, 23.4], B: [33.6, 28.7], alt: 188, src: 'ashrae2021', wmo: 423610, station: 'Gwalior' },
    { name: 'Bhopal', state: 'Madhya Pradesh', zone: 'Composite', A: [42.0, 21.9], B: [31.2, 26.3], alt: 524, src: 'ashrae2021', wmo: 426670, station: 'Bhopal' },
    { name: 'Indore', state: 'Madhya Pradesh', zone: 'Composite', A: [40.8, 20.9], B: [30.5, 25.6], alt: 564, src: 'ashrae2021', wmo: 427540, station: 'Indore Intl' },
    { name: 'Jabalpur', state: 'Madhya Pradesh', zone: 'Composite', A: [42.4, 20.8], B: [31.0, 26.6], alt: 495, src: 'ashrae2021', wmo: 426750, station: 'Jabalpur' },
    { name: 'Patna', state: 'Bihar', zone: 'Composite', A: [41.3, 23.2], B: [34.1, 29.1], alt: 52, src: 'ashrae2021', wmo: 424920, station: 'Patna' },
    { name: 'Ranchi', state: 'Jharkhand', zone: 'Composite', A: [39.5, 22.5], B: [33.6, 28.2], alt: 651, src: 'ashrae2021', wmo: 427980, station: 'Jamshedpur', approx: true },
    { name: 'Jamshedpur', state: 'Jharkhand', zone: 'Composite', A: [42.1, 22.6], B: [33.6, 28.2], alt: 154, src: 'ashrae2021', wmo: 427980, station: 'Jamshedpur' },
    { name: 'Raipur', state: 'Chhattisgarh', zone: 'Composite', A: [43.5, 23.5], B: [32.3, 27.9], alt: 298, src: 'ashrae2021', wmo: 428670, station: 'Nagpur Ambedkar Intl', approx: true },
    { name: 'Jagdalpur', state: 'Chhattisgarh', zone: 'Composite', A: [39.3, 22.9], B: [33.0, 26.6], alt: 553, src: 'ashrae2021', wmo: 430410, station: 'Jagdalpur' },
    { name: 'Srinagar', state: 'Jammu & Kashmir', zone: 'Cold', A: [33.5, 20.0], B: [29.0, 22.0], alt: 1587, src: 'estimate', estimated: true },
    { name: 'Jammu', state: 'Jammu & Kashmir', zone: 'Composite', A: [42.0, 23.0], B: [33.9, 29.5], alt: 327, src: 'ashrae2021', wmo: 421010, station: 'Patiala', approx: true },
    { name: 'Shimla', state: 'Himachal Pradesh', zone: 'Cold', A: [28.0, 17.0], B: [25.0, 20.0], alt: 2200, src: 'estimate', estimated: true },
    { name: 'Ahmedabad', state: 'Gujarat', zone: 'Hot-dry', A: [43.1, 23.0], B: [33.8, 28.6], alt: 58, src: 'ashrae2021', wmo: 426470, station: 'Ahmedabad' },
    { name: 'Gandhinagar', state: 'Gujarat', zone: 'Hot-dry', A: [43.1, 23.0], B: [33.8, 28.6], alt: 81, src: 'ashrae2021', wmo: 426470, station: 'Ahmedabad', proxy: true },
    { name: 'Vadodara', state: 'Gujarat', zone: 'Hot-dry', A: [43.1, 23.0], B: [33.8, 28.6], alt: 35, src: 'ashrae2021', wmo: 426470, station: 'Ahmedabad', proxy: true, note: 'Ahmedabad station, 100 km' },
    { name: 'Surat', state: 'Gujarat', zone: 'Warm-humid', A: [38.2, 22.6], B: [32.1, 28.4], alt: 12, src: 'ashrae2021', wmo: 428400, station: 'Surat' },
    { name: 'Rajkot', state: 'Gujarat', zone: 'Hot-dry', A: [41.4, 22.1], B: [32.7, 27.7], alt: 134, src: 'ashrae2021', wmo: 427370, station: 'Rajkot' },
    { name: 'Bhuj', state: 'Gujarat', zone: 'Hot-dry', A: [40.9, 23.2], B: [34.0, 28.6], alt: 82, src: 'ashrae2021', wmo: 426340, station: 'Bhuj' },
    { name: 'Bhavnagar', state: 'Gujarat', zone: 'Hot-dry', A: [41.0, 24.5], B: [32.7, 27.7], alt: 24, src: 'ashrae2021', wmo: 427370, station: 'Rajkot', approx: true },
    { name: 'Jamnagar', state: 'Gujarat', zone: 'Hot-dry', A: [40.5, 24.5], B: [32.7, 27.7], alt: 20, src: 'ashrae2021', wmo: 427370, station: 'Rajkot', approx: true },
    { name: 'Veraval', state: 'Gujarat', zone: 'Warm-humid', A: [34.9, 23.6], B: [32.2, 29.3], alt: 8, src: 'ashrae2021', wmo: 429090, station: 'Veraval' },
    { name: 'Mumbai', state: 'Maharashtra', zone: 'Warm-humid', A: [36.0, 22.7], B: [31.2, 28.0], alt: 11, src: 'ashrae2021', wmo: 430030, station: 'Mumbai Shivaji Intl' },
    { name: 'Thane / Navi Mumbai', state: 'Maharashtra', zone: 'Warm-humid', A: [36.0, 22.7], B: [31.2, 28.0], alt: 10, src: 'ashrae2021', wmo: 430030, station: 'Mumbai Shivaji Intl', proxy: true },
    { name: 'Pune', state: 'Maharashtra', zone: 'Temperate', A: [38.5, 19.9], B: [30.0, 24.7], alt: 558, src: 'ashrae2021', wmo: 430630, station: 'Pune' },
    { name: 'Nashik', state: 'Maharashtra', zone: 'Composite', A: [39.5, 20.5], B: [30.0, 24.7], alt: 600, src: 'ashrae2021', wmo: 430630, station: 'Pune', approx: true },
    { name: 'Aurangabad', state: 'Maharashtra', zone: 'Hot-dry', A: [40.3, 22.8], B: [35.7, 26.9], alt: 583, src: 'ashrae2021', wmo: 430140, station: 'Aurangabad' },
    { name: 'Solapur', state: 'Maharashtra', zone: 'Hot-dry', A: [41.3, 22.3], B: [33.0, 26.5], alt: 483, src: 'ashrae2021', wmo: 431170, station: 'Solapur' },
    { name: 'Kolhapur', state: 'Maharashtra', zone: 'Composite', A: [38.5, 21.5], B: [29.6, 24.3], alt: 570, src: 'ashrae2021', wmo: 431980, station: 'Belgaum', approx: true },
    { name: 'Nagpur', state: 'Maharashtra', zone: 'Composite', A: [44.2, 22.6], B: [32.3, 27.9], alt: 315, src: 'ashrae2021', wmo: 428670, station: 'Nagpur Ambedkar Intl' },
    { name: 'Ratnagiri', state: 'Maharashtra', zone: 'Warm-humid', A: [34.4, 23.2], B: [30.9, 27.6], alt: 67, src: 'ashrae2021', wmo: 431100, station: 'Ratnagiri' },
    { name: 'Panaji (Goa)', state: 'Goa', zone: 'Warm-humid', A: [34.2, 25.9], B: [32.1, 28.2], alt: 58, src: 'ashrae2021', wmo: 431920, station: 'Goa Panaji' },
    { name: 'Hyderabad', state: 'Telangana', zone: 'Composite', A: [41.0, 22.0], B: [31.8, 26.4], alt: 531, src: 'ashrae2021', wmo: 431280, station: 'Hyderabad Begumpet' },
    { name: 'Kurnool', state: 'Andhra Pradesh', zone: 'Composite', A: [41.6, 23.0], B: [33.8, 26.3], alt: 281, src: 'ashrae2021', wmo: 432130, station: 'Kurnool' },
    { name: 'Anantapur', state: 'Andhra Pradesh', zone: 'Composite', A: [40.5, 23.5], B: [34.7, 27.2], alt: 364, src: 'ashrae2021', wmo: 432370, station: 'Anantapur' },
    { name: 'Vijayawada', state: 'Andhra Pradesh', zone: 'Warm-humid', A: [43.0, 25.5], B: [34.8, 29.4], alt: 23, src: 'ashrae2021', wmo: 431850, station: 'Machilipatnam', approx: true },
    { name: 'Machilipatnam', state: 'Andhra Pradesh', zone: 'Warm-humid', A: [40.6, 26.7], B: [34.8, 29.4], alt: 3, src: 'ashrae2021', wmo: 431850, station: 'Machilipatnam' },
    { name: 'Kakinada', state: 'Andhra Pradesh', zone: 'Warm-humid', A: [39.6, 27.4], B: [34.7, 29.5], alt: 8, src: 'ashrae2021', wmo: 431890, station: 'Kakinada' },
    { name: 'Nellore', state: 'Andhra Pradesh', zone: 'Warm-humid', A: [40.9, 27.1], B: [36.0, 29.1], alt: 20, src: 'ashrae2021', wmo: 432450, station: 'Nellore' },
    { name: 'Tirupati', state: 'Andhra Pradesh', zone: 'Warm-humid', A: [41.5, 24.5], B: [36.0, 29.1], alt: 150, src: 'ashrae2021', wmo: 432450, station: 'Nellore', approx: true },
    { name: 'Visakhapatnam', state: 'Andhra Pradesh', zone: 'Warm-humid', A: [34.0, 27.1], B: [32.3, 29.3], alt: 66, src: 'ashrae2021', wmo: 431500, station: 'Vishakhapatnam Cwc' },
    { name: 'Bengaluru', state: 'Karnataka', zone: 'Temperate', A: [34.3, 20.0], B: [29.1, 23.7], alt: 921, src: 'ashrae2021', wmo: 432950, station: 'Bengaluru' },
    { name: 'Mysuru', state: 'Karnataka', zone: 'Temperate', A: [35.5, 20.5], B: [29.1, 23.7], alt: 770, src: 'ashrae2021', wmo: 432950, station: 'Bengaluru', approx: true },
    { name: 'Mangaluru', state: 'Karnataka', zone: 'Warm-humid', A: [34.4, 24.9], B: [31.4, 27.2], alt: 103, src: 'ashrae2021', wmo: 432840, station: 'Mangalore Intl' },
    { name: 'Hubballi', state: 'Karnataka', zone: 'Composite', A: [37.6, 20.4], B: [30.2, 25.4], alt: 660, src: 'ashrae2021', wmo: 432010, station: 'Gadag', proxy: true, note: 'Gadag station, 60 km' },
    { name: 'Belagavi', state: 'Karnataka', zone: 'Temperate', A: [36.5, 19.4], B: [29.6, 24.3], alt: 758, src: 'ashrae2021', wmo: 431980, station: 'Belgaum' },
    { name: 'Chitradurga', state: 'Karnataka', zone: 'Temperate', A: [36.7, 20.8], B: [31.0, 25.5], alt: 733, src: 'ashrae2021', wmo: 432330, station: 'Chitradurga' },
    { name: 'Chennai', state: 'Tamil Nadu', zone: 'Warm-humid', A: [39.0, 26.0], B: [33.3, 28.5], alt: 16, src: 'ashrae2021', wmo: 432790, station: 'Chennai Intl' },
    { name: 'Coimbatore', state: 'Tamil Nadu', zone: 'Warm-humid', A: [36.7, 22.2], B: [31.3, 25.7], alt: 404, src: 'ashrae2021', wmo: 433210, station: 'Coimbatore Intl' },
    { name: 'Madurai', state: 'Tamil Nadu', zone: 'Warm-humid', A: [40.5, 24.5], B: [35.0, 27.7], alt: 140, src: 'ashrae2021', wmo: 433440, station: 'Tiruchirappalli', approx: true },
    { name: 'Tiruchirappalli', state: 'Tamil Nadu', zone: 'Warm-humid', A: [39.2, 26.0], B: [35.0, 27.7], alt: 88, src: 'ashrae2021', wmo: 433440, station: 'Tiruchirappalli' },
    { name: 'Cuddalore / Puducherry', state: 'Tamil Nadu', zone: 'Warm-humid', A: [37.9, 27.0], B: [33.9, 29.2], alt: 12, src: 'ashrae2021', wmo: 433290, station: 'Cuddalore' },
    { name: 'Kochi', state: 'Kerala', zone: 'Warm-humid', A: [34.5, 27.0], B: [33.9, 29.0], alt: 5, src: 'ashrae2021', wmo: 433140, station: 'Kozhikode', approx: true, note: 'between Kozhikode and Thiruvananthapuram stations' },
    { name: 'Kozhikode', state: 'Kerala', zone: 'Warm-humid', A: [35.2, 28.2], B: [33.9, 29.0], alt: 5, src: 'ashrae2021', wmo: 433140, station: 'Kozhikode' },
    { name: 'Thiruvananthapuram', state: 'Kerala', zone: 'Warm-humid', A: [34.2, 26.2], B: [31.9, 28.0], alt: 64, src: 'ashrae2021', wmo: 433710, station: 'Thiruvananthapuram' },
    { name: 'Kolkata', state: 'West Bengal', zone: 'Warm-humid', A: [37.9, 27.3], B: [34.7, 29.7], alt: 5, src: 'ashrae2021', wmo: 428090, station: 'Kolkata Bose Intl' },
    { name: 'Siliguri', state: 'West Bengal', zone: 'Warm-humid', A: [35.5, 27.0], B: [33.3, 29.5], alt: 120, src: 'ashrae2021', wmo: 424100, station: 'Guwahati Intl', estimated: true },
    { name: 'Bhubaneswar', state: 'Odisha', zone: 'Warm-humid', A: [39.3, 27.3], B: [34.8, 29.7], alt: 42, src: 'ashrae2021', wmo: 429710, station: 'Bhubaneshwar' },
    { name: 'Cuttack', state: 'Odisha', zone: 'Warm-humid', A: [39.3, 27.3], B: [34.8, 29.7], alt: 36, src: 'ashrae2021', wmo: 429710, station: 'Bhubaneshwar', proxy: true },
    { name: 'Balasore', state: 'Odisha', zone: 'Warm-humid', A: [37.6, 27.0], B: [34.3, 29.4], alt: 20, src: 'ashrae2021', wmo: 428950, station: 'Balasore' },
    { name: 'Guwahati', state: 'Assam', zone: 'Warm-humid', A: [35.2, 27.8], B: [33.3, 29.5], alt: 49, src: 'ashrae2021', wmo: 424100, station: 'Guwahati Intl' },
    { name: 'Shillong', state: 'Meghalaya', zone: 'Cold', A: [27.5, 20.0], B: [25.0, 21.0], alt: 1500, src: 'estimate', estimated: true },
    { name: 'Imphal', state: 'Manipur', zone: 'Temperate', A: [32.5, 24.5], B: [30.0, 25.0], alt: 786, src: 'estimate', estimated: true },
    { name: 'Agartala', state: 'Tripura', zone: 'Warm-humid', A: [35.1, 27.0], B: [33.1, 29.0], alt: 14, src: 'ashrae2021', wmo: 427240, station: 'Agartala' }
  ];

  // ---------- Units ----------
  const FT2_PER_M2 = 10.7639, FT_PER_M = 3.28084, BTU_PER_W = 3.412, W_PER_TR = 3516.85;
  const toM = ft => ft / FT_PER_M, toM2 = f => f / FT2_PER_M2;
  const wToTR = W => W * BTU_PER_W / 12000;

  // ---------- Psychrometrics ----------
  function sitePressure(altM) { return 101.325 * Math.pow(1 - 2.25577e-5 * altM, 5.2559); }
  function pws(T) { return 0.61078 * Math.exp(17.27 * T / (T + 237.3)); }
  function wsat(T, P) { const p = pws(T); return 0.622 * p / (P - p); }
  function humidityRatio(DB, WB, P) {
    const ws = wsat(WB, P);
    const w = ((2501 - 2.326 * WB) * ws - 1.006 * (DB - WB)) / (2501 + 1.86 * DB - 4.186 * WB);
    return Math.max(0, w) * 1000; // g/kg
  }
  function humidityRatioRH(T, RH, P) { const p = RH * pws(T); return 1000 * 0.622 * p / (P - p); }

  // ---------- Default input ----------
  function defaultInput() {
    return {
      city: 'Vadodara', customClimate: null,  // {DB, WB, alt}
      roomType: 'bedroom',
      lengthFt: 12, widthFt: 10, heightFt: 10,
      floor: 'middle',                 // ground | middle | top
      roofType: 'rccBare', roofFinish: 'grey', falseCeiling: false,
      wallType: 'brick9', wallColour: 'medium',
      // external walls: array of { orient, windows: [{ areaFt2, glass, shades: [] }] }
      walls: [{ orient: 'W', windows: [{ areaFt2: 16, glass: 'single', shades: ['curtains'] }] }],
      peopleDay: 2, peopleNight: 2, activity: 'seated',
      lighting: 'led', lightingW: null,
      appliances: ['fan'],
      kitchen: 'none',
      ach: 'average', frequentDoor: false,
      usage: 'night', setpoint: 24, indoorRH: 0.5,
      heatWave: null,  // null = auto by zone
      acType: 'inverter',
      hoursPerDay: 8, tariff: null, state: null
    };
  }

  // Defaults for a city that is not listed: coincident WB and monsoon case by climate zone
  const ZONE_DEFAULTS = {
    'Hot-dry':    { WB: 22.0, B: [34, 27] },
    'Composite':  { WB: 23.5, B: [35, 28] },
    'Warm-humid': { WB: 27.0, B: [33, 28] },
    'Temperate':  { WB: 20.5, B: [30, 23] },
    'Cold':       { WB: 19.0, B: [27, 21] }
  };
  function customClimate(zone, peakDB, altM) {
    const z = ZONE_DEFAULTS[zone] || ZONE_DEFAULTS.Composite;
    const DB = Math.min(48, Math.max(26, +peakDB || 40));
    const WB = Math.min(z.WB, DB - 6);
    return { A: [DB, WB], B: [Math.min(z.B[0], DB), Math.min(z.B[1], Math.min(z.B[0], DB) - 3)], alt: +altM || 0, zone };
  }

  function getCity(name) { return CITIES.find(c => c.name === name) || null; }

  // ---------- Core load for one climate case ----------
  function computeCase(inp, DB, WB, altM, opts) {
    opts = opts || {};
    const C = CONFIG;
    const usage = C.usage[inp.usage] || C.usage.day;
    const P = sitePressure(altM);
    const rho = P / 101.325;
    const Ti = inp.setpoint;
    const dT = Math.max(0, DB - Ti) * (opts.nightMode === false ? 1 : usage.dT);
    const L = toM(inp.lengthFt), Wd = toM(inp.widthFt), H = toM(inp.heightFt);
    const area = L * Wd, V = area * H;
    const perimSides = { L: L, W: Wd };

    const b = { walls: 0, roof: 0, glassSolar: 0, glassCond: 0, partitions: 0, people: 0, lights: 0, appliances: 0, kitchen: 0, infiltration: 0 };
    const lat = { people: 0, kitchen: 0, infiltration: 0 };
    const rows = []; // heat load sheet line items
    const row = (group, item, A, U, dTe, qs, ql, note) => rows.push({ group, item, area_m2: A, U, dT: dTe, sensible: qs, latent: ql || 0, note: note || '' });

    const wallU = (C.walls[inp.wallType] || C.walls.unknown).U;
    const colour = C.wallColour[inp.wallColour] || 0.8;
    // External walls
    let extArea = 0;
    const totalWallArea = 2 * (L + Wd) * H;
    (inp.walls || []).forEach((w, i) => {
      if (w._empty) return; // placeholder keeping index parity (length/width alternation)
      const o = C.orient[w.orient] || C.orient.N;
      // alternate wall length assignment: first/third walls use length, others width
      const side = (i % 2 === 0) ? perimSides.L : perimSides.W;
      const gross = side * H;
      let glassArea = 0;
      (w.windows || []).forEach(win => {
        const Ag = Math.min(toM2(win.areaFt2 || 0), gross * 0.9);
        const g = C.glass[win.glass] || C.glass.single;
        let sf = 1;
        (win.shades || []).forEach(s => {
          if (s === 'overhang') sf *= (w.orient === 'E' || w.orient === 'NE') ? C.shade.overhangE : C.shade.overhang;
          else sf *= (C.shade[s] != null ? C.shade[s] : 1);
        });
        sf = Math.max(C.shade.floor, sf);
        const qSol = Ag * g.SHGC * o.scl * sf * usage.glassSolar, qCond = Ag * g.U * dT;
        b.glassSolar += qSol; b.glassCond += qCond;
        glassArea += Ag;
        row('Glass', `Window ${win.areaFt2} sq ft on ${w.orient} wall — solar`, Ag, null, null, qSol, 0, `SHGC ${g.SHGC} × ${o.scl} W/m² × shade ${sf.toFixed(2)}`);
        row('Glass', `Window ${win.areaFt2} sq ft on ${w.orient} wall — conduction`, Ag, g.U, dT, qCond, 0, '');
      });
      const net = Math.max(0, gross - glassArea);
      const dTeq = dT + o.dsol * colour * usage.wallDsol, qw = net * wallU * dTeq;
      b.walls += qw;
      extArea += gross;
      row('Walls', `External wall facing ${w.orient} (net of glass)`, net, wallU, dTeq, qw, 0, `ΔT ${dT.toFixed(1)} + solar ${(o.dsol * colour * usage.wallDsol).toFixed(1)} K`);
    });
    // Partitions to unconditioned rooms
    const partArea = Math.max(0, totalWallArea - extArea);
    const dTp = Math.min(C.partitionDeltaCap, C.partitionDeltaFrac * dT);
    b.partitions += partArea * C.partitionU * dTp;
    if (partArea > 0) row('Partitions', 'Internal walls to unconditioned rooms', partArea, C.partitionU, dTp, partArea * C.partitionU * dTp, 0, '');
    // Kitchen wall extra
    if (inp.kitchen !== 'none' && partArea > 0) {
      const kitchenWall = Math.min(partArea, Wd * H);
      const qk = kitchenWall * C.partitionU * (dT + C.kitchenPartitionExtraK - dTp);
      b.partitions += qk;
      row('Partitions', 'Kitchen wall (extra over partition)', kitchenWall, C.partitionU, dT + C.kitchenPartitionExtraK - dTp, qk, 0, '');
    }
    // Roof
    if (inp.floor === 'top') {
      let Ur = (C.roofs[inp.roofType] || C.roofs.rccBare).U;
      if (inp.falseCeiling) Ur *= C.falseCeilingFactor;
      const ds = (C.roofFinish[inp.roofFinish] || C.roofFinish.grey).dsol * usage.roofDsol;
      b.roof = area * Ur * (dT + ds);
      row('Roof', `Exposed roof${inp.falseCeiling ? ' (with false ceiling)' : ''}`, area, Ur, dT + ds, b.roof, 0, `ΔT ${dT.toFixed(1)} + solar ${ds.toFixed(0)} K`);
    }
    // People
    const pType = inp.activity === 'active' ? 'active' : (usage.people || 'seated');
    const pp = C.people[pType];
    const nPeople = inp.usage === 'night' ? inp.peopleNight : inp.peopleDay;
    b.people = nPeople * pp.s; lat.people = nPeople * pp.l;
    row('Internal', `${nPeople} people, ${pType}`, null, null, null, b.people, lat.people, `${pp.s} W sensible + ${pp.l} W latent each`);
    // Lights
    b.lights = inp.lightingW != null ? inp.lightingW : (C.lightingWm2[inp.lighting] || 0) * area;
    // Appliances
    b.appliances = (inp.appliances || []).reduce((s, k) => s + ((C.appliances[k] || {}).W || 0), 0);
    row('Internal', 'Lighting', area, null, null, b.lights, 0, inp.lightingW != null ? 'actual W' : `${C.lightingWm2[inp.lighting] || 0} W/m²`);
    (inp.appliances || []).forEach(k => { const a = C.appliances[k]; if (a) row('Internal', a.label, null, null, null, a.W, 0, ''); });
    // Kitchen
    const k = C.kitchen[inp.kitchen] || C.kitchen.none;
    b.kitchen = k.s; lat.kitchen = k.l;
    if (k.s) row('Internal', inp.kitchen === 'open' ? 'Open kitchen (cooking)' : 'Kitchen spill through door', null, null, null, k.s, k.l, '');
    // Infiltration
    let ach = C.ach[inp.ach] || 1.0;
    if (inp.frequentDoor) ach += C.livingDoorExtraACH;
    const wo = humidityRatio(DB, WB, P), wi = humidityRatioRH(Ti, inp.indoorRH, P);
    b.infiltration = C.infilSensibleCoef * rho * ach * V * dT;
    lat.infiltration = C.infilLatentCoef * rho * ach * V * Math.max(0, wo - wi);
    row('Infiltration', `Air leakage ${ach.toFixed(1)} ACH × ${V.toFixed(1)} m³ — sensible`, null, null, dT, b.infiltration, 0, `0.335 × ${rho.toFixed(2)} × ACH × V × ΔT`);
    row('Infiltration', `Air leakage — moisture (Δw ${Math.max(0, wo - wi).toFixed(1)} g/kg)`, null, null, null, 0, lat.infiltration, `0.834 × ${rho.toFixed(2)} × ACH × V × Δw`);

    const sensible = Object.values(b).reduce((a, x) => a + x, 0);
    const latent = Object.values(lat).reduce((a, x) => a + x, 0);
    const total = sensible + latent;
    const design = total * (1 + C.safetyFactor);
    const airflow = computeAirflow(sensible, latent, V, area, nPeople, design);
    return { DB, WB, dT, area_m2: area, volume_m3: V, P, rho, wo, wi, sensible: b, latent: lat, rows, airflow, ach,
      sensibleW: sensible, latentW: latent, totalW: total, designW: design, designTR: wToTR(design), SHR: total ? sensible / total : 1 };
  }

  // ---------- Airflow (CFM) ----------
  // Required supply airflow from sensible load: CFM = Q_s[BTU/h] / (1.08 × ΔT_supply[°F]).
  // Indian splits typically deliver 350–400 CFM per ton with a 18–22 °F coil ΔT.
  function computeAirflow(sensibleW, latentW, V_m3, area_m2, nPeople, designW) {
    const C = CONFIG.airflow;
    const total = sensibleW + latentW;
    const SHR = total ? sensibleW / total : 1;
    const qBtu = sensibleW * BTU_PER_W;
    const dTF = SHR < C.humidSHR ? C.supplyDeltaF_humid : C.supplyDeltaF;
    const cfm = qBtu / (1.08 * dTF);
    const tr = wToTR(designW);
    const cfmPerTon = tr ? cfm / tr : 0;
    const V_ft3 = V_m3 * 35.3147;
    const ach = V_ft3 ? cfm * 60 / V_ft3 : 0;
    const area_ft2 = area_m2 * FT2_PER_M2;
    const freshCfm = C.freshPerPerson * nPeople + C.freshPerFt2 * area_ft2;
    // typical indoor unit airflow at nominal size (CFM)
    const typical = CONFIG.sizes.map(s => ({ ton: s.ton, label: s.label, cfm: Math.round(s.ton * C.unitCfmPerTon) }));
    let guidance;
    if (SHR < C.humidSHR) guidance = 'Humid room: keep airflow nearer 350 CFM/ton (medium fan speed) so the coil stays cold enough to pull out moisture. A unit with higher CFM/ton will leave the room clammy.';
    else if (cfmPerTon > C.unitCfmPerTon * 1.15) guidance = `Dry, sensible-heavy room: the ideal airflow (${Math.round(cfmPerTon)} CFM/ton) is above what indoor units deliver (~${C.unitCfmPerTon}). That is fine: run the fan on High or Turbo on peak afternoons; the coil simply works at a wider temperature difference.`;
    else guidance = 'Balanced room: a standard 350–400 CFM/ton indoor unit on Auto fan is right.';
    return { SHR, supplyDeltaF: dTF, cfm, m3h: cfm * 1.699, cfmPerTon, ach, freshCfm, freshM3h: freshCfm * 1.699, typical, guidance };
  }

  // ---------- Full calculation ----------
  function calculate(inp) {
    const C = CONFIG;
    const city = getCity(inp.city);
    const clim = inp.customClimate || (city ? { A: city.A, B: city.B, alt: city.alt, zone: city.zone } : null);
    if (!clim) throw new Error('Unknown city and no custom climate');
    const alt = clim.alt || 0;
    const zone = clim.zone || (city && city.zone) || 'Composite';
    const caseA = computeCase(inp, clim.A[0], clim.A[1], alt);
    const caseB = clim.B ? computeCase(inp, clim.B[0], clim.B[1], alt) : null;
    const hwAuto = /Hot-dry|Composite/.test(zone) || (C.usage[inp.usage] && C.usage[inp.usage].forceHeatWave);
    const heatWave = inp.heatWave == null ? hwAuto : !!inp.heatWave;
    const caseC = heatWave ? computeCase(inp, clim.A[0] + C.heatWaveDeltaK, clim.A[1], alt) : null;
    // cap combined margin
    const capW = caseA.totalW * (1 + C.combinedMarginCap);
    if (caseC && caseC.designW > capW) { caseC.designW = capW; caseC.designTR = wToTR(capW); caseC.capped = true; }

    let governing = 'A', L = caseA.designW;
    if (caseB && caseB.designW > L) { governing = 'B'; L = caseB.designW; }
    const Lhw = caseC ? Math.max(caseC.designW, L) : L;
    // night / part load
    const nightInp = Object.assign({}, inp, { usage: 'night' });
    const nightCase = computeCase(nightInp, clim.A[0] - 6, Math.min(clim.A[1], clim.A[0] - 7), alt);
    const Lmin = Math.min(nightCase.designW, 0.45 * L);

    const sel = select(L, Lhw, Lmin, caseA.DB, inp.acType);
    const areaRuleTR = (inp.lengthFt * inp.widthFt) / 120;
    const warnings = buildWarnings(inp, city, caseA, caseB, governing, L, Lhw, sel, areaRuleTR, zone);
    const confidence = confidenceLevel(inp, city);
    const tariff = inp.tariff || (inp.state && C.tariffs[inp.state]) || (city && C.tariffs[city.state]) || C.tariffDefault;
    const cost = runningCost(L, sel, caseA.DB, inp.hoursPerDay || 8, tariff);
    const electrical = electricalAdvice(sel.recommended ? sel.recommended.ton : 1.5);
    return { input: inp, city, zone, alt, heatWave, caseA, caseB, caseC, nightCase, governing,
      designW: L, designTR: wToTR(L), heatWaveW: Lhw, heatWaveTR: wToTR(Lhw), partLoadW: Lmin,
      selection: sel, areaRuleTR, warnings, confidence, tariff, cost, electrical };
  }

  function select(L, Lhw, Lmin, DBdesign, acType) {
    const C = CONFIG;
    const Lk = L / 1000, Lhwk = Lhw / 1000, Lmink = Lmin / 1000;
    const out = { acType, candidates: [], recommended: null, acceptable: [], notes: [] };
    if (acType === 'fixed') {
      C.sizes.filter(s => C.fixedSizes.includes(s.ton)).forEach(s => {
        const cap = s.kW * (1 - C.fixed.derateK * Math.max(0, DBdesign - 35));
        const ok = cap >= Lk && s.kW <= C.fixed.maxRatedFrac * Lk;
        out.candidates.push({ ...s, capAtDesign: cap, ratio: s.kW / Lk, ok,
          reason: cap < Lk ? 'Too small at design ambient' : (s.kW > C.fixed.maxRatedFrac * Lk ? 'Oversized (>115%) — short cycling risk' : 'OK') });
      });
      const okc = out.candidates.filter(c => c.ok);
      out.acceptable = okc;
      out.recommended = okc[0] || null;
      if (!out.recommended) {
        // fallback: smallest that meets load, flag
        const fb = out.candidates.find(c => c.capAtDesign >= Lk);
        out.recommended = fb || out.candidates[out.candidates.length - 1];
        out.notes.push('No fixed-speed size falls in the 100–115% band. An inverter is recommended instead.');
        out.fallback = true;
      }
    } else {
      C.sizes.forEach(s => {
        const maxk = s.kW * C.inverter.maxOverRated, mink = s.kW * C.inverter.minOverRated;
        const bigEnough = s.kW >= C.inverter.minRatedFrac * Lk && maxk >= C.inverter.hwMaxFrac * Lhwk;
        const tooBig = s.kW > C.inverter.maxRatedFrac * Lk;
        const cyc = mink > Lmink;
        out.candidates.push({ ...s, maxkW: maxk, minkW: mink, ratio: s.kW / Lk, ok: bigEnough && !tooBig, cycles: cyc,
          reason: !bigEnough ? 'Too small for peak / heat-wave load' : tooBig ? 'Oversized (>125% of need)' : cyc ? 'OK, but may cycle at night' : 'Good fit' });
      });
      const okc = out.candidates.filter(c => c.ok);
      out.acceptable = okc;
      if (okc.length) {
        okc.sort((a, b) => a.kW - b.kW);
        okc.forEach(c => { if (c.kW < Lk) c.reason = 'Acceptable but tight (90–100% of need)'; });
        out.recommended = okc.find(c => c.kW >= Lk) || okc[okc.length - 1];
      } else {
        const fb = out.candidates.find(c => c.kW >= C.inverter.minRatedFrac * Lk);
        out.recommended = fb || out.candidates[out.candidates.length - 1];
        out.fallback = true;
        out.notes.push(fb ? 'Nearest size is more than 125% of need; still the smallest that works.' : 'Load exceeds 2.5 ton — consider two units or a cassette AC.');
      }
    }
    return out;
  }

  function buildWarnings(inp, city, A, B, governing, L, Lhw, sel, areaRuleTR, zone) {
    const w = [];
    const tr = wToTR(L);
    if (inp.floor === 'top') {
      const pct = A.roof / A.sensibleW;
      if (pct > 0.3) w.push({ level: 'high', text: `Your roof is ${Math.round(pct * 100)}% of the heat load. A white cool-roof coating or terrace insulation can cut the AC size by one step.` });
    }
    const westGlassUnshaded = (inp.walls || []).some(wl => /W|SW/.test(wl.orient) && (wl.windows || []).some(win => !(win.shades || []).length));
    if (westGlassUnshaded) w.push({ level: 'med', text: 'West or south-west glass has no shading. Heavy curtains or an external sun-screen reduce load noticeably.' });
    if (/Warm-humid/.test(zone) || (B && B.SHR < 0.75 && governing === 'B')) w.push({ level: 'med', text: 'Humid climate: avoid oversizing. A right-sized inverter removes moisture better; use Dry mode on muggy days.' });
    if (sel.recommended && sel.recommended.ratio > 1.25) w.push({ level: 'high', text: `The suggested unit is ${Math.round(sel.recommended.ratio * 100)}% of your need — oversized. Expect clammy air and short cycling.` });
    if (sel.recommended && sel.recommended.cycles) w.push({ level: 'low', text: 'Night-time load is below the inverter\'s minimum capacity, so it will cycle on/off in mild weather. Still acceptable.' });
    if (inp.acType === 'fixed') w.push({ level: 'med', text: `A fixed-speed unit loses roughly ${Math.round(CONFIG.fixed.derateK * Math.max(0, A.DB - 35) * 100)}% capacity at ${A.DB} °C ambient. Inverters hold capacity better and cost less to run.` });
    if (inp.kitchen === 'open') w.push({ level: 'med', text: 'An open kitchen adds roughly 0.4 ton of cooling load. Keep the exhaust/chimney running while cooking.' });
    if (Math.abs(tr - areaRuleTR) / areaRuleTR > 0.4) w.push({ level: 'info', text: `Dealer rule of thumb (area ÷ 120) says ${areaRuleTR.toFixed(1)} ton; our calculation says ${tr.toFixed(2)} ton. Rules of thumb ignore roof, orientation and climate.` });
    if (city && city.proxy) w.push({ level: 'info', text: `Weather for ${city.name} uses the nearest ASHRAE station (${city.station}${city.note ? ', ' + city.note.replace(/^[^,]*station, /, '') : ''}). Usually within ±1 °C.` });
    else if (city && city.approx) w.push({ level: 'info', text: `Peak design temperature for ${city.name} is an estimate (no station in the city); the humid case comes from ${city.station}. Expect ±1–2 °C, about ±5% on the load.` });
    else if (city && city.estimated) w.push({ level: 'info', text: `Weather for ${city.name} is estimated; there is no ASHRAE station nearby. Results may vary by ±5–10%.` });
    if (!city) w.push({ level: 'info', text: 'You entered your own climate. The result is only as good as the peak temperature you typed; check it against the IMD normal for your town.' });
    if (/Cold/.test(zone)) w.push({ level: 'low', text: 'Cold-zone city: summers are short. A 0.75–1 ton inverter usually covers a bedroom, and a model with heating mode is worth considering.' });
    if (inp.setpoint < 24) w.push({ level: 'low', text: 'Setpoints below 24 °C raise bills ~6% per degree. BEE recommends 24 °C; with a fan, 26 °C feels the same.' });
    return w;
  }

  function confidenceLevel(inp, city) {
    let score = 3;
    if (inp.wallType === 'unknown') score--;
    if (!city || city.proxy || city.estimated) score--;
    if (!(inp.walls || []).length) score--;
    return score >= 3 ? 'High' : score === 2 ? 'Medium' : 'Low';
  }

  function runningCost(L, sel, DB, hours, tariff) {
    const rec = sel.recommended; if (!rec) return null;
    const Lavg = 0.7 * L / 1000;
    const amb = 1 - 0.015 * Math.max(0, DB - 35);
    const make = iseer => {
      const eer = iseer * 0.92; // seasonal→rated approx
      const cop = eer * amb;
      const kWh_h = Lavg / cop;
      return { iseer, kWh_h, kWh_month: kWh_h * hours * 30, rs_month: kWh_h * hours * 30 * tariff, rs_summer: kWh_h * hours * 30 * tariff * 4 };
    };
    return { tariff, hours, Lavg_kW: Lavg, star5: make(5.3), star3: make(4.1), fixed3: make(3.3) };
  }

  function electricalAdvice(ton) {
    if (ton <= 1.0) return { mcb: '16 A C-curve (dedicated)', wire: '2.5 mm² copper', point: '16 A socket + switch', current: '4–6 A' };
    if (ton <= 1.5) return { mcb: '16–20 A C-curve (dedicated) — check nameplate', wire: '2.5 mm² (16 A) or 4 mm² (20 A) copper', point: '16 A socket, or 20/32 A DP switch', current: '5.5–8 A' };
    return { mcb: '20–25 A C-curve (dedicated)', wire: '4 mm² copper (6 mm² for long runs)', point: '32 A DP switch', current: '8–11 A' };
  }

  function starFromISEER(iseer, type, dateStr) {
    const d = dateStr || new Date().toISOString().slice(0, 10);
    const band = CONFIG.iseerBands.find(b => b.type === type && d >= b.from && d <= b.to);
    if (!band) return null;
    let star = 0;
    band.bands.forEach((th, i) => { if (th != null && iseer >= th) star = i + 1; });
    return { star, band };
  }

  return { CONFIG, CITIES, ZONE_DEFAULTS, customClimate, defaultInput, calculate, computeCase, computeAirflow, select, starFromISEER, electricalAdvice,
    units: { FT2_PER_M2, FT_PER_M, BTU_PER_W, W_PER_TR, wToTR, toM, toM2 },
    psychro: { sitePressure, humidityRatio, humidityRatioRH } };
});
