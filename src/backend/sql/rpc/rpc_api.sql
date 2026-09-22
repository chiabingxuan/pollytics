/* For a given election, get participation results of each division. */
CREATE OR REPLACE FUNCTION get_division_participation_results(
    p_election_id INT
)
RETURNS TABLE (
    division_id INT,
    division_name VARCHAR,
    division_type VARCHAR,
    candidate_name VARCHAR,
    party_name VARCHAR,
    party_color VARCHAR,
    votes INT
)
LANGUAGE SQL
AS $$
    SELECT
        d.id AS division_id,
        d.name AS division_name,
        d.type AS division_type,
        c.name AS candidate_name,
        ptp_and_p.party_name AS party_name,
        ptp_and_p.party_color AS party_color,
        pt.total_votes AS votes
    FROM participations pt
    INNER JOIN races r
        ON r.election_id = pt.election_id
        AND r.division_id = pt.division_id
    INNER JOIN divisions d
        ON d.id = r.division_id
    INNER JOIN candidates c
        ON c.id = pt.candidate_id
    LEFT JOIN ( -- left join to account for independent candidates with no parties
        SELECT
            ptp.candidate_id,
            ptp.election_id,
            ptp.division_id,
            p.name AS party_name,
            p.color AS party_color
        FROM participation_parties ptp
        INNER JOIN parties p
            ON p.id = ptp.party_id
    ) AS ptp_and_p
        ON ptp_and_p.candidate_id = pt.candidate_id
       AND ptp_and_p.election_id = pt.election_id
       AND ptp_and_p.division_id = pt.division_id
    WHERE pt.election_id = p_election_id
    ORDER BY d.id, pt.total_votes DESC;
$$;


/* For a given election, get other results of each division. */
CREATE OR REPLACE FUNCTION get_division_other_results(
    p_election_id INT
)
RETURNS TABLE (
    division_id INT,
    division_name VARCHAR,
    division_type VARCHAR,
    vote_type VARCHAR,
    votes INT
)
LANGUAGE SQL
AS $$
    SELECT
        d.id AS division_id,
        d.name AS division_name,
        d.type AS division_type,
        o.type AS vote_type,
        o.votes
    FROM other_racewide_results o
    INNER JOIN races r
        ON r.election_id = o.election_id
        AND r.division_id = o.division_id
    INNER JOIN divisions d
        ON d.id = r.division_id
    WHERE o.election_id = p_election_id
    ORDER BY d.id, o.votes DESC;
$$;


/* For a given election and division, get participation results of each region in that division. */
CREATE OR REPLACE FUNCTION get_region_participation_results(
    p_election_id INT,
    p_division_id INT
)
RETURNS TABLE (
    region_id INT,
    region_name VARCHAR,
    region_type VARCHAR,
    candidate_name VARCHAR,
    party_name VARCHAR,
    party_color VARCHAR,
    votes INT
)
LANGUAGE SQL
AS $$
    SELECT
        r.id AS region_id,
        r.name AS region_name,
        r.type AS region_type,
        c.name AS candidate_name,
        ptp_and_p.party_name AS party_name,
        ptp_and_p.party_color AS party_color,
        ptr.votes
    FROM participation_regional_results ptr
    INNER JOIN participations pt
        ON pt.candidate_id = ptr.candidate_id
        AND pt.election_id = ptr.election_id
        AND pt.division_id = ptr.division_id
    INNER JOIN regions r
        ON r.id = ptr.region_id
    INNER JOIN candidates c
        ON c.id = pt.candidate_id
    LEFT JOIN ( -- left join to account for independent candidates with no parties
        SELECT
            ptp.candidate_id,
            ptp.election_id,
            ptp.division_id,
            p.name AS party_name,
            p.color AS party_color
        FROM participation_parties ptp
        INNER JOIN parties p
            ON p.id = ptp.party_id
    ) AS ptp_and_p
        ON ptp_and_p.candidate_id = pt.candidate_id
       AND ptp_and_p.election_id = pt.election_id
       AND ptp_and_p.division_id = pt.division_id
    WHERE ptr.election_id = p_election_id
    AND ptr.division_id = p_division_id
    ORDER BY r.id, ptr.votes DESC;
$$;


/* For a given election and division, get other results of each region. */
CREATE OR REPLACE FUNCTION get_region_other_results(
    p_election_id INT,
    p_division_id INT
)
RETURNS TABLE (
    region_id INT,
    region_name VARCHAR,
    region_type VARCHAR,
    vote_type VARCHAR,
    votes INT
)
LANGUAGE SQL
AS $$
    SELECT
        r.id AS region_id,
        r.name AS region_name,
        r.type AS region_type,
        o.type AS vote_type,
        o.votes
    FROM other_regional_results o
    INNER JOIN regions r
        ON r.id = o.region_id
    WHERE o.election_id = p_election_id
    AND o.division_id = p_division_id
    ORDER BY r.id, o.votes DESC;
$$;


/* For a given election, get the latest applicable border of each division. */
CREATE OR REPLACE FUNCTION get_division_geometry(
    p_election_id INT
)
RETURNS TABLE (
    division_id INT,
    division_name VARCHAR,
    geometry GEOMETRY(MULTIPOLYGON, 4326)
)
LANGUAGE SQL
AS $$
    SELECT DISTINCT ON (d.id)
        d.id AS division_id,
        d.name AS division_name,
        db.geometry
    FROM division_borders db
    INNER JOIN divisions d
        ON d.id = db.division_id
    INNER JOIN races r
        ON r.division_id = d.id
    WHERE r.election_id = p_election_id

    /* Only consider borders drawn in or before the election year. */
    AND db.year_drawn <= (
        SELECT e.year
        FROM elections e
        WHERE e.id = p_election_id
    )

    /*
    For each division, arrange from latest borders to oldest borders.
    Then DISTINCT ON (d.id) chooses the first row (latest border as of the election)
    for each division. These will be the borders used for the election.
    */
    ORDER BY d.id, db.year_drawn DESC;
$$;


/* For a given election, get the latest applicable border of each region in that division. */
CREATE OR REPLACE FUNCTION get_region_geometry(
    p_election_id INT,
    p_division_id INT
)
RETURNS TABLE (
    region_id INT,
    region_name VARCHAR,
    geometry GEOMETRY(MULTIPOLYGON, 4326)
)
LANGUAGE SQL
AS $$
    SELECT DISTINCT ON (r.id)
        r.id AS region_id,
        r.name AS region_name,
        rb.geometry
    FROM region_borders rb
    INNER JOIN regions r
        ON r.id = rb.region_id
    INNER JOIN (
            -- regions in which there were votes for known participations
            SELECT
                ptr.region_id AS region_id
            FROM participation_regional_results ptr
            WHERE ptr.election_id = p_election_id
            AND ptr.division_id = p_division_id

            UNION

            -- regions in which there were votes of other types
            SELECT
                o.region_id AS region_id
            FROM other_regional_results o
            WHERE o.election_id = p_election_id
            AND o.division_id = p_division_id
    ) AS target_regions
        ON target_regions.region_id = rb.region_id

    /* Only consider borders drawn in or before the election year. */
    WHERE rb.year_drawn <= (
        SELECT e.year
        FROM elections e
        WHERE e.id = p_election_id
    )

    /*
    For each region, arrange from latest borders to oldest borders.
    Then DISTINCT ON (r.id) chooses the first row (latest border as of the election)
    for each region. These will be the borders used for the election.
    */
    ORDER BY r.id, rb.year_drawn DESC;
$$;