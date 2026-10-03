import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { LeafletMouseEvent, Path } from "leaflet";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import ErrorMessage from "./ErrorMessage";
import SelectedSidebar from "./SelectedSidebar";
import { fetchDivisionResults, fetchRegionResults } from "../api/results";
import { fetchDivisionMaps, fetchRegionMaps } from "../api/maps";
import type { LocationResult, Pane } from "../types";
import { fixAntimeridian } from "../utils/antimeridianFix";
import type { APIError } from "../utils/APIError";
import { getPaneStyle } from "../utils/mapUtils";
import "leaflet/dist/leaflet.css";
import "./Dashboard.css";

interface DashboardProps {
    electionId: number;
}

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

function getGeoJson(
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

    const DIVISION_LEVEL: string = "DIVISION";
    const REGION_DATA_NOT_FOUND_ERROR_CODE: string = "REGION_DATA_NOT_FOUND";

    // GeoJSON across all divisions
    const [divisionGeoJson, setDivisionGeoJson] = useState<FeatureCollection<Geometry, Pane> | null>(null);

    // GeoJSON across all regions in the selected division. If no selected division, this is null
    const [regionGeoJson, setRegionGeoJson] = useState<FeatureCollection<Geometry, Pane> | null>(null);

    // A division can be selected by clicking
    const [selectedDivisionPane, setSelectedDivisionPane] = useState<Pane | null>(null);

    // Any location (division or region, depending on what is being displayed) can be hover over
    const [hoveredLocationPane, setHoveredLocationPane] = useState<Pane | null>(null);

    // If a user clicks a division with no regional data, we need to show a pop-up notifying them
    const [showNoRegionPopup, setShowNoRegionPopup] = useState(false);
    const noRegionPopupRef = useRef<HTMLDialogElement>(null);  // Initial reference to popup is null

    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // If no division selected, display all divisions.
    // Otherwise, display the regions of the selected division
    const displayedGeoJson = selectedDivisionPane
        ? regionGeoJson
        : divisionGeoJson;

    // For the first time, get division results and maps
    useEffect(() => {
        setIsLoading(true);

        Promise.all([
            fetchDivisionResults(electionId),
            fetchDivisionMaps(electionId),
        ])
            .then(([divisionResults, divisionMaps]) => {
                const formattedGeoJson = getGeoJson(divisionResults, divisionMaps);
                setDivisionGeoJson(formattedGeoJson);
            })
            .catch((error: APIError) => {
                setErrorMsg(error.message);
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [electionId]);

    // If popup boolean flag changes, open or close the popup accordingly
    useEffect(() => {
        if (showNoRegionPopup) {
            noRegionPopupRef.current?.showModal();
        } else {
            noRegionPopupRef.current?.close();
        }
    }, [showNoRegionPopup]);

    if (errorMsg) {
        return (<ErrorMessage msg={errorMsg}/>);
    }

    if (isLoading) {
        return <p>Loading...</p>;
    }

    // If loading has completed, the GeoJSON to display should not still be null. 
    // If this happens, we are screwed so throw an error
    if (!displayedGeoJson) {
        throw new Error("Dashboard has loaded, but the GeoJSON to display is still null");
    }

    // When mouse hovers above a pane, we highlight the pane
    const handleHoverPane = (e: LeafletMouseEvent) => {
        const layer = e.target as Path & {
            feature: Feature<Geometry, Pane>;
        };

        setHoveredLocationPane(layer.feature.properties);

        layer.setStyle({
            weight: 3,
            fillOpacity: 1
        });
    };

    // When mouse no longers hovers above pane, do not highlight it anymore
    const resetHoverPane = (e: LeafletMouseEvent) => {
        const layer = e.target as Path & {
            feature: Feature<Geometry, Pane>;
        };

        setHoveredLocationPane(null);
        e.target.setStyle(getPaneStyle(layer.feature));
    };

    // If a pane is clicked
    // If the pane is a division, show the regional panes for that division
    // Otherwise, nothing happens
    const handleClickPane = (e: LeafletMouseEvent) => {
        const layer = e.target as Path & {
            feature: Feature<Geometry, Pane>;
        };
        const pane = layer.feature.properties;

        // Only division panes should be clickable
        if (pane.level != DIVISION_LEVEL) {
            return;
        }

        const divisionId = pane.id;

        setHoveredLocationPane(null);
        setIsLoading(true);

        Promise.all([
            fetchRegionResults(electionId, divisionId),
            fetchRegionMaps(electionId, divisionId),
        ])
            .then(([regionResults, regionMaps]) => {
                const formattedGeoJson = getGeoJson(regionResults, regionMaps);
                setRegionGeoJson(formattedGeoJson);
                setSelectedDivisionPane(pane);
            })
            .catch((error: APIError) => {
                // If no regional data found for the selected division,
                // show a popup
                if (error.code === REGION_DATA_NOT_FOUND_ERROR_CODE) {
                    setShowNoRegionPopup(true);
                    return;
                }

                setErrorMsg(error.message);
            })
            .finally(() => {
                setIsLoading(false);
            });
    };

    // Handles mouse actions on the panes
    const onEachPane = (_feature: Feature<Geometry, Pane>, layer: Path) => {
        layer.on({
            mouseover: handleHoverPane,
            mouseout: resetHoverPane,
            click: handleClickPane
        });
    };

    const mapStyle = {
        height: "100%",
        width: "100%"
    };
    
    return (
        <div className="dashboard">
            <SelectedSidebar
                selectedDivisionPane={selectedDivisionPane}
                hoveredLocationPane={hoveredLocationPane}
                onBack={() => {
                    // Sidebar has a callback. If a division has been selected,
                    // the callback allows the user to back out and view
                    // all the divisions again
                    setRegionGeoJson(null);
                    setSelectedDivisionPane(null);
                }}
            />
            <MapContainer 
                center={[0, 0]} // Placeholder coordinates
                zoom={6}
                scrollWheelZoom={true}
                style={mapStyle}
            >
                <TileLayer
                    attribution={MAP_ATTRIBUTION}
                    url={MAP_URL}
                />
                {/* Use a key to force GeoJSON layer to be recreated when switching between
                divisions and regions. This ensures Leaflet correctly renders all division panes when
                returning from a selected division */}
                <GeoJSON
                    key={selectedDivisionPane ? "regions" : "divisions"}
                    data={displayedGeoJson}
                    style={getPaneStyle}
                    onEachFeature={onEachPane}
                />
                <FitMapToGeoJson geoJson={displayedGeoJson} />
            </MapContainer>

            <dialog ref={noRegionPopupRef} className="no-region-popup">
                <p>No regional results are available for this location.</p>
                <button onClick={() => setShowNoRegionPopup(false)}>
                    OK
                </button>
            </dialog>
        </div>
    );
}

export default Dashboard;