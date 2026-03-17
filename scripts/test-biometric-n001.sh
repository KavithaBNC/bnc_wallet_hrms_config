#!/bin/bash
# Test biometric device GET and POST for employee N001
# Usage: ./scripts/test-biometric-n001.sh [BASE_URL] [SERIAL]
# Example: ./scripts/test-biometric-n001.sh http://localhost:5001 CQZ7224460246

BASE="${1:-http://localhost:5001}"
SERIAL="${2:-CQZ7224460246}"
CDATA="${BASE}/iclock/cdata"
CDATA_ASPX="${BASE}/iclock/cdata.aspx"

echo "=== Biometric device test for N001 ==="
echo "Base URL: $BASE"
echo "Serial:   $SERIAL"
echo ""

echo "1. GET handshake"
curl -s "${CDATA}?SN=${SERIAL}&options=all" | head -5
echo ""
echo ""

echo "2. POST punch (N001 IN) - tab-separated (eSSL format)"
TS=$(date +"%Y-%m-%d %H:%M:%S")
curl -s -X POST "${CDATA_ASPX}?SN=${SERIAL}&table=ATTLOG&Stamp=9999" \
  -H "Content-Type: text/plain" \
  -d "N001	${TS}	0	4	0			0	0"
echo ""
echo "   Sent: N001 IN at $TS"
echo ""

echo "3. POST punch (N001 OUT) - key=value format"
TS2=$(date +"%Y-%m-%d %H:%M:%S")
curl -s -X POST "${CDATA}?SN=${SERIAL}" \
  -H "Content-Type: text/plain" \
  -d "USERID=N001
TIMESTAMP=${TS2}
STATUS=1
SERIALNO=${SERIAL}"
echo ""
echo "   Sent: N001 OUT at $TS2"
echo ""

echo "4. GET getrequest (device polls)"
curl -s "${BASE}/iclock/getrequest.aspx?SN=${SERIAL}"
echo ""
echo ""

echo "Done. Check attendance_logs and attendance_punches in DB."
