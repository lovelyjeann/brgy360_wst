// Public map data for the Brgy360 "Map" button (OpenStreetMap / Leaflet).
// Defaults can be overridden in backend/.env:
//   MAP_LAT=13.7544
//   MAP_LNG=121.0650
//   MAP_ZOOM=16
//   MAP_ADDRESS=Street / Sitio where the barangay hall is
//   MAP_LANDMARK=Nearby landmark to help residents find it
const DEFAULT_LOCATION = {
  name: 'Barangay Pallocan West',
  city: 'Batangas City',
  lat: 13.7544,
  lng: 121.0650,
  zoom: 16,
  address: '',
  landmark: ''
};

exports.getMapLocation = (req, res) => {
  const lat = parseFloat(process.env.MAP_LAT);
  const lng = parseFloat(process.env.MAP_LNG);
  const zoom = parseInt(process.env.MAP_ZOOM, 10);

  res.json({
    success: true,
    data: {
      ...DEFAULT_LOCATION,
      lat: Number.isFinite(lat) ? lat : DEFAULT_LOCATION.lat,
      lng: Number.isFinite(lng) ? lng : DEFAULT_LOCATION.lng,
      zoom: Number.isFinite(zoom) ? zoom : DEFAULT_LOCATION.zoom,
      address: process.env.MAP_ADDRESS || DEFAULT_LOCATION.address,
      landmark: process.env.MAP_LANDMARK || DEFAULT_LOCATION.landmark
    }
  });
};