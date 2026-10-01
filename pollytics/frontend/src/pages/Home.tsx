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
        <section>
            <ElectionPanel
                elections={elections}
                pageIdx={pageIdx}
                pageCursors={pageCursors}
                hasMore={hasMore}
                onPageChange={onPageChange}
            />
        </section>
    );
}

export default Home;