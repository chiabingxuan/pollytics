import type { Election } from "../types";
import "./ElectionCard.css";

interface ElectionCardProps {
    election: Election;
}

function ElectionCard({ election }: ElectionCardProps) {
    return (
        <article className="election-card">
            <div>
                <span className="election-card-label">Year</span>
                <span>{election.year}</span>
            </div>

            <div>
                <span className="election-card-label">Country</span>
                <span>{election.country}</span>
            </div>

            <div>
                <span className="election-card-label">Type</span>
                <span>{election.type}</span>
            </div>
        </article>
    );
}

export default ElectionCard;