// --- COMMUNITY SETUP ---
// Ersetze 'DEINE_PANTRY_ID' mit der ID, die du auf getpantry.cloud bekommst
const PANTRY_ID = "d9785260-5904-4964-ba0b-8389092f3adb"; 
const BASKET_NAME = "freeway_stuttgart";
const PANTRY_URL = `https://getpantry.cloud/apiv1/pantry/${PANTRY_ID}/basket/${BASKET_NAME}`;

let map, myLocationMarker, reportsData = [], activeMarkers = {};

function initMap() {
    map = L.map('map').setView([48.775, 9.182], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    
    // Beim Start: Daten von der Community laden
    loadFromCommunity();

    map.locate({setView: true, maxZoom: 16});
    map.on('locationfound', e => {
        if (myLocationMarker) map.removeLayer(myLocationMarker);
        myLocationMarker = L.marker(e.latlng).addTo(map);
    });
    map.on('click', e => openSelectionPopup(e.latlng));
}

// DATEN LADEN (Community)
async function loadFromCommunity() {
    updateStatus("Lade Daten...", "#34495e");
    try {
        const response = await fetch(PANTRY_URL);
        if (response.ok) {
            const result = await response.json();
            reportsData = result.markers || [];
            drawMarkersOnMap();
            updateStatus("Community Live ✅", "#27AE60");
        } else {
            updateStatus("Neu hier? Erster Marker...", "#E67E22");
        }
    } catch (err) {
        updateStatus("Offline-Modus ⚠️", "#7f8c8d");
    }
}

// DATEN SPEICHERN (Community)
async function saveToCommunity() {
    updateStatus("Speichere...", "#f39c12");
    try {
        await fetch(PANTRY_URL, {
            method: 'POST', // Pantry nutzt POST zum Updaten des Baskets
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ markers: reportsData })
        });
        updateStatus("Community Live ✅", "#27AE60");
    } catch (err) {
        alert("Speichern fehlgeschlagen. Keine Internetverbindung?");
    }
}

function updateStatus(text, color) {
    const s = document.getElementById('sync-status');
    if(s) {
        s.innerHTML = text;
        s.style.background = color;
        s.style.color = "white";
    }
}

function drawMarkersOnMap() {
    Object.values(activeMarkers).forEach(m => map.removeLayer(m));
    activeMarkers = {};

    reportsData.forEach((r, index) => {
let emoji = "📍";
if (r.typ.includes("Treppe")) emoji = "🪜";
if (r.typ.includes("defekt")) emoji = "⚠️";
if (r.typ.includes("WC")) emoji = "🚽";
if (r.typ.includes("Parkplatz")) emoji = "🅿️";
if (r.typ.includes("Aufzug")) emoji = "🛗"; // Findet jetzt beide Aufzug-Typen
if (r.typ.includes("Bau")) emoji = "🚧";


        const icon = L.divIcon({
            html: `<div class="custom-marker" style="background:${r.farbe}; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:2px solid white;">${emoji}</div>`,
            className: '', iconSize: [30, 30]
        });
        const m = L.marker([r.lat, r.lng], {icon}).addTo(map);
        m.bindPopup(`<b>${r.typ}</b><br><button onclick="deleteReport(${index})">Löschen</button>`);
        activeMarkers[index] = m;
    });
}

function openSelectionPopup(latlng) {
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

        <hr style="border: 0; border-top: 1px solid #eee; margin: 5px 0;">

        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Aufzug vorhanden', '#27AE60')" 
          style="background:#27AE60; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; display: flex; align-items: center; width: 100%; box-sizing: border-box;">
          <span style="font-size: 20px; margin-right: 15px;">🛗</span> Aufzug vorhanden
        </button>

        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'WC barrierefrei', '#2ECC71')" 
          style="background:#2ECC71; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; display: flex; align-items: center; width: 100%; box-sizing: border-box;">
          <span style="font-size: 20px; margin-right: 15px;">🚽</span> WC barrierefrei
        </button>
        
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Parkplatz', '#3498DB')" 
          style="background:#3498DB; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; display: flex; align-items: center; width: 100%; box-sizing: border-box;">
          <span style="font-size: 20px; margin-right: 15px;">🅿️</span> Behinderten-Parkplatz
        </button>
        
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Barrierefreier Ort', '#9B59B6')" 
          style="background:#9B59B6; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; display: flex; align-items: center; width: 100%; box-sizing: border-box;">
          <span style="font-size: 20px; margin-right: 15px;">📍</span> Barrierefreier Ort
        </button>

      </div>
      <p style="text-align:center; font-size: 10px; color: #999; margin-top: 10px;">Zum Abbrechen daneben tippen</p>
    </div>`;

  L.popup({ maxWidth: 320, minWidth: 280 })
    .setLatLng(latlng)
    .setContent(content)
    .openOn(map);
}

function finalizeReport(lat, lng, typ, farbe) {
    reportsData.push({lat, lng, typ, farbe, zeit: new Date().toLocaleTimeString()});
    drawMarkersOnMap();
    saveToCommunity();
    map.closePopup();
}

function sendReport(typ, farbe) {
    if (myLocationMarker) {
        const pos = myLocationMarker.getLatLng();
        finalizeReport(pos.lat, pos.lng, typ, farbe);
    } else { alert("Suche Standort..."); }
}

function deleteReport(index) {
    reportsData.splice(index, 1);
    drawMarkersOnMap();
    saveToCommunity();
}

window.onload = initMap;
