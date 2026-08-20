package com.campusvibe.user.profile;

import com.campusvibe.exception.RequestValidationException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The server-side half of the profile-link rule.
 *
 * <p>Its twin, {@code app/__tests__/profile.test.ts}, covers the same cases in
 * the browser. Neither is redundant: that one protects the render, this one is
 * the control — anything holding a token can PUT straight past the browser.
 *
 * <p>A plain unit test, no Spring context. It exercises a pure function.
 */
class ProfileLinksTest {

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
		assertThatThrownBy(() -> ProfileLinks.normalise(hostile, "Instagram"))
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
		assertThatThrownBy(() -> ProfileLinks.normalise("javascript:alert(1)", "Instagram"))
				.isInstanceOf(RequestValidationException.class);
	}

	@Test
	void assumesHttpsForSomethingTypedWithoutAScheme() {
		assertThat(ProfileLinks.normalise("instagram.com/someone", "Instagram"))
				.isEqualTo("https://instagram.com/someone");
	}

	@Test
	void keepsAnHttpsUrlAsItIs() {
		assertThat(ProfileLinks.normalise("https://www.linkedin.com/in/someone", "LinkedIn"))
				.isEqualTo("https://www.linkedin.com/in/someone");
	}

	@Test
	void allowsPlainHttp() {
		assertThat(ProfileLinks.normalise("http://example.com/someone", "Facebook"))
				.isEqualTo("http://example.com/someone");
	}

	@ParameterizedTest
	@ValueSource(strings = {"", "   ", "\t"})
	void treatsBlankAsNotSet(String blank) {
		assertThat(ProfileLinks.normalise(blank, "Instagram")).isNull();
	}

	@Test
	void treatsNullAsNotSet() {
		assertThat(ProfileLinks.normalise(null, "Instagram")).isNull();
	}

	@Test
	void refusesSomethingWithNoHostToGoTo() {
		assertThatThrownBy(() -> ProfileLinks.normalise("https://", "Instagram"))
				.isInstanceOf(RequestValidationException.class);
	}
}
