import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ElectoralMap from "../components/ElectoralMap";
import ErrorMessage from "../components/ErrorMessage";
import { fetchElection } from "../api/elections";
import type { Election } from "../types";

function Dashboard() {
    // Since the election id is taken from the URL, it is a string
    const { electionId } = useParams<{ electionId: string }>();

    const [election, setElection] = useState<Election | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        if (!electionId) {
            setErrorMsg("The election ID is missing from the URL.");
            return;
        }
        
        // The fetching method accepts election id as a string.
        // When making the HTTP request, the backend will help check
        // whether or not this stringified election id is valid.
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
        return <ErrorMessage msg={errorMsg}/>;
    }

    // Election has not been loaded and there is no error
    if (!election) {
        return <p>Loading...</p>;
    }

    return (
        <>
            <h2>Election Dashboard</h2>
            <ElectoralMap electionId={election.id}/>
        </>
    );
}

export default Dashboard;