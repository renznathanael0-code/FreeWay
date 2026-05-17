
const isAdminPage = window.location.pathname.includes("admin.html");

if (isAdminPage) {
    const login = prompt("StepFree Admin-Bereich\nBitte Passwort eingeben:");
    if (btoa(login) !== "ZldpUyE=") { 
        alert("Zugriff verweigert!");
        window.location.href = "index.html"; 
    }
}

const PANTRY_ID = "d9785260-5904-4964-ba0b-8389092f3adb"; 
const BASKET_NAME = "freeway_stuttgart";
const PANTRY_URL = `https://getpantry.cloud/apiv1/pantry/${PANTRY_ID}/basket/${BASKET_NAME}`;

let map, myLocationMarker, reportsData = [], activeMarkers = {};

async function initApp() {
    const splash = document.getElementById('splash-screen');

    map = L.map('map').setView([48.775, 9.182], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    
    map.on('click', e => openSelectionPopup(e.latlng));

    setupLocationTracking();

    updateStatus("Lade Community-Daten...", "#3498db");
    try {
        await loadFromCommunity();
        updateStatus("Community Live ✅", "#27AE60");
    } catch (e) {
        updateStatus("Eingeschränkt bereit ⚠️", "#E67E22");
    }

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

function setupLocationTracking() {
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
    // 1. Prüfen: Sind wir auf der Admin-Seite?
    const isAdminPage = window.location.pathname.includes("admin.html");

    // 2. Karte säubern
    Object.values(activeMarkers).forEach(m => map.removeLayer(m));
    activeMarkers = {};

    // 3. Marker durchlaufen
    reportsData.forEach((r, index) => {
        
        // SICHERHEITS-CHECK FÜR BÜRGER:
        // Wenn der Punkt im "review" ist (wegen -3 Votes), sieht ihn nur der Admin
        if (r.status === "review" && !isAdminPage) {
            return; 
        }

        let emoji = "📍";
        if (r.typ.includes("Treppe")) emoji = "🪜";
        if (r.typ.includes("defekt")) emoji = "🛗";
        if (r.typ.includes("WC")) emoji = "🚽";
        if (r.typ.includes("Parkplatz")) emoji = "🅿️";
        if (r.typ.includes("Aufzug")) emoji = "🛗";
        if (r.typ.includes("Baustelle")) emoji = "🚧";

        const icon = L.divIcon({
            html: `<div style="background:${r.farbe}; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:2px solid white; color:white; ${r.status === 'review' ? 'box-shadow: 0 0 10px red; border: 2px solid red;' : ''}">${emoji}</div>`,
            className: '', 
            iconSize: [30, 30]
        });

        const m = L.marker([r.lat, r.lng], {icon}).addTo(map);
        const gMapsUrl = `https://www.google.com/maps?q=${r.lat},${r.lng}`;
        
        // POPUP INHALT AUFBAUEN
        let popupContent = `
            <div style="font-family:sans-serif; min-width:180px;">
                ${r.status === 'review' ? '<b style="color:red;">⚠️ IN PRÜFUNG</b><br>' : ''}
                <b>${r.typ}</b><br>
                <p style="margin: 5px 0;">${r.kommentar}</p>
                <div style="background:#eee; padding:5px; border-radius:5px; text-align:center; margin-bottom:10px; font-size: 0.9em;">
                    Vertrauen: <b>${r.votes || 0}</b>
                </div>`;

        // Normale Voting-Buttons (immer anzeigen)
        popupContent += `
                <div style="display:flex; gap:5px; margin-bottom:10px;">
                    <button onclick="vote('${r.id}', 1)" style="flex:1; background:#27AE60; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer; font-weight:bold;">✅ Stimmt</button>
                    <button onclick="vote('${r.id}', -1)" style="flex:1; background:#E67E22; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer; font-weight:bold;">❌ Falsch</button>
                </div>
                <a href="${gMapsUrl}" target="_blank" style="text-decoration:none;">
                    <button style="background:#4285F4; color:white; border:none; padding:10px; width:100%; border-radius:5px; margin-bottom:10px; cursor:pointer; font-weight:bold;">🗺️ Google Maps</button>
                </a>`;

        // SPEZIAL-BUTTONS NUR FÜR ADMINS
        if (isAdminPage) {
            popupContent += `
                <div style="border-top:1px solid #ccc; padding-top:10px; margin-top:5px;">
                    <button onclick="directDelete('${r.id}')" style="background:#e74c3c; color:white; border:none; padding:8px; width:100%; border-radius:5px; cursor:pointer; font-weight:bold; margin-bottom:5px;">🗑️ Endgültig Löschen</button>
                    <button onclick="askForPhoto('${r.id}')" style="background:#3498db; color:white; border:none; padding:8px; width:100%; border-radius:5px; cursor:pointer; font-weight:bold;">📸 Beweis anfordern</button>
                </div>`;
        } else {
            // Für Bürger: Ein Hinweis, wenn ein Beweis gefordert wurde
            // ... in der drawMarkersOnMap Funktion bei den Admin-Zusätzen ...
if (isAdminPage && r.evidencePhoto) {
    popupContent += `
        <div style="margin-top:10px;">
            <b style="color:green;">📸 Beweisfoto vorhanden:</b><br>
            <img src="${r.evidencePhoto}" style="width:100%; border-radius:5px; margin-top:5px; cursor:pointer;" onclick="window.open(this.src)">
        </div>`;
}
}

        popupContent += `</div>`; 

        m.bindPopup(popupContent);
        activeMarkers[index] = m;
    }); 
}

function directDelete(id) {
    if (confirm("Diesen Punkt wirklich für alle löschen?")) {
        reportsData = reportsData.filter(r => r.id !== id);
        saveToCommunity();
        drawMarkersOnMap();
    }
}

function askForPhoto(id) {
    const r = reportsData.find(item => item.id === id);
    if (r) {
        r.needsPhoto = true;
        r.status = "active"; // Wieder sichtbar machen, falls er im Review war
        saveToCommunity();
        drawMarkersOnMap();
        alert("Beweisfoto-Anforderung ist raus!");
    }
}

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
    if (!report) return;

    // Falls ein Foto angefordert wurde, muss erst das Foto kommen
    if (report.needsPhoto && !isAdminPage) {
        alert("Der Admin hat für diesen Punkt eine Verifizierung angefordert. Bitte mache ein Beweisfoto vor Ort.");
        startPhotoVerification(id);
        return; // Voten erst nach Foto möglich
    }

    // Normaler Voting-Ablauf
    let myVotes = JSON.parse(localStorage.getItem('userVotes') || "{}");
    if (myVotes[id]) return alert("Bereits abgestimmt!");

    report.votes += change;
    myVotes[id] = true;
    localStorage.setItem('userVotes', JSON.stringify(myVotes));

    if (report.votes <= -3) {
        report.status = "review";
    }

    saveToCommunity();
    drawMarkersOnMap();
}

function startPhotoVerification(id) {
    // 1. Standort prüfen
    navigator.geolocation.getCurrentPosition((pos) => {
        const report = reportsData.find(r => r.id === id);
        const dist = getDistance(pos.coords.latitude, pos.coords.longitude, report.lat, report.lng);

        if (dist > 0.05) { // 50 Meter
            alert(`Du bist zu weit weg (${Math.round(dist * 1000)}m). Gehe näher an das Hindernis heran.`);
            return;
        }

        // 2. Kamera öffnen (Input-Trick für Handys)
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.capture = 'environment'; // Öffnet direkt die Kamera auf dem Handy

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                // Bild im Report speichern
                report.evidencePhoto = event.target.result;
                report.needsPhoto = false; // Anforderung erfüllt
                report.votes += 1; // Belohnung für das Foto
                
                alert("Beweis erfolgreich hochgeladen! Danke für deine Hilfe.");
                saveToCommunity();
                drawMarkersOnMap();
            };
            reader.readAsDataURL(file); // Wandelt Bild in Text um
        };
        fileInput.click();
    }, () => alert("Standortzugriff erforderlich!"));
}

window.onload = initApp;
