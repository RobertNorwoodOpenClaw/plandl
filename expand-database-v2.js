const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Sleep utility
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Download file from URL
function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);
    
    protocol.get(url, {
      headers: { 'User-Agent': 'PlandlGame/1.0' }
    }, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        file.close();
        fs.unlinkSync(filepath);
        downloadFile(response.headers.location, filepath).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode === 429) {
        file.close();
        fs.unlinkSync(filepath);
        reject({ code: 429, message: 'Rate limited' });
        return;
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(filepath);
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      reject(err);
    });
  });
}

// Search Wikimedia Commons and download image with retry
async function fetchAircraftImage(searchTerm, outputFilename, retries = 3) {
  const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(searchTerm)}+aircraft&gsrlimit=1&prop=imageinfo&iiprop=url&iiurlwidth=1280`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const json = await new Promise((resolve, reject) => {
        https.get(apiUrl, {
          headers: { 'User-Agent': 'PlandlGame/1.0' }
        }, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (err) {
              reject(err);
            }
          });
        }).on('error', reject);
      });
      
      if (!json.query || !json.query.pages) {
        return null;
      }
      
      const pages = Object.values(json.query.pages);
      if (pages.length === 0 || !pages[0].imageinfo) {
        return null;
      }
      
      const imageUrl = pages[0].imageinfo[0].thumburl || pages[0].imageinfo[0].url;
      const outputPath = path.join(__dirname, 'images', outputFilename);
      
      await downloadFile(imageUrl, outputPath);
      return outputFilename;
      
    } catch (err) {
      if (err.code === 429 && attempt < retries) {
        const backoffMs = Math.pow(2, attempt) * 5000; // 10s, 20s, 40s
        console.log(`  ⏳ Rate limited, waiting ${backoffMs/1000}s before retry ${attempt + 1}/${retries}...`);
        await sleep(backoffMs);
      } else if (attempt === retries) {
        throw err;
      }
    }
  }
  
  return null;
}

// Aircraft list to add
const newAircraft = [
  // Cessna variants
  { manufacturer: "Cessna", model: "310", version: "Standard", search: "Cessna 310" },
  { manufacturer: "Cessna", model: "337", version: "Skymaster", search: "Cessna 337" },
  { manufacturer: "Cessna", model: "340", version: "Standard", search: "Cessna 340" },
  { manufacturer: "Cessna", model: "402", version: "Businessliner", search: "Cessna 402" },
  { manufacturer: "Cessna", model: "421", version: "Golden Eagle", search: "Cessna 421" },
  { manufacturer: "Cessna", model: "Citation", version: "CJ3", search: "Cessna Citation CJ3" },
  { manufacturer: "Cessna", model: "Citation", version: "Longitude", search: "Cessna Citation Longitude" },
  { manufacturer: "Cessna", model: "Citation", version: "X", search: "Cessna Citation X" },
  { manufacturer: "Cessna", model: "206", version: "Stationair", search: "Cessna 206" },
  { manufacturer: "Cessna", model: "210", version: "Centurion", search: "Cessna 210" },
  { manufacturer: "Cessna", model: "195", version: "Businessliner", search: "Cessna 195" },
  
  // Piper variants
  { manufacturer: "Piper", model: "PA-32", version: "Cherokee Six", search: "Piper PA-32" },
  { manufacturer: "Piper", model: "PA-34", version: "Seneca", search: "Piper Seneca" },
  { manufacturer: "Piper", model: "PA-44", version: "Seminole", search: "Piper Seminole" },
  { manufacturer: "Piper", model: "PA-60", version: "Aerostar", search: "Piper Aerostar" },
  { manufacturer: "Piper", model: "PA-31", version: "Navajo", search: "Piper Navajo" },
  { manufacturer: "Piper", model: "J-3", version: "Cub", search: "Piper J-3 Cub" },
  
  // Grumman/American General
  { manufacturer: "Grumman", model: "AA-5", version: "Tiger", search: "Grumman Tiger" },
  { manufacturer: "American General", model: "AG-5B", version: "Tiger", search: "American General Tiger" },
  { manufacturer: "Grumman", model: "G-21", version: "Goose", search: "Grumman Goose" },
  
  // Socata/Daher TBM
  { manufacturer: "Daher", model: "TBM 940", version: "Standard", search: "TBM 940" },
  { manufacturer: "Socata", model: "TBM 700", version: "Standard", search: "TBM 700" },
  
  // Military - Jets
  { manufacturer: "North American", model: "F-86", version: "Sabre", search: "F-86 Sabre" },
  { manufacturer: "North American", model: "F-100", version: "Super Sabre", search: "F-100 Super Sabre" },
  { manufacturer: "Lockheed", model: "F-104", version: "Starfighter", search: "F-104 Starfighter" },
  { manufacturer: "Republic", model: "F-105", version: "Thunderchief", search: "F-105 Thunderchief" },
  { manufacturer: "General Dynamics", model: "F-111", version: "Aardvark", search: "F-111 Aardvark" },
  { manufacturer: "McDonnell Douglas", model: "A-4", version: "Skyhawk", search: "A-4 Skyhawk" },
  { manufacturer: "Grumman", model: "A-6", version: "Intruder", search: "A-6 Intruder" },
  { manufacturer: "McDonnell Douglas", model: "AV-8B", version: "Harrier II", search: "AV-8B Harrier" },
  { manufacturer: "Boeing", model: "EA-18G", version: "Growler", search: "EA-18G Growler" },
  { manufacturer: "Northrop Grumman", model: "E-2", version: "Hawkeye", search: "E-2 Hawkeye" },
  { manufacturer: "Lockheed", model: "P-3", version: "Orion", search: "P-3 Orion" },
  { manufacturer: "Lockheed", model: "F-117", version: "Nighthawk", search: "F-117 Nighthawk" },
  { manufacturer: "Lockheed", model: "SR-71", version: "Blackbird", search: "SR-71 Blackbird" },
  { manufacturer: "Lockheed", model: "U-2", version: "Dragon Lady", search: "U-2 spy plane" },
  { manufacturer: "Vought", model: "F4U", version: "Corsair", search: "F4U Corsair" },
  { manufacturer: "LTV", model: "A-7", version: "Corsair II", search: "A-7 Corsair" },
  { manufacturer: "Northrop", model: "F-5", version: "Tiger II", search: "F-5 Tiger" },
  
  // Military - WWII
  { manufacturer: "Republic", model: "P-47", version: "Thunderbolt", search: "P-47 Thunderbolt" },
  { manufacturer: "Consolidated", model: "B-24", version: "Liberator", search: "B-24 Liberator" },
  { manufacturer: "Boeing", model: "B-29", version: "Superfortress", search: "B-29 Superfortress" },
  { manufacturer: "Avro", model: "Lancaster", version: "Standard", search: "Avro Lancaster" },
  { manufacturer: "de Havilland", model: "Mosquito", version: "Standard", search: "de Havilland Mosquito" },
  { manufacturer: "Hawker", model: "Hurricane", version: "Mk I", search: "Hawker Hurricane" },
  { manufacturer: "Mitsubishi", model: "A6M", version: "Zero", search: "A6M Zero" },
  { manufacturer: "Messerschmitt", model: "Me 262", version: "Schwalbe", search: "Me 262" },
  { manufacturer: "Focke-Wulf", model: "Fw 190", version: "Wurger", search: "Fw 190" },
  { manufacturer: "Ilyushin", model: "Il-2", version: "Shturmovik", search: "Il-2 Shturmovik" },
  { manufacturer: "Junkers", model: "Ju 87", version: "Stuka", search: "Ju 87 Stuka" },
  { manufacturer: "Heinkel", model: "He 111", version: "Standard", search: "Heinkel He 111" },
  
  // Modern Military
  { manufacturer: "Boeing", model: "B-1", version: "Lancer", search: "B-1 Lancer" },
  { manufacturer: "Tupolev", model: "Tu-95", version: "Bear", search: "Tu-95 Bear" },
  { manufacturer: "Mikoyan", model: "MiG-15", version: "Fagot", search: "MiG-15" },
  { manufacturer: "Mikoyan", model: "MiG-25", version: "Foxbat", search: "MiG-25" },
  { manufacturer: "Sukhoi", model: "Su-25", version: "Frogfoot", search: "Su-25" },
  { manufacturer: "Sukhoi", model: "Su-34", version: "Fullback", search: "Su-34" },
  { manufacturer: "Saab", model: "JAS 39", version: "Gripen", search: "Saab Gripen" },
  { manufacturer: "HAL", model: "Tejas", version: "Mk 1", search: "HAL Tejas" },
  { manufacturer: "Mitsubishi", model: "F-2", version: "Viper Zero", search: "Mitsubishi F-2" },
  
  // Helicopters
  { manufacturer: "Boeing", model: "CH-47", version: "Chinook", search: "CH-47 Chinook" },
  { manufacturer: "Bell", model: "AH-1", version: "Cobra", search: "AH-1 Cobra" },
  { manufacturer: "Mil", model: "Mi-24", version: "Hind", search: "Mi-24 Hind" },
  { manufacturer: "Mil", model: "Mi-8", version: "Hip", search: "Mi-8" },
  { manufacturer: "Kamov", model: "Ka-52", version: "Alligator", search: "Ka-52" },
  { manufacturer: "Bell", model: "OH-58", version: "Kiowa", search: "OH-58 Kiowa" },
  { manufacturer: "Robinson", model: "R22", version: "Beta", search: "Robinson R22" },
  { manufacturer: "Robinson", model: "R44", version: "Raven", search: "Robinson R44" },
  { manufacturer: "Bell", model: "206", version: "JetRanger", search: "Bell 206" },
  
  // Trainers
  { manufacturer: "Beechcraft", model: "T-6", version: "Texan II", search: "T-6 Texan II" },
  { manufacturer: "Pilatus", model: "PC-7", version: "Turbo Trainer", search: "Pilatus PC-7" },
  { manufacturer: "Embraer", model: "EMB 312", version: "Tucano", search: "Embraer Tucano" },
  { manufacturer: "BAE Systems", model: "Hawk", version: "T1", search: "BAE Hawk" },
  { manufacturer: "Aero", model: "L-39", version: "Albatros", search: "L-39 Albatros" },
  
  // Turboprops
  { manufacturer: "Beechcraft", model: "King Air", version: "200", search: "King Air 200" },
  { manufacturer: "Pilatus", model: "PC-6", version: "Porter", search: "Pilatus Porter" },
  { manufacturer: "de Havilland Canada", model: "DHC-6", version: "Twin Otter", search: "DHC-6 Twin Otter" },
  { manufacturer: "Shorts", model: "360", version: "Standard", search: "Shorts 360" },
  
  // Additional GA aircraft
  { manufacturer: "Beechcraft", model: "Musketeer", version: "Standard", search: "Beechcraft Musketeer" },
  { manufacturer: "Maule", model: "M-7", version: "Orion", search: "Maule M-7" },
  { manufacturer: "Stinson", model: "108", version: "Standard", search: "Stinson 108" },
  { manufacturer: "Aeronca", model: "7AC", version: "Champion", search: "Aeronca Champion" },
  { manufacturer: "Taylorcraft", model: "BC-12D", version: "Standard", search: "Taylorcraft BC-12D" },
  { manufacturer: "Luscombe", model: "8A", version: "Silvaire", search: "Luscombe Silvaire" },
  { manufacturer: "Ercoupe", model: "415", version: "Standard", search: "Ercoupe 415" },
  { manufacturer: "Bellanca", model: "Citabria", version: "7ECA", search: "Bellanca Citabria" },
  { manufacturer: "Decathlon", model: "8KCAB", version: "Standard", search: "Decathlon 8KCAB" },
  { manufacturer: "Lake", model: "LA-4", version: "Buccaneer", search: "Lake Buccaneer" },
  { manufacturer: "Icon", model: "A5", version: "Standard", search: "Icon A5" },
  { manufacturer: "Tecnam", model: "P2008", version: "Standard", search: "Tecnam P2008" },
  { manufacturer: "Flight Design", model: "CTLS", version: "Standard", search: "Flight Design CTLS" },
  { manufacturer: "Pipistrel", model: "Alpha", version: "Trainer", search: "Pipistrel Alpha" },
  { manufacturer: "Vans", model: "RV-10", version: "Standard", search: "Vans RV-10" },
  { manufacturer: "Vans", model: "RV-7", version: "Standard", search: "Vans RV-7" },
  { manufacturer: "Glasair", model: "Sportsman", version: "2+2", search: "Glasair Sportsman" },
  { manufacturer: "Lancair", model: "IV", version: "Standard", search: "Lancair IV" },
  { manufacturer: "Columbia", model: "400", version: "Standard", search: "Columbia 400" },
];

async function main() {
  console.log('Starting aircraft database expansion (v2 with exponential backoff)...');
  console.log(`Processing ${newAircraft.length} aircraft...`);
  
  const successfulEntries = [];
  let count = 0;
  
  for (const aircraft of newAircraft) {
    count++;
    console.log(`\n[${count}/${newAircraft.length}] Processing: ${aircraft.manufacturer} ${aircraft.model} ${aircraft.version}`);
    
    try {
      const filename = `${aircraft.manufacturer.toLowerCase().replace(/\s+/g, '_')}_${aircraft.model.toLowerCase().replace(/[\s\/]+/g, '_')}_${aircraft.version.toLowerCase().replace(/\s+/g, '_')}.jpg`;
      const filepath = path.join(__dirname, 'images', filename);
      
      // Skip if image already exists
      if (fs.existsSync(filepath)) {
        console.log(`  ✓ Already exists: ${filename}`);
        successfulEntries.push({
          manufacturer: aircraft.manufacturer,
          model: aircraft.model,
          version: aircraft.version,
          image: `images/${filename}`
        });
        continue;
      }
      
      console.log(`  Searching: "${aircraft.search}"`);
      const result = await fetchAircraftImage(aircraft.search, filename);
      
      if (result) {
        console.log(`  ✓ Downloaded: ${result}`);
        successfulEntries.push({
          manufacturer: aircraft.manufacturer,
          model: aircraft.model,
          version: aircraft.version,
          image: `images/${result}`
        });
      } else {
        console.log(`  ✗ No image found`);
      }
    } catch (err) {
      console.log(`  ✗ Error: ${err.message || err}`);
    }
    
    // Rate limiting: wait 6 seconds between requests
    if (count < newAircraft.length) {
      await sleep(6000);
    }
  }
  
  console.log(`\n\nCompleted! Successfully added ${successfulEntries.length} aircraft.`);
  
  // Read existing planes.json
  const existingData = JSON.parse(fs.readFileSync('planes.json', 'utf8'));
  
  // Merge with new entries
  const updatedData = [...existingData, ...successfulEntries];
  
  // Write updated planes.json
  fs.writeFileSync('planes.json', JSON.stringify(updatedData, null, 2));
  
  console.log(`\nTotal aircraft in database: ${updatedData.length}`);
  console.log('Database updated successfully!');
}

main().catch(console.error);
