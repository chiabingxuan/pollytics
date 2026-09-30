import { useEffect, useState } from "react";
import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import ErrorMessage from "./ErrorMessage";
import { fetchDivisionResults } from "../api/results";
import { fetchDivisionMaps } from "../api/maps";
import type { DivisionResult, PaneProperties } from "../types";
import "leaflet/dist/leaflet.css";

const MAP_ATTRIBUTION: string = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const MAP_URL ="https://tile.openstreetmap.org/{z}/{x}/{y}.png";

interface ElectoralMapProps {
    electionId: number;
}

function replaceWithOtherColor(color: string | null): string {
    const OTHER_COLOR: string = "#6B7280"; // colour used for other voting categories
    if (color === null) {
        return OTHER_COLOR;
    }

    return color;
}

function formatDivisionFeature(divRes: DivisionResult, divFeature: Feature): Feature<Geometry, PaneProperties> {
    // Pool all the vote counts for this division and replace empty colours with default colour
    const allResults = [
        ...divRes.results.participations,
        ...divRes.results.other
    ].map((result) => ({
        ...result,
        color: replaceWithOtherColor(result.color)
    }));

    const totalVotes = allResults.reduce(
        (total, result) => total + result.votes,
        0
    );

    // Add vote proportions to the results of this division
    const allResultsWithProportion = allResults.map((result) => ({
        ...result,
        proportion: result.votes / totalVotes
    }))

    // There should always be at least one result for the division in question.
    // The backend API has an assertion that will be flagged if the division queried
    // has no results. Thus the error below should never be thrown.
    const [
        firstResultWithProportion,
        ...remainingResultsWithProportion
    ] = allResultsWithProportion;
    if (!firstResultWithProportion) {
        throw new Error(
            `No results found for division ${divRes.division.id}.`
        );
    }

    // Find the winner of the division
    const bestResultWithProportion = remainingResultsWithProportion.reduce(
        (bestRes, res) => res.votes > bestRes.votes ? res : bestRes,
        firstResultWithProportion
    );

    // Retain all old attributes in the feature
    return {
        ...divFeature,
        properties: {
            // id already exists in properties from the backend API call
            // We have also checked that it exists earlier, in getGeoJson()
            id: divFeature.properties?.id,
            name: divRes.division.name,
            type: divRes.division.type,

            // Used to colour the division
            winningProportion: bestResultWithProportion.proportion,
            winningColor: bestResultWithProportion.color,

            results: allResultsWithProportion
        }
    };
}

function getGeoJson(
    divisionResults: DivisionResult[],
    divisionMaps: FeatureCollection
): FeatureCollection<Geometry, PaneProperties> {
    // This should not happen
    if (divisionResults.length !== divisionMaps.features.length) {
        throw new Error (
            "For a fixed number of divisions, the number of division results should be"
            + " equal to the number of division maps."
        );
    }

    // Map each division id to its corresponding geometry features
    const divIdToGeometry = new Map();
    divisionMaps.features.forEach((feature, index) => {
        if (!feature.properties?.id) {
            // This should not happen, as we have added the id on the backend
            throw new Error(`Geometry feature at index ${index} is missing a division id in its properties.`);
        }

        divIdToGeometry.set(feature.properties.id, feature);
    });

    // Make new GeoJSON with division details, results and geometry
    const geoJson: FeatureCollection<Geometry, PaneProperties> = {
        type: "FeatureCollection",
        features: []
    };

    for (const divRes of divisionResults) {
        const divGeom = divIdToGeometry.get(divRes.division.id);

        // This should not happen. Missing geometry data should have
        // been caught earlier
        if (!divGeom) {
            throw new Error(
                `No geometry found for division ${divRes.division.id}.`
            );
        }

        // Make copy of feature to avoid modifying original geometry feature
        const divFeature = structuredClone(divGeom);
        const formattedDivFeature = formatDivisionFeature(divRes, divFeature);

        geoJson.features.push(formattedDivFeature);

    }

    return geoJson;
}

function getColorFromWinningProportion(
    color: string,
    winningProportion: number
): string {
    // Colour is in hexadecimal.
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    // Either white or black.
    // If proportion is low, shift colour to white (255); otherwise, shift to black (0)
    let target: number;

    // The extent (0-1) to which we shift the colour to the target identified
    let factor: number;

    if (winningProportion < 0.50) {
        // <50%: very light
        target = 255;
        factor = 0.8;
    } else if (winningProportion < 0.60) {
        // 50–60%: light
        target = 255;
        factor = 0.4;
    } else if (winningProportion < 0.70) {
        // 60–70%: original colour
        target = 255;
        factor = 0;
    } else if (winningProportion < 0.80) {
        // 70–80%: dark
        target = 0;
        factor = 0.4;
    } else if (winningProportion < 0.90) {
        // 80–90%: very dark
        target = 0;
        factor = 0.7;
    } else {
        // 90–100%: darkest
        target = 0;
        factor = 0.9;
    }

    const newR = Math.round(r + (target - r) * factor);
    const newG = Math.round(g + (target - g) * factor);
    const newB = Math.round(b + (target - b) * factor);

    return `rgb(${newR}, ${newG}, ${newB})`;
}

function getMapContainer(geoJson: FeatureCollection<Geometry, PaneProperties>) {
    const style = (feature: Feature<Geometry, PaneProperties> | undefined) => {
        // Required by React Leaflet's StyleFunction type
        if (!feature) {
            return {};
        }

        return ({
            fillColor: getColorFromWinningProportion(
                feature.properties.winningColor,
                feature.properties.winningProportion
            ),
            weight: 1,
            opacity: 1,
            color: "black",
            fillOpacity: 0.8
        });
    };

    const mapStyle = {
        height: "100vh",
        width: "100%",
        margin: "0 auto",
    }

    return (
        <MapContainer 
            center={[39.8283, -98.5795]}
            zoom={4}
            scrollWheelZoom={true}
            style={mapStyle}
        >
            <TileLayer
                attribution={MAP_ATTRIBUTION}
                url={MAP_URL}
            />
            <GeoJSON data={geoJson} style={style}/>
        </MapContainer>
    );
}

function ElectoralMap({ electionId }: ElectoralMapProps) {
    const [geoJson, setGeoJson] = useState<FeatureCollection<Geometry, PaneProperties> | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([
            fetchDivisionResults(electionId),
            fetchDivisionMaps(electionId),
        ])
            .then(([divisionResults, divisionMaps]) => {
                const formmattedGeoJson = getGeoJson(divisionResults, divisionMaps);
                setGeoJson(formmattedGeoJson);
            })
            .catch((error) => {
                if (error instanceof Error) {
                    setErrorMsg(error.message);
                } else {
                    setErrorMsg("An unknown error occurred.");
                }
            });
    }, [electionId]);

    // Display error message, if any
    if (errorMsg) {
        return (<ErrorMessage msg={errorMsg}/>);
    }

    // GeoJSON has not been loaded and there is no error
    if (!geoJson) {
        return <p>Loading...</p>;
    }

    return getMapContainer(geoJson);
}

export default ElectoralMap;