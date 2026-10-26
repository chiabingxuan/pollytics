from dotenv import load_dotenv
from langchain.agents.middleware import ToolCallLimitMiddleware
from langchain_google_genai import ChatGoogleGenerativeAI
import os

from .agent import Agent
from ..tools.database_tools import get_database_schema, get_table_names_in_database, query_database
from ..tools.search_tools import search_and_extract
from ..utils.agent_types import AssistantResponse
from ..utils.prompts import ELECTION_AGENT_SYSTEM_PROMPT


MODEL_NAME = "gemini-3.5-flash-lite"

# Limit database tool usage
MAX_TABLE_NAME_CHECKS = 2
MAX_SCHEMA_CHECKS = 3
MAX_SQL_QUERIES = 8

# Limit search tool usage
MAX_SEARCHES = 3

load_dotenv()
google_api_key = os.environ.get("GOOGLE_API_KEY")

class ElectionAssistant(Agent):
    def __init__(self, election_year, election_country, election_type, api_key):
        super().__init__(
            # LLM used
            model=ChatGoogleGenerativeAI(
                model=MODEL_NAME,
                api_key=api_key
            ),

            tools=[get_database_schema, get_table_names_in_database, query_database, search_and_extract],

            system_prompt=ELECTION_AGENT_SYSTEM_PROMPT.format(
                election_year=election_year,
                election_country=election_country,
                election_type=election_type,
                max_searches=MAX_SEARCHES,
                max_table_name_checks=MAX_TABLE_NAME_CHECKS,
                max_schema_checks=MAX_SCHEMA_CHECKS,
                max_sql_queries=MAX_SQL_QUERIES
            ),

            # Pydantic model to specify the output format of the agent
            response_format=AssistantResponse,

            # Limit the number of times each tool is called
            middleware=[
                ToolCallLimitMiddleware(
                    tool_name="get_database_schema",
                    run_limit=MAX_SCHEMA_CHECKS,
                    exit_behavior="continue",
                ),
                ToolCallLimitMiddleware(
                    tool_name="get_table_names_in_database",
                    run_limit=MAX_TABLE_NAME_CHECKS,
                    exit_behavior="continue",
                ),
                ToolCallLimitMiddleware(
                    tool_name="query_database",
                    run_limit=MAX_SQL_QUERIES,
                    exit_behavior="continue",
                ),
                ToolCallLimitMiddleware(
                    tool_name="search_and_extract",
                    run_limit=MAX_SEARCHES,
                    exit_behavior="continue"
                )
            ]
        )


if __name__ == "__main__":
    assistant = ElectionAssistant(
        election_year=2024,
        election_country="UNITED STATES",
        election_type="PRESIDENT",
        api_key=google_api_key
    )

    print(assistant.invoke("evaluate harris' performance in new jersey"))