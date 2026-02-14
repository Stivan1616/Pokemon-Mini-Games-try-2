const fs = require('fs');

const db = fs.readFileSync('pokemon_db.json', 'utf8');
const jsContent = `window.POKEMON_DB = ${db};`;

fs.writeFileSync('pokemon_data.js', jsContent);
console.log('Created pokemon_data.js');
