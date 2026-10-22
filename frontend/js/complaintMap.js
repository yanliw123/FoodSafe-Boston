import {
  circleMarker,
  layerGroup,
  map as leafletMap,
  tileLayer,
} from "https://unpkg.com/leaflet@1.9.4/dist/leaflet-src.esm.js";
import { businessesText, TYPE_COLORS } from "./complaintView.js";

const BOSTON = [42.32, -71.08];

function createBaseMap(element) {
  // Canvas draws thousands of markers much faster than SVG
  const map = leafletMap(element, { preferCanvas: true }).setView(BOSTON, 12);
  tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  return map;
}

// Built as text, since Leaflet would read a plain string as HTML
function createTooltip(point) {
  const tooltip = document.createElement("span");
  tooltip.textContent = [point.address, businessesText(point), point.type]
    .filter(Boolean)
    .join(" · ");
  return tooltip;
}

function toLatLng(complaint) {
  const [lng, lat] = complaint.location.coordinates;
  return [lat, lng];
}
// The map of search results. Open complaints are solid, closed ones faded.
export function createComplaintMap(element, onSelect) {
  const map = createBaseMap(element);
  const markers = layerGroup().addTo(map);

  return {
    show(points) {
      markers.clearLayers();
      for (const point of points) {
        const color = TYPE_COLORS[point.type];
        circleMarker(toLatLng(point), {
          radius: 6,
          weight: 1,
          color,
          fillColor: color,
          fillOpacity: point.status === "Open" ? 0.9 : 0.35, 
// Really liked the design choice of having open complaints as solid and closed as faded.
        })
          .bindTooltip(createTooltip(point))
          .on("click", () => onSelect(point._id))
          .addTo(markers);
      }
    },
    focus(complaint) {
      map.setView(toLatLng(complaint), 17);
    },
  };
}

// A small map in the form: click it to mark where the restaurant is
export function createLocationPicker(element, onPick) {
  const map = createBaseMap(element);
  let marker = null;

  function place(latLng) {
    if (marker) marker.setLatLng(latLng);
    else marker = circleMarker(latLng, { radius: 8 }).addTo(map);
  }

  map.on("click", (event) => {
    place(event.latlng);
    onPick(event.latlng);
  });

  return {
    set(lat, lng) {
      place([lat, lng]);
      map.setView([lat, lng], 16);
    },
    clear() {
      marker?.remove();
      marker = null;
      map.setView(BOSTON, 12);
    },
  };
}
