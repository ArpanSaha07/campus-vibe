package com.campusvibe.mail;

import com.campusvibe.common.Logs;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Writes the message to the log instead of sending it.
 *
 * <p>Selected by {@link MailConfig} whenever no SMTP host is configured, which
 * is every local environment and CI. The reset and verification links appear in
 * {@code docker compose logs backend}, so both flows can be exercised end to
 * end without a mail account, a credential in {@code .env}, or a third-party
 * signup.
 *
 * <p>It logs the whole body, links included. That is correct here and would be
 * a credential leak in production — which is precisely why this bean disappears
 * as soon as {@code spring.mail.host} is set.
 *
 * <p>All three values are still scrubbed through {@link Logs} first. The body is
 * assembled from the recipient's own name, so a name containing newlines could
 * otherwise write log entries of its own; {@code safeBlock} keeps the layout
 * readable while denying that.
 */
public class LoggingMailSender implements MailSender {

    private static final Logger log = LoggerFactory.getLogger(LoggingMailSender.class);

    @Override
    public void send(String to, String subject, String body) {
        log.info("""

                ------------------------- MAIL (not sent) -------------------------
                To:      {}
                Subject: {}

                {}
                -------------------------------------------------------------------""",
                Logs.safe(to), Logs.safe(subject), Logs.safeBlock(body));
    }
}
