from dotenv import load_dotenv
from langchain.agents.middleware import ToolCallLimitMiddleware
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
import os
import psycopg
from typing import Any

from .agent import Agent
from ..utils.agent_types import DatabaseAgentResponse
from ..utils.prompts import DATABASE_AGENT_SYSTEM_PROMPT


MODEL_NAME = "gemini-3.5-flash-lite"
MAX_TABLE_NAME_CHECKS = 1
MAX_SCHEMA_CHECKS = 1
MAX_QUERIES = 10
THINKING_LEVEL = "minimal"

load_dotenv()
supabase_db_url = os.environ.get("SUPABASE_DB_URL")


# Helper to make sure that a given query is safe to run
def validate_sql_query(sql_query: str) -> None:
    forbidden_operations = [
        "insert ",
        "update ",
        "delete ",
        "drop ",
        "alter ",
        "truncate ",
        "create ",
        "grant ",
        "revoke ",
    ]
        
    cleaned_sql_query = sql_query.strip().lower()

    if not cleaned_sql_query.startswith("select"):
        raise ValueError("Only SELECT queries are allowed.")

    if any(keyword in cleaned_sql_query for keyword in forbidden_operations):
        raise ValueError("Query contains a forbidden operation.")

    
# Helper to execute a given SQL query.
# If the query has placeholders, execute the query with the corresponding parameters.
# Returns a list of dictionaries. Each dictionary corresponds to a row.
# The keys are the column names, mapped to their corresponding values
def execute_query(sql_query: str, params_to_add: list[str] | None = None) -> list[dict[str, Any]]:
    # We must check that the query is safe and does not contain destructive operations
    validate_sql_query(sql_query)

    try:
        with psycopg.connect(supabase_db_url) as connection:
            connection.execute("SET TRANSACTION READ ONLY")
            connection.execute("SET LOCAL statement_timeout = '5000ms'")

            with connection.cursor() as cursor:
                cursor.execute(sql_query, params_to_add)

                # If the statement produced no resultset, return empty list
                if cursor.description is None:
                    return list()

                column_names = [column.name for column in cursor.description]

                return [dict(zip(column_names, row)) for row in cursor.fetchall()]

    except psycopg.errors.QueryCanceled as error:
        raise RuntimeError("The query exceeded the preset time limit.") from error

    except psycopg.errors.InsufficientPrivilege as error:
        raise RuntimeError("You do not have permission to execute this query.") from error

    except psycopg.Error as error:
        raise RuntimeError(f"Database query failed: {error}") from error


def query_table_names_in_database() -> list[str]:
    rows_returned = execute_query("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name;
    """)

    return [row["table_name"] for row in rows_returned]


@tool
def get_table_names_in_database() -> list[str] | str:
    """List all tables available in the public database schema of the election database.

    Call this tool before requesting table schemas or writing a SQL query so
    that you know which tables exist.

    Returns:
        A list of table names. If the operation fails, returns a string
        describing the database error.
    """
        
    try:
        return query_table_names_in_database()

    except (ValueError, RuntimeError) as error:
        return f"Database error: {error}"


@tool
def get_database_schema(table_names: list[str]) -> list[dict[str, Any]] | str:
    """Retrieve the column names and data types of specified database tables.

    Call `get_table_names_in_database` first, then pass the relevant table names
    to this tool. Use the returned schema to identify valid columns and
    construct accurate SQL queries.

    Args:
        table_names: Names of one or more existing tables whose schemas should
            be retrieved.

    Returns:
        A list of dictionaries containing `table_name`, `column_name`, and
        `data_type` for each column. If the input is invalid or the operation
        fails, returns a string describing the database error.
    """

    try:
        # Make sure there is at least one table name in the input
        if not table_names:
            raise RuntimeError("At least one table name is required.")

        # Make sure the input table names all exist in the database
        all_table_names_in_db = query_table_names_in_database()
        non_existent_table_names = list()
        for table_name in table_names:
            if table_name not in all_table_names_in_db:
                non_existent_table_names.append(table_name)
        if non_existent_table_names:
            raise RuntimeError(f"Table names {non_existent_table_names} do not exist in the database.")

        placeholders = ", ".join(["%s"] * len(table_names))
        rows_returned = execute_query(f"""
            SELECT table_name, column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
                AND table_name IN ({placeholders})
            ORDER BY table_name, ordinal_position;
        """, table_names)

        return rows_returned

    except (ValueError, RuntimeError) as error:
        return f"Database error: {error}"


@tool
def query_database(sql_query: str) -> list[dict[str, Any]] | str:
    """Execute a read-only SQL SELECT query against the election database.

    Inspect the available tables and relevant schemas before using this tool.
    The query must begin with SELECT and must not contain any operation that
    modifies the database. Select only columns relevant to the research request
    and limit the number of rows where appropriate.

    If the query fails, examine the returned error, correct the query, and try
    again when appropriate.

    Args:
        sql_query: A syntactically valid, read-only PostgreSQL SELECT query.

    Returns:
        A list of dictionaries, where each dictionary represents one result
        row and maps column names to values. If validation or execution fails,
        returns a string describing the database error.
    """

    try:
        return execute_query(sql_query)

    except (ValueError, RuntimeError) as error:
        return f"Database error: {error}"


class DatabaseAgent(Agent):
    def __init__(self, api_key):
        super().__init__(
            # LLM used
            model=ChatGoogleGenerativeAI(
                model=MODEL_NAME,
                api_key=api_key,
                thinking_level=THINKING_LEVEL
            ),

            tools=[get_table_names_in_database, get_database_schema, query_database],

            system_prompt=DATABASE_AGENT_SYSTEM_PROMPT.format(
                max_table_name_checks=MAX_TABLE_NAME_CHECKS,
                max_schema_checks=MAX_SCHEMA_CHECKS,
                max_sql_queries=MAX_QUERIES
            ),

            # Limit the number of times each tool is called
            middleware=[
                ToolCallLimitMiddleware(
                    tool_name="get_table_names_in_database",
                    run_limit=MAX_TABLE_NAME_CHECKS,
                    exit_behavior="continue",
                ),
                ToolCallLimitMiddleware(
                    tool_name="get_database_schema",
                    run_limit=MAX_SCHEMA_CHECKS,
                    exit_behavior="continue",
                ),
                ToolCallLimitMiddleware(
                    tool_name="query_database",
                    run_limit=MAX_QUERIES,
                    exit_behavior="continue",
                )
            ],

            # Pydantic model to specify the output format of the agent
            response_format=DatabaseAgentResponse
        )