import { useEffect, useRef, useState } from "react";
import type { FeatureCollection, Geometry } from "geojson";

import ElectoralMap from "./ElectoralMap";
import ErrorMessage from "./ErrorMessage";
import SelectedSidebar from "./SelectedSidebar";
import { fetchDivisionMaps, fetchRegionMaps } from "../api/maps";
import { fetchDivisionResults, fetchRegionResults } from "../api/results";
import type { Pane } from "../types";
import type { APIError } from "../utils/APIError";
import { getGeoJson } from "../utils/geometryUtils";

import "./Dashboard.css";

interface DashboardProps {
    electionId: number;
}

function Dashboard({ electionId }: DashboardProps) {
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

    // Processes a pane marked as selected from ElectoralMap
    const handleSelectedPane = (pane: Pane) => {
        const DIVISION_LEVEL: string = "DIVISION";
        const REGION_DATA_NOT_FOUND_ERROR_CODE: string = "REGION_DATA_NOT_FOUND";
        
        // If the pane is a division, show the regional panes for that division
        // Otherwise, nothing happens
        if (pane.level != DIVISION_LEVEL) {
            return;
        }

        setHoveredLocationPane(null);
        setIsLoading(true);

        const divisionId = pane.id;

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
            {/* Use a key to force GeoJSON layer in ElectoralMap to be recreated when switching between
            divisions and regions. This ensures Leaflet correctly renders all division panes when
            returning from a selected division */}
            <ElectoralMap
                geoJson={displayedGeoJson}
                geoJsonKey={selectedDivisionPane ? "regions" : "divisions"}
                updateHoveredLocationOnHoverPane={setHoveredLocationPane}
                updateHoveredLocationOnLeavePane={() => setHoveredLocationPane(null)}
                handleSelectedPane={handleSelectedPane}
            />

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