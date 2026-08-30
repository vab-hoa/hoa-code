#!/usr/bin/env python3
"""
Retry helper for Google Sheets API operations with exponential backoff.

Handles transient errors (503 Service Unavailable, 502 Bad Gateway, 504 Gateway Timeout, 429 Too Many Requests)
with exponential backoff and jitter. Does not retry on client errors (400/401/403/404).
"""

import logging
import random
import time
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)


def retry_sheets_call(callable_obj, max_retries=5, initial_delay=2):
    """
    Execute a Google Sheets API call with retry-on-503 logic.

    Args:
        callable_obj: A callable that executes a Sheets API call (e.g., lambda: sheets.spreadsheets().get(...).execute())
        max_retries: Maximum number of retry attempts (default: 5)
        initial_delay: Initial delay in seconds before first retry (default: 2)

    Returns:
        The result of the API call if successful.

    Raises:
        HttpError: If the call fails after max_retries, or on non-retryable errors (400/401/403/404).
    """
    attempt = 0
    while True:
        try:
            return callable_obj()
        except HttpError as e:
            status = e.resp.status

            # Don't retry on client errors
            if status in (400, 401, 403, 404):
                raise

            # Retry on transient server errors
            if status in (429, 502, 503, 504):
                attempt += 1
                if attempt > max_retries:
                    logger.error(
                        f"Google Sheets API {status}, max retries ({max_retries}) exceeded"
                    )
                    raise

                # Exponential backoff with jitter: delay * (2 ** attempt) + random jitter
                delay = initial_delay * (2 ** (attempt - 1))
                jitter = random.uniform(0, delay * 0.1)  # Add up to 10% jitter
                delay = min(delay + jitter, 60)  # Cap at 60 seconds

                logger.warning(
                    f"Google Sheets API {status}, retrying in {delay:.1f}s "
                    f"(attempt {attempt}/{max_retries})"
                )
                time.sleep(delay)
                continue

            # Re-raise on unexpected errors
            raise
