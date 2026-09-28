CREATE OR REPLACE FUNCTION insert_region_borders (
    p_rows JSONB
)
RETURNS VOID
LANGUAGE SQL
AS $$
    INSERT INTO region_borders (
        region_id,
        year_drawn,
        geometry
    )
    SELECT
        (row->>'region_id')::INTEGER,
        (row->>'year_drawn')::INTEGER,
        ST_GeomFromText(row->>'geometry', 4326)
    FROM jsonb_array_elements(p_rows) AS row;
$$;