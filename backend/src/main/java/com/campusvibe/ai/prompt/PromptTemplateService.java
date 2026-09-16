package com.campusvibe.ai.prompt;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Prompts live as text files under {@code resources/prompts/}, not as Java
 * strings, so a prompt change is a readable diff of the prompt alone.
 *
 * <p>A template names its values as {@code {{name}}}. Filling is a single pass
 * over the template, so a value that itself contains {@code {{...}}} (an event
 * description a club wrote, say) is inserted as text and never expanded.
 * A placeholder with no value, or a value with no placeholder, is a programming
 * error and throws rather than sending the model a prompt with a hole in it.
 */
@Service
public class PromptTemplateService {

    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{([a-zA-Z]+)}}");

    private final Map<String, String> templates = new ConcurrentHashMap<>();

    public String render(String name, Map<String, String> values) {
        String template = templates.computeIfAbsent(name, PromptTemplateService::load);

        Matcher matcher = PLACEHOLDER.matcher(template);
        StringBuilder out = new StringBuilder(template.length() + 1024);
        Set<String> used = new HashSet<>();
        while (matcher.find()) {
            String key = matcher.group(1);
            String value = values.get(key);
            if (value == null) {
                throw new IllegalArgumentException("Prompt " + name + " has no value for {{" + key + "}}");
            }
            used.add(key);
            matcher.appendReplacement(out, Matcher.quoteReplacement(value));
        }
        matcher.appendTail(out);

        if (!used.containsAll(values.keySet())) {
            throw new IllegalArgumentException("Prompt " + name + " has no placeholder for some of " + values.keySet());
        }
        return out.toString();
    }

    private static String load(String name) {
        ClassPathResource resource = new ClassPathResource("prompts/" + name + ".txt");
        try (InputStream in = resource.getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8).replace("\r\n", "\n");
        } catch (IOException e) {
            throw new UncheckedIOException("Prompt template not found: prompts/" + name + ".txt", e);
        }
    }
}
