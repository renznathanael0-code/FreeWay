const localDB = new PouchDB('freeway_stuttgart');
let map, myLocationMarker, reportsData = [], activeMarkers = {};

function initMap() {
    map = L.map('map').setView([48.775, 9.182], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    
    loadFromLocal();
    
    map.locate({setView: true, maxZoom: 16});
    map.on('locationfound', e => {
        if (myLocationMarker) map.removeLayer(myLocationMarker);
        myLocationMarker = L.marker(e.latlng, {title: "Du bist hier"}).addTo(map);
    });

    map.on('click', e => openSelectionPopup(e.latlng));
}

async function loadFromLocal() {
    try {
        const doc = await localDB.get('reports_masterlist');
        reportsData = doc.data || [];
        drawMarkersOnMap();
    } catch (err) { console.log("Keine Daten"); }
}

function drawMarkersOnMap() {
    Object.values(activeMarkers).forEach(m => map.removeLayer(m));
    activeMarkers = {};

    reportsData.forEach(r => {
        // Innerhalb der reportsData.forEach Schleife:
let emoji = "📍";
if (r.typ.includes("Treppe")) emoji = "🪜";
if (r.typ.includes("defekt")) emoji = "⚠️";
if (r.typ.includes("Aufzug OK")) emoji = "🛗";
if (r.typ.includes("WC")) emoji = "🚽";
if (r.typ.includes("Parkplatz")) emoji = "🅿️";
if (r.typ.includes("Baustelle")) emoji = "🚧";

        const icon = L.divIcon({
            html: `<div class="custom-marker" style="background:${r.farbe}; width:30px; height:30px; display:flex; align-items:center; justify-content:center;">${emoji}</div>`,
            className: '', iconSize: [30, 30]
        });
        const m = L.marker([r.lat, r.lng], {icon}).addTo(map);
        m.bindPopup(`<b>${r.typ}</b><br>${r.kommentar}<br><button onclick="deleteReport('${r.id}')">Löschen</button>`);
        activeMarkers[r.id] = m;
    });
}

function openSelectionPopup(latlng) {
  // Wir definieren das Design direkt hier als Text, um Leaflet zu überstimmen
  const content = `
    <div style="width: 280px !important; font-family: sans-serif; padding: 10px; background: white;">
      <b style="font-size: 1.2em; display: block; text-align: center; margin-bottom: 15px; color: #333;">Eintrag hinzufügen</b>
      
      <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
        
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Treppe', '#E74C3C')" 
          style="background:#E74C3C; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; display: flex; align-items: center; width: 100%; box-sizing: border-box;">
          <span style="font-size: 20px; margin-right: 15px;">🪜</span> Treppe melden
        </button>
        
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Aufzug defekt', '#E67E22')" 
          style="background:#E67E22; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; display: flex; align-items: center; width: 100%; box-sizing: border-box;">
          <span style="font-size: 20px; margin-right: 15px;">⚠️</span> Aufzug defekt
        </button>
        
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Parkplatz', '#3498DB')" 
          style="background:#3498DB; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; display: flex; align-items: center; width: 100%; box-sizing: border-box;">
          <span style="font-size: 20px; margin-right: 15px;">🅿️</span> Parkplatz
        </button>
        
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'WC barrierefrei', '#2ECC71')" 
          style="background:#2ECC71; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; display: flex; align-items: center; width: 100%; box-sizing: border-box;">
          <span style="font-size: 20px; margin-right: 15px;">🚽</span> WC barrierefrei
        </button>
        
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Aufzug OK', '#27AE60')" 
          style="background:#27AE60; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; display: flex; align-items: center; width: 100%; box-sizing: border-box;">
          <span style="font-size: 20px; margin-right: 15px;">🛗</span> Aufzug OK
        </button>

      </div>
      <p style="text-align:center; font-size: 10px; color: #999; margin-top: 10px;">Zum Abbrechen daneben tippen</p>
    </div>`;

  // maxWidth sorgt dafür, dass Leaflet das Fenster groß genug macht
  L.popup({ maxWidth: 320, minWidth: 280 })
    .setLatLng(latlng)
    .setContent(content)
    .openOn(map);
}

// Diese Funktion verarbeitet den Klick und speichert alles ab
function finalizeReport(lat, lng, typ, farbe) {
    const id = "ID_" + Date.now();
    const kommentar = ""; // Kann man später noch per prompt abfragen
    reportsData.push({id, lat, lng, typ, farbe, kommentar, zeit: new Date().toLocaleTimeString()});
    
    drawMarkersOnMap(); // Sofort zeichnen
    saveToServer();     // In PouchDB speichern
    map.closePopup();   // Fenster schließen
}
// Und diese Hilfsfunktion für das Speichern per Klick:
function finalizeReport(lat, lng, typ, farbe) {
    const id = "ID_" + Date.now();
    reportsData.push({id, lat, lng, typ, farbe, kommentar: "Per Klick gemeldet", zeit: new Date().toLocaleTimeString()});
    drawMarkersOnMap();
    saveToServer();
    map.closePopup();
}


function sendReport(typ, farbe) {
    if (myLocationMarker) {
        const pos = myLocationMarker.getLatLng();
        const kommentar = prompt("Details (optional):") || "";
        const id = "ID_" + Date.now();
        reportsData.push({id, lat: pos.lat, lng: pos.lng, typ, farbe, kommentar, zeit: new Date().toLocaleTimeString()});
        drawMarkersOnMap();
        saveToServer();
    } else { alert("Standort noch nicht gefunden!"); }
}

async function saveToServer() {
    const doc = {_id: 'reports_masterlist', data: reportsData};
    const old = await localDB.get('reports_masterlist').catch(() => null);
    if (old) doc._rev = old._rev;
    await localDB.put(doc);
}

function generateQR() {
    const qrContainer = document.getElementById("qrcode");
    const overlay = document.getElementById("qr-overlay");
    
    // 1. Altes löschen
    qrContainer.innerHTML = "";
    
    // 2. Das Fenster erst SICHTBAR machen
    overlay.style.display = "flex";

    // 3. Einen winzigen Moment warten (100ms), damit der Browser das Fenster gezeichnet hat
    setTimeout(() => {
        try {
            const dataString = JSON.stringify(reportsData);
            
            // Check, ob überhaupt Daten da sind
            if (reportsData.length === 0) {
                qrContainer.innerHTML = "<p style='color:black; padding:20px;'>Keine Marker zum Teilen vorhanden!</p>";
                return;
            }

            new QRCode(qrContainer, {
                text: dataString,
                width: 220,
                height: 220,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.L // Level L verträgt mehr Daten
            });
        } catch (err) {
            console.error("QR Fehler:", err);
            qrContainer.innerHTML = "<p style='color:black;'>Fehler: Zu viele Daten!</p>";
        }
    }, 100); 
}

function scanQR() {
    const val = prompt("QR-Text hier einfügen:");
    if (val) {
        try {
            reportsData = JSON.parse(val);
            drawMarkersOnMap();
            saveToServer();
        } catch(e) { alert("Ungültiger Code"); }
    }
}

function deleteReport(id) {
    reportsData = reportsData.filter(r => r.id !== id);
    drawMarkersOnMap();
    saveToServer();
}

window.onload = initMap;
