from concurrent.futures import ThreadPoolExecutor, as_completed
from ddgs import DDGS
from ddgs.exceptions import DDGSException
from langchain_core.tools import tool
from trafilatura import extract


MAX_SEARCH_RESULTS_PER_CALL = 3


def search_with_ddgs(query: str) -> list[dict[str, str]]:
    try:
        search_results = DDGS().news(query, max_results=MAX_SEARCH_RESULTS_PER_CALL)

    # If the search fails, the search results should be empty
    except DDGSException:
        search_results = list()

    return search_results


def extract_with_ddgs(url: str) -> str | None:
    try:
        extracted_text = DDGS().extract(url, fmt="text")["content"]

    # If fetching of the url fails, return None
    except DDGSException:
        extracted_text = None

    return extracted_text


def convert_html_to_markdown(html: str) -> str:
    # Only focus on the main content and convert it to markdown
    return extract(html, output_format="markdown")


def extract_and_format_source(search_result: dict[str, str]) -> dict[str, str] | None:
    extracted_html = extract_with_ddgs(search_result["url"])
    if not extracted_html:
        return None

    extracted_markdown = convert_html_to_markdown(extracted_html)

    return {
        "title": search_result["title"],
        "website": search_result["source"],
        "date_published": search_result["date"],
        "url": search_result["url"],
        "content": extracted_markdown
    }


@tool
def search_and_extract(query: str) -> list[dict[str, str]]:
    """Search DuckDuckGo News for webpages relevant to the specified election and
    extract their content as Markdown.

    Only successfully extracted webpages are returned. Each result contains:

    - title: Webpage title.
    - website: Publisher or organisation.
    - date_published: Approximate date supplied by DuckDuckGo.
    - url: Direct webpage URL.
    - content: Extracted webpage content.

    Use the returned `content` to assess source relevance and credibility and to
    select exact quotations. Include the election year, country, election type, and
    research topic in the query.

    Args:
        query: A focused search query about the specified election.

    Returns:
        A list of successfully extracted webpages, or an empty list if none can be
        found or extracted.
    """

    search_results = search_with_ddgs(query)

    # Extract the markdown of all the sources obtained from the query search, in parallel
    extracted_sources = list()
    with ThreadPoolExecutor(max_workers=MAX_SEARCH_RESULTS_PER_CALL) as executor:
        futures = [
            executor.submit(extract_and_format_source, search_result)
            for search_result in search_results
        ]

        for future in as_completed(futures):
            source = future.result()

            # Add this formatted source if it has indeed been extracted properly
            if source is not None:
                extracted_sources.append(source)

    return extracted_sources