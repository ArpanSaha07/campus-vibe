package com.campusvibe.instagram;

import org.junit.jupiter.api.Test;

import java.io.StringReader;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class InstagramAccountRankerTest {

    private static final String CSV = """
            username,profile_url,found_on
            4originesbeer,https://www.instagram.com/4originesbeer/,https://www.mtl.org/fr/experience/guide-voyager-chien
            asa_mcgill,https://www.instagram.com/asa_mcgill/,https://ssmu.ca/clubs/
            mcgillgeography,https://www.instagram.com/mcgillgeography/,https://www.mcgill.ca/geography/
            jdoe.writes,https://www.instagram.com/jdoe.writes/,https://www.mcgilldaily.com/author/jdoe/
            csu_concordia,https://www.instagram.com/csu_concordia/,https://www.concordia.ca/students.html
            "quoted.club","https://www.instagram.com/quoted.club/","https://ssmu.ca/clubs/?a=1,2"
            BAD HANDLE!,,
            asa_mcgill,https://www.instagram.com/asa_mcgill/,https://www.mtl.org/x
            """;

    @Test
    void studentClubsRankAboveDepartmentsAboveVenues() throws Exception {
        List<String> order = InstagramAccountRanker.rank(new StringReader(CSV)).stream()
                .map(InstagramAccountRanker.RankedAccount::handle).toList();

        assertThat(order.indexOf("asa_mcgill")).isLessThan(order.indexOf("mcgillgeography"));
        assertThat(order.indexOf("mcgillgeography")).isLessThan(order.indexOf("4originesbeer"));
    }

    @Test
    void personalAndOtherSchoolAccountsAreIneligibleAndLast() throws Exception {
        var ranked = InstagramAccountRanker.rank(new StringReader(CSV));

        assertThat(ranked.stream().filter(r -> !r.eligible()).map(InstagramAccountRanker.RankedAccount::handle))
                .containsExactlyInAnyOrder("jdoe.writes", "csu_concordia");
        assertThat(ranked.subList(ranked.size() - 2, ranked.size()))
                .allMatch(r -> !r.eligible());
    }

    @Test
    void duplicatesKeepTheirBestSourceAndBadHandlesAreDropped() throws Exception {
        var ranked = InstagramAccountRanker.rank(new StringReader(CSV));

        assertThat(ranked.stream().filter(r -> r.handle().equals("asa_mcgill"))).singleElement()
                .satisfies(r -> assertThat(r.foundOn()).contains("ssmu.ca"));
        assertThat(ranked).extracting(InstagramAccountRanker.RankedAccount::handle)
                .contains("quoted.club")
                .doesNotContain("bad handle!");
    }

    @Test
    void shortAbbreviationsOnlyCountAsWholeTokens() {
        assertThat(InstagramAccountRanker.looksLikeAGroup("eus.mcgill")).isTrue();
        assertThat(InstagramAccountRanker.looksLikeAGroup("mcgill_aus")).isTrue();
        assertThat(InstagramAccountRanker.looksLikeAGroup("mausoleumtours")).isFalse();
    }

    @Test
    void handlesComeFromUrlsWhenTheUsernameIsMissing() {
        assertThat(InstagramAccountRanker.normaliseHandle("", "https://www.instagram.com/SSMU_AEUM/")).isEqualTo("ssmu_aeum");
        assertThat(InstagramAccountRanker.normaliseHandle("@Buss.McGill", null)).isEqualTo("buss.mcgill");
        assertThat(InstagramAccountRanker.normaliseHandle("..", null)).isNull();
        assertThat(InstagramAccountRanker.normaliseHandle(null, "https://www.instagram.com/p/abc/")).isNull();
    }
}
