package com.campusvibe.search;

/** Bounds on what a search request may ask for. */
public final class SearchLimits {

    /**
     * Longest accepted query, in characters.
     *
     * <p>An embedding call costs roughly in proportion to input length, so an
     * uncapped public endpoint lets one caller turn a single request into an
     * arbitrarily large bill ([BUG-005]). 200 is far beyond anything a search
     * box produces and far below anything worth paying for.
     *
     * <p>Rejected rather than truncated: truncating still pays for the work and
     * silently answers a different question than the one asked.
     */
    public static final int MAX_QUERY_LENGTH = 200;

    private SearchLimits() {}
}
