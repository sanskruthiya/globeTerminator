import * as maplibregl from "maplibre-gl";
import { calculate } from './terminator.js';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';

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
    bearing: init_bearing,
    pitch: init_pitch,
    attributionControl: false,
    renderWorldCopies: false
});

const attCntl = new maplibregl.AttributionControl({
    customAttribution:'<a href="https://github.com/sanskruthiya/globeTerminator" target="_blank">GitHub</a>',
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
});
