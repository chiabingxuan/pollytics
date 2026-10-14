import { useEffect, useState } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";

import { fetchDivisionMaps, fetchRegionMaps } from "../api/maps";
import {
    fetchDivisionResults,
    fetchHistoricalResultsForDivision,
    fetchHistoricalResultsForRegion,
    fetchRegionResults,
} from "../api/results";
import { getFormattedGeoJson, getFormattedGeoJsonFromFeature } from "../utils/geometryUtils";
import { getFormattedHistoricalData } from "../utils/voteUtils";
import { Level } from "../utils/types";

import type { APIError } from "../utils/APIError";
import type { FormattedHistoricalData, Pane } from "../utils/types";

import ElectoralMap from "./ElectoralMap";
import Gallery from "./Gallery";
import SelectedSidebar from "./SelectedSidebar";

import "./Dashboard.css";

interface DashboardProps {
    electionId: number;
    electionCountry: string;
    electionType: string;
    completeGeoJson: FeatureCollection<Geometry, Pane> | null;
    selectedDivisionGeoJson: FeatureCollection<Geometry, Pane> | null;
    selectedRegionGeoJson: FeatureCollection<Geometry, Pane> | null;
    selectedDivisionPane: Pane | null;
    selectedRegionPane: Pane | null;
    selectedDivisionHistoricalData: FormattedHistoricalData | null;
    selectedRegionHistoricalData: FormattedHistoricalData | null;
    setCompleteGeoJson: (feature: FeatureCollection<Geometry, Pane>) => void;
    setSelectedDivision: (
        divisionGeoJson: FeatureCollection<Geometry, Pane>,
        divisionPane: Pane,
        divisionHistoricalData: FormattedHistoricalData
    ) => void;
    setSelectedRegion: (
        regionGeoJson: FeatureCollection<Geometry, Pane>,
        regionPane: Pane,
        regionHistoricalData: FormattedHistoricalData
    ) => void;
    exitDivisionView: () => void;
    exitRegionView: () => void;
    setErrorMsg: (message: string | null) => void;
}

function Dashboard({
    electionId,
    electionCountry,
    electionType,
    completeGeoJson,
    selectedDivisionGeoJson,
    selectedRegionGeoJson,
    selectedDivisionPane,
    selectedRegionPane,
    selectedDivisionHistoricalData,
    selectedRegionHistoricalData,
    setCompleteGeoJson,
    setSelectedDivision,
    setSelectedRegion,
    exitDivisionView,
    exitRegionView,
    setErrorMsg
}: DashboardProps) {
    // Any location (division or region, depending on what is being displayed) can be hovered over
    const [hoveredLocationPane, setHoveredLocationPane] = useState<Pane | null>(null);
    
    const [isLoading, setIsLoading] = useState(true);

    // Note that complete view > division view > regional view
    const displayedGeoJson = selectedRegionGeoJson ?? (selectedDivisionGeoJson ?? completeGeoJson);

    // Get division results and maps, if election ID or complete GeoJSON changes
    useEffect(() => {
        // Once the complete GeoJSON is saved in state during the first render,
        // the effect will run again, since the complete GeoJSON is a dependency.
        // But we don't need to fetch the GeoJSON anymore if that is the case.
        // The following if clause checks for this
        if (completeGeoJson) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        Promise.all([
            fetchDivisionResults(electionId),
            fetchDivisionMaps(electionId)
        ])
            .then(([divisionResults, divisionMaps]) => {
                const formattedGeoJson = getFormattedGeoJson(divisionResults, divisionMaps);
                setCompleteGeoJson(formattedGeoJson);
            })
            .catch((error: APIError) => {
                setErrorMsg(error.message);
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [electionId, completeGeoJson]);

    if (isLoading) {
        return <p>Loading...</p>;
    }

    // If loading has completed, the GeoJSON to display should not still be null. 
    // If this happens, we are screwed so throw an error
    if (!displayedGeoJson) {
        throw new Error("Dashboard has loaded, but the GeoJSON to display is still null.");
    }

    // If there is no selected division, then there should not be a selected region
    if (!selectedDivisionPane && selectedRegionPane) {
        throw new Error("There is a selected region but no selected division.");
    }

    // Processes a feature marked as selected from ElectoralMap
    const handleSelectedFeature = (feature: Feature<Geometry, Pane>) => {
        const REGION_DATA_NOT_FOUND_ERROR_CODE: string = "REGION_DATA_NOT_FOUND";

        const pane: Pane = feature.properties;

        // Check what kind of pane this is (division or region)
        switch (pane.level) {
            case Level.DIVISION:
                if (selectedDivisionPane) {
                    // A selected division already exists.
                    // This must mean that the map had only been showing a single pane (representing the 
                    // existing selected division), and the user clicked on it again

                    // The existing selected division must be the same as the new division being selected
                    if ((selectedDivisionPane.id !== pane.id) || (selectedDivisionPane.level !== pane.level)) {
                        throw new Error("New division being selected is different from the existing selected division");
                    }

                    // For this case, nothing should happen
                    return;
                }
                
                setHoveredLocationPane(null);
                setIsLoading(true);
                
                const divisionId = pane.id;

                // Promise to get regional results and maps for this division
                const selectedDivisionGeoJsonPromise = Promise.all([
                    fetchRegionResults(electionId, divisionId),
                    fetchRegionMaps(electionId, divisionId),
                ])
                    .then(([regionResults, regionMaps]) =>
                        getFormattedGeoJson(regionResults, regionMaps)
                    )
                    .catch((error: APIError) => {
                        if (error.code === REGION_DATA_NOT_FOUND_ERROR_CODE) {
                            // If no regional data found for the selected feature,
                            // the new GeoJSON will only contain the selected feature itself
                            return getFormattedGeoJsonFromFeature(feature);
                        }

                        throw error;
                    });

                // Get regional results + maps for this division, as well as
                // get historical results for this division, in parallel
                Promise.all([
                    selectedDivisionGeoJsonPromise,
                    fetchHistoricalResultsForDivision(
                        divisionId,
                        electionCountry,
                        electionType
                    ),
                ])
                    .then(([formattedSelectedDivisionGeoJson, fetchedSelectedDivisionHistoricalResults]) => {
                        setSelectedDivision(
                            formattedSelectedDivisionGeoJson,
                            pane,
                            getFormattedHistoricalData(fetchedSelectedDivisionHistoricalResults)
                        );

                    })
                    .catch((error: APIError) => {
                        setErrorMsg(error.message);
                    })
                    .finally(() => {
                        setIsLoading(false);
                    });

                break;

            case Level.REGION:
                if (selectedRegionPane) {
                    // A selected region already exists.
                    // This must mean that the map had only been showing a single pane (representing the 
                    // existing selected region), and the user clicked on it again

                    // The existing selected region must be the same as the new region being selected
                    if ((selectedRegionPane.id !== pane.id) || (selectedRegionPane.level !== pane.level)) {
                        throw new Error("New region being selected is different from the existing selected region");
                    }

                    // For this case, nothing should happen
                    return;
                }

                setHoveredLocationPane(null);
                setIsLoading(true);
                
                const regionId = pane.id;

                // New GeoJSON will only contain the selected feature
                const formattedSelectedRegionGeoJson = getFormattedGeoJsonFromFeature(feature);

                // Get historical results for this region
                fetchHistoricalResultsForRegion(regionId, electionCountry, electionType)
                    .then((fetchedSelectedRegionHistoricalResults) => {
                        setSelectedRegion(
                            formattedSelectedRegionGeoJson,
                            pane,
                            getFormattedHistoricalData(fetchedSelectedRegionHistoricalResults)
                        );
                    })
                    .catch((error: APIError) => {
                        setErrorMsg(error.message);
                    })
                    .finally(() => {
                        setIsLoading(false);
                    })

                break;

            default:
                throw new Error("Unknown pane level detected.");
        }
    };

    return (
        <>
            <section>
                <ul>
                    <li>
                        Hover over an unselected location to preview its election results in the sidebar.
                    </li>
                    <li>
                        Click a location to select it, keep its election results displayed in the sidebar,
                        and show additional details below the map.
                    </li>
                </ul>
                
                <div className="electoral-visualization">
                    <SelectedSidebar
                        selectedDivisionPane={selectedDivisionPane}
                        selectedRegionPane={selectedRegionPane}
                        hoveredLocationPane={hoveredLocationPane}

                        // Sidebar has callbacks. The callbacks allow the user to do the following,
                        // depending on the current view they are in:
                        // - Back out from regional view and re-enter the division view
                        // - Back out from division view and re-enter the complete view
                        exitDivisionView={exitDivisionView}
                        exitRegionView={exitRegionView}
                    />

                    <ElectoralMap
                        geoJson={displayedGeoJson}
                        currentView={
                            selectedRegionPane ? Level.REGION
                                : selectedDivisionPane ? Level.DIVISION
                                : Level.COMPLETE
                        }
                        setHoveredLocationPaneOnHover={setHoveredLocationPane}
                        setHoveredLocationPaneOnLeave={() => setHoveredLocationPane(null)}
                        handleSelectedFeature={handleSelectedFeature}
                    />
                </div>
            </section>
            <Gallery
                selectedDivisionPane={selectedDivisionPane}
                selectedRegionPane={selectedRegionPane}
                selectedDivisionHistoricalData={selectedDivisionHistoricalData}
                selectedRegionHistoricalData={selectedRegionHistoricalData}
            />
        </>
    );
}

export default Dashboard;





