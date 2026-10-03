import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import ErrorMessage from "./components/ErrorMessage";
import Header from "./components/Header";
import Nav from "./components/Nav";
import About from "./pages/About";
import Home from "./pages/Home";
import IndivElection from "./pages/IndivElection";
import { fetchElections } from "./api/elections";
import type { Election } from "./types";
import type { APIError } from "./utils/APIError";
import "./App.css";

function App() {
    // TODO: Move these into Home instead. Then the error handling can be done in home too
    const [elections, setElections] = useState<Election[]>([]);
    const [hasMoreElections, setHasMoreElections] = useState<boolean>(false);
    const [pageIdx, setPageIdx] = useState(0);
    const [pageCursors, setPageCursors] = useState<(number | null)[]>([null]); // maps each page index -> the last election id on the previous page
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    async function handleFetchElections(after: number | null, targetPageIdx: number) {
        fetchElections(after)
            .then((electionsResponse) => {
                setElections(electionsResponse.elections);
                setHasMoreElections(electionsResponse.hasMoreElections);

                if (electionsResponse.elections.length > 0) {
                    const lastId = electionsResponse.elections[electionsResponse.elections.length - 1].id;

                    // Store the cursor for the following page.
                    // The cursor is the last election ID from the current page.
                    setPageCursors((currentCursors) => {
                        const newCursors = [...currentCursors];
                        newCursors[targetPageIdx + 1] = lastId;
                        return newCursors;
                    })
                }
            })
            .catch((error: APIError) => {
                setErrorMsg(error.message);
            });
    }

    async function goToPage(targetPageIdx: number) {
        const cursor = pageCursors[targetPageIdx];
        await handleFetchElections(cursor, targetPageIdx);
        setPageIdx(targetPageIdx);
    }

    // When App component first mounts, get the first few elections
    useEffect(() => {
        handleFetchElections(null, 0);
    }, []);

    if (errorMsg) {
        return <ErrorMessage msg={errorMsg} />;
    }

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
                    <Route path="/dashboards/:electionId" element={<IndivElection />} />
                    <Route path="/about" element={<About />} />
                </Routes>
            </main>
        </>
    );
}

export default App;
