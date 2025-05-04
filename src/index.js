import * as maplibregl from "maplibre-gl";
import { calculate } from './terminator.js';
import * as pmtiles from 'pmtiles';
import { getTimezoneInfo, formatZoneDisplay } from './timezone-utils';
import SunCalc from 'suncalc';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';

// 日の出入り時刻をフォーマットする関数
function formatSunTime(date, tzid) {
    return date ? date.toLocaleTimeString('ja-JP', {
        timeZone: tzid,
        hour: '2-digit',
        minute: '2-digit'
    }) : 'N/A';
}

// 現在の状態を取得する関数
function getSunState(times) {
    const now = new Date();
    if (now >= times.sunrise && now <= times.sunset) {
        return '🌞'; // 太陽（日中）
    } else if (now >= times.sunset || now < times.sunrise) {
        return '🌙'; // 月（夜間）
    }
    return '';
}

const protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles",protocol.tile);

const init_center = [139.76, 35.67];
const init_zoom = 2;
const init_bearing = 0;
const init_pitch = 0;

// URLパラメータから移動先の座標を取得
const urlParams = new URLSearchParams(window.location.search);
const paramLat = parseFloat(urlParams.get('lat'));
const paramLng = parseFloat(urlParams.get('lng'));

const map = new maplibregl.Map({
    container: 'map',
    style: 'https://tile.openstreetmap.jp/styles/osm-bright-ja/style.json',
    center: init_center,
    interactive: true,
    zoom: init_zoom,
    minZoom: 1,
    maxZoom: 10,
    bearing: init_bearing,
    pitch: init_pitch,
    attributionControl: false,
    renderWorldCopies: false,
    hash: false  // URLハッシュを無効化
});

// カスタム位置情報ボタンの作成
const geolocateButton = document.createElement('button');
geolocateButton.className = 'custom-geolocate';
geolocateButton.innerHTML = `
    <svg viewBox="0 0 24 24" fill="#404040">
        <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
    </svg>
`;

// 位置情報取得の処理
geolocateButton.addEventListener('click', () => {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const currentZoom = map.getZoom();
                const lngLat = {
                    lng: position.coords.longitude,
                    lat: position.coords.latitude
                };

                // 現在位置に移動
                map.flyTo({
                    center: [lngLat.lng, lngLat.lat],
                    zoom: currentZoom < 3 ? 3 : currentZoom,
                    duration: 1000,
                    essential: true
                });

                // 移動完了後にポップアップを表示
                map.once('moveend', () => {
                    showLocationPopup(lngLat);
                });
            },
            (error) => {
                console.error('Failed to get geolocation:', error);
                alert('Failed to get your location.');
            },
            {
                enableHighAccuracy: false,
                timeout: 5000,
                maximumAge: 0
            }
        );
    } else {
        alert('Your browser does not support geolocation.');
    }
});

// 検索ボックスの作成
const searchBox = document.createElement('div');
searchBox.className = 'search-box';
searchBox.innerHTML = `
    <input type="text" class="search-input" placeholder="Search location...">
    <button type="button" class="search-clear" aria-label="Clear search">
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
    </button>
    <div class="search-results"></div>
`;

// ボタンと検索ボックスを地図に追加
// URLコピーボタンの作成
const copyUrlButton = document.createElement('button');
copyUrlButton.className = 'copy-url-button';
copyUrlButton.innerHTML = `
    <svg viewBox="0 0 24 24" fill="#404040">
        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
    </svg>
`;

// URLをコピーする関数
window.copyLocationUrl = function(lng, lat) {
    // マップの移動が完了しているか確認
    if (map.isMoving()) {
        map.once('moveend', () => {
            // 移動完了後の座標を使用
            const center = map.getCenter();
            copyLocationUrl(center.lng, center.lat);
        });
        return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('lat', lat.toFixed(3));
    url.searchParams.set('lng', lng.toFixed(3));
    navigator.clipboard.writeText(url.toString())
        .then(() => {
            showToast('Location URL copied to clipboard');
        })
        .catch(err => {
            showToast('Failed to copy URL', 3000);
            console.error('Failed to copy URL:', err);
        });
}

// トースト通知を表示する関数
function showToast(message, duration = 1000) {
    // 既存のトーストを削除
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    // 新しいトーストを作成
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // トーストを表示
    setTimeout(() => toast.classList.add('show'), 10);

    // 指定時間後にトーストを非表示にし、その後削除
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// URLコピーの処理
copyUrlButton.addEventListener('click', () => {
    // マップの移動が完了しているか確認
    if (map.isMoving()) {
        map.once('moveend', () => {
            const center = map.getCenter();
            copyLocationUrl(center.lng, center.lat);
        });
        return;
    }
    const center = map.getCenter();
    copyLocationUrl(center.lng, center.lat);
});

const mapContainer = document.getElementById('map');
mapContainer.appendChild(geolocateButton);
mapContainer.appendChild(copyUrlButton);
mapContainer.appendChild(searchBox);

// 検索機能の実装
const searchInput = searchBox.querySelector('.search-input');
const searchResults = searchBox.querySelector('.search-results');
const searchClear = searchBox.querySelector('.search-clear');
let searchTimeout = null;
let currentPopup = null; // 現在表示中のポップアップを追跡

// クリアボタンの表示制御
const updateClearButton = () => {
    if (searchInput.value) {
        searchClear.classList.add('visible');
    } else {
        searchClear.classList.remove('visible');
    }
};

// 検索ボックスをクリアする関数
const clearSearch = () => {
    searchInput.value = '';
    searchResults.classList.remove('active');
    updateClearButton();
};

// クリアボタンのクリックイベント
searchClear.addEventListener('click', clearSearch);

// 検索結果を表示する関数
function showSearchResults(results) {
    const searchResults = searchBox.querySelector('.search-results');
    searchResults.innerHTML = '';

    if (results.length > 0) {
        results.forEach(result => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.textContent = result.display_name;

            item.addEventListener('click', () => {
                // 検索結果をクリア
                clearSearch();

                // 選択された位置に移動
                const lngLat = {
                    lng: parseFloat(result.lon),
                    lat: parseFloat(result.lat)
                };
                map.flyTo({
                    center: [lngLat.lng, lngLat.lat],
                    zoom: 3,
                    duration: 1000,
                });

                // 移動完了後にポップアップを表示
                map.once('moveend', () => {
                    showLocationPopup(lngLat);
                });
            });

            searchResults.appendChild(item);
        });

        searchResults.classList.add('active');
    } else {
        searchResults.classList.remove('active');
    }
}

// 検索入力のハンドリング
searchInput.addEventListener('input', (e) => {
    updateClearButton();
    const query = e.target.value.trim();

    // 前回のタイマーをクリア
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    // 入力が空の場合、結果を非表示に
    if (!query) {
        searchResults.classList.remove('active');
        return;
    }

    // 500msのデバウンスを設定
    searchTimeout = setTimeout(() => {
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => showSearchResults(data))
            .catch(error => console.error('Error:', error));
    }, 500);
});

// 検索結果以外をクリックしたときに結果を非表示に
document.addEventListener('click', (e) => {
    if (!searchBox.contains(e.target)) {
        searchResults.classList.remove('active');
    }
});

const attCntl = new maplibregl.AttributionControl({
    customAttribution:'Timezone data from <a href="https://www.naturalearthdata.com/downloads/10m-cultural-vectors/timezones/" target="_blank">Natural Earth</a> & <a href="https://github.com/evansiroky/timezone-boundary-builder" target="_blank">timezone-boundary-builder</a> | <a href="https://github.com/sanskruthiya/globeTerminator" target="_blank">GitHub</a> | <a href="https://form.run/@party--1681740493" target="_blank">Contact Form</a>',
    compact: true
});
map.addControl(attCntl, 'bottom-right');

const currentDate = new Date();
const geojsonData = calculate(currentDate);

map.on('load', () => {
    // Globe Projectionを設定
    map.setProjection({"type": "globe"});
    
    // Terminatorレイヤーを追加
    map.addSource('terminator', {
      'type': "geojson",
      'data': geojsonData
    });
    
    map.addSource('timezones_tbb', {
      'type': 'vector',
      'url': 'pmtiles://app/timezones_tbb.pmtiles',
      "minzoom": 0,
      "maxzoom": 9,
    });

    map.addSource('timezones_ne', {
      'type': 'vector',
      'url': 'pmtiles://app/timezones_ne.pmtiles',
      "minzoom": 0,
      "maxzoom": 3,
    });
    
    map.addLayer({
      'id': "terminator-layer",
      'type': "fill",
      'source': "terminator",
      'layout': {'visibility': "visible"},
      'paint': {
        'fill-color': "#333",
        'fill-opacity': 0.5,
        'fill-outline-color': "transparent",
      }
    });

    //timezone-boundary-builderベースのタイムゾーン情報を利用
    map.addLayer({
      'id': "timezone-tbb-layer",
      'type': "fill",
      'source': "timezones_tbb",
      'source-layer': 'timezoneswithoceansnow',
      'layout': {'visibility': "visible"},
      'paint': {
        'fill-color': "transparent",
        'fill-outline-color': "#999",
      }
    });

    //NaturalEarthベースのタイムゾーンRegion情報を利用
    map.addLayer({
      'id': "timezone-ne-layer",
      'type': "fill",
      'source': "timezones_ne",
      'source-layer': 'timezone',
      'layout': {'visibility': "visible"},
      'paint': {
        'fill-color': "transparent",
        'fill-outline-color': "#999",
      }
    });
    
    //NaturalEarthベースのタイムゾーン境界データを表示
    map.addLayer({
      'id': "timezone-line-layer",
      'type': "line",
      'source': "timezones_ne",
      'source-layer': 'timezone',
      'layout': {
            'visibility': 'visible',
            'line-join': 'bevel',
            'line-cap': 'butt'
      },
      'paint': {
            'line-color': '#fff',
            'line-opacity': ['interpolate',['linear'],['zoom'],0,1,3,1,5,0],
            'line-blur': 2,
            'line-width': 1.5
      }
    });

    map.setSky({
      'atmosphere-blend': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    0, 0.6,
                    5, 0.6,
                    7, 0
                ]
    });
    map.setLight({
      'anchor': 'viewport',
      'color': "white", 
      'intensity': 0.1,
      'position': [1.15,270,30]
    });

    // URLパラメータの座標が有効な場合、その位置に移動
    if (!isNaN(paramLat) && !isNaN(paramLng)) {
        map.flyTo({
            center: [paramLng, paramLat],
            duration: 1000,
            essential: true
        });

        // 移動完了後にポップアップを表示
        map.once('moveend', () => {
            const lngLat = {
                lng: paramLng,
                lat: paramLat
            };
            showLocationPopup(lngLat);
        });
    }
});

// ポップアップ表示の処理を関数化
function showLocationPopup(lngLat) {
    // 現在のポップアップを閉じる
    if (currentPopup) {
        currentPopup.remove();
    }

    // クリック位置の情報を取得
    const point = map.project(lngLat);
    const tzFeatures = map.queryRenderedFeatures(point, {
        layers: ['timezone-tbb-layer']  // timezone-boundary-builderのレイヤー
    });
    const regionFeatures = map.queryRenderedFeatures(point, {
        layers: ['timezone-ne-layer']  // Natural Earthのレイヤー
    });

    if (tzFeatures.length > 0 && regionFeatures.length > 0) {
        const tzProperties = tzFeatures[0].properties;
        const regionProperties = regionFeatures[0].properties;

        // タイムゾーン情報（時刻、DST等）
        const tzInfo = getTimezoneInfo(tzProperties.tzid);

        // 日の出入り時刻を計算
        const times = SunCalc.getTimes(new Date(), lngLat.lat, lngLat.lng);
        const sunrise = formatSunTime(times.sunrise, tzProperties.tzid);
        const sunset = formatSunTime(times.sunset, tzProperties.tzid);
        const sunState = getSunState(times);

        // 地域情報（Natural Earthから、なければタイムゾーンから）
        const displayRegion = regionProperties?.places || tzProperties.tzid.split('/')[0];

        const now = new Date();
        currentPopup = new maplibregl.Popup({
            closeButton: true,
            focusAfterOpen: false,
            className: `t-popup ${now >= times.sunrise && now <= times.sunset ? 'day' : 'night'}`,
            minWidth: '240px',
            maxWidth: '240px',
            anchor: 'bottom'
        })
        .setLngLat(lngLat)
        .setHTML(`
            <h3 id="currentTime">${sunState} ${tzInfo.time}</h3>
            <strong>Regions:</strong> ${regionProperties.places}<br>
            <strong>UTC Offset:</strong> ${regionProperties.utc_format}<br>
            <strong>Sunrise:</strong> ${sunrise}<br>
            <strong>Sunset:</strong> ${sunset}
            ${tzInfo.isDST ? '<br><div class="dst-notice">🌞 Summer Time (DST) is in effect</div>' : ''}
            <button class="popup-copy-button" onclick="copyLocationUrl(${lngLat.lng}, ${lngLat.lat})">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 1H4C2.9 1 2 1.9 2 3v14h2V3h12V1zm3 4H8C6.9 5 6 5.9 6 7v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                </svg>
                Copy URL with current location
            </button>
        `)
        .addTo(map);
    }
}

// クリック時の処理
map.on('click', (e) => {
    // マップの移動を開始
    map.panTo(e.lngLat, {duration:1000});
    
    // 移動完了後にポップアップを表示
    map.once('moveend', () => {
        showLocationPopup(e.lngLat);
    });
});


