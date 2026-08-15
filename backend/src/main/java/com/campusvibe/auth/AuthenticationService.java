package com.campusvibe.auth;

import com.campusvibe.auth.token.AuthTokenPurpose;
import com.campusvibe.auth.token.AuthTokenService;
import com.campusvibe.exception.DuplicateResourceException;
import com.campusvibe.exception.TooManyAttemptsException;
import com.campusvibe.jwt.JWTUtil;
import com.campusvibe.mail.AppMailProperties;
import com.campusvibe.mail.MailSender;
import com.campusvibe.security.ratelimit.AuthRateLimiter;
import com.campusvibe.user.*;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthenticationService {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserDTOMapper userDTOMapper;
    private final JWTUtil jwtUtil;
    private final GoogleTokenVerifier googleTokenVerifier;
    private final AuthRateLimiter rateLimiter;
    private final AuthTokenService authTokenService;
    private final MailSender mailSender;
    private final AppMailProperties mailProperties;
    private final boolean requireVerifiedEmail;

    public AuthenticationService(AuthenticationManager authenticationManager,
                                 UserRepository userRepository,
                                 RoleRepository roleRepository,
                                 PasswordEncoder passwordEncoder,
                                 UserDTOMapper userDTOMapper,
                                 JWTUtil jwtUtil,
                                 GoogleTokenVerifier googleTokenVerifier,
                                 AuthRateLimiter rateLimiter,
                                 AuthTokenService authTokenService,
                                 MailSender mailSender,
                                 AppMailProperties mailProperties,
                                 @Value("${campusvibe.auth.require-verified-email:false}")
                                 boolean requireVerifiedEmail) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.userDTOMapper = userDTOMapper;
        this.jwtUtil = jwtUtil;
        this.googleTokenVerifier = googleTokenVerifier;
        this.rateLimiter = rateLimiter;
        this.authTokenService = authTokenService;
        this.mailSender = mailSender;
        this.mailProperties = mailProperties;
        this.requireVerifiedEmail = requireVerifiedEmail;
    }

    public AuthenticationResponse login(AuthenticationRequest request) {
        String email = normalise(request.email());

        // Checked before authenticate(), so a locked account costs no bcrypt.
        if (rateLimiter.isAccountLocked(email)) {
            throw new TooManyAttemptsException(
                    "Too many failed sign-in attempts. Try again later.",
                    rateLimiter.lockoutSeconds());
        }

        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, request.password())
            );
        } catch (AuthenticationException e) {
            // Counted for an unknown address as well as a wrong password —
            // see AuthRateLimiter.recordFailedLogin for why.
            rateLimiter.recordFailedLogin(email);
            throw e;
        }

        rateLimiter.recordSuccessfulLogin(email);
        User principal = (User) authentication.getPrincipal();

        // Off by default. Turning it on is a product decision, not a security
        // one: it trades a real barrier against throwaway addresses for locking
        // out anyone whose confirmation mail never arrives.
        if (requireVerifiedEmail && !principal.isEmailVerified()) {
            throw new EmailNotVerifiedException(
                    "Confirm your email address before signing in. Check your inbox for the link.");
        }

        return respondWithToken(principal);
    }

    /**
     * Whether an address is already taken, and by which kind of account.
     *
     * <p>This deliberately confirms that an account exists — it is the one
     * place in the system that does. The signup form asks as soon as the email
     * field is complete, so that someone who first signed up with Google is
     * told to continue with Google instead of discovering it by failing to
     * register. The cost is account enumeration on this endpoint, which is the
     * accepted trade; rate limiting is what bounds it.
     */
    @Transactional(readOnly = true)
    public EmailStatusResponse emailStatus(String email) {
        return userRepository.findByEmail(normalise(email))
                .map(u -> new EmailStatusResponse(true, u.getAuthProvider().name()))
                .orElseGet(() -> new EmailStatusResponse(false, null));
    }

    @Transactional
    public AuthenticationResponse register(RegisterRequest request) {
        String email = normalise(request.email());
        userRepository.findByEmail(email).ifPresent(existing -> {
            // Provider-aware, because 'an account already exists' is a dead end
            // for someone whose account is a Google one: there is no password
            // they could remember and no reset that would help them.
            throw new DuplicateResourceException(
                    existing.getAuthProvider() == AuthProvider.GOOGLE
                            ? "This email is already registered through Google. Continue with Google to sign in."
                            : "An account with this email already exists");
        });
        User user = new User();
        user.setName(request.name());
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setAuthProvider(AuthProvider.LOCAL);
        user.addRole(defaultRole());
        userRepository.save(user);
        sendVerificationEmail(user);
        return respondWithToken(user);
    }

    @Transactional
    public AuthenticationResponse googleSignIn(GoogleSignInRequest request) {
        GoogleIdToken.Payload payload = googleTokenVerifier.verify(request.idToken());
        if (payload == null) {
            throw new BadCredentialsException("Invalid Google token");
        }

        // Google will happily issue a token for an address the account holder
        // has never proven they own. Because the lookup below matches on email
        // alone, trusting an unverified one would let such a token sign in as an
        // existing CampusVibe user (BUG-031).
        if (!Boolean.TRUE.equals(payload.getEmailVerified())) {
            throw new BadCredentialsException("This Google account has no verified email address");
        }

        String email = normalise(payload.getEmail());
        String name = (String) payload.get("name");
        User user = userRepository.findByEmail(email).orElseGet(() -> {
            User u = new User();
            u.setEmail(email);
            u.setName(name != null ? name : email);
            // No password, and none is invented: V10 made the column nullable
            // precisely so this account can say it has none.
            u.setAuthProvider(AuthProvider.GOOGLE);
            // Google refuses to reach this line without a verified address -
            // the email_verified check above guarantees it.
            u.setEmailVerified(true);
            u.addRole(defaultRole());
            return userRepository.save(u);
        });
        return respondWithToken(user);
    }

    // --- password reset ---------------------------------------------------

    /**
     * Starts a password reset. Silent about everything.
     *
     * <p>Returns without signalling whether the address exists, whether it is a
     * Google account, or whether mail actually went out. Unlike
     * {@link #emailStatus}, there is no product reason for this endpoint to
     * confirm an account — so it does not, and an attacker learns nothing by
     * calling it.
     *
     * <p>A Google account gets no mail: it has no password to reset, and
     * inventing one would turn a mailbox compromise into a way to convert a
     * Google account into a password account.
     */
    @Transactional
    public void requestPasswordReset(String rawEmail) {
        String email = normalise(rawEmail);
        userRepository.findByEmail(email)
                .filter(u -> u.getAuthProvider() == AuthProvider.LOCAL)
                .ifPresent(user -> {
                    String token = authTokenService.issue(
                            user.getId(), AuthTokenPurpose.PASSWORD_RESET, mailProperties.resetTokenTtl());
                    mailSender.send(user.getEmail(), "Reset your CampusVibe password", """
                            Hi %s,

                            Someone asked to reset the password for this CampusVibe account.
                            Open the link below to choose a new one. It expires in %d minutes
                            and can only be used once.

                            %s/?auth=reset-password&token=%s

                            If this was not you, nothing has changed and you can ignore this email.
                            """.formatted(user.getName(), mailProperties.resetTokenTtl().toMinutes(),
                            mailProperties.appBaseUrl(), token));
                });
    }

    /**
     * Completes a reset. The token proves inbox control, so it stands in for
     * the old password.
     *
     * <p>Every outstanding reset token for the user dies with the redemption,
     * and the failure counter is cleared — someone who has just proven control
     * of the inbox should not stay locked out by the guesses that led them
     * here.
     */
    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        Long userId = authTokenService.redeem(rawToken, AuthTokenPurpose.PASSWORD_RESET)
                .orElseThrow(() -> new BadCredentialsException(
                        "This reset link is invalid or has expired. Request a new one."));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BadCredentialsException(
                        "This reset link is invalid or has expired. Request a new one."));

        user.setPassword(passwordEncoder.encode(newPassword));
        // Redeeming a mailed link is itself proof of the address.
        user.setEmailVerified(true);
        userRepository.save(user);
        rateLimiter.recordSuccessfulLogin(user.getEmail());
    }

    // --- email verification -----------------------------------------------

    /** Issues a verification token and mails the link. No-op if already verified. */
    @Transactional
    public void sendVerificationEmail(User user) {
        if (user.isEmailVerified()) return;
        String token = authTokenService.issue(
                user.getId(), AuthTokenPurpose.EMAIL_VERIFICATION, mailProperties.verifyTokenTtl());
        mailSender.send(user.getEmail(), "Confirm your CampusVibe email", """
                Hi %s,

                Confirm this address to finish setting up your CampusVibe account.
                The link expires in %d hours.

                %s/?auth=verify-email&token=%s

                If you did not create an account, you can ignore this email.
                """.formatted(user.getName(), mailProperties.verifyTokenTtl().toHours(),
                mailProperties.appBaseUrl(), token));
    }

    @Transactional
    public void verifyEmail(String rawToken) {
        Long userId = authTokenService.redeem(rawToken, AuthTokenPurpose.EMAIL_VERIFICATION)
                .orElseThrow(() -> new BadCredentialsException(
                        "This confirmation link is invalid or has expired. Request a new one."));

        userRepository.findById(userId).ifPresent(user -> {
            user.setEmailVerified(true);
            userRepository.save(user);
        });
    }

    /** Re-sends to the signed-in user. Requires a session, so it cannot be used to spam a stranger. */
    @Transactional
    public void resendVerification(User user) {
        sendVerificationEmail(user);
    }

    /**
     * Emails are matched case-insensitively, so they are stored and looked up in
     * one form. Without this, Ada@x.com and ada@x.com are two accounts, and the
     * signup collision check misses half of them.
     */
    private static String normalise(String email) {
        return email == null ? null : email.trim().toLowerCase(java.util.Locale.ROOT);
    }

    private AuthenticationResponse respondWithToken(User user) {
        UserDTO dto = userDTOMapper.apply(user);
        String token = jwtUtil.issueToken(user.getId(), user.getEmail(), user.getRoleNames());
        return new AuthenticationResponse(token, dto);
    }

    private Role defaultRole() {
        return roleRepository.findByName(RoleName.ROLE_USER.name())
                .orElseThrow(() -> new IllegalStateException(
                        "ROLE_USER is missing from the roles table; check Flyway migration V7"));
    }
}
