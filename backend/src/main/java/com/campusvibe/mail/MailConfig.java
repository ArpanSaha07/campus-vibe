package com.campusvibe.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;

/**
 * Picks the mail implementation from configuration alone.
 *
 * <p>{@code spring.mail.host} set → real SMTP. Absent → the logging sender, so
 * a developer with no mail account can still walk the whole password-reset and
 * verification flow by reading the backend log.
 *
 * <p>Declared as {@code @Bean} methods rather than annotated {@code @Component}
 * classes because {@code @ConditionalOnMissingBean} is only dependable here:
 * on a component scanned class it races the scan order and silently gives the
 * wrong answer.
 */
@Configuration
@EnableConfigurationProperties(AppMailProperties.class)
public class MailConfig {

    private static final Logger log = LoggerFactory.getLogger(MailConfig.class);

    @Bean
    @ConditionalOnProperty(prefix = "spring.mail", name = "host")
    public MailSender smtpMailSender(JavaMailSender javaMailSender, AppMailProperties properties) {
        log.info("Mail: SMTP delivery enabled, from {}", properties.from());
        return new SmtpMailSender(javaMailSender, properties.from());
    }

    @Bean
    @ConditionalOnMissingBean(MailSender.class)
    public MailSender loggingMailSender() {
        log.warn("Mail: no spring.mail.host configured - messages are LOGGED, not sent. "
                + "Password reset and verification links appear in this log.");
        return new LoggingMailSender();
    }
}
