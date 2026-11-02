import asyncio
from datetime import date
from gnews import GNews, GNewsException, NetworkError
from gnews.utils.constants import AVAILABLE_COUNTRIES
from googlenewsdecoder import gnews_decoder_async
from langchain.agents.middleware import ToolCallLimitMiddleware
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI

from .agent import Agent
from ..utils.agent_types import SearchAgentResponse
from ..utils.prompts import SEARCH_AGENT_SYSTEM_PROMPT


MODEL_NAME = "gemini-3.1-flash-lite"
MAX_AVAILABLE_COUNTRIES_CHECKS = 1
MAX_SEARCHES = 3
MAX_SEARCH_RESULTS_PER_CALL = 5
MIN_SOURCES_IN_OUTPUT = 3
THINKING_LEVEL = "minimal"


def validate_date_parts(date_parts: list[int]) -> None:
    error_message_prefix = f"{date_parts} is an invalid date. "

    if len(date_parts) != 3:
        raise ValueError(error_message_prefix + "Date must contain exactly three integers: [year, month, day].")

    if not all(isinstance(part, int) for part in date_parts):
        raise ValueError(error_message_prefix + "Date must contain only integers.")

    year, month, day = date_parts

    try:
        date(year, month, day)
    except ValueError as error:
        raise ValueError(error_message_prefix + "Date must contain a valid year, month, and day.") from error


def resolve_rss_urls(search_results: list[dict]) -> list[dict]:
    rss_urls = [result["url"] for result in search_results]

    try:
        # Resolve to original URLs, preserving order of the links
        resolution_results = asyncio.run(gnews_decoder_async(rss_urls))

        # Make a mapping of each RSS URL to the resolved version, skipping any
        # RSS URLs that could not be resolved
        rss_urls_to_original_urls = dict()
        for rss_url, resolution_result in zip(rss_urls, resolution_results):
            if resolution_result["success"]:
                rss_urls_to_original_urls[rss_url] = resolution_result["decoded_url"]

            else:
                print(f"Error occurred during resolution of {rss_url}:", resolution_result["message"])

        # Convert RSS URL to the resolved version. If resolution of a RSS URL
        # was unsuccessful, leave the original RSS URL as it is
        search_results_with_resolved_urls = list()
        for result in search_results:
            result_with_resolved_url = {
                "publisher": result["publisher"],
                "description": result["description"],
                "published date": result["published date"],
                "title": result["title"],
                "url": rss_urls_to_original_urls.get(result["url"], result["url"])
            }
            search_results_with_resolved_urls.append(result_with_resolved_url)

        return search_results_with_resolved_urls

    except Exception as error:
        print(f"Error occurred during resolution of RSS URLs: {error}")
        return search_results


async def fetch_content_for_search_result(google_news: GNews, search_result: dict) -> dict[str, str] | None:
    url = search_result["url"]

    try:
        full_article = await asyncio.to_thread(google_news.get_full_article, url)

        extracted_source = {
            "title": search_result["title"],
            "website": search_result["publisher"]["title"],
            "date_published": search_result["published date"],
            "url": url,
            "content": full_article["text"]
        }

        return extracted_source

    # Failed to extract the full source text - return None
    except NetworkError as error:
        print(f"Error occurred when extracting full article: {error}")
        

async def fetch_content_for_all_search_results(google_news: GNews, search_results: list[dict]) -> list[dict]:
    extraction_tasks = list()

    async with asyncio.TaskGroup() as task_group:
        for search_result in search_results:
            task = task_group.create_task(fetch_content_for_search_result(google_news, search_result))
            extraction_tasks.append(task)

    # Ignore all sources for which the full article cannot be extracted
    extracted_sources = [task.result() for task in extraction_tasks if task.result() is not None]

    return extracted_sources


@tool
def get_available_countries_for_search() -> dict[str, str]:
    """Return the countries supported by the news search tool.

    The returned dictionary maps country names to the two-letter country codes
    required by the `country_for_search` argument of `search_and_extract`.

    Returns:
        A dictionary mapping country names to ISO-style two-letter country codes.
        For example: ``{"Australia": "AU", "Botswana": "BW"}``.
    """

    return AVAILABLE_COUNTRIES


@tool
def search_and_extract(query: str, country_for_search: str | None = None, start_date_for_search: list[int] | None = None, end_date_for_search: list[int] | None = None) -> list[dict[str, str]] | str:
    """Search Google News and extract the full text of relevant webpages.

    The search is restricted to the specified country and date range. The
    GNews country parameter must be a supported two-letter country code. Use
    `get_available_countries_for_search` to find valid country codes.

    Dates must be three-integer lists in [year, month, day] format, for example
    [2024, 1, 1]. The date range is inclusive.

    Only webpages whose full text is successfully extracted are returned.
    Each returned dictionary contains:

    - `title`: The webpage title.
    - `website`: The publisher or organisation.
    - `date_published`: The approximate publication date supplied by GNews.
    - `url`: The direct webpage URL.
    - `content`: The extracted webpage text.

    Use the returned `content` to assess source relevance and credibility and to
    select exact quotations. The query should include the election year,
    country, election type, and specific research topic.

    Args:
        query: A focused natural-language news-search query.
        country_for_search: A supported two-letter country code.
        start_date_for_search: Start date as ``(year, month, day)``.
        end_date_for_search: End date as ``(year, month, day)``.

    Returns:
        A list of successfully extracted webpage dictionaries. If the search
        fails, returns a string describing the search error. If no webpages can
        be extracted, returns an empty list.
    """

    # Verify that the date inputs represent valid dates
    try:
        validate_date_parts(start_date_for_search)
        validate_date_parts(end_date_for_search)
    except ValueError as date_error:
        return f"Date error: {date_error}"

    # Initialise GNews with various parameters
    google_news = GNews(
        language="en",
        country=country_for_search,
        start_date=tuple(start_date_for_search),
        end_date=tuple(end_date_for_search),
        max_results=MAX_SEARCH_RESULTS_PER_CALL
    )

    try:
        # Search for potential articles with the chosen query
        search_results = google_news.get_news(query)
        resolved_search_results = resolve_rss_urls(search_results)

        # Extract the full article for each URL obtained
        extracted_sources = asyncio.run(fetch_content_for_all_search_results(google_news, resolved_search_results))

        return extracted_sources
    
    # Something went wrong during the initial news search with the query - return an error message
    except GNewsException as search_error:
        return f"Search error: {search_error}"


class SearchAgent(Agent):
    def __init__(self, api_key):
        super().__init__(
            # LLM used
            model=ChatGoogleGenerativeAI(
                model=MODEL_NAME,
                api_key=api_key,
                thinking_level=THINKING_LEVEL
            ),

            tools=[get_available_countries_for_search, search_and_extract],

            system_prompt=SEARCH_AGENT_SYSTEM_PROMPT.format(
                max_searches=MAX_SEARCHES,
                min_sources_in_output=MIN_SOURCES_IN_OUTPUT
            ),

            # Pydantic model to specify the output format of the agent
            response_format=SearchAgentResponse,

            # Limit the number of times the tools are called
            middleware=[
                ToolCallLimitMiddleware(
                    tool_name="get_available_countries_for_search",
                    run_limit=MAX_AVAILABLE_COUNTRIES_CHECKS,
                    exit_behavior="continue"
                ),
                ToolCallLimitMiddleware(
                    tool_name="search_and_extract",
                    run_limit=MAX_SEARCHES,
                    exit_behavior="continue"
                )
            ]
        )