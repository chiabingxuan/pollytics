import "./Pagination.css";

interface PaginationProps {
    pageIdx: number;
    pageCursors: (number | null)[];
    hasMore: boolean;
    onPageChange: (pageIdx: number) => void;
}

function Pagination({ pageIdx, pageCursors, hasMore, onPageChange }: PaginationProps) {
    return (
        <nav aria-label="Election pages">
            <ul className="pagination">
                {
                    // Remove the last cursor, as that corresponds to the following page,
                    // which we have not visited yet
                }
                {pageCursors.slice(0, -1).map((_, index) => (
                    <li key={index}>
                        <button
                            onClick={() => onPageChange(index)}
                            disabled={index === pageIdx}
                        >
                            {index + 1}
                        </button>
                    </li>
                ))}

                {hasMore && (
                    <li>
                        <button onClick={() => onPageChange(pageIdx + 1)}>
                            Next
                        </button>
                    </li>
                )}
            </ul>
        </nav>
    );
}

export default Pagination;