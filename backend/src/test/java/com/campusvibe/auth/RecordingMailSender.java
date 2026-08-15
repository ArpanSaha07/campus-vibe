package com.campusvibe.auth;

import com.campusvibe.mail.MailSender;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Captures mail instead of sending it, so a test can assert on the link that
 * was actually generated.
 *
 * <p>Testing the token by reading it out of the database would prove less: the
 * database holds only the SHA-256, and the whole point is that the raw token
 * exists exactly once, in the message. Pulling it back out of the message is
 * the only way to exercise the real redemption path.
 */
public class RecordingMailSender implements MailSender {

    public record Message(String to, String subject, String body) {}

    private final List<Message> sent = new CopyOnWriteArrayList<>();

    @Override
    public void send(String to, String subject, String body) {
        sent.add(new Message(to, subject, body));
    }

    public List<Message> sent() {
        return List.copyOf(sent);
    }

    public void clear() {
        sent.clear();
    }

    public Optional<Message> lastTo(String recipient) {
        return sent.stream().filter(m -> m.to().equalsIgnoreCase(recipient))
                .reduce((first, second) -> second);
    }

    /** Pulls the {@code token=...} value out of the most recent message. */
    public Optional<String> lastTokenTo(String recipient) {
        return lastTo(recipient).flatMap(m -> {
            Matcher matcher = Pattern.compile("token=([A-Za-z0-9_-]+)").matcher(m.body());
            return matcher.find() ? Optional.of(matcher.group(1)) : Optional.empty();
        });
    }
}
