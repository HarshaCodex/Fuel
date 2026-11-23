package com.lazybuff.fuel.service;

import com.lazybuff.fuel.dto.StreakResponse;
import java.time.LocalDate;
import java.util.List;

/** Pure streak arithmetic over a user's distinct logged dates. */
final class StreakCalculator {

    private StreakCalculator() {}

    /**
     * @param datesDesc distinct logged dates on or before {@code today}, newest first
     * @param today the user's current local date
     */
    static StreakResponse compute(List<LocalDate> datesDesc, LocalDate today) {
        if (datesDesc.isEmpty()) {
            return new StreakResponse(0, 0, null);
        }
        int longest = 0;
        int run = 0;
        int newestRun = 0;
        boolean newestRunOpen = true;
        LocalDate previous = null;
        for (LocalDate date : datesDesc) {
            boolean continuesRun = previous != null && previous.minusDays(1).equals(date);
            if (previous != null && !continuesRun) {
                newestRunOpen = false;
            }
            run = continuesRun ? run + 1 : 1;
            longest = Math.max(longest, run);
            if (newestRunOpen) {
                newestRun = run;
            }
            previous = date;
        }
        LocalDate latest = datesDesc.getFirst();
        boolean alive = latest.equals(today) || latest.equals(today.minusDays(1));
        return new StreakResponse(alive ? newestRun : 0, longest, latest);
    }
}
