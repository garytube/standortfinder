'use strict';

const SITES_API_URL = "/api/Sites?year=2026";

function sitesToGeoJSON(sites) {
  return {
    type: 'FeatureCollection',
    features: sites
      .filter(site => Number.isFinite(site.longitude) && Number.isFinite(site.latitude))
      .map(site => ({
        type: 'Feature',
        id: site.sid,
        geometry: {
          type: 'Point',
          coordinates: [site.longitude, site.latitude]
        },
        properties: {
          sid: site.sid,
          siteDescription: site.siteDescription || '',
          city: site.city || 'Ohne Stadt',
          gkz: site.gkz || '',
          plz: site.plz || '',
          imageIDs: site.imageIDs || [],
          faces: site.faces || []
        }
      }))
  };
}

async function loadSitesGeoJSON() {
  const response = await fetch(SITES_API_URL, {
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) {
    throw new Error(`Standort-API antwortet mit HTTP ${response.status}`);
  }
  const sites = await response.json();
  if (!Array.isArray(sites)) {
    throw new Error('Standort-API liefert keine Liste');
  }
  return sitesToGeoJSON(sites);
}

function geoJSONToRows(featureCollection) {
  return featureCollection.features.flatMap(feature => {
    const [longitude, latitude] = feature.geometry.coordinates;
    const site = feature.properties;
    const faces = site.faces.length ? site.faces : [null];

    return faces.map(face => ({
      SID: site.sid,
      QID: face?.qid ?? '',
      PPS: face?.pps ?? '',
      Price: face?.price ?? null,
      SiteDescription: site.siteDescription,
      Longitude: longitude,
      Latitude: latitude,
      City: site.city,
      MediaName: face?.media?.mediaName || 'Werbefläche',
      Direction: face?.direction ?? '',
      PanelNumber: Math.max(1, face?.panelNumbers?.length || 1),
      PanelNumbers: face?.panelNumbers || [],
      ImageIDs: site.imageIDs,
      GKZ: site.gkz,
      PLZ: site.plz
    }));
  });
}
