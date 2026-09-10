package com.campusvibe.common;

import com.campusvibe.exception.RequestValidationException;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The server-side half of the link rule, for profiles and for clubs alike.
 *
 * <p>Its twin, {@code app/__tests__/links.test.ts}, covers the same cases in
 * the browser. Neither is redundant: that one protects the render, this one is
 * the control — anything holding a token can PUT straight past the browser.
 *
 * <p>A plain unit test, no Spring context. It exercises a pure function.
 */
class WebLinksTest {

	@ParameterizedTest
	@ValueSource(strings = {
			"javascript:alert(1)",
			"JavaScript:alert(1)",
			"  javascript:alert(1)  ",
			"data:text/html;base64,PHNjcmlwdD4=",
			"vbscript:msgbox(1)",
			"file:///etc/passwd",
	})
	void refusesEverySchemeThatIsNotHttp(String hostile) {
		assertThatThrownBy(() -> WebLinks.normalise(hostile, "Instagram"))
				.isInstanceOf(RequestValidationException.class)
				.hasMessageContaining("Instagram");
	}

	/**
	 * The regression this whole class exists for.
	 *
	 * <p>If {@code normalise} ever prepends {@code https://} before checking the
	 * scheme, {@code javascript:alert(1)} becomes
	 * {@code https://javascript:alert(1)} — an https URL that passes a scheme
	 * check and reaches an href. The two steps must stay in this order.
	 */
	@Test
	void doesNotDisguiseAHostileSchemeByPrependingHttps() {
		assertThatThrownBy(() -> WebLinks.normalise("javascript:alert(1)", "Instagram"))
				.isInstanceOf(RequestValidationException.class);
	}

	@Test
	void assumesHttpsForSomethingTypedWithoutAScheme() {
		assertThat(WebLinks.normalise("instagram.com/someone", "Instagram"))
				.isEqualTo("https://instagram.com/someone");
	}

	@Test
	void keepsAnHttpsUrlAsItIs() {
		assertThat(WebLinks.normalise("https://www.linkedin.com/in/someone", "LinkedIn"))
				.isEqualTo("https://www.linkedin.com/in/someone");
	}

	@Test
	void allowsPlainHttp() {
		assertThat(WebLinks.normalise("http://example.com/someone", "Facebook"))
				.isEqualTo("http://example.com/someone");
	}

	@ParameterizedTest
	@ValueSource(strings = {"", "   ", "\t"})
	void treatsBlankAsNotSet(String blank) {
		assertThat(WebLinks.normalise(blank, "Instagram")).isNull();
	}

	@Test
	void treatsNullAsNotSet() {
		assertThat(WebLinks.normalise(null, "Instagram")).isNull();
	}

	@Test
	void refusesSomethingWithNoHostToGoTo() {
		assertThatThrownBy(() -> WebLinks.normalise("https://", "Instagram"))
				.isInstanceOf(RequestValidationException.class);
	}

	/**
	 * The Instagram field asks for a handle and this builds the URL, so what is
	 * tested here is mostly what it refuses: the handle is concatenated into a
	 * URL, and the pattern is the only thing standing between the two.
	 */
	@Nested
	class Instagram {

		@ParameterizedTest
		@ValueSource(strings = {"yourclub", "@yourclub", "  @yourclub  ", "your.club_1"})
		void buildsTheUrlFromAHandle(String typed) {
			assertThat(WebLinks.normaliseInstagram(typed, "Instagram"))
					.isEqualTo("https://instagram.com/" + typed.trim().replace("@", ""));
		}

		@ParameterizedTest
		@ValueSource(strings = {
				"instagram.com/yourclub",
				"https://instagram.com/yourclub",
				"http://www.instagram.com/yourclub",
				"https://instagram.com/yourclub/",
				"https://instagram.com/yourclub?hl=en",
		})
		void reducesAPastedUrlToTheSameThing(String pasted) {
			// People paste. A form that refuses what the address bar gave them
			// looks broken -- and the query string goes, so two people who
			// arrived by different routes store the same URL.
			assertThat(WebLinks.normaliseInstagram(pasted, "Instagram"))
					.isEqualTo("https://instagram.com/yourclub");
		}

		@ParameterizedTest
		@ValueSource(strings = {
				"javascript:alert(1)",
				"evil.com/yourclub",
				"https://instagram.com.evil.com/yourclub",
				"https://instagram.com",
				"your club",
				"your/club",
				"@@yourclub",
				"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		})
		void refusesAnythingThatIsNeitherAHandleNorAnInstagramUrl(String hostile) {
			assertThatThrownBy(() -> WebLinks.normaliseInstagram(hostile, "Instagram"))
					.isInstanceOf(RequestValidationException.class)
					.hasMessageContaining("Instagram");
		}

		@ParameterizedTest
		@ValueSource(strings = {"", "   ", "@"})
		void treatsBlankAsNotSet(String blank) {
			assertThat(WebLinks.normaliseInstagram(blank, "Instagram")).isNull();
		}

		@Test
		void treatsNullAsNotSet() {
			assertThat(WebLinks.normaliseInstagram(null, "Instagram")).isNull();
		}
	}
}
