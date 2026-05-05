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
  const content = `
    <div style="font-family: sans-serif; text-align: center; min-width: 200px;">
      <b style="font-size: 1.1em;">Was möchtest du melden?</b><br><br>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Treppe', '#E74C3C')" style="background:#E74C3C; color:white; border:none; padding:10px; border-radius:5px;">🪜 Treppe</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Aufzug defekt', '#E67E22')" style="background:#E67E22; color:white; border:none; padding:10px; border-radius:5px;">🛗 Defekt</button>
        
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Parkplatz', '#3498DB')" style="background:#3498DB; color:white; border:none; padding:10px; border-radius:5px;">🅿️ Parken</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'WC barrierefrei', '#2ECC71')" style="background:#2ECC71; color:white; border:none; padding:10px; border-radius:5px;">🚽 WC</button>
        
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Aufzug OK', '#27AE60')" style="background:#27AE60; color:white; border:none; padding:10px; border-radius:5px;">🛗 Aufzug</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Ort barrierefrei', '#9B59B6')" style="background:#9B59B6; color:white; border:none; padding:10px; border-radius:5px;">📍 Ort</button>
      </div>
      <p style="font-size: 0.8em; color: #666; margin-top: 10px;">Tippe auf ein Symbol zum Melden</p>
    </div>`;
  L.popup().setLatLng(latlng).setContent(content).openOn(map);
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
    document.getElementById("qrcode").innerHTML = "";
    document.getElementById("qr-overlay").style.display = "flex";
    new QRCode(document.getElementById("qrcode"), {
        text: JSON.stringify(reportsData),
        width: 250, height: 250
    });
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
