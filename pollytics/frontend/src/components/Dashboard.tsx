import { useEffect, useState } from "react";
import L from "leaflet";
import type { LeafletMouseEvent, Path } from "leaflet";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import ErrorMessage from "./ErrorMessage";
import SelectedSidebar from "./SelectedSidebar";
import { fetchDivisionResults } from "../api/results";
import { fetchDivisionMaps } from "../api/maps";
import type { DivisionResult, Pane } from "../types";
import { fixAntimeridian } from "../utils/antimeridianFix";
import "leaflet/dist/leaflet.css";
import "./Dashboard.css";

export const DEFAULT_COLOR: string = "#6B7280";

interface DashboardProps {
    electionId: number;
}

function formatDivisionFeature(divRes: DivisionResult, divFeature: Feature): Feature<Geometry, Pane> {
    // Pool all the vote counts for this division and find total votes
    const allResults = [
        ...divRes.results.participations,
        // Other results do not have a party, so we add a null party here.
        // This gives participation results and other results the same structure,
        // allowing them to be handled uniformly when displayed in the sidebar.
        ...divRes.results.other.map((result) => ({
            ...result,
            party: null
        }))
    ]

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
): FeatureCollection<Geometry, Pane> {
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
    const geoJson: FeatureCollection<Geometry, Pane> = {
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

    return fixAntimeridian(geoJson);
}

function getColorFromWinningProportion(
    color: string | null,
    winningProportion: number
): string {
    // Give default colour if the category doesn't have an associated colouR
    const baseColor = color ?? DEFAULT_COLOR;

    // Colour is in hexadecimal
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);

    // Either white or black.
    // If proportion is low, shift colour to white (255); otherwise, shift to black (0)
    let target: number;

    // The extent (0-1) to which we shift the colour to the target identified
    let shiftFactor: number;

    if (winningProportion < 0.50) {
        // <50%: very light
        target = 255;
        shiftFactor = 0.8;
    } else if (winningProportion < 0.60) {
        // 50–60%: light
        target = 255;
        shiftFactor = 0.4;
    } else if (winningProportion < 0.70) {
        // 60–70%: original colour
        target = 255;
        shiftFactor = 0;
    } else if (winningProportion < 0.80) {
        // 70–80%: dark
        target = 0;
        shiftFactor = 0.4;
    } else if (winningProportion < 0.90) {
        // 80–90%: very dark
        target = 0;
        shiftFactor = 0.7;
    } else {
        // 90–100%: darkest
        target = 0;
        shiftFactor = 0.9;
    }

    const newR = Math.round(r + (target - r) * shiftFactor);
    const newG = Math.round(g + (target - g) * shiftFactor);
    const newB = Math.round(b + (target - b) * shiftFactor);

    return `rgb(${newR}, ${newG}, ${newB})`;
}

function getPaneStyle(feature: Feature<Geometry, Pane> | undefined) {
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
}

// Get bounds of the GeoJSON and use it shift the map view, enabling all the panes to be captured.
// This means we do not need to hard code the centre of the map
function FitMapToGeoJson({ geoJson }: { geoJson: FeatureCollection }) {
    const map = useMap();

    useEffect(() => {
        const layer = L.geoJSON(geoJson);
        if (layer.getBounds().isValid()) {
            map.fitBounds(layer.getBounds());
        }
    }, [geoJson, map]);

    return null;
}

function Dashboard({ electionId }: DashboardProps) {
    const MAP_ATTRIBUTION: string = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    const MAP_URL ="https://tile.openstreetmap.org/{z}/{x}/{y}.png";

    const [geoJson, setGeoJson] = useState<FeatureCollection<Geometry, Pane> | null>(null);
    const [selectedPane, setSelectedPane] = useState<Pane | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([
            fetchDivisionResults(electionId),
            fetchDivisionMaps(electionId),
        ])
            .then(([divisionResults, divisionMaps]) => {
                const formattedGeoJson = getGeoJson(divisionResults, divisionMaps);
                setGeoJson(formattedGeoJson);
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

    // When mouse hovers above a pane, we highlight the pane
    const highlightPane = (e: LeafletMouseEvent) => {
        const layer = e.target as Path & {
            feature: Feature<Geometry, Pane>;
        };

        setSelectedPane(layer.feature.properties);

        // Change to a highlighted style
        layer.setStyle({
            weight: 3,
            fillOpacity: 1
        });
    };

    // When mouse no longers hovers above pane, do not highlight it anymore
    const resetHighlight = ((e: LeafletMouseEvent) => {
        const layer = e.target as Path & {
            feature: Feature<Geometry, Pane>;
        };

        setSelectedPane(null);
        e.target.setStyle(getPaneStyle(layer.feature));
    })

    // Handles mouse hovering on the pane, if any
    const onEachPane = (_feature: Feature<Geometry, Pane>, layer: Path) => {
        layer.on({
            mouseover: highlightPane,
            mouseout: resetHighlight,
        });
    }

    const mapStyle = {
        height: "100%",
        width: "100%"
    }

    return (
        <div className="dashboard">
            <SelectedSidebar pane={selectedPane}/>
            <MapContainer 
                center={[0, 0]} // placeholder coordinates
                zoom={6}
                scrollWheelZoom={true}
                style={mapStyle}
            >
                <TileLayer
                    attribution={MAP_ATTRIBUTION}
                    url={MAP_URL}
                />
                <GeoJSON data={geoJson} style={getPaneStyle} onEachFeature={onEachPane}/>
                <FitMapToGeoJson geoJson={geoJson} />
            </MapContainer>
        </div>
    );
}

export default Dashboard;