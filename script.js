// --- Globale Variablen ---
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
  
  // Wir laden die Daten sofort beim Start aus dem Browser-Speicher
  loadFromStorage();
  
  map.locate({ setView: true, maxZoom: 16 });
  
  map.on('locationfound', function(e) {
    if (myLocationMarker) map.removeLayer(myLocationMarker);
    myLocationMarker = L.marker(e.latlng, { title: 'Du bist hier' }).addTo(map);
  });
  
  map.on('click', function(e) {
    openSelectionPopup(e.latlng);
  });
}

// --- 2. Auswahl-Popups ---
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

// --- 3. Speichern & Laden (Lokal) ---
function finalizeReport(lat, lng, typ, farbe) {
  const kommentar = document.getElementById('report-comment').value;
  const id = "ID_" + Date.now();
  const zeit = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  reportsData.push({ id, lat, lng, typ, kommentar, zeit, farbe });
  
  saveToStorage();
  map.closePopup();
}

function saveToStorage() {
  // Speichert die Liste als Text im Browser
  localStorage.setItem('my_freeway_data', JSON.stringify(reportsData));
  console.log("💾 Lokal im Browser gesichert!");
  drawMarkersOnMap();
}

function loadFromStorage() {
  const saved = localStorage.getItem('my_freeway_data');
  if (saved) {
    reportsData = JSON.parse(saved);
    console.log("✅ " + reportsData.length + " Marker aus Browser geladen.");
    drawMarkersOnMap();
  }
}

// --- 4. Zeichnen ---
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
    m.bindPopup(`<b>${r.typ}</b><br><button onclick="deleteReport('${r.id}')">🗑 Löschen</button>`);
    activeMarkers[r.id] = m;
  });
}

function deleteReport(id) {
  reportsData = reportsData.filter(r => r.id !== id);
  saveToStorage();
}

window.addEventListener('load', initMap);