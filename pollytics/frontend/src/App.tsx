import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import type { Election } from "./types";
import { fetchElections } from "./api/elections";
import Header from "./components/Header";
import Nav from "./components/Nav";
import About from "./pages/About";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import "./App.css";

function App() {
    const [elections, setElections] = useState<Election[]>([]);
    const [hasMoreElections, setHasMoreElections] = useState<boolean>(false);
    const [pageIdx, setPageIdx] = useState(0);

    // Maps each page index -> the last election id on the previous page
    const [pageCursors, setPageCursors] = useState<(number | null)[]>([null]);

    async function handleFetchElections(after: number | null, targetPageIdx: number) {
        const data = await fetchElections(after);

        setElections(data.elections);
        setHasMoreElections(data.hasMoreElections);

        if (data.elections.length > 0) {
            const lastId = data.elections[data.elections.length - 1].id;

            // Store the cursor for the following page.
            // The cursor is the last election ID from the current page.
            setPageCursors((currentCursors) => {
                const newCursors = [...currentCursors];
                newCursors[targetPageIdx + 1] = lastId;
                return newCursors;
            })
        }
    }

    async function goToPage(targetPageIdx: number) {
        // TODO: Handle invalid indices
        const cursor = pageCursors[targetPageIdx];
        
        await handleFetchElections(cursor, targetPageIdx);
        setPageIdx(targetPageIdx);
    }

    // When App component first mounts, get the first few elections
    useEffect(() => {
        handleFetchElections(null, 0);
    }, []);

    return (
        <>
            <Header />
            <Nav />
            <main className="app">
                <Routes>
                    <Route
                        path="/"
                        element={
                            <Home
                                elections={elections}
                                pageIdx={pageIdx}
                                pageCursors={pageCursors}
                                hasMore={hasMoreElections}
                                onPageChange={goToPage}
                            />
                        }
                    />
                    <Route path="/dashboards/:electionId" element={<Dashboard />} />
                    <Route path="/about" element={<About />} />
                </Routes>
            </main>
        </>
    );
}

export default App;
