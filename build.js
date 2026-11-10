// Inlines engine.js into app.html at the /*ENGINE*/ marker, wraps it in a full
// HTML document and writes index.html (for GitHub Pages / any static host).
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/app.html', 'utf8');
const eng = fs.readFileSync(__dirname + '/engine.js', 'utf8');
const body = html.replace('/*ENGINE*/', () => eng);
const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Room-by-room air-conditioner tonnage calculator for Indian homes.">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)} [hidden]{display:none!important}</style>
</head>
<body>
${body}
</body>
</html>
`;
fs.writeFileSync(__dirname + '/index.html', doc);
console.log('index.html built');
