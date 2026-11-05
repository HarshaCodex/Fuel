package com.lazybuff.fuel.service;

import com.lazybuff.fuel.entity.User;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;

/** Resolves the timezone that decides which calendar day a moment belongs to for a user. */
@Slf4j
final class UserZones {

    private UserZones() {}

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
