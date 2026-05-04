// --- Globale Variablen ---
// Dies ist dein persönlicher Server-Platz (ID am Ende ist für dich generiert)
const localDB = new PouchDB('freeway_stuttgart');
const remoteDB = new PouchDB('https://96f79986-778e-4903-8d05-950c459f0f97-bluemix.cloudantnosqldb.appdomain.cloud/freeway-global');


let map;
let myLocationMarker;
let reportsData = []; // Hier speichern wir die reinen Daten (Lat, Lng, Text...)
let activeMarkers = {}; // Hier speichern wir die Leaflet-Marker-Objekte zum Löschen

// --- 1. Karte initialisieren ---
function initMap() {
  map = L.map('map').setView([51.16, 10.45], 5);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // WICHTIG: Erst wenn die Karte "ready" ist, laden wir die Punkte
  map.whenReady(() => {
    console.log("🗺️ Karte bereit, lade Daten...");
    loadFromLocal().then(() => initSync());
  });

  map.locate({setView: true, maxZoom: 16});

  map.on('locationfound', function(e) {
    if (myLocationMarker) map.removeLayer(myLocationMarker);
    myLocationMarker = L.marker(e.latlng, { title: 'Du bist hier' }).addTo(map);
  });

  map.on('click', function(e) {
    openSelectionPopup(e.latlng);
  });
}

// --- 2. Auswahl- & Kommentar-Fenster ---
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

// --- 3. Speichern-Logik (Lokal -> Server) ---
function finalizeReport(lat, lng, typ, farbe) {
  const kommentar = document.getElementById('report-comment').value;
  const id = "ID_" + Date.now();
  const zeit = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

  // In die Liste hinzufügen
  reportsData.push({ id, lat, lng, typ, kommentar, zeit, farbe });
  
  // Sofort zum Server schicken
  saveReportsToServer(); 
  map.closePopup();
}

// --- 4. Server-Kommunikation ---

// --- Neue Speicher-Logik ---

async function saveReportsToServer() {
  const doc = {
    _id: 'reports_masterlist',
    data: reportsData
  };

  try {
    // Wir prüfen, ob es die Datei schon gibt (wegen der Revisions-Nummer)
    const oldDoc = await localDB.get('reports_masterlist').catch(() => null);
    if (oldDoc) doc._rev = oldDoc._rev;

    // Lokal speichern
    await localDB.put(doc);
    console.log("💾 Lokal gesichert!");
    drawMarkersOnMap();
  } catch (err) {
    console.log("Fehler beim Speichern: " + err);
  }
}

// Startet den Abgleich mit anderen Geräten
function initSync() {
  localDB.sync(remoteDB, {
    live: true,
    retry: true
  }).on('change', function (info) {
    console.log("🔄 Update von anderem Gerät!");
    loadFromLocal(); // Karte neu zeichnen, wenn Daten reinkommen
  });
}

// Lädt die Daten aus dem Speicher des iPads/Handys
async function loadFromLocal() {
  try {
    // Wir holen das Dokument direkt mit dem neuesten Stand
    const doc = await localDB.get('reports_masterlist', { conflicts: true });
    if (doc && doc.data) {
      reportsData = doc.data;
      console.log("✅ Daten geladen: " + reportsData.length);
      drawMarkersOnMap();
    }
  } catch (err) {
    console.log("DB leer oder Fehler: " + err.status);
    // Falls das iPad die Daten "vergessen" hat, holen wir sie uns sofort von der Welt-Cloud
    const remoteDoc = await remoteDB.get('reports_masterlist').catch(() => null);
    if (remoteDoc) {
       reportsData = remoteDoc.data;
       drawMarkersOnMap();
    }
  }
}

// Zeichnet alle Marker aus der reportsData-Liste neu
function drawMarkersOnMap() {
  // Falls die Karte aus irgendeinem Grund noch nicht da ist: Abbrechen!
  if (!map) return; 

  // Erst mal alle alten Marker von der Karte entfernen
  for (let id in activeMarkers) {
    map.removeLayer(activeMarkers[id]);
  }
  activeMarkers = {};

  // Alle aus der Liste neu setzen
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

function sendReport(typ, farbe) {
  if (myLocationMarker) {
    const pos = myLocationMarker.getLatLng();
    openCommentPopup(pos.lat, pos.lng, typ, farbe);
  } else {
    alert("Standort wird gesucht...");
  }
}

// --- 5. Automatisierung ---
window.addEventListener('load', initMap);