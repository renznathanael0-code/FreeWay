// --- Globale Variablen ---
// Firebase Setup (Die "Welt-Cloud")
// --- Firebase Setup Korrektur ---
const firebaseConfig = {
  databaseURL: "https://freeway-stuttgart-default-rtdb.europe-west1.firebasedatabase.app"
};

// Initialisierung
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();


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

  // Sobald die Karte bereit ist, starten wir den Live-Sync
  map.whenReady(() => {
    console.log("🗺️ Karte bereit, verbinde mit Welt-Cloud...");
    initSync();
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

// --- 3. Speichern-Logik ---
function finalizeReport(lat, lng, typ, farbe) {
  const kommentar = document.getElementById('report-comment').value;
  const id = "ID_" + Date.now();
  const zeit = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

  // In die lokale Liste hinzufügen
  reportsData.push({ id, lat, lng, typ, kommentar, zeit, farbe });
  
  // In die Firebase Cloud schicken
  saveReportsToServer(); 
  map.closePopup();
}

function saveReportsToServer() {
  db.ref('marker_liste').set(reportsData)
    .then(() => console.log("🚀 Weltweit gespeichert!"))
    .catch(e => console.log("Fehler beim Speichern: " + e.message));
}

// --- 4. Live-Sync (Der wichtigste Teil) ---
function initSync() {
  // .on('value', ...) sorgt dafür, dass die App SOFORT reagiert, 
  // wenn irgendwo auf der Welt ein neuer Marker gesetzt wird.
  db.ref('marker_liste').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      reportsData = data;
      console.log("🌍 Neue Daten aus der Cloud erhalten!");
      drawMarkersOnMap();
    } else {
      console.log("☁️ Cloud ist noch leer.");
    }
  });
}

// Zeichnet alle Marker aus der reportsData-Liste neu
function drawMarkersOnMap() {
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

// --- 5. Start ---
window.addEventListener('load', initMap);
