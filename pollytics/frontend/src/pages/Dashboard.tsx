import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { Election } from "../types";
import { fetchElection } from "../api/elections";

function getErrorMsg(msg: string) {
    return (
        <div className="error-message">
            <h2>Something went wrong...</h2>
            <p>{msg}</p>
        </div>
    );
}

function Dashboard() {
    const { electionId } = useParams<{ electionId: string }>();

    const [election, setElection] = useState<Election | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        if (!electionId) {
            setErrorMsg("The election ID is missing from the URL.");
            return;
        }

        fetchElection(electionId)
            .then((election) => {
                setElection(election);
            })
            .catch((error) => {
                if (error instanceof Error) {
                    setErrorMsg(error.message);
                } else {
                    setErrorMsg("An unknown error occurred.");
                }
            });
    }, [electionId]);

    // Display error message, if any
    if (errorMsg) {
        return getErrorMsg(errorMsg);
    }

    // Election has not been loaded and there is no error
    if (!election) {
        return <p>Loading...</p>;
    }

    return (
        <>
            <h2>Election Dashboard</h2>
            <p>Election ID: {election.id}</p>
        </>
    );
}

export default Dashboard;