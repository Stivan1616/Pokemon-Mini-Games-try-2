const fs = require('fs');
const https = require('https');

const TYPES = [
    "normal", "fighting", "flying", "poison", "ground", "rock", "bug", "ghost", "steel",
    "fire", "water", "grass", "electric", "psychic", "ice", "dragon", "dark", "fairy"
];

const pokemonMap = new Map(); // ID -> { id, name, types: Set<string> }

const fetchUrl = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
};

const buildDB = async () => {
    console.log("Starting DB build...");

    // Fetch all types in parallel (or sequential if rate limits are an issue, but 18 is small)
    for (const type of TYPES) {
        console.log(`Fetching type: ${type}...`);
        try {
            const data = await fetchUrl(`https://pokeapi.co/api/v2/type/${type}`);

            for (const p of data.pokemon) {
                // p = { slot: 1, pokemon: { name: "bulbasaur", url: "..." } }
                const name = p.pokemon.name;
                const url = p.pokemon.url;
                // Extract ID: https://pokeapi.co/api/v2/pokemon/1/
                const parts = url.split('/');
                const id = parseInt(parts[parts.length - 2]);

                if (!pokemonMap.has(id)) {
                    pokemonMap.set(id, {
                        id: id,
                        name: name,
                        types: new Set()
                    });
                }

                pokemonMap.get(id).types.add(type);
            }
        } catch (e) {
            console.error(`Error fetching type ${type}:`, e);
        }
    }

    console.log(`Processed all types. Total Pokemon found: ${pokemonMap.size}`);

    // Convert Map to Array and Sort by ID
    const db = Array.from(pokemonMap.values())
        .map(p => ({
            id: p.id,
            name: p.name,
            types: Array.from(p.types).sort(),
            sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`,
            sprite_showdown: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${p.id}.gif`,
            sprite_official: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.id}.png`
        }))
        .sort((a, b) => a.id - b.id);

    // Write to file
    fs.writeFileSync('pokemon_db.json', JSON.stringify(db, null, 2));
    console.log("Database written to pokemon_db.json");
};

buildDB();
