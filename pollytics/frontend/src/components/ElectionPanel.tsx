import ElectionCard from "./ElectionCard";
import Pagination from "./Pagination";
import type { Election } from "../types";

import "./ElectionPanel.css";

interface ElectionPanelProps {
    elections: Election[];
    pageIdx: number;
    pageCursors: (number | null)[];
    hasMore: boolean;
    onPageChange: (pageIdx: number) => void;
}

function ElectionPanel({
    elections,
    pageIdx,
    pageCursors,
    hasMore,
    onPageChange
}: ElectionPanelProps) {
    return (
        <section className="election-panel">
            <h2>Elections</h2>

            {/* List details of each election here */}
            <ul className="election-list">
                {elections.map((election) => (
                    <li key={election.id}>
                        <ElectionCard election={election} />
                    </li>
                ))}
            </ul>

            {/* Page selection and next button, if any */}
            <Pagination
                pageIdx={pageIdx}
                pageCursors={pageCursors}
                hasMore={hasMore}
                onPageChange={onPageChange}
            />
        </section>
    );
}

export default ElectionPanel;