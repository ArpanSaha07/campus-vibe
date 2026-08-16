package com.campusvibe.exception;

import com.campusvibe.auth.EmailNotVerifiedException;
import com.campusvibe.common.Logs;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.InsufficientAuthenticationException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.time.LocalDateTime;

/**
 * Maps exceptions to the {@link ApiError} the API answers with.
 *
 * <p>Every handler has a distinct name rather than thirteen overloads of
 * {@code handleException}. Spring dispatches on the {@code @ExceptionHandler}
 * annotation, never on the parameter type, so the overloading bought nothing and
 * cost two things: a reader had to match brace to signature to see which one ran,
 * and a stack trace named {@code handleException} thirteen times over.
 */
@ControllerAdvice
public class DefaultExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(DefaultExceptionHandler.class);

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiError> handleResourceNotFound(ResourceNotFoundException e,
                                                           HttpServletRequest request) {
        ApiError apiError = new ApiError(
                request.getRequestURI(),
                e.getMessage(),
                HttpStatus.NOT_FOUND.value(),
                LocalDateTime.now()
        );

        return new ResponseEntity<>(apiError, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(InsufficientAuthenticationException.class)
    public ResponseEntity<ApiError> handleInsufficientAuthentication(InsufficientAuthenticationException e,
                                                                     HttpServletRequest request) {
        ApiError apiError = new ApiError(
                request.getRequestURI(),
                e.getMessage(),
                HttpStatus.FORBIDDEN.value(),
                LocalDateTime.now()
        );

        return new ResponseEntity<>(apiError, HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiError> handleBadCredentials(BadCredentialsException e,
                                                         HttpServletRequest request) {
        ApiError apiError = new ApiError(
                request.getRequestURI(),
                e.getMessage(),
                HttpStatus.UNAUTHORIZED.value(),
                LocalDateTime.now()
        );

        return new ResponseEntity<>(apiError, HttpStatus.UNAUTHORIZED);
    }

    // Without this, the generic Exception handler below would turn method-security
    // denials (@PreAuthorize) into 500s instead of 403s. No exception parameter:
    // the message is a fixed string, so there is nothing to read off the
    // exception, and Spring takes the type from the annotation.
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(HttpServletRequest request) {
        ApiError apiError = new ApiError(
                request.getRequestURI(),
                "Access denied",
                HttpStatus.FORBIDDEN.value(),
                LocalDateTime.now()
        );

        return new ResponseEntity<>(apiError, HttpStatus.FORBIDDEN);
    }

    // Likewise fixed: saying "no such user" here would confirm which addresses
    // have accounts, which is the whole point of answering "Invalid credentials".
    @ExceptionHandler(UsernameNotFoundException.class)
    public ResponseEntity<ApiError> handleUsernameNotFound(HttpServletRequest request) {
        ApiError apiError = new ApiError(
                request.getRequestURI(),
                "Invalid credentials",
                HttpStatus.UNAUTHORIZED.value(),
                LocalDateTime.now()
        );

        return new ResponseEntity<>(apiError, HttpStatus.UNAUTHORIZED);
    }

    @ExceptionHandler(DuplicateResourceException.class)
    public ResponseEntity<ApiError> handleDuplicateResource(DuplicateResourceException e,
                                                            HttpServletRequest request) {
        ApiError apiError = new ApiError(
                request.getRequestURI(),
                e.getMessage(),
                HttpStatus.CONFLICT.value(),
                LocalDateTime.now()
        );

        return new ResponseEntity<>(apiError, HttpStatus.CONFLICT);
    }

    @ExceptionHandler(RequestValidationException.class)
    public ResponseEntity<ApiError> handleRequestValidation(RequestValidationException e,
                                                            HttpServletRequest request) {
        ApiError apiError = new ApiError(
                request.getRequestURI(),
                e.getMessage(),
                HttpStatus.BAD_REQUEST.value(),
                LocalDateTime.now()
        );

        return new ResponseEntity<>(apiError, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleMethodArgumentNotValid(MethodArgumentNotValidException e,
                                                                 HttpServletRequest request) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(err -> err.getField() + " " + err.getDefaultMessage())
                .findFirst()
                .orElse("Validation failed");
        ApiError apiError = new ApiError(
                request.getRequestURI(),
                message,
                HttpStatus.BAD_REQUEST.value(),
                LocalDateTime.now()
        );

        return new ResponseEntity<>(apiError, HttpStatus.BAD_REQUEST);
    }

    // A path variable that cannot be converted — /api/v1/events/dance-party for
    // a Long id — is a malformed request, not a server fault. Without this the
    // catch-all below answered 500, which told the caller we had broken when in
    // fact they had asked for something that could never name a resource.
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> handleTypeMismatch(MethodArgumentTypeMismatchException e,
                                                       HttpServletRequest request) {
        // Deliberately does not echo e.getMessage(): it names the target Java
        // type and the controller parameter, which is internal detail.
        ApiError apiError = new ApiError(
                request.getRequestURI(),
                "Invalid value for '%s'".formatted(e.getName()),
                HttpStatus.BAD_REQUEST.value(),
                LocalDateTime.now()
        );

        return new ResponseEntity<>(apiError, HttpStatus.BAD_REQUEST);
    }

    // Right password, unconfirmed address. 403 rather than 401 so the client
    // does not tell the user their password is wrong when it is not.
    @ExceptionHandler(EmailNotVerifiedException.class)
    public ResponseEntity<ApiError> handleEmailNotVerified(EmailNotVerifiedException e,
                                                           HttpServletRequest request) {
        ApiError apiError = new ApiError(
                request.getRequestURI(),
                e.getMessage(),
                HttpStatus.FORBIDDEN.value(),
                LocalDateTime.now()
        );

        return new ResponseEntity<>(apiError, HttpStatus.FORBIDDEN);
    }

    // Account lockout. 429 rather than 401 so the client can tell 'wrong
    // password' from 'stop trying for a while', and Retry-After says how long.
    @ExceptionHandler(TooManyAttemptsException.class)
    public ResponseEntity<ApiError> handleTooManyAttempts(TooManyAttemptsException e,
                                                          HttpServletRequest request) {
        ApiError apiError = new ApiError(
                request.getRequestURI(),
                e.getMessage(),
                HttpStatus.TOO_MANY_REQUESTS.value(),
                LocalDateTime.now()
        );

        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", String.valueOf(e.getRetryAfterSeconds()))
                .body(apiError);
    }

    // Constraints on @RequestParam / @PathVariable (a @Validated controller)
    // surface as this rather than MethodArgumentNotValidException, which only
    // covers @Valid request bodies. Without this entry the catch-all below
    // answered 500 for an ordinary malformed query parameter — which is how
    // GET /api/v1/auth/email-status?email=not-an-email behaved.
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiError> handleConstraintViolation(ConstraintViolationException e,
                                                              HttpServletRequest request) {
        String message = e.getConstraintViolations().stream()
                .findFirst()
                .map(v -> {
                    String path = v.getPropertyPath().toString();
                    String field = path.contains(".") ? path.substring(path.lastIndexOf('.') + 1) : path;
                    return field + " " + v.getMessage();
                })
                .orElse("Validation failed");
        ApiError apiError = new ApiError(
                request.getRequestURI(),
                message,
                HttpStatus.BAD_REQUEST.value(),
                LocalDateTime.now()
        );

        return new ResponseEntity<>(apiError, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception e,
                                                     HttpServletRequest request) {
        // Logged in full, returned as a fixed string. Echoing e.getMessage()
        // handed internal detail to the caller for every exception nothing above
        // maps — a JVM helpful-NPE naming a private field and its type is the
        // example that prompted this (BUG-029). Anything a client legitimately
        // needs to act on deserves its own handler and its own status.
        //
        // The URI is scrubbed first: this is the line someone reads when working
        // out what went wrong, so it is the last one that should be forgeable by
        // the caller who caused it.
        log.error("Unhandled exception for {} {}",
                Logs.safe(request.getMethod()), Logs.safe(request.getRequestURI()), e);
        ApiError apiError = new ApiError(
                request.getRequestURI(),
                "Something went wrong. Please try again.",
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                LocalDateTime.now()
        );

        return new ResponseEntity<>(apiError, HttpStatus.INTERNAL_SERVER_ERROR);
    }

}
