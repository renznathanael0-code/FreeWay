// --- Globale Variablen ---
// Dies ist dein persönlicher Server-Platz (ID am Ende ist für dich generiert)
const URL = "https://jsonblob.com/api/jsonBlob/1367468132923056128";
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

  // Daten sofort beim Start vom Server laden
  loadReportsFromServer();

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

async function saveReportsToServer() {
  drawMarkersOnMap(); // Lokal sofort anzeigen

  try {
    const response = await fetch(URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json' // Hinzugefügt: Sagt dem Server, wir wollen JSON
      },
      body: JSON.stringify(reportsData)
    });

    if (response.ok) {
      console.log("✅ Server hat die Daten angenommen!");
    } else {
      // Wenn der Server mit einem Fehler antwortet (z.B. 404 oder 401)
      const errorText = await response.text();
      console.log("❌ Server-Antwort: " + response.status + " - " + errorText);
    }
  } catch (err) {
    console.log("🌐 Netzwerk-Fehler: Eventuell blockiert der Browser die Anfrage.");
  }
}


async function loadReportsFromServer() {
  try {
    const response = await fetch(URL);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        reportsData = data;
        drawMarkersOnMap();
        console.log("📡 Daten vom Server empfangen");
      }
    }
  } catch (err) {
    console.log("Noch keine Daten auf dem Server.");
  }
}

// Zeichnet alle Marker aus der reportsData-Liste neu
function drawMarkersOnMap() {
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

// Alle 15 Sekunden automatisch vom Server laden (für das Team)
setInterval(loadReportsFromServer, 15000);
