import ElectionPanel from "../components/ElectionPanel";
import type { Election } from "../types";

interface HomeProps {
    elections: Election[];
    pageIdx: number;
    pageCursors: (number | null)[];
    hasMore: boolean;
    onPageChange: (pageIdx: number) => void;
}

function Home({
    elections,
    pageIdx,
    pageCursors,
    hasMore,
    onPageChange,
}: HomeProps) {
    return (
        <ElectionPanel
            elections={elections}
            pageIdx={pageIdx}
            pageCursors={pageCursors}
            hasMore={hasMore}
            onPageChange={onPageChange}
        />
    );
}

export default Home;