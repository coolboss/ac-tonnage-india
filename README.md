# AC Tonnage India

A room-by-room air-conditioner sizing tool for Indian homes. Instead of the dealer's "1 ton per 120 sq ft" rule, it runs a simplified ASHRAE/ISHRAE heat-load calculation using the city's design weather, the wall and roof construction, window orientation and shading, people, appliances, kitchen spill and air leakage, then picks the smallest standard AC size that fits.

**Live app:** https://coolboss.github.io/ac-tonnage-india/

## What it covers

- 83 Indian cities grouped by state. Peak case: ASHRAE Handbook 2021 annual 0.4 % dry-bulb with mean coincident wet-bulb. Humid case: annual 0.4 % wet-bulb with coincident dry-bulb. Optional +3 °C heat-wave margin. 49 cities sit on their own ASHRAE station (WMO id stored); 12 `proxy` cities borrow a station within ~100 km; 19 `approx` cities have an estimated peak with the humid case from the nearest station; 4 `estimated` hill or north-east cities have no station nearby. The app badges every non-station city. Station values were read from ashrae-meteo.info (2021 edition, SI) on 10 Nov 2026 and are kept in `climate/stations.txt`. A "My city is not listed" option takes a climate zone and peak summer temperature instead.
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

Solar-gain increments, kitchen spill, partition ΔT and monsoon design points are tuned engineering estimates, not table values; treat results as ±10 %. City entries flagged `approx` or `estimated` in `engine.js` are the remaining soft spots; the app badges them in the result. This is a household guide, not an engineering certificate.
