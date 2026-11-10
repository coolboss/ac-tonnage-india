# AC Tonnage India

A room-by-room air-conditioner sizing tool for Indian homes. Instead of the dealer's "1 ton per 120 sq ft" rule, it runs a simplified ASHRAE/ISHRAE heat-load calculation using the city's design weather, the wall and roof construction, window orientation and shading, people, appliances, kitchen spill and air leakage, then picks the smallest standard AC size that fits.

**Live app:** https://coolboss.github.io/ac-tonnage-india/

## What it covers

- 68 Indian cities grouped by state, each with a peak design dry-bulb / wet-bulb, an indicative monsoon humid case, and an optional +3 °C heat-wave margin. Cities with a verified ASHRAE 0.4 % station record are unmarked; `approx` cities use general climate-table values (±1–2 °C); `proxy` cities borrow the nearest station; `estimated` cities have thin data. A "My city is not listed" option takes a climate zone and peak summer temperature instead.
- Quick mode (seven questions) and detailed mode, with a hand-off between them.
- Wall U-values (9" brick, 4.5" brick, AAC, RCC, concrete block, cavity, laterite) from BEE Eco-Niwas Samhita figures; roof types and terrace finishes including white cool-roof coating.
- Glass types, window sizes, orientation and shading; people (seated/sleeping), lights, appliances, open or closed kitchen; air leakage.
- Sizing by rated kW, not nameplate ton. Inverter accepted at 90–125 % of load, fixed-speed at 100–115 %.
- Load breakdown, three weather cases, "what if" scenarios (cool roof, curtains, 26 °C, BLDC fan, sealing), running cost at your tariff, MCB/wire advice, installation checklist.

## Files

| File | Purpose |
|---|---|
| `index.html` | The app, single self-contained file (engine inlined). Serve this. |
| `engine.js` | Calculation engine (pure JS, works in browser and Node). All coefficients live in `CONFIG`. |
| `app.html` | UI source with an `/*ENGINE*/` placeholder; `build.js` inlines the engine into `index.html`. |
| `test.js` | QA suite (59 tests): conversions, psychrometrics, four worked examples, monotonicity, edge cases, star-band versioning. |
| `build.js` | Builds `index.html` from `app.html` + `engine.js`. |

## Run the tests / rebuild

```
node test.js
node build.js
```

## Caveats

Solar-gain increments, kitchen spill, partition ΔT and monsoon design points are tuned engineering estimates, not table values; treat results as ±10 %. City entries flagged `approx`, `proxy` or `estimated` in `engine.js` should be verified against ISHRAE weather data before relying on them for a borderline size choice; the app badges them in the result. This is a household guide, not an engineering certificate.
