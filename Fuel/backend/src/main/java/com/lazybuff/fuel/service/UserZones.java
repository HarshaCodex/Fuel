package com.lazybuff.fuel.service;

import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.exception.FuelException;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;

/** Resolves the timezone that decides which calendar day a moment belongs to for a user. */
@Slf4j
final class UserZones {

    private UserZones() {}

    /** Rejects ids that are not IANA zone ids; a null id is allowed and means "not provided". */
    static void requireValid(String timezone) {
        if (timezone != null && !ZoneId.getAvailableZoneIds().contains(timezone)) {
            throw new FuelException(HttpStatus.BAD_REQUEST, "Invalid timezone.");
        }
    }

    static ZoneId of(User user, UUID userId) {
        try {
            return ZoneId.of(user.getTimezone());
        } catch (DateTimeException exception) {
            // Registration does not validate IANA ids; the timezone itself is not logged.
            log.warn("User:{} has an invalid timezone, using UTC", userId);
            return ZoneOffset.UTC;
        }
    }
}
