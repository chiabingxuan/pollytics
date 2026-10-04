import type { Pane } from "../types";
import { DEFAULT_COLOR } from "../utils/colors";
import "./SelectedSidebar.css";

interface SelectedSidebarProps {
    selectedDivisionPane: Pane | null;
    hoveredLocationPane: Pane | null;
    onBack: () => void;
}

function getResultsDisplay(pane: Pane) {
    // Based on the place associated with the pane, display details in the sidebar
    return (
        <>
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
        </>
    );
}

function getSelectedDivisionDisplay(selectedDivisionPane: Pane | null, onBack: () => void) {
    return selectedDivisionPane && (
        <>
            <button className="back-button" onClick={onBack}>Back to main view</button>
            {getResultsDisplay(selectedDivisionPane)}
            <hr />
        </>
    )

}

function getHoveredRegionDisplay(selectedDivisionPane: Pane | null, hoveredLocationPane: Pane | null) {
    if (!hoveredLocationPane) {
        return (
            <p>Hover over a location to view its results.</p>
        );
    }

    return (
        <>
            {getResultsDisplay(hoveredLocationPane)}
            {/* If no division has been selected, the hovered location is a division as well.
                Add a prompt to ask user to click into the division */}
            {!selectedDivisionPane && (
                <p>Click to view regional results (if they are available).</p>
            )} 
        </>
    );
}

function SelectedSidebar({ selectedDivisionPane, hoveredLocationPane, onBack }: SelectedSidebarProps) {
    return (
        <aside className="sidebar">
            {/* If there has been a division selected, show the division results at the top of the sidebar */}
            {getSelectedDivisionDisplay(selectedDivisionPane, onBack)}
            {getHoveredRegionDisplay(selectedDivisionPane, hoveredLocationPane)}
        </aside>
    );
}

export default SelectedSidebar;