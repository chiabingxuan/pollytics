import type { Pane } from "../types";
import { DEFAULT_COLOR } from "./Dashboard";
import "./SelectedSidebar.css";

interface SelectedSidebarProps {
    pane: Pane | null;
}

function getSidebar(pane: Pane | null) {
    // No pane is being hovered over
    if (!pane) {
        return (
            <p>Hover over a location to view its results.</p>
        );
    }

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

function SelectedSidebar({ pane }: SelectedSidebarProps) {
    return (
        <aside className="sidebar">
            {getSidebar(pane)}
        </aside>
    );
}

export default SelectedSidebar;