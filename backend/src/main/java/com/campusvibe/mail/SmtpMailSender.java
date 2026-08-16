package com.campusvibe.mail;

import com.campusvibe.common.Logs;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

/**
 * Real delivery through whatever {@code spring.mail.*} points at.
 *
 * <p>Selected by {@link MailConfig} when {@code spring.mail.host} is set.
 */
public class SmtpMailSender implements MailSender {

    private static final Logger log = LoggerFactory.getLogger(SmtpMailSender.class);

    private final JavaMailSender javaMailSender;
    private final String from;

    public SmtpMailSender(JavaMailSender javaMailSender, String from) {
        this.javaMailSender = javaMailSender;
        this.from = from;
    }

    @Override
    public void send(String to, String subject, String body) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);
        try {
            javaMailSender.send(message);
        } catch (Exception e) {
            // Never rethrown. A forgot-password request that 500s because the
            // mail server is down tells the caller the address exists, and
            // leaves the user with nothing to do. The recipient is logged, the
            // body is not — it carries a working reset link.
            //
            // The recipient is whatever the caller typed into a form, so it is
            // scrubbed before it reaches the log: see Logs.safe.
            log.error("Failed to send mail to {} (subject: {})",
                    Logs.safe(to), Logs.safe(subject), e);
        }
    }
}
