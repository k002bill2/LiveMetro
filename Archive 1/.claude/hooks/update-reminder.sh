#!/bin/bash

# KiiPS Skills Guide Update Check System
# Checks every 15 days for updates

UPDATE_LOG="skills guide/UPDATE_LOG.md"
LAST_CHECK_FILE=".claude/.last-update-check"
UPDATE_INTERVAL=15

# Current timestamp
CURRENT_TIMESTAMP=$(date +%s)
CURRENT_DATE=$(date +%Y-%m-%d)

# Check last update time
if [ -f "$LAST_CHECK_FILE" ]; then
    LAST_CHECK=$(cat "$LAST_CHECK_FILE")
    DAYS_SINCE_CHECK=$(( (CURRENT_TIMESTAMP - LAST_CHECK) / 86400 ))

    # Alert if 15+ days passed
    if [ $DAYS_SINCE_CHECK -ge $UPDATE_INTERVAL ]; then
        echo ""
        echo "=========================================================="
        echo "  Skills Guide Update Reminder"
        echo "=========================================================="
        echo "  Last check: ${DAYS_SINCE_CHECK} days ago"
        echo ""
        echo "  Items to check:"
        echo "  - Claude Code CLI version (current: v2.0.76)"
        echo "  - New model releases (Opus/Sonnet/Haiku)"
        echo "  - KiiPS documentation changes"
        echo "  - Skills Guide updates"
        echo ""
        echo "  Update command:"
        echo "    'Update Skills Guide to latest info'"
        echo "=========================================================="
        echo ""

        # Update timestamp
        echo "$CURRENT_TIMESTAMP" > "$LAST_CHECK_FILE"
    fi
else
    # Initialize on first run
    echo "$CURRENT_TIMESTAMP" > "$LAST_CHECK_FILE"
    echo "Skills Guide update check system initialized (15-day interval)"
fi

# Check UPDATE_LOG.md last update date
if [ -f "$UPDATE_LOG" ]; then
    LAST_UPDATE=$(grep "업데이트 날짜" "$UPDATE_LOG" | grep -oE "[0-9]{4}-[0-9]{2}-[0-9]{2}" | head -1)

    if [ ! -z "$LAST_UPDATE" ]; then
        LAST_UPDATE_TS=$(date -jf "%Y-%m-%d" "$LAST_UPDATE" +%s 2>/dev/null || echo "0")

        if [ "$LAST_UPDATE_TS" != "0" ]; then
            DAYS_SINCE_UPDATE=$(( (CURRENT_TIMESTAMP - LAST_UPDATE_TS) / 86400 ))

            # Info message (only alert every 15 days)
            if [ $DAYS_SINCE_UPDATE -lt 7 ]; then
                echo "Skills Guide last updated: ${DAYS_SINCE_UPDATE} days ago (up to date)"
            fi
        fi
    fi
fi
