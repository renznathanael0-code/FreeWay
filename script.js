// --- Globale Variablen ---
const localDB = new PouchDB('freeway_stuttgart');
const remoteDB = new PouchDB('https://96f79986-778e-4903-8d05-950c459f0f97-bluemix.cloudantnosqldb.appdomain.cloud/freeway-global');

let map;
let myLocationMarker;
let reportsData = []; 
let activeMarkers = {}; 

// --- 1. Karte initialisieren ---
function initMap() {
  map = L.map('map').setView([51.16, 10.45], 5);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  
  // Erst laden, dann Sync starten
  loadFromLocal().then(() => initSync());
  
  map.locate({ setView: true, maxZoom: 16 });
  
  map.on('locationfound', function(e) {
    if (myLocationMarker) map.removeLayer(myLocationMarker);
    myLocationMarker = L.marker(e.latlng, { title: 'Du bist hier' }).addTo(map);
  });
  
  map.on('click', function(e) {
    openSelectionPopup(e.latlng);
  });
}

// --- 2. Popups (Auswahl & Kommentar) ---
function openSelectionPopup(latlng) {
  const content = `
    <div style="font-family: sans-serif; text-align: center; min-width: 230px;">
      <b style="font-size: 1.1em;">Was möchtest du melden?</b><br><br>
      
      <div style="text-align: left; font-size: 0.85em; font-weight: bold; margin-bottom: 5px; color: #c0392b;">⚠️ HINDERNISSE</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 15px;">
        <button onclick="openCommentPopup(${latlng.lat}, ${latlng.lng}, 'Treppe', '#E74C3C')" style="background:#E74C3C; color:white; border:none; padding:10px; border-radius:5px;">🪜 Treppe</button>
        <button onclick="openCommentPopup(${latlng.lat}, ${latlng.lng}, 'Aufzug defekt', '#E67E22')" style="background:#E67E22; color:white; border:none; padding:10px; border-radius:5px;">🛗 Defekt</button>
        <button onclick="openCommentPopup(${latlng.lat}, ${latlng.lng}, 'Baustelle', '#F1C40F')" style="background:#F1C40F; color:black; border:none; padding:10px; border-radius:5px; grid-column: span 2;">🚧 Baustelle / Engpass</button>
      </div>

      <div style="text-align: left; font-size: 0.85em; font-weight: bold; margin-bottom: 5px; color: #27ae60;">✅ BARRIEREFREI</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
        <button onclick="openCommentPopup(${latlng.lat}, ${latlng.lng}, 'WC barrierefrei', '#2ECC71')" style="background:#2ECC71; color:white; border:none; padding:10px; border-radius:5px;">🚽 WC</button>
        <button onclick="openCommentPopup(${latlng.lat}, ${latlng.lng}, 'Aufzug', '#27AE60')" style="background:#27AE60; color:white; border:none; padding:10px; border-radius:5px;">🛗 Aufzug</button>
        <button onclick="openCommentPopup(${latlng.lat}, ${latlng.lng}, 'Parkplatz', '#3498DB')" style="background:#3498DB; color:white; border:none; padding:10px; border-radius:5px;">🅿️ Parkplatz</button>
        <button onclick="openCommentPopup(${latlng.lat}, ${latlng.lng}, 'Ort barrierefrei', '#9B59B6')" style="background:#9B59B6; color:white; border:none; padding:10px; border-radius:5px;">📍 Ort</button>
      </div>
    </div>`;
  L.popup().setLatLng(latlng).setContent(content).openOn(map);
}


function openCommentPopup(lat, lng, typ, farbe) {
  const content = `
    <div style="font-family: sans-serif; min-width: 200px;">
      <b style="color:${farbe};">${typ}</b> melden<br><br>
      <textarea id="report-comment" placeholder="Details..." style="width:94%; padding:5px; margin-bottom:10px;"></textarea>
      <button onclick="finalizeReport(${lat}, ${lng}, '${typ}', '${farbe}')" style="width:100%; background:#27ae60; color:white; border:none; padding:10px; border-radius:5px; font-weight:bold;">Speichern</button>
    </div>`;
  L.popup().setLatLng([lat, lng]).setContent(content).openOn(map);
}

// --- 3. Speichern ---
function finalizeReport(lat, lng, typ, farbe) {
  const kommentar = document.getElementById('report-comment').value;
  const id = "ID_" + Date.now();
  const zeit = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // 1. In die lokale Liste schreiben
  reportsData.push({ id, lat, lng, typ, kommentar, zeit, farbe });
  
  // 2. Sofort auf der Karte anzeigen (das fehlte wahrscheinlich!)
  drawMarkersOnMap();
  
  // 3. Im Hintergrund in der Datenbank speichern
  saveReportsToServer();
  
  // 4. Fenster zu
  map.closePopup();
}

async function saveReportsToServer() {
  const doc = { _id: 'reports_masterlist', data: reportsData };
  try {
    const oldDoc = await localDB.get('reports_masterlist').catch(() => null);
    if (oldDoc) doc._rev = oldDoc._rev;
    
    await localDB.put(doc);
    console.log("💾 Lokal gesichert!");
    
    // Manueller Push zur Cloud, damit es sofort beim anderen Gerät ankommt
    await localDB.replicate.to(remoteDB);
    console.log("🚀 Daten zur Cloud hochgeladen!");
    
    drawMarkersOnMap();
  } catch (err) { 
    console.log("Fehler beim Speichern: " + err); 
  }
}


// --- 4. Sync & Laden ---
function initSync() {
  // Push: Lokal -> Cloud
  localDB.replicate.to(remoteDB, { live: true, retry: true });
  
  // Pull: Cloud -> Lokal
  localDB.replicate.from(remoteDB, { live: true, retry: true })
    .on('change', function(info) {
      console.log("📥 JEMAND HAT WAS GEÄNDERT! Lade neu...");
      loadFromLocal();
    })
    .on('error', function(err) {
      console.log("Sync-Fehler: " + err);
    });
}

async function loadFromLocal() {
  try {
    const doc = await localDB.get('reports_masterlist');
    if (doc && doc.data) {
      reportsData = doc.data;
      drawMarkersOnMap();
      console.log("✅ Daten geladen: " + reportsData.length);
    }
  } catch (err) { console.log("Noch keine lokalen Daten vorhanden."); }
}

// --- 5. Karte zeichnen ---
function drawMarkersOnMap() {
  if (!map) return;
  for (let id in activeMarkers) { map.removeLayer(activeMarkers[id]); }
  activeMarkers = {};
  
  reportsData.forEach(r => {
    // Welches Emoji gehört zu welchem Typ?
    let emoji = "📍"; // Standard
    if (r.typ.includes("Treppe")) emoji = "🪜";
    if (r.typ.includes("Aufzug defekt")) emoji = "⚠️";
    if (r.typ.includes("Aufzug")) emoji = "🛗";
    if (r.typ.includes("WC")) emoji = "🚽";
    if (r.typ.includes("Parkplatz")) emoji = "🅿️";
    if (r.typ.includes("Baustelle")) emoji = "🚧";

    const icon = L.divIcon({
      html: `<div style="background-color: ${r.farbe}; width: 30px; height: 30px; border-radius: 50%; border: 2px solid white; display: flex; justify-content: center; align-items: center; box-shadow: 0 0 5px rgba(0,0,0,0.4); font-size: 16px;">${emoji}</div>`,
      className: 'custom-marker',
      iconSize: [30, 30]
    });
    
    const m = L.marker([r.lat, r.lng], { icon: icon }).addTo(map);
    m.bindPopup(`<b>${r.typ}</b><br><p>${r.kommentar}</p><button onclick="deleteReport('${r.id}')">🗑 Löschen</button>`);
    activeMarkers[r.id] = m;
  });
}

function deleteReport(id) {
  if (confirm("Behoben?")) {
    reportsData = reportsData.filter(r => r.id !== id);
    saveReportsToServer();
  }
}

window.addEventListener('load', initMap);

// --- QR-Code generieren ---
function generateQR() {
    const dataString = JSON.stringify(reportsData); // Macht aus der Liste Text
    const qrContainer = document.getElementById("qrcode");
    qrContainer.innerHTML = ""; // Altes löschen
    
    document.getElementById("qr-overlay").style.display = "flex";
    
    new QRCode(qrContainer, {
        text: dataString,
        width: 256,
        height: 256
    });
}

// --- Daten per Texteingabe einlesen (als Ersatz für echte Kamera-Scans) ---
function scanQR() {
    const input = prompt("Füge hier den Code ein, den du gescannt hast (oder kopierten Text):");
    if (input) {
        try {
            const neueDaten = JSON.parse(input);
            // Bestehende Daten mit neuen mischen (ohne Doppelte)
            reportsData = [...new Set([...reportsData, ...neueDaten].map(JSON.stringify))].map(JSON.parse);
            saveReportsToServer(); // Lokal speichern
            drawMarkersOnMap();    // Karte aktualisieren
            alert("Daten erfolgreich übertragen!");
        } catch (e) {
            alert("Fehler: Das war kein gültiger Code.");
        }
    }
}
