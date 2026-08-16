package com.campusvibe.mail;

/**
 * Outbound mail, behind one method.
 *
 * <p>Deliberately not {@code org.springframework.mail.JavaMailSender}: the
 * application should not know whether a message went to SMTP, to a log, or
 * eventually to SES. Two implementations exist — {@link LoggingMailSender} when
 * no SMTP host is configured, {@link SmtpMailSender} when one is — and the
 * choice is made by configuration, not by code that calls this.
 *
 * <p>Implementations must not throw for a delivery failure. A password-reset
 * request that returns 500 because a mail server is down tells the caller which
 * addresses exist, and leaves the user with no way forward. Log and move on.
 */
public interface MailSender {

    void send(String to, String subject, String body);
}
