import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { LocationResult, Pane } from "../types";
import { fixAntimeridian } from "../utils/antimeridianFix";

function formatLocationFeature(locationRes: LocationResult, locationFeature: Feature): Feature<Geometry, Pane> {
    // Pool all the vote counts for this location and find total votes
    const allResults = [
        ...locationRes.results.participations,
        // Other results do not have a party, so we add a null party here.
        // This gives participation results and other results the same structure,
        // allowing them to be handled uniformly when displayed in the sidebar.
        ...locationRes.results.other.map((result) => ({
            ...result,
            party: null
        }))
    ]
    const totalVotes = allResults.reduce(
        (total, result) => total + result.votes,
        0
    );

    // Add vote proportions to the results of this location
    const allResultsWithProportion = allResults.map((result) => ({
        ...result,
        proportion: result.votes / totalVotes
    }))

    // There should always be at least one result for the location in question.
    // The backend API has an assertion that will be flagged if the location queried
    // has no results. Thus the error below should never be thrown.
    const [
        firstResultWithProportion,
        ...remainingResultsWithProportion
    ] = allResultsWithProportion;
    if (!firstResultWithProportion) {
        throw new Error(
            `No results found for ${locationRes.location.type} `
                + `${locationRes.location.name} (id: ${locationRes.location.id}).`
        );
    }

    // Find the winner of the location
    const bestResultWithProportion = remainingResultsWithProportion.reduce(
        (bestRes, res) => res.votes > bestRes.votes ? res : bestRes,
        firstResultWithProportion
    );

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
            winningProportion: bestResultWithProportion.proportion,
            winningColor: bestResultWithProportion.color,

            results: allResultsWithProportion
        }
    };
}

export function getGeoJson(
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