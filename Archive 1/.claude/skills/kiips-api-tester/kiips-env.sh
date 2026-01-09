#!/bin/bash
# ============================================================
# KiiPS Environment Configuration Script
# ============================================================
# This script automatically loads service ports from
# app-local.properties files to ensure consistency between
# actual system configuration and API testing.
#
# Usage:
#   source kiips-env.sh
#   # or
#   . kiips-env.sh
#
# After sourcing, use environment variables like:
#   curl -H "X-AUTH-TOKEN: $TOKEN" $KIIPS_GATEWAY/FDAPI/FD0101/LIST
# ============================================================

# Base directory (adjust if needed)
KIIPS_BASE="${KIIPS_BASE:-/Users/younghwankang/WORK/WORKSPACE/KiiPS}"

# Function to extract port from properties file
get_port() {
    local service_dir="$1"
    local props_file="$KIIPS_BASE/$service_dir/app-local.properties"

    if [ -f "$props_file" ]; then
        grep "^server.port=" "$props_file" 2>/dev/null | head -1 | cut -d'=' -f2 | tr -d ' '
    else
        echo ""
    fi
}

# ============================================================
# Auto-detect ports from app-local.properties
# ============================================================

echo "Loading KiiPS environment from: $KIIPS_BASE"
echo "============================================================"

# API Gateway
export KIIPS_GATEWAY_PORT=$(get_port "KIIPS-APIGateway")
export KIIPS_GATEWAY="http://localhost:${KIIPS_GATEWAY_PORT:-8088}"

# Authentication
export KIIPS_LOGIN_PORT=$(get_port "KiiPS-Login")
export KIIPS_LOGIN="http://localhost:${KIIPS_LOGIN_PORT:-8801}"

# UI
export KIIPS_UI_PORT=$(get_port "KiiPS-UI")
export KIIPS_UI="http://localhost:${KIIPS_UI_PORT:-8100}"

# Business Services
export KIIPS_FD_PORT=$(get_port "KiiPS-FD")
export KIIPS_FD="http://localhost:${KIIPS_FD_PORT:-8601}"

export KIIPS_IL_PORT=$(get_port "KiiPS-IL")
export KIIPS_IL="http://localhost:${KIIPS_IL_PORT:-8401}"

export KIIPS_PG_PORT=$(get_port "KiiPS-PG")
export KIIPS_PG="http://localhost:${KIIPS_PG_PORT:-8501}"

export KIIPS_COMMON_PORT=$(get_port "KiiPS-COMMON")
export KIIPS_COMMON="http://localhost:${KIIPS_COMMON_PORT:-8701}"

export KIIPS_SY_PORT=$(get_port "KiiPS-SY")
export KIIPS_SY="http://localhost:${KIIPS_SY_PORT:-8301}"

export KIIPS_AC_PORT=$(get_port "KiiPS-AC")
export KIIPS_AC="http://localhost:${KIIPS_AC_PORT:-8901}"

export KIIPS_EL_PORT=$(get_port "KiiPS-EL")
export KIIPS_EL="http://localhost:${KIIPS_EL_PORT:-8201}"

export KIIPS_LP_PORT=$(get_port "KiiPS-LP")
export KIIPS_LP="http://localhost:${KIIPS_LP_PORT:-8101}"

export KIIPS_RT_PORT=$(get_port "KiiPS-RT")
export KIIPS_RT="http://localhost:${KIIPS_RT_PORT:-8001}"

export KIIPS_MES_PORT=$(get_port "KiiPS-MES")
export KIIPS_MES="http://localhost:${KIIPS_MES_PORT:-8200}"

# Infrastructure Services
export KIIPS_MOBILE_PORT=$(get_port "KIIPS-MOBILE")
export KIIPS_MOBILE="http://localhost:${KIIPS_MOBILE_PORT:-8002}"

export KIIPS_BATCH_PORT=$(get_port "KIIPS-BATCH")
export KIIPS_BATCH="http://localhost:${KIIPS_BATCH_PORT:-9432}"

export KIIPS_KSD_PORT=$(get_port "KIIPS-KSD")
export KIIPS_KSD="http://localhost:${KIIPS_KSD_PORT:-9993}"

# Common headers
export KIIPS_API_KEY="SpammerGoHome"

# ============================================================
# Display loaded configuration
# ============================================================

echo ""
echo "Service Ports Loaded:"
echo "------------------------------------------------------------"
printf "%-20s %-8s %s\n" "Service" "Port" "URL"
echo "------------------------------------------------------------"
printf "%-20s %-8s %s\n" "API Gateway" "$KIIPS_GATEWAY_PORT" "$KIIPS_GATEWAY"
printf "%-20s %-8s %s\n" "Login" "$KIIPS_LOGIN_PORT" "$KIIPS_LOGIN"
printf "%-20s %-8s %s\n" "UI" "$KIIPS_UI_PORT" "$KIIPS_UI"
printf "%-20s %-8s %s\n" "FD (Fund)" "$KIIPS_FD_PORT" "$KIIPS_FD"
printf "%-20s %-8s %s\n" "IL (Investment)" "$KIIPS_IL_PORT" "$KIIPS_IL"
printf "%-20s %-8s %s\n" "PG (Program)" "$KIIPS_PG_PORT" "$KIIPS_PG"
printf "%-20s %-8s %s\n" "COMMON" "$KIIPS_COMMON_PORT" "$KIIPS_COMMON"
printf "%-20s %-8s %s\n" "SY (System)" "$KIIPS_SY_PORT" "$KIIPS_SY"
printf "%-20s %-8s %s\n" "AC (Accounting)" "$KIIPS_AC_PORT" "$KIIPS_AC"
printf "%-20s %-8s %s\n" "EL (E-Document)" "$KIIPS_EL_PORT" "$KIIPS_EL"
printf "%-20s %-8s %s\n" "LP" "$KIIPS_LP_PORT" "$KIIPS_LP"
printf "%-20s %-8s %s\n" "RT (Report)" "$KIIPS_RT_PORT" "$KIIPS_RT"
printf "%-20s %-8s %s\n" "MES" "$KIIPS_MES_PORT" "$KIIPS_MES"
printf "%-20s %-8s %s\n" "MOBILE" "$KIIPS_MOBILE_PORT" "$KIIPS_MOBILE"
printf "%-20s %-8s %s\n" "BATCH" "$KIIPS_BATCH_PORT" "$KIIPS_BATCH"
printf "%-20s %-8s %s\n" "KSD" "$KIIPS_KSD_PORT" "$KIIPS_KSD"
echo "------------------------------------------------------------"
echo ""

# ============================================================
# Helper Functions
# ============================================================

# Get JWT Token
kiips_login() {
    local username="${1:-admin}"
    local password="${2:-password}"

    export KIIPS_TOKEN=$(curl -s -X POST "$KIIPS_LOGIN/api/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$username\",\"password\":\"$password\"}" \
        | jq -r '.token // .body.token // empty')

    if [ -n "$KIIPS_TOKEN" ] && [ "$KIIPS_TOKEN" != "null" ]; then
        echo "Login successful. Token saved to \$KIIPS_TOKEN"
        echo "Token: ${KIIPS_TOKEN:0:50}..."
    else
        echo "Login failed. Check credentials or service status."
        return 1
    fi
}

# Call API through Gateway
kiips_api() {
    local endpoint="$1"
    local method="${2:-GET}"
    local data="$3"

    if [ -z "$KIIPS_TOKEN" ]; then
        echo "Error: No token. Run 'kiips_login' first."
        return 1
    fi

    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        curl -s -X "$method" "$KIIPS_GATEWAY/$endpoint" \
            -H "X-AUTH-TOKEN: $KIIPS_TOKEN" \
            -H "x-api-key: $KIIPS_API_KEY" \
            -H "Content-Type: application/json" \
            -d "$data" | jq '.'
    else
        curl -s -X "$method" "$KIIPS_GATEWAY/$endpoint" \
            -H "X-AUTH-TOKEN: $KIIPS_TOKEN" \
            -H "x-api-key: $KIIPS_API_KEY" | jq '.'
    fi
}

# Health check all services
kiips_health() {
    echo "Checking service health..."
    echo "------------------------------------------------------------"

    local services=(
        "Gateway:$KIIPS_GATEWAY_PORT"
        "Login:$KIIPS_LOGIN_PORT"
        "UI:$KIIPS_UI_PORT"
        "FD:$KIIPS_FD_PORT"
        "IL:$KIIPS_IL_PORT"
        "PG:$KIIPS_PG_PORT"
        "COMMON:$KIIPS_COMMON_PORT"
        "SY:$KIIPS_SY_PORT"
    )

    for svc in "${services[@]}"; do
        local name="${svc%%:*}"
        local port="${svc##*:}"
        local status=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$port/actuator/health" 2>/dev/null || echo "DOWN")

        if [ "$status" = "200" ]; then
            printf "%-15s %-8s \033[32mUP\033[0m\n" "$name" "$port"
        else
            printf "%-15s %-8s \033[31mDOWN ($status)\033[0m\n" "$name" "$port"
        fi
    done

    echo "------------------------------------------------------------"
}

# ============================================================
# Usage Instructions
# ============================================================

echo "Helper Functions Available:"
echo "  kiips_login [username] [password]  - Get JWT token"
echo "  kiips_api <endpoint> [method] [data] - Call API"
echo "  kiips_health                        - Check all services"
echo ""
echo "Example:"
echo "  kiips_login admin password"
echo "  kiips_api FDAPI/FD0101/LIST"
echo "  kiips_api PGAPI/PG0203/LIST POST '{\"key\":\"value\"}'"
echo ""
echo "Environment loaded successfully!"
