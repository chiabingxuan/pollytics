from dotenv import load_dotenv
from langchain.agents.middleware import ToolCallLimitMiddleware
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
import os

from .agent import Agent
from .database_agent import DatabaseAgent
from .search_agent import SearchAgent
from ..utils.agent_types import AssistantResponse
from ..utils.prompts import SUPERVISOR_AGENT_SYSTEM_PROMPT


MODEL_NAME = "gemini-3.5-flash-lite"
MAX_SEARCH_AGENT_CALLS = 1
MAX_DATABASE_AGENT_CALLS = 1
THINKING_LEVEL = "minimal"

load_dotenv()
google_api_key = os.environ.get("GOOGLE_API_KEY")
search_agent = SearchAgent(api_key=google_api_key)
database_agent = DatabaseAgent(api_key=google_api_key)


# Using subagents as tools
@tool("web_research_agent", description="""
    Delegate a complete, natural-language request for external evidence about
    the specified election.

    Use this tool for analysts' interpretations, political context, major
    issues, important events, voter behaviour, electoral systems, and
    explanations of election results.

    Include the election year, country, election type, topic, and specific
    aspect to investigate. Do not provide keyword fragments.

    The tool returns a dictionary containing relevant
    webpages and exact quotations. It returns evidence, not a final answer.

    Use the Database Agent instead for structured information stored in the
    application database.
""")
def call_search_agent(request: str) -> dict:
    response = search_agent.invoke(request)

    return response.model_dump(mode="json")


@tool("database_agent", description="""
    Delegate a complete, natural-language request for structured information
    about the specified election.

    Use this tool for database information such as vote totals, vote shares,
    margins, regional results, candidate results, party results, and election
    comparisons.

    Include the election year, country, election type, relevant candidate or
    region, and the specific information to retrieve. Do not provide keyword
    fragments.

    The tool returns a dictionary containing findings and supporting SQL queries.
    It returns database evidence, not a final answer.

    Use the Web Research Agent instead for external analysis, political
    context, opinions, and voter motivations.
""")
def call_database_agent(request: str) -> dict:
    response = database_agent.invoke(request)

    return response.model_dump(mode="json")


class SupervisorAgent(Agent):
    def __init__(self, election_year, election_country, election_type, api_key):
        super().__init__(
            # LLM used
            model=ChatGoogleGenerativeAI(
                model=MODEL_NAME,
                api_key=api_key,
                thinking_level=THINKING_LEVEL
            ),

            tools=[call_search_agent, call_database_agent],

            system_prompt=SUPERVISOR_AGENT_SYSTEM_PROMPT.format(
                election_year=election_year,
                election_country=election_country,
                election_type=election_type,
                max_search_agent_calls=MAX_SEARCH_AGENT_CALLS,
                max_database_agent_calls=MAX_DATABASE_AGENT_CALLS
            ),

            # Pydantic model to specify the output format of the agent
            response_format=AssistantResponse,

            # Limit the number of times each tool is called
            middleware=[
                ToolCallLimitMiddleware(
                    tool_name="web_research_agent",
                    run_limit=MAX_SEARCH_AGENT_CALLS,
                    exit_behavior="continue"
                ),
                ToolCallLimitMiddleware(
                    tool_name="database_agent",
                    run_limit=MAX_DATABASE_AGENT_CALLS,
                    exit_behavior="continue"
                )
            ]
        )


if __name__ == "__main__":
    supervisor_agent = SupervisorAgent(
        election_year=2024,
        election_country="UNITED STATES",
        election_type="PRESIDENT",
        api_key=google_api_key
    )

    print(supervisor_agent.invoke("evaluate harris' performance in new jersey in detail."))