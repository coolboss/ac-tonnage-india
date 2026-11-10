# AC Tonnage India

A room-by-room air-conditioner sizing tool for Indian homes. Instead of the dealer's "1 ton per 120 sq ft" rule, it runs a simplified ASHRAE/ISHRAE heat-load calculation using the city's design weather, the wall and roof construction, window orientation and shading, people, appliances, kitchen spill and air leakage, then picks the smallest standard AC size that fits.

**Live app:** https://coolboss.github.io/ac-tonnage-india/

## What it covers

- 21 Indian cities with ASHRAE 0.4 % design dry-bulb / wet-bulb data, an indicative monsoon humid case, and an optional +3 °C heat-wave margin.
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
| `test.js` | QA suite (46 tests): conversions, psychrometrics, four worked examples, monotonicity, edge cases, star-band versioning. |
| `build.js` | Builds `index.html` from `app.html` + `engine.js`. |

## Run the tests / rebuild

```
node test.js
node build.js
```

## Caveats

Solar-gain increments, kitchen spill, partition ΔT and monsoon design points are tuned engineering estimates, not table values; treat results as ±10 %. Vadodara, Rajkot, Chandigarh and Kochi use proxy or estimated weather. This is a household guide, not an engineering certificate.
