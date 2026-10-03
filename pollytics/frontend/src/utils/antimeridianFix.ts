import type { FeatureCollection, Geometry } from "geojson";
import type { Pane } from "../types";

// Get average longitude for the given polygon
function getPolygonLongitude(polygon: number[][][]): number {
    const longitudes = polygon
        .flat()
        .map(([lng]) => lng);

    return (
        Math.min(...longitudes) +
        Math.max(...longitudes)
    ) / 2;
}

// Get the number of coordinates in the given polygon
function getPolygonSize(polygon: number[][][]): number {
    return polygon.reduce(
        (total, ring) => total + ring.length,
        0
    );
}

function shiftPolygon(
    polygon: number[][][],
    referenceLng: number
): number[][][] {
    const polygonLng = getPolygonLongitude(polygon);

    const shift = Math.round(
        (referenceLng - polygonLng) / 360
    ) * 360;

    return polygon.map(ring =>
        ring.map(([lng, lat]) => [
            lng + shift,
            lat,
        ])
    );
}

export function fixAntimeridian(
    geoJson: FeatureCollection<Geometry, Pane>
): FeatureCollection<Geometry, Pane> {
    return {
        ...geoJson,
        features: geoJson.features.map(feature => {
            const geometry = feature.geometry;

            if (geometry.type !== "MultiPolygon") {
                return feature;
            }

            // Use the largest polygon (with the most coordinates) as the reference.
            // Eg. For Alaska, this should be the mainland
            const referencePolygon = geometry.coordinates.reduce(
                (largest, polygon) => getPolygonSize(polygon) > getPolygonSize(largest)
                    ? polygon
                    : largest
            );

            const referenceLng = getPolygonLongitude(referencePolygon);

            return {
                ...feature,
                geometry: {
                    ...geometry,
                    coordinates: geometry.coordinates.map(
                        polygon => shiftPolygon(polygon, referenceLng)
                    )
                }
            };
        })
    };
}