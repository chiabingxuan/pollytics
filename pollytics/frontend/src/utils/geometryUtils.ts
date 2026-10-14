import type { Feature, FeatureCollection, Geometry } from "geojson";

import { fixAntimeridian } from "./antimeridianFix";
import { formatAllResults, getBestResult } from "./voteUtils";

import type { FormattedResult, LocationResult, Pane } from "./types";

function formatLocationFeature(locationRes: LocationResult, locationFeature: Feature): Feature<Geometry, Pane> {
    const formattedResults: FormattedResult[] = formatAllResults(locationRes.results);

    // Find the winner of the location
    const bestResult = getBestResult(locationRes.location, formattedResults);

    // Retain all old attributes in the feature
    return {
        ...locationFeature,
        properties: {
            // id already exists in properties from the backend API call
            // We have also checked that it exists earlier, in getGeoJson()
            id: locationFeature.properties?.id,
            name: locationRes.location.name,
            level: locationRes.location.level,
            type: locationRes.location.type,

            // Used to colour the location
            winningProportion: bestResult.proportion,
            winningColor: bestResult.color,

            results: formattedResults
        }
    };
}

export function getFormattedGeoJson(
    locationResults: LocationResult[],
    locationMaps: FeatureCollection
): FeatureCollection<Geometry, Pane> {
    // This should not happen
    if (locationResults.length !== locationMaps.features.length) {
        throw new Error (
            "For a fixed number of locations, the number of location results should be"
                + " equal to the number of location maps."
        );
    }

    // Map each location id to its corresponding geometry features
    const locationIdToGeometry = new Map();
    locationMaps.features.forEach((feature, index) => {
        if (!feature.properties?.id) {
            // This should not happen, as we have added the id on the backend
            throw new Error(`Geometry feature at index ${index} is missing a location id in its properties.`);
        }

        locationIdToGeometry.set(feature.properties.id, feature);
    });

    // Make new GeoJSON with location details, results and geometry
    const geoJson: FeatureCollection<Geometry, Pane> = {
        type: "FeatureCollection",
        features: []
    };

    for (const locationRes of locationResults) {
        const locationGeom = locationIdToGeometry.get(locationRes.location.id);

        // This should not happen. Missing geometry data should have
        // been caught earlier
        if (!locationGeom) {
            throw new Error(
                `No geometry found for ${locationRes.location.type} `
                    + `${locationRes.location.name} (id: ${locationRes.location.id}).`
            );
        }

        // Make copy of feature to avoid modifying original geometry feature
        const locationFeature = structuredClone(locationGeom);
        const formattedLocationFeature = formatLocationFeature(locationRes, locationFeature);

        geoJson.features.push(formattedLocationFeature);
    }

    return fixAntimeridian(geoJson);
}

// Get GeoJSON only containing the specified feature
export function getFormattedGeoJsonFromFeature(feature: Feature<Geometry, Pane>): FeatureCollection<Geometry, Pane> {
    const geoJson: FeatureCollection<Geometry, Pane> = {
        type: "FeatureCollection",
        features: [feature]
    };

    return geoJson;
}