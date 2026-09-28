import { Link } from "react-router-dom";
import type { Election } from "../types";
import "./ElectionCard.css";

interface ElectionCardProps {
    election: Election;
}

function ElectionCard({ election }: ElectionCardProps) {
    return (
        <Link to={`/dashboards/${election.id}`}>
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
        </Link>
    );
}

export default ElectionCard;