import { DEGREE_TO_RADIAN, EARTH_RADIUS_KM, ETA_CITY_SPEED_KMH, ETA_MIN_MINUTES } from '../constants';
import { Location } from '../types';

/**
 * Calculates the distance in kilometers between two geographic locations using the Haversine formula.
 * @param a - The first location with latitude and longitude.
 * @param b - The second location with latitude and longitude.
 * @returns The distance in kilometers between the two locations.
 */
export function calculateDistanceKm(a: Location, b: Location): number {
  const dLat = (b.lat - a.lat) * DEGREE_TO_RADIAN;
  const dLng = (b.lng - a.lng) * DEGREE_TO_RADIAN;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(a.lat * DEGREE_TO_RADIAN) *
    Math.cos(b.lat * DEGREE_TO_RADIAN) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return EARTH_RADIUS_KM * y;
}

/**
 * Converts a distance in kilometers to an estimated time of arrival (ETA) in minutes, based on a predefined average speed.
 * @param distanceKm - The distance in kilometers.
 * @returns The estimated time of arrival in minutes.
 */
export function estimateEtaMinutes(distanceKm: number): number {
  return Math.max(ETA_MIN_MINUTES, Math.ceil((distanceKm / ETA_CITY_SPEED_KMH) * 60));
}
