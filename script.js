async function hashPass(text) {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- COMMUNITY SETUP ---
const PANTRY_ID = "d9785260-5904-4964-ba0b-8389092f3adb"; 
const BASKET_NAME = "freeway_stuttgart"; 
const PANTRY_URL = `https://getpantry.cloud/apiv1/pantry/${PANTRY_ID}/basket/${BASKET_NAME}`;

let map, myLocationMarker, reportsData = [], activeMarkers = {};



async function initApp() {
    const splash = document.getElementById('splash-screen');

    // Karte erstellen
    map = L.map('map').setView([48.775, 9.182], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    
    // Klick-Event für neue Marker
    map.on('click', e => openSelectionPopup(e.latlng));

    // STANDORT-TRACKING AKTIVIEREN
    setupLocationTracking();

    // DATEN LADEN
    updateStatus("Lade Community-Daten...", "#3498db");
    try {
        await loadFromCommunity();
        updateStatus("Community Live ✅", "#27AE60");
    } catch (e) {
        updateStatus("Eingeschränkt bereit ⚠️", "#E67E22");
    }

    // SPLASH SCREEN ÜBERGANG
    setTimeout(() => {
        if(splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
                map.invalidateSize();
            }, 800);
        }
    }, 1000);
}

// 2. Die neue Standort-Funktion (Tracking)
function setupLocationTracking() {
    // Blaues Design für deinen Standort
    const locationIcon = L.divIcon({
        html: `<div style="background:#3498db; width:12px; height:12px; border-radius:50%; border:3px solid white; box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>`,
        className: '',
        iconSize: [18, 18]
    });

    map.locate({watch: true, enableHighAccuracy: true});

    map.on('locationfound', e => {
        if (myLocationMarker) {
            myLocationMarker.setLatLng(e.latlng);
        } else {
            myLocationMarker = L.marker(e.latlng, {icon: locationIcon}).addTo(map);
            myLocationMarker.bindPopup("Du bist hier");
            map.setView(e.latlng, 16); // Beim ersten Finden zentrieren
        }
    });

    map.on('locationerror', () => {
        console.warn("Standort konnte nicht gefunden werden.");
    });
}

// --- COMMUNITY LOGIK ---

async function loadFromCommunity() {
    try {
        const response = await fetch(PANTRY_URL);
        if (response.ok) {
            const result = await response.json();
            reportsData = result.markers || [];
            drawMarkersOnMap();
        }
    } catch (err) {
        console.error("Ladefehler:", err);
    }
}

async function saveToCommunity() {
    updateStatus("Speichere...", "#f39c12");
    try {
        await fetch(PANTRY_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ markers: reportsData })
        });
        updateStatus("Community Live ✅", "#27AE60");
    } catch (err) {
        alert("Speichern fehlgeschlagen.");
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
        if (r.typ.includes("defekt")) emoji = "🛗";
        if (r.typ.includes("WC")) emoji = "🚽";
        if (r.typ.includes("Parkplatz")) emoji = "🅿️";
        if (r.typ.includes("Aufzug")) emoji = "🛗";
        if (r.typ.includes("Baustelle")) emoji = "🚧";

        const icon = L.divIcon({
            html: `<div style="background:${r.farbe}; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:2px solid white; color:white;">${emoji}</div>`,
            className: '', 
            iconSize: [30, 30]
        });

        const m = L.marker([r.lat, r.lng], {icon}).addTo(map);
        
        // REPARIERTER GOOGLE MAPS LINK
        const gMapsUrl = `https://www.google.com/maps?q=${r.lat},${r.lng}`;

        const popupContent = `
            <div style="font-family:sans-serif; min-width:180px;">
                <b>${r.typ}</b><br>
                <p style="margin: 5px 0;">${r.kommentar}</p>
                <div style="background:#eee; padding:5px; border-radius:5px; text-align:center; margin-bottom:10px; font-size: 0.9em;">
                    Vertrauen: <b>${r.votes || 0}</b>
                </div>
                <div style="display:flex; gap:5px; margin-bottom:10px;">
                    <button onclick="vote('${r.id}', 1)" style="flex:1; background:#27AE60; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer; font-weight:bold;">✅ Stimmt</button>
                    <button onclick="vote('${r.id}', -1)" style="flex:1; background:#E67E22; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer; font-weight:bold;">❌ Falsch</button>
                </div>
                <a href="${gMapsUrl}" target="_blank" style="text-decoration:none;">
                    <button style="background:#4285F4; color:white; border:none; padding:10px; width:100%; border-radius:5px; margin-bottom:10px; cursor:pointer; font-weight:bold;">🗺️ Google Maps</button>
                </a>
                <button onclick="adminDelete(${index})" style="background:none; color:#999; border:none; font-size:10px; cursor:pointer; width:100%; margin-top:5px;">⚙️ Admin-Löschung</button>
            </div>`; 

        m.bindPopup(popupContent);
        activeMarkers[index] = m;
    }); 
}

// ... (Restliche Funktionen: openSelectionPopup, finalizeReport, vote, adminDelete bleiben gleich) ...

function openSelectionPopup(latlng) {
  const content = `
    <div style="width: 280px !important; font-family: sans-serif; padding: 10px; background: white;">
      <b style="font-size: 1.2em; display: block; text-align: center; margin-bottom: 15px; color: #333;">Eintrag hinzufügen</b>
      <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Treppe', '#E74C3C')" style="background:#E74C3C; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; display: flex; align-items: center; width: 100%;"><span style="font-size: 20px; margin-right: 15px;">🪜</span> Treppe melden</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Aufzug defekt', '#E67E22')" style="background:#E67E22; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; display: flex; align-items: center; width: 100%;"><span style="font-size: 20px; margin-right: 15px;">🛗</span> Aufzug defekt</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Baustelle', '#F1C40F')" style="background:#F1C40F; color:black; border:none; padding:12px; border-radius:8px; font-weight:bold; display: flex; align-items: center; width: 100%;"><span style="font-size: 20px; margin-right: 15px;">🚧</span> Baustelle / Sperrung</button>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 5px 0;">
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Aufzug vorhanden', '#27AE60')" style="background:#27AE60; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; display: flex; align-items: center; width: 100%;"><span style="font-size: 20px; margin-right: 15px;">🛗</span> Aufzug vorhanden</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'WC barrierefrei', '#2ECC71')" style="background:#2ECC71; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; display: flex; align-items: center; width: 100%;"><span style="font-size: 20px; margin-right: 15px;">🚽</span> WC barrierefrei</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Parkplatz', '#3498DB')" style="background:#3498DB; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; display: flex; align-items: center; width: 100%;"><span style="font-size: 20px; margin-right: 15px;">🅿️</span> Behinderten-Parkplatz</button>
        <button onclick="finalizeReport(${latlng.lat}, ${latlng.lng}, 'Barrierefreier Ort', '#9B59B6')" style="background:#9B59B6; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; display: flex; align-items: center; width: 100%;"><span style="font-size: 20px; margin-right: 15px;">📍</span> Barrierefreier Ort</button>
      </div>
    </div>`;

  L.popup({ maxWidth: 320, minWidth: 280 }).setLatLng(latlng).setContent(content).openOn(map);
}

function finalizeReport(lat, lng, typ, farbe) {
    const details = prompt(`Zusatzinfos für ${typ}:`, "");
    reportsData.push({
        lat: lat, lng: lng, typ: typ, farbe: farbe, 
        kommentar: details || "", id: "id_" + Date.now(), votes: 0
    });
    drawMarkersOnMap();
    saveToCommunity();
    map.closePopup();
}

async function vote(id, change) {
    const report = reportsData.find(r => r.id === id);
    if (report) {
        report.votes += change;
        if (report.votes <= -3) {
            reportsData = reportsData.filter(r => r.id !== id);
        }
        drawMarkersOnMap();
        saveToCommunity();
    }
}

async function adminDelete(index) {
    // 1. Das Eingabefeld abfragen
    const input = prompt("Bitte Admin-Passwort eingeben:");
    
    // Abbrechen, wenn nichts eingegeben wurde
    if (input === null || input === "") return;

    try {
        // 2. Die Eingabe hashen
        const hashedInput = await hashPass(input);
        
        // 3. Der "Salat" deines Passworts
        const targetHash = "934e62a046c82705707767d49826372f8546b3f7f892404e4e94326f212284c8";

        // 4. Vergleich
        if (hashedInput === targetHash) {
            // Wenn korrekt: Hier deine Lösch-Funktion aufrufen
            actualDeleteLogic(index); 
        } else {
            alert("Falsches Passwort!");
        }
    } catch (e) {
        console.error("Fehler beim Hashen:", e);
        alert("Sicherheitsfehler im Browser.");
    }
}

// Start der App
window.onload = initApp;
