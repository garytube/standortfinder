export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

const EARTH_RADIUS_METERS = 6_371_000;
const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export function distanceMeters(a: LatLng, b: LatLng): number {
  const latitudeDelta = toRadians(b.lat - a.lat);
  const longitudeDelta = toRadians(b.lng - a.lng);
  const latitudeA = toRadians(a.lat);
  const latitudeB = toRadians(b.lat);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

export function distanceToPathMeters(point: LatLng, path: readonly LatLng[]): number {
  if (path.length === 0) return Number.POSITIVE_INFINITY;
  if (path.length === 1) return distanceMeters(point, path[0]);

  const latitudeScale = (Math.PI / 180) * EARTH_RADIUS_METERS;
  const longitudeScale = latitudeScale * Math.cos(toRadians(point.lat));
  const pointX = point.lng * longitudeScale;
  const pointY = point.lat * latitudeScale;
  let minimum = Number.POSITIVE_INFINITY;

  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index];
    const end = path[index + 1];
    const startX = start.lng * longitudeScale;
    const startY = start.lat * latitudeScale;
    const endX = end.lng * longitudeScale;
    const endY = end.lat * latitudeScale;
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const lengthSquared = deltaX * deltaX + deltaY * deltaY;
    const progress =
      lengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((pointX - startX) * deltaX + (pointY - startY) * deltaY) /
                lengthSquared,
            ),
          );
    const nearestX = startX + progress * deltaX;
    const nearestY = startY + progress * deltaY;
    minimum = Math.min(minimum, Math.hypot(pointX - nearestX, pointY - nearestY));
  }

  return minimum;
}

export function pointInPolygon(point: LatLng, polygon: readonly LatLng[]): boolean {
  let inside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const intersects =
      currentPoint.lat > point.lat !== previousPoint.lat > point.lat &&
      point.lng <
        ((previousPoint.lng - currentPoint.lng) * (point.lat - currentPoint.lat)) /
          (previousPoint.lat - currentPoint.lat) +
          currentPoint.lng;

    if (intersects) inside = !inside;
  }

  return inside;
}
