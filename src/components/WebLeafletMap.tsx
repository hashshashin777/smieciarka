import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { PostItem } from '../types';

interface WebLeafletMapProps {
  items: PostItem[];
  selectedItem?: PostItem | null;
  onSelectItem?: (item: PostItem | null) => void;
  onOpenDetail?: (item: PostItem) => void;
  centerLat: number;
  centerLng: number;
  zoom?: number;
  userCoords?: { latitude: number; longitude: number } | null;
  isDark?: boolean;
  style?: any;
}

export const WebLeafletMap: React.FC<WebLeafletMapProps> = ({
  items,
  selectedItem,
  onSelectItem,
  onOpenDetail,
  centerLat,
  centerLng,
  zoom = 13,
  userCoords,
  isDark = false,
  style,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Serializacja danych ogłoszeń do lekkiej postaci
  const serializedItems = useMemo(() => {
    return items
      .filter(
        (it) =>
          it.location &&
          typeof it.location.latitude === 'number' &&
          typeof it.location.longitude === 'number' &&
          !isNaN(it.location.latitude) &&
          !isNaN(it.location.longitude)
      )
      .map((it) => ({
        id: it.id,
        title: it.title || 'Wystawka',
        type: it.type || 'wystawka',
        category: it.category || 'inne',
        lat: it.location.latitude,
        lng: it.location.longitude,
        address: it.location.address || '',
        photo: it.photos && it.photos.length > 0 ? it.photos[0] : null,
      }));
  }, [items]);

  // Nasłuchiwanie na interakcje z wnętrza iframe (kliknięcie pinezki, przycisku szczegółów)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = event.data;
        if (!data || typeof data !== 'object') return;

        if (data.type === 'SELECT_PIN' && data.id) {
          const found = items.find((it) => it.id === data.id);
          if (found && onSelectItem) {
            onSelectItem(found);
          }
        } else if (data.type === 'OPEN_DETAIL' && data.id) {
          const found = items.find((it) => it.id === data.id);
          if (found && onOpenDetail) {
            onOpenDetail(found);
          }
        }
      } catch {
        // Ignoruj obce komunikaty
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [items, onSelectItem, onOpenDetail]);

  // Reagowanie na zmianę wybranego miasta / współrzędnych bez przeładowywania iframe
  useEffect(() => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return;
    try {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'SET_CENTER',
          lat: centerLat,
          lng: centerLng,
          zoom: zoom,
        },
        '*'
      );
    } catch {
      // Ignoruj
    }
  }, [centerLat, centerLng, zoom]);

  // Dynamiczne generowanie dokumentu HTML z pełną obsługą Leaflet i kafelków OpenStreetMap
  const htmlContent = useMemo(() => {
    const rawItemsJson = JSON.stringify(serializedItems);
    const userCoordsJson = userCoords
      ? JSON.stringify({ lat: userCoords.latitude, lng: userCoords.longitude })
      : 'null';
    const selectedIdJson = JSON.stringify(selectedItem ? selectedItem.id : null);

    return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    
    /* Własne ikony pinezek */
    .pin-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 44px;
      cursor: pointer;
      filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3));
      transition: transform 0.15s ease;
    }
    .pin-wrapper:hover {
      transform: scale(1.15) translateY(-3px);
    }
    .pin-wrapper.selected {
      transform: scale(1.25) translateY(-5px);
      filter: drop-shadow(0 0 8px rgba(35, 229, 219, 0.9));
    }
    
    /* GPS puls */
    .user-gps-dot {
      width: 18px;
      height: 18px;
      background: #2563EB;
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 0 10px rgba(37, 99, 235, 0.8);
      position: relative;
    }
    .user-gps-pulse {
      position: absolute;
      top: -8px;
      left: -8px;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(37, 99, 235, 0.35);
      animation: pulse 2s infinite ease-out;
    }
    @keyframes pulse {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.8); opacity: 0; }
    }

    /* Popup */
    .leaflet-popup-content-wrapper {
      padding: 0;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.2);
    }
    .leaflet-popup-content {
      margin: 0;
      line-height: 1.4;
      width: 230px !important;
    }
    .popup-box {
      display: flex;
      flex-direction: column;
    }
    .popup-img {
      width: 100%;
      height: 110px;
      object-fit: cover;
      background: #E2E8F0;
    }
    .popup-body {
      padding: 10px 12px;
    }
    .popup-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 7px;
      border-radius: 6px;
      margin-bottom: 4px;
      color: #FFFFFF;
    }
    .badge-wystawka { background: #F59E0B; }
    .badge-oddam { background: #10B981; }
    .popup-title {
      font-size: 14px;
      font-weight: 700;
      color: #0F172A;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .popup-address {
      font-size: 11px;
      color: #64748B;
      margin-bottom: 10px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .popup-btn {
      display: block;
      width: 100%;
      padding: 7px 0;
      background: #064E3B;
      color: #FFFFFF;
      font-size: 12px;
      font-weight: 700;
      text-align: center;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .popup-btn:hover {
      background: #047857;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const items = ${rawItemsJson};
    const userPos = ${userCoordsJson};
    const initialCenter = [${centerLat}, ${centerLng}];
    const initialZoom = ${zoom};
    const selectedId = ${selectedIdJson};

    const map = L.map('map', {
      zoomControl: true,
      attributionControl: true
    }).setView(initialCenter, initialZoom);

    // Standardowe, niezawodne kafelki OpenStreetMap 2D (bez WebGL)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // SVG ikony pinezek
    function createPinSvg(type, isSelected) {
      const isWystawka = type === 'wystawka';
      const mainColor = isWystawka ? '#F59E0B' : '#10B981';
      const innerColor = isWystawka ? '#D97706' : '#059669';
      // Ikona ciężarówki dla wystawki lub prezentu dla do oddania
      const iconPath = isWystawka
        ? '<path d="M11 15v4h2v-4h4v4h2v-4h1a2 2 0 0 1 2 2v3h-1a3 3 0 0 0-6 0h-4a3 3 0 0 0-6 0H5v-7a2 2 0 0 1 2-2h4zm11 2v3h2.5l1.5-3H22zm-12 7a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm10 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" fill="#FFF"/>'
        : '<path d="M12 11h8a1 1 0 0 1 1 1v2h-10v-2a1 1 0 0 1 1-1zm-2 4h12v7a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-7zm6-4V7a2 2 0 1 0-2 2h2zm2 0h2a2 2 0 1 0-2-2v2z" fill="#FFF"/>';

      return \`
        <div class="pin-wrapper \${isSelected ? 'selected' : ''}">
          <svg width="36" height="44" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 0C8.06 0 0 8.06 0 18C0 31.5 18 44 18 44C18 44 36 31.5 36 18C36 8.06 27.94 0 18 0Z" fill="\${mainColor}"/>
            <circle cx="18" cy="18" r="13" fill="\${innerColor}"/>
            <g transform="translate(2, 2) scale(0.9)">
              \${iconPath}
            </g>
          </svg>
        </div>
      \`;
    }

    const markersMap = {};

    items.forEach(item => {
      const isSelected = selectedId && item.id === selectedId;
      const customIcon = L.divIcon({
        className: 'custom-leaflet-icon',
        html: createPinSvg(item.type, isSelected),
        iconSize: [36, 44],
        iconAnchor: [18, 44],
        popupAnchor: [0, -42]
      });

      const marker = L.marker([item.lat, item.lng], { icon: customIcon }).addTo(map);
      markersMap[item.id] = marker;

      // Zawartość okna podręcznego
      const isWystawka = item.type === 'wystawka';
      const badgeClass = isWystawka ? 'badge-wystawka' : 'badge-oddam';
      const badgeText = isWystawka ? 'Wystawka' : 'Do oddania';
      const imgHtml = item.photo ? \`<img src="\${item.photo}" class="popup-img" alt="\${item.title}" />\` : '';

      const popupContent = \`
        <div class="popup-box">
          \${imgHtml}
          <div class="popup-body">
            <span class="popup-badge \${badgeClass}">\${badgeText}</span>
            <div class="popup-title">\${item.title}</div>
            <div class="popup-address">\${item.address || 'Sprawdź lokalizację'}</div>
            <button class="popup-btn" onclick="openDetail('\${item.id}')">Zobacz szczegóły</button>
          </div>
        </div>
      \`;

      marker.bindPopup(popupContent);

      marker.on('click', () => {
        window.parent.postMessage({ type: 'SELECT_PIN', id: item.id }, '*');
      });
    });

    // Pinezka lokalizacji użytkownika GPS
    if (userPos && typeof userPos.lat === 'number' && typeof userPos.lng === 'number') {
      const userIcon = L.divIcon({
        className: 'user-gps-container',
        html: '<div class="user-gps-dot"><div class="user-gps-pulse"></div></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });
      L.marker([userPos.lat, userPos.lng], { icon: userIcon })
        .addTo(map)
        .bindPopup('<b>Twoja lokalizacja (GPS)</b>');
    }

    // Wywołanie otwarcia szczegółów ogłoszenia
    window.openDetail = function(id) {
      window.parent.postMessage({ type: 'OPEN_DETAIL', id: id }, '*');
    };

    // Obsługa komunikatów od nadrzędnej aplikacji React
    window.addEventListener('message', function(event) {
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'SET_CENTER') {
        map.setView([event.data.lat, event.data.lng], event.data.zoom || 13, { animate: true });
      }
    });
  </script>
</body>
</html>`;
  }, [serializedItems, userCoords, centerLat, centerLng, zoom, selectedItem]);

  return (
    <View style={[styles.container, style]}>
      {Platform.OS === 'web' ? (
        <iframe
          ref={iframeRef as any}
          title="Interaktywna Mapa Wystawka"
          srcDoc={htmlContent}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          } as any}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
});
