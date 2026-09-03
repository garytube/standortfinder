import { sitesToGeoJson } from './sites-to-geojson';

describe('sitesToGeoJson', () => {
  it('rejects a non-array response', () => {
    expect(() => sitesToGeoJson({ sites: [] })).toThrowError(
      'Standort-API liefert keine Liste',
    );
  });

  it('filters invalid coordinates', () => {
    const result = sitesToGeoJson([
      { sid: 1, longitude: 13.4, latitude: 52.5 },
      { sid: 2, longitude: Number.NaN, latitude: 52.5 },
      { sid: 3, longitude: 13.4, latitude: Number.POSITIVE_INFINITY },
      null,
    ]);

    expect(result.features.map((feature) => feature.properties.sid)).toEqual([1]);
  });

  it('creates longitude-latitude point geometry and uses SID as ID', () => {
    const [feature] = sitesToGeoJson([
      { sid: 121693, longitude: 13.349, latitude: 52.542 },
    ]).features;

    expect(feature.id).toBe(121693);
    expect(feature.geometry).toEqual({
      type: 'Point',
      coordinates: [13.349, 52.542],
    });
  });

  it('applies defaults and preserves faces', () => {
    const faces = [{ qid: 42, media: { mediaName: 'City Light Säule' } }];
    const [feature] = sitesToGeoJson([
      { sid: 1, longitude: 13, latitude: 52, faces },
    ]).features;

    expect(feature.properties).toEqual({
      sid: 1,
      siteDescription: '',
      city: 'Ohne Stadt',
      gkz: '',
      plz: '',
      imageIDs: [],
      faces,
    });
  });

  it('handles an empty API array', () => {
    expect(sitesToGeoJson([])).toEqual({ type: 'FeatureCollection', features: [] });
  });
});
