package com.campusvibe.contract;

import com.campusvibe.auth.AuthenticationResponse;
import com.campusvibe.club.ClubDTO;
import com.campusvibe.clubadmin.ClubAdminDTO;
import com.campusvibe.clubadmin.ClubAuditLogDTO;
import com.campusvibe.clubadmin.ClubInvitationDTO;
import com.campusvibe.clubadmin.OwnershipTransferDTO;
import com.campusvibe.clubadmin.ClubAdminRequestDTO;
import com.campusvibe.clubadmin.ManagedClubDTO;
import com.campusvibe.event.EventDTO;
import com.campusvibe.user.MyEventDTO;
import com.campusvibe.user.UserDTO;
import com.campusvibe.taxonomy.ClubCategoryDTO;
import com.campusvibe.taxonomy.EventFormatDTO;
import com.campusvibe.taxonomy.InterestDTO;
import com.campusvibe.user.profile.NotificationPreferencesDTO;
import com.campusvibe.user.profile.ProfileSocialLinksDTO;
import com.campusvibe.user.profile.UserProfileDTO;
import com.fasterxml.jackson.databind.BeanDescription;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.introspect.BeanPropertyDefinition;
import org.assertj.core.api.SoftAssertions;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The backend half of the API contract.
 *
 * <p>{@code frontend/app/types/index.ts} is a hand-written mirror of these
 * records. There is no OpenAPI generation and no shared package, so renaming a
 * field here used to break the frontend with nothing failing anywhere: this
 * suite passed, the frontend suite passed, and the defect surfaced in a browser.
 * Neither side can catch that alone, because neither knows the other's types.
 *
 * <p>Both sides now assert against one file,
 * {@code contracts/api-dto-fields.json}. This test proves the backend still
 * serialises exactly those names; its counterpart,
 * {@code frontend/app/__tests__/api-contract.test.ts}, proves the TypeScript
 * interfaces declare exactly those names. Agreeing with the same file is what
 * makes them agree with each other.
 *
 * <p>Deliberately a plain unit test — no Spring context. It reads type metadata,
 * not behaviour, so it costs milliseconds and fails on the commit that breaks
 * the contract rather than on the one that deploys it.
 */
class ApiContractTest {

    /**
     * Every DTO the frontend mirrors. A record that no TypeScript interface
     * copies does not belong here — the contract is for types that cross the
     * wire into hand-written code, not for every DTO in the codebase.
     */
    private static final Map<String, Class<?>> CONTRACTED = new LinkedHashMap<>();

    static {
        CONTRACTED.put("EventDTO", EventDTO.class);
        CONTRACTED.put("ClubDTO", ClubDTO.class);
        CONTRACTED.put("UserDTO", UserDTO.class);
        CONTRACTED.put("MyEventDTO", MyEventDTO.class);
        CONTRACTED.put("AuthenticationResponse", AuthenticationResponse.class);
        CONTRACTED.put("ClubAdminRequestDTO", ClubAdminRequestDTO.class);
        CONTRACTED.put("ClubAdminDTO", ClubAdminDTO.class);
        CONTRACTED.put("ClubInvitationDTO", ClubInvitationDTO.class);
        CONTRACTED.put("OwnershipTransferDTO", OwnershipTransferDTO.class);
        CONTRACTED.put("ClubAuditLogDTO", ClubAuditLogDTO.class);
        CONTRACTED.put("ManagedClubDTO", ManagedClubDTO.class);
        CONTRACTED.put("UserProfileDTO", UserProfileDTO.class);
        // Contracted in its own right because the contract records a
        // nested object as a single field name -- UserProfileDTO
        // contributes "socialLinks" and nothing about what is inside it,
        // so without this entry these three names cross the wire
        // unchecked.
        CONTRACTED.put("ProfileSocialLinksDTO", ProfileSocialLinksDTO.class);
        CONTRACTED.put("NotificationPreferencesDTO", NotificationPreferencesDTO.class);
        CONTRACTED.put("InterestDTO", InterestDTO.class);
        CONTRACTED.put("ClubCategoryDTO", ClubCategoryDTO.class);
        CONTRACTED.put("EventFormatDTO", EventFormatDTO.class);
    }

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void everyContractedDtoSerialisesExactlyTheAgreedFieldNames() throws IOException {
        JsonNode contract = mapper.readTree(contractFile().toFile());

        // Reported together rather than one per run: a rename usually moves two
        // or three fields at once, and finding out about the second one only
        // after fixing the first is a slow way to learn what changed.
        SoftAssertions softly = new SoftAssertions();

        CONTRACTED.forEach((name, type) -> softly.assertThat(serialisedFieldNames(type))
                .as("%s — update contracts/api-dto-fields.json and the TypeScript "
                        + "mirror in the same commit as the record", name)
                .isEqualTo(agreedFieldNames(contract, name)));

        softly.assertAll();
    }

    @Test
    void theContractDoesNotNameATypeNobodyChecks() throws IOException {
        // Without this, deleting an entry from CONTRACTED silently stops
        // checking that DTO while leaving the contract file looking complete.
        JsonNode contract = mapper.readTree(contractFile().toFile());

        Set<String> documented = new TreeSet<>();
        contract.fieldNames().forEachRemaining(field -> {
            if (!field.startsWith("$")) {
                documented.add(field);
            }
        });

        assertThat(documented).isEqualTo(new TreeSet<>(CONTRACTED.keySet()));
    }

    /**
     * The names Jackson will actually put on the wire.
     *
     * <p>Introspection rather than serialising an instance: it needs no
     * populated object, and it reports the field even when its value would be
     * null. A test that built instances would silently stop checking any field
     * left unset.
     */
    private Set<String> serialisedFieldNames(Class<?> type) {
        BeanDescription description = mapper.getSerializationConfig()
                .introspect(mapper.constructType(type));
        Set<String> names = new TreeSet<>();
        for (BeanPropertyDefinition property : description.findProperties()) {
            names.add(property.getName());
        }
        return names;
    }

    private Set<String> agreedFieldNames(JsonNode contract, String dto) {
        JsonNode names = contract.get(dto);
        assertThat(names)
                .as("contracts/api-dto-fields.json has no entry for %s", dto)
                .isNotNull();

        Set<String> agreed = new TreeSet<>();
        names.forEach(name -> agreed.add(name.asText()));
        return agreed;
    }

    /**
     * Surefire runs with the working directory at {@code backend/}, so the
     * contract sits one level up. Resolved to an absolute path before the
     * existence check purely so the failure message says where it looked.
     */
    private Path contractFile() {
        Path path = Path.of("..", "contracts", "api-dto-fields.json").toAbsolutePath().normalize();
        assertThat(Files.exists(path))
                .as("API contract not found at %s — it is shared with the frontend "
                        + "and must not be moved without updating both tests", path)
                .isTrue();
        return path;
    }
}
