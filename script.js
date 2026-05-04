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
    <div style="font-family: sans-serif; text-align: center;">
      <b>Was ist hier?</b><br><br>
      <button onclick="openCommentPopup(${latlng.lat}, ${latlng.lng}, 'Treppe', '#E74C3C')" style="background:#E74C3C; color:white; border:none; padding:8px; margin:2px; border-radius:5px;">🪜 Treppe</button>
      <button onclick="openCommentPopup(${latlng.lat}, ${latlng.lng}, 'Aufzug defekt', '#E67E22')" style="background:#E67E22; color:white; border:none; padding:8px; margin:2px; border-radius:5px;">🛗 Aufzug</button>
      <button onclick="openCommentPopup(${latlng.lat}, ${latlng.lng}, 'Baustelle', '#F1C40F')" style="background:#F1C40F; color:black; border:none; padding:8px; margin:2px; border-radius:5px;">🚧 Baustelle</button>
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
  
  reportsData.push({ id, lat, lng, typ, kommentar, zeit, farbe });
  saveReportsToServer();
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
    const icon = L.divIcon({
      html: `<div style="background-color: ${r.farbe}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
      className: 'custom-marker',
      iconSize: [20, 20]
    });
    
    const m = L.marker([r.lat, r.lng], { icon: icon }).addTo(map);
    m.bindPopup(`
      <div style="font-family: sans-serif;">
        <b>${r.typ}</b><br><small>${r.zeit} Uhr</small>
        <p><i>"${r.kommentar || 'Kein Kommentar'}"</i></p>
        <button onclick="deleteReport('${r.id}')" style="color:#e74c3c; border:none; background:none; font-weight:bold; cursor:pointer;">🗑 Löschen</button>
      </div>
    `);
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
