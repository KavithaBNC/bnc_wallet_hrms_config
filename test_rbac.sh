#!/bin/bash

# RBAC Test Script for HRMS
# Tests role-based access control with different user roles

set -e

BASE_URL="http://localhost:5000/api/v1"
RESULTS_FILE="rbac_test_results.txt"

echo "🧪 HRMS RBAC Test Suite" > $RESULTS_FILE
echo "======================" >> $RESULTS_FILE
echo "Date: $(date)" >> $RESULTS_FILE
echo "" >> $RESULTS_FILE

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test users
declare -A USERS=(
    ["SUPER_ADMIN"]="superadmin@test.hrms.com"
    ["ORG_ADMIN"]="orgadmin@test.hrms.com"
    ["HR_MANAGER"]="hrmanager@test.hrms.com"
    ["MANAGER"]="manager@test.hrms.com"
    ["EMPLOYEE"]="employee@test.hrms.com"
)

PASSWORD="Test@123"

# Store tokens
declare -A TOKENS
declare -A ORG_IDS

echo "Step 1: Login all test users and get tokens..."
echo "=============================================="

for ROLE in "${!USERS[@]}"; do
    EMAIL="${USERS[$ROLE]}"
    echo -n "Logging in $ROLE ($EMAIL)... "

    RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

    TOKEN=$(echo $RESPONSE | jq -r '.data.tokens.accessToken // empty')
    ORG_ID=$(echo $RESPONSE | jq -r '.data.user.employee.organizationId // empty')

    if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
        TOKENS[$ROLE]=$TOKEN
        ORG_IDS[$ROLE]=$ORG_ID
        echo -e "${GREEN}✓${NC}"
        echo "$ROLE: ✓ Login successful" >> $RESULTS_FILE
        if [ -n "$ORG_ID" ] && [ "$ORG_ID" != "null" ]; then
            echo "  Organization ID: $ORG_ID" >> $RESULTS_FILE
        fi
    else
        echo -e "${RED}✗${NC}"
        echo "$ROLE: ✗ Login failed" >> $RESULTS_FILE
        echo "  Response: $RESPONSE" >> $RESULTS_FILE
    fi
done

echo ""
echo "Step 2: Test Employee List Access (Organization Filtering)"
echo "==========================================================="

for ROLE in "${!USERS[@]}"; do
    TOKEN="${TOKENS[$ROLE]}"
    ORG_ID="${ORG_IDS[$ROLE]}"

    if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
        echo "$ROLE: Skipped (no token)" >> $RESULTS_FILE
        continue
    fi

    echo -n "Testing $ROLE... "

    # Test 1: Get employees without organizationId
    RESPONSE=$(curl -s -X GET "$BASE_URL/employees?limit=5" \
        -H "Authorization: Bearer $TOKEN")

    STATUS=$(echo $RESPONSE | jq -r '.status // empty')
    COUNT=$(echo $RESPONSE | jq -r '.data.employees | length // 0')
    HAS_SENSITIVE=$(echo $RESPONSE | jq -r '.data.employees[0].address // empty')

    echo "" >> $RESULTS_FILE
    echo "=== $ROLE Employee List Test ===" >> $RESULTS_FILE

    if [ "$STATUS" == "success" ]; then
        echo -e "${GREEN}✓${NC} Access granted"
        echo "  ✓ Access: Granted" >> $RESULTS_FILE
        echo "  ✓ Employees returned: $COUNT" >> $RESULTS_FILE

        # Check if sensitive data is included
        if [ -n "$HAS_SENSITIVE" ] && [ "$HAS_SENSITIVE" != "null" ]; then
            echo "  ✓ Sensitive data: Included (address field present)" >> $RESULTS_FILE
        else
            echo "  ○ Sensitive data: Excluded (as expected for limited roles)" >> $RESULTS_FILE
        fi
    else
        ERROR=$(echo $RESPONSE | jq -r '.message // "Unknown error"')
        echo -e "${RED}✗${NC} Failed: $ERROR"
        echo "  ✗ Access: Denied" >> $RESULTS_FILE
        echo "  ✗ Error: $ERROR" >> $RESULTS_FILE
    fi

    # Test 2: Try to access different organization (if not SUPER_ADMIN)
    if [ "$ROLE" != "SUPER_ADMIN" ] && [ -n "$ORG_ID" ] && [ "$ORG_ID" != "null" ]; then
        echo -n "  Testing cross-org access... "

        FAKE_ORG_ID="00000000-0000-0000-0000-000000000000"
        RESPONSE2=$(curl -s -X GET "$BASE_URL/employees?organizationId=$FAKE_ORG_ID&limit=5" \
            -H "Authorization: Bearer $TOKEN")

        STATUS2=$(echo $RESPONSE2 | jq -r '.status // empty')

        if [ "$STATUS2" == "error" ]; then
            echo -e "${GREEN}✓${NC} Blocked (as expected)"
            echo "  ✓ Cross-org access: Blocked (security working)" >> $RESULTS_FILE
        else
            echo -e "${RED}✗${NC} NOT BLOCKED (SECURITY ISSUE!)"
            echo "  ✗ Cross-org access: NOT BLOCKED (SECURITY VULNERABILITY!)" >> $RESULTS_FILE
        fi
    fi
done

echo ""
echo "Step 3: Test Create Employee Permissions"
echo "========================================="

for ROLE in "${!USERS[@]}"; do
    TOKEN="${TOKENS[$ROLE]}"
    ORG_ID="${ORG_IDS[$ROLE]}"

    if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
        continue
    fi

    echo -n "Testing $ROLE create permission... "

    # Use first org ID if available
    TEST_ORG_ID="${ORG_IDS[ORG_ADMIN]}"

    RESPONSE=$(curl -s -X POST "$BASE_URL/employees" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "{
            \"organizationId\":\"$TEST_ORG_ID\",
            \"firstName\":\"Test\",
            \"lastName\":\"RBAC-$ROLE\",
            \"email\":\"test.rbac.$ROLE@test.com\",
            \"phone\":\"1234567890\",
            \"dateOfJoining\":\"2026-01-24\"
        }")

    STATUS=$(echo $RESPONSE | jq -r '.status // empty')

    echo "" >> $RESULTS_FILE
    echo "=== $ROLE Create Employee Test ===" >> $RESULTS_FILE

    if [ "$STATUS" == "success" ]; then
        echo -e "${GREEN}✓${NC} Allowed"
        echo "  ✓ Create permission: Granted" >> $RESULTS_FILE
    elif [ "$STATUS" == "error" ]; then
        ERROR=$(echo $RESPONSE | jq -r '.message // "Unknown error"')
        if [[ "$ERROR" == *"permission"* ]] || [[ "$ERROR" == *"403"* ]]; then
            echo -e "${YELLOW}○${NC} Denied (as expected)"
            echo "  ○ Create permission: Denied (as expected for limited roles)" >> $RESULTS_FILE
        else
            echo -e "${RED}✗${NC} Error: $ERROR"
            echo "  ✗ Create error: $ERROR" >> $RESULTS_FILE
        fi
    fi
done

echo ""
echo "Step 4: Test Delete Employee Permissions"
echo "========================================="

# Get a test employee ID first
ORG_ADMIN_TOKEN="${TOKENS[ORG_ADMIN]}"
TEST_ORG_ID="${ORG_IDS[ORG_ADMIN]}"

if [ -n "$ORG_ADMIN_TOKEN" ] && [ -n "$TEST_ORG_ID" ]; then
    RESPONSE=$(curl -s -X GET "$BASE_URL/employees?organizationId=$TEST_ORG_ID&limit=1" \
        -H "Authorization: Bearer $ORG_ADMIN_TOKEN")

    TEST_EMPLOYEE_ID=$(echo $RESPONSE | jq -r '.data.employees[0].id // empty')

    if [ -n "$TEST_EMPLOYEE_ID" ] && [ "$TEST_EMPLOYEE_ID" != "null" ]; then
        for ROLE in "${!USERS[@]}"; do
            TOKEN="${TOKENS[$ROLE]}"

            if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
                continue
            fi

            echo -n "Testing $ROLE delete permission... "

            RESPONSE=$(curl -s -X DELETE "$BASE_URL/employees/$TEST_EMPLOYEE_ID" \
                -H "Authorization: Bearer $TOKEN")

            STATUS=$(echo $RESPONSE | jq -r '.status // empty')

            echo "" >> $RESULTS_FILE
            echo "=== $ROLE Delete Employee Test ===" >> $RESULTS_FILE

            if [ "$STATUS" == "success" ]; then
                echo -e "${GREEN}✓${NC} Allowed"
                echo "  ✓ Delete permission: Granted" >> $RESULTS_FILE
                break  # Stop after first successful delete
            elif [ "$STATUS" == "error" ]; then
                ERROR=$(echo $RESPONSE | jq -r '.message // "Unknown error"')
                if [[ "$ERROR" == *"permission"* ]] || [[ "$ERROR" == *"403"* ]]; then
                    echo -e "${YELLOW}○${NC} Denied (as expected)"
                    echo "  ○ Delete permission: Denied (as expected for limited roles)" >> $RESULTS_FILE
                else
                    echo -e "${RED}✗${NC} Error: $ERROR"
                    echo "  ✗ Delete error: $ERROR" >> $RESULTS_FILE
                fi
            fi
        done
    else
        echo "No test employee found for delete test" >> $RESULTS_FILE
    fi
fi

echo ""
echo "================================================"
echo "Test Summary"
echo "================================================"
echo ""
cat $RESULTS_FILE
echo ""
echo "Full results saved to: $RESULTS_FILE"
echo ""
echo "Expected Results:"
echo "  ✓ SUPER_ADMIN: Full access to all operations"
echo "  ✓ ORG_ADMIN: Create, update, delete employees in their org"
echo "  ✓ HR_MANAGER: Create, update employees (no delete)"
echo "  ○ MANAGER: View only (no create/update/delete)"
echo "  ○ EMPLOYEE: View only (no create/update/delete)"
echo "  ✓ Cross-org access blocked for all non-SUPER_ADMIN roles"
