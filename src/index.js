import * as maplibregl from "maplibre-gl";
import { calculate } from './terminator.js';
import * as pmtiles from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';

const protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles",protocol.tile);

const init_center = [139.76, 35.67];
const init_zoom = 2;
const init_bearing = 0;
const init_pitch = 0;

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
    renderWorldCopies: false
});

const attCntl = new maplibregl.AttributionControl({
    customAttribution:'<a href="https://www.naturalearthdata.com/downloads/10m-cultural-vectors/timezones/" target="_blank">Timezone data from Natural Earth</a> | <a href="https://github.com/sanskruthiya/globeTerminator" target="_blank">GitHub</a>',
    compact: true
});
map.addControl(attCntl, 'bottom-right');

const currentDate = new Date();
const geojsonData = calculate(currentDate);

map.on('load', () => {
    map.setProjection({"type": "globe"});
    
    map.addSource('terminator', {
      'type': "geojson",
      'data': geojsonData
    });
    
    map.addSource('timezone', {
      'type': 'vector',
      'url': 'pmtiles://app/timezone.pmtiles',
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

    map.addLayer({
      'id': "timezone-layer",
      'type': "fill",
      'source': "timezone",
      'source-layer': 'timezone',
      'layout': {'visibility': "visible"},
      'paint': {
        'fill-color': "transparent",
        'fill-outline-color': "#999",
      }
    });
    
    map.addLayer({
      'id': "timezone-line-layer",
      'type': "line",
      'source': "timezone",
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
});

map.on("click", (e) => {
  map.panTo(e.lngLat,{duration:1000});

  const features = map.queryRenderedFeatures(e.point, {
      layers: ["timezone-layer"]
  });

  if (features.length > 0) {
      const timezoneOffset = features[0].properties.zone;
      const currentTime = getCurrentTimeFromOffset(timezoneOffset);
      const areaName = features[0].properties.places;
      const timeZone = features[0].properties.time_zone;

      new maplibregl.Popup({closeButton:true, focusAfterOpen:false, className:'t-popup', minWidth:'210px',maxWidth:'210px', anchor:'bottom'})
          .setLngLat(e.lngLat)
          .setHTML(`<h3 id="currentTime">${currentTime}</h3><strong>Region:</strong> ${areaName}<br><strong>Timezone:</strong> ${timeZone}`)
          .addTo(map);
  } else {
      new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML("Timezone data not found.")
          .addTo(map);
  }
});

function getCurrentTimeFromOffset(offset) {
  const now = new Date();
  const utcTime = now.getTime();
  const localTime = new Date(utcTime + offset * 3600000);
  return localTime.toISOString().slice(11, 16);
}
