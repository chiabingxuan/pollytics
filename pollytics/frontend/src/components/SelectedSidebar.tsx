import { DEFAULT_COLOR } from "../utils/colorUtils";
import { Level, type Pane } from "../utils/types";

import "./SelectedSidebar.css";

interface SelectedSidebarProps {
    selectedDivisionPane: Pane | null;
    selectedRegionPane: Pane | null;
    hoveredLocationPane: Pane | null;
    exitDivisionView: () => void;
    exitRegionView: () => void;
}

function getButton(
    selectedRegionPane: Pane | null,
    exitDivisionView: () => void,
    exitRegionView: () => void
) {
    const onBack = () => {
        if (selectedRegionPane) {
            exitRegionView();
        }

        else {
            exitDivisionView();
        }
    };

    return <button className="back-button" onClick={onBack}>Back</button>;
}

function getResultsDisplay(pane: Pane) {
    // Based on the place associated with the pane, display details in the sidebar
    return <>
        <h2>{pane.name}</h2>
        <h3>{pane.type}</h3>

        {/* Table of vote counts */}
        <table>
            <tbody>
                {pane.results.map((result) => (
                    <tr key={result.name}>
                        <td>
                            {/* A coloured indicator for the result in this row */}
                            <span
                                className="result-color"
                                style={{ backgroundColor: result.color ?? DEFAULT_COLOR }}
                            />
                            {result.name}
                            {result.party && (
                                <div className="result-party">{result.party}</div>
                            )}
                        </td>
                        {/* toLocaleString() adds commas to vote counts */}
                        <td>{result.votes.toLocaleString()}</td>
                        <td>{(result.proportion * 100).toFixed(1)}%</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </>;
}

function getHoveredDisplay(
    selectedDivisionPane: Pane | null,
    hoveredLocationPane: Pane | null
) {
    if (!hoveredLocationPane) {
        return;
    }

    if (selectedDivisionPane) {
        // A division is selected (division view)
        // Check what kind of pane is being hovered over
        switch (hoveredLocationPane.level) {
            case Level.DIVISION:
                // This must mean that the map had only been showing a single pane (representing the 
                // selected division), and the user hovered on it again

                // The existing selected region must be the same as the new region being selected
                if ((selectedDivisionPane.id !== hoveredLocationPane.id) || (selectedDivisionPane.level !== hoveredLocationPane.level)) {
                    throw new Error("New division being hovered is different from the selected division");
                }

                // For this case, nothing should happen
                return;
            
            case Level.REGION:
                return <>{getResultsDisplay(hoveredLocationPane)}</>;

            default:
                throw new Error("Unknown pane level detected.");
        }
    }

    // No division is selected (complete view)
    // Check what kind of pane is being hovered over
    switch (hoveredLocationPane.level) {
        case Level.DIVISION:
            return <>{getResultsDisplay(hoveredLocationPane)}</>;
           
        case Level.REGION:
            throw new Error("A region was hovered over from the complete view, which should not happen.");

        default:
            throw new Error("Unknown pane level detected.");
    }    
}

function SelectedSidebar({
    selectedDivisionPane,
    selectedRegionPane,
    hoveredLocationPane,
    exitDivisionView,
    exitRegionView
}: SelectedSidebarProps) {
    // If there is no selected division, then there should not be a selected region
    if (!selectedDivisionPane && selectedRegionPane) {
        throw new Error("There is a selected region but no selected division.");
    }

    return (
        <aside className="sidebar">
            {/* Show button only if a division is selected (ie. division / regional view) */}
            {selectedDivisionPane && getButton(selectedRegionPane, exitDivisionView, exitRegionView)}

            {/* Show division results only if a division is selected (ie. division / regional view) */}
            {selectedDivisionPane && (
                <section className="sidebar-display">
                    {getResultsDisplay(selectedDivisionPane)}
                </section>
            )}

            {/* Show regional results only if a region is selected (ie. regional view) */}
            {selectedRegionPane && (
                <section className="sidebar-display">
                    {getResultsDisplay(selectedRegionPane)}
                </section>
            )}

            {/* Show hovered details only if a region is not selected (complete / division view) */}
            {!selectedRegionPane && (
                <section className="sidebar-display">
                    {getHoveredDisplay(selectedDivisionPane, hoveredLocationPane)}
                </section>
            )}
        </aside>
    );
}

export default SelectedSidebar;