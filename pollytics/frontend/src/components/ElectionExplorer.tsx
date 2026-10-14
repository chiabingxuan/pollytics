import { useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import type { FeatureCollection, Geometry } from "geojson";

import type {
    ChatMessage,
    FormattedHistoricalData,
    Pane,
} from "../utils/types";

import AssistantChat from "./AssistantChat";
import Dashboard from "./Dashboard";
import ErrorMessage from "./ErrorMessage";

import "./ElectionExplorer.css";

interface ElectionExplorerProps {
    electionId: number;
    electionYear: number;
    electionCountry: string;
    electionType: string;
}

function ElectionExplorer({ electionId, electionYear, electionCountry, electionType }: ElectionExplorerProps) {
    const ASSISTANT_CHAT_PATH_SUFFIX = "ask";

    /////////////////////////////////
    // SHARED STATES FOR DASHBOARD //
    /////////////////////////////////
    // GeoJSON across all divisions
    const [completeGeoJson, setCompleteGeoJson] = useState<FeatureCollection<Geometry, Pane> | null>(null);

    // GeoJSONs for selected division / region, if any
    const [selectedDivisionGeoJson, setSelectedDivisionGeoJson] = useState<FeatureCollection<Geometry, Pane> | null>(null);
    const [selectedRegionGeoJson, setSelectedRegionGeoJson] = useState<FeatureCollection<Geometry, Pane> | null>(null);

    // Divisions and regions can be selected by clicking
    const [selectedDivisionPane, setSelectedDivisionPane] = useState<Pane | null>(null);
    const [selectedRegionPane, setSelectedRegionPane] = useState<Pane | null>(null);

    // Historical data for selected divisions / regions, if any
    const [selectedDivisionHistoricalData, setSelectedDivisionHistoricalData] = useState<FormattedHistoricalData | null>(null);
    const [selectedRegionHistoricalData, setSelectedRegionHistoricalData] = useState<FormattedHistoricalData | null>(null);

    ////////////////////////////
    // SHARED STATES FOR CHAT //
    ////////////////////////////
    const STARTING_MESSAGE: ChatMessage = {
        id: 1,
        sender: "assistant",
        text: "Hi! I'm ready to help you make sense of the results for this election."
    };

    const [chatInput, setChatInput] = useState("");
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([STARTING_MESSAGE]);

    // Other states
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    if (errorMsg) {
        return <ErrorMessage msg={errorMsg}/>;
    }
    
    return (
        <>
            <nav className="explorer-tabs" aria-label="Different views of the election explorer">
                <NavLink end to={`/elections/${electionId}`}>Dashboard</NavLink>
                <NavLink end to={`/elections/${electionId}/${ASSISTANT_CHAT_PATH_SUFFIX}`}>Ask <i>pollytics</i></NavLink>
            </nav>

            <Routes>
                <Route
                    index
                    element={
                        <Dashboard
                            electionId={electionId}
                            electionCountry={electionCountry}
                            electionType={electionType}
                            completeGeoJson={completeGeoJson}
                            selectedDivisionGeoJson={selectedDivisionGeoJson}
                            selectedRegionGeoJson={selectedRegionGeoJson}
                            selectedDivisionPane={selectedDivisionPane}
                            selectedRegionPane={selectedRegionPane}
                            selectedDivisionHistoricalData={selectedDivisionHistoricalData}
                            selectedRegionHistoricalData={selectedRegionHistoricalData}
                            setCompleteGeoJson={setCompleteGeoJson}
                            setSelectedDivision={(
                                divisionGeoJson: FeatureCollection<Geometry, Pane>,
                                divisionPane: Pane,
                                divisionHistoricalData: FormattedHistoricalData
                            ) => {
                                setSelectedDivisionGeoJson(divisionGeoJson);
                                setSelectedDivisionPane(divisionPane);
                                setSelectedDivisionHistoricalData(divisionHistoricalData);
                            }}
                            setSelectedRegion={(
                                regionGeoJson: FeatureCollection<Geometry, Pane>,
                                regionPane: Pane,
                                regionHistoricalData: FormattedHistoricalData
                            ) => {
                                setSelectedRegionGeoJson(regionGeoJson);
                                setSelectedRegionPane(regionPane);
                                setSelectedRegionHistoricalData(regionHistoricalData);
                            }}
                            exitDivisionView={() => {
                                setSelectedDivisionGeoJson(null);
                                setSelectedDivisionPane(null);
                                setSelectedDivisionHistoricalData(null);
                            }}
                            exitRegionView={() => {
                                setSelectedRegionGeoJson(null);
                                setSelectedRegionPane(null);
                                setSelectedRegionHistoricalData(null);
                            }}
                            setErrorMsg={setErrorMsg}
                        />
                    }
                />
                <Route
                    path={ASSISTANT_CHAT_PATH_SUFFIX}
                    element={
                        <AssistantChat
                            input={chatInput}
                            messages={chatMessages}
                            electionId={electionId}
                            electionYear={electionYear}
                            electionCountry={electionCountry}
                            electionType={electionType}
                            selectedDivisionPane={selectedDivisionPane}
                            selectedRegionPane={selectedRegionPane}
                            setInput={setChatInput}
                            setMessages={setChatMessages}
                        />
                    }
                />            
            </Routes>
        </>
    );
}

export default ElectionExplorer;