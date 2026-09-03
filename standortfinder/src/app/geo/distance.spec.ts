import { distanceMeters } from './distance';

describe('distanceMeters', () => {
  it('returns zero for the same point', () => {
    const berlin = { lat: 52.52, lng: 13.405 };
    expect(distanceMeters(berlin, berlin)).toBe(0);
  });

  it('matches the known Berlin to Hamburg distance', () => {
    const distance = distanceMeters(
      { lat: 52.52, lng: 13.405 },
      { lat: 53.5511, lng: 9.9937 },
    );

    expect(distance).toBeGreaterThan(250_000);
    expect(distance).toBeLessThan(260_000);
  });
});
