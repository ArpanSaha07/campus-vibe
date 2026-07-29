package com.campusvibe.search;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/search")
public class SearchController {

    private final SearchIndexService searchIndexService;

    public SearchController(SearchIndexService searchIndexService) {
        this.searchIndexService = searchIndexService;
    }

    /** Backfills embeddings for all events and clubs (e.g. after enabling the API key). */
    @PostMapping("/reindex")
    @PreAuthorize("hasRole('ADMIN')")
    public SearchIndexService.ReindexResult reindex() {
        return searchIndexService.reindexAll();
    }
}
