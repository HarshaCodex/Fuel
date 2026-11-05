package com.lazybuff.fuel.repository;

import com.lazybuff.fuel.entity.TrackingEntry;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface TrackingEntryRepository extends JpaRepository<TrackingEntry, UUID> {

    /** Ownership is part of the query so another user's id looks the same as an unknown one. */
    Optional<TrackingEntry> findByIdAndUserId(UUID id, UUID userId);

    List<TrackingEntry> findByUserIdAndLogDateOrderByLoggedAtAscCreatedAtAsc(
            UUID userId, LocalDate logDate);

    /**
     * Distinct diary dates up to {@code today}, newest first. Soft-deleted entries are already
     * excluded. Only dates are loaded, never entries, so long histories stay cheap.
     */
    @Query(
            "select distinct e.logDate from TrackingEntry e where e.user.id = :userId"
                    + " and e.logDate <= :today order by e.logDate desc")
    List<LocalDate> findDistinctLogDates(
            @Param("userId") UUID userId, @Param("today") LocalDate today);

    /**
     * Per-day sums for {@code from} to {@code to} (both inclusive), newest first, in one grouped
     * query. Days without entries produce no row; soft-deleted entries are already excluded.
     */
    @Query(
            "select new com.lazybuff.fuel.repository.DailyTotals(e.logDate, sum(e.calories),"
                    + " sum(e.protein), sum(e.carbs), sum(e.fat), sum(e.fiber), count(e))"
                    + " from TrackingEntry e where e.user.id = :userId"
                    + " and e.logDate between :from and :to"
                    + " group by e.logDate order by e.logDate desc")
    List<DailyTotals> findDailyTotals(
            @Param("userId") UUID userId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    /**
     * Deletes the tracking entries of accounts soft-deleted before {@code cutoff}. Run before
     * purging their custom foods: the entries reference those foods through a plain foreign key.
     *
     * @return the number of entries deleted
     */
    @Modifying
    @Query(
            value =
                    """
                    DELETE FROM tracking_entries
                    WHERE user_id IN (
                        SELECT id FROM users WHERE deleted_at IS NOT NULL AND deleted_at < :cutoff)
                    """,
            nativeQuery = true)
    int deleteEntriesOfUsersDeletedBefore(@Param("cutoff") Instant cutoff);
}
