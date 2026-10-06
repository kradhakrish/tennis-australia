#!/usr/bin/env bash
# Configures the json2html overlay for /news/{articleId} pages and previews every article.
#
# Usage:
#   AEM_ADMIN_TOKEN=<token> tools/json2html/setup.sh [--publish] [--skip-config] [--create-site-config]
#
# Get a token by signing in at https://admin.hlx.page/login and copying the
# auth token, or use an Admin API key for the site.

set -euo pipefail

ORG="kradhakrish"
SITE="tennis-australia"
BRANCH="${BRANCH:-main}"
ADMIN="https://admin.hlx.page"
JSON2HTML="https://json2html.adobeaem.workers.dev"
ARTICLE_LIST="https://publish-p158407-e1689364.adobeaemcloud.com/graphql/execute.json/tennis-australia/article-list"
DIR="$(cd "$(dirname "$0")" && pwd)"

PUBLISH=false
SKIP_CONFIG=false
CREATE_SITE_CONFIG=false
for arg in "$@"; do
  case "$arg" in
    --publish) PUBLISH=true ;;
    --skip-config) SKIP_CONFIG=true ;;
    --create-site-config) CREATE_SITE_CONFIG=true ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

if [[ -z "${AEM_ADMIN_TOKEN:-}" ]]; then
  echo "AEM_ADMIN_TOKEN is not set." >&2
  exit 1
fi

request() {
  # request <method> <url> [json-file] ; prints body, fails on non-2xx
  local method="$1" url="$2" data="${3:-}" out status
  out="$(mktemp)"
  if [[ -n "$data" ]]; then
    status="$(curl -sS -o "$out" -w '%{http_code}' -X "$method" "$url" \
      -H "x-auth-token: ${AEM_ADMIN_TOKEN}" \
      -H "Authorization: token ${AEM_ADMIN_TOKEN}" \
      -H 'Content-Type: application/json' \
      --data-binary "@${data}")"
  else
    status="$(curl -sS -o "$out" -w '%{http_code}' -X "$method" "$url" \
      -H "x-auth-token: ${AEM_ADMIN_TOKEN}" \
      -H "Authorization: token ${AEM_ADMIN_TOKEN}")"
  fi
  cat "$out"
  rm -f "$out"
  [[ "$status" =~ ^2 ]] || { echo >&2; echo "HTTP $status for $method $url" >&2; return 1; }
}

if [[ "$SKIP_CONFIG" == false ]]; then
  echo "==> Checking Configuration Service for ${ORG}/${SITE}"
  config_status="$(curl -sS -o /dev/null -w '%{http_code}' \
    -H "x-auth-token: ${AEM_ADMIN_TOKEN}" "${ADMIN}/config/${ORG}/sites/${SITE}.json")"
  if [[ "$config_status" == "200" ]]; then
    echo "==> Adding json2html overlay to content source"
    request POST "${ADMIN}/config/${ORG}/sites/${SITE}/content.json" "${DIR}/content-config.json" > /dev/null
  elif [[ "$config_status" != "404" ]]; then
    echo "Could not read site config (HTTP ${config_status}). Check the token." >&2
    exit 1
  elif [[ "$CREATE_SITE_CONFIG" == false ]]; then
    echo "Site ${ORG}/${SITE} is not on Configuration Service (it uses fstab.yaml)." >&2
    echo "Overlays need Configuration Service. Re-run with --create-site-config to create it." >&2
    exit 1
  else
    echo "==> Creating site config on Configuration Service (fstab.yaml will no longer be used)"
    site_config="$(mktemp)"
    python3 - "$DIR/content-config.json" "$ORG" "$SITE" > "$site_config" << 'PY'
import json, sys
content = json.load(open(sys.argv[1]))
print(json.dumps({"code": {"owner": sys.argv[2], "repo": sys.argv[3]}, "content": content}))
PY
    request PUT "${ADMIN}/config/${ORG}/sites/${SITE}.json" "$site_config" > /dev/null
    rm -f "$site_config"
  fi

  echo "==> Uploading json2html config for ${BRANCH}"
  request POST "${JSON2HTML}/config/${ORG}/${SITE}/${BRANCH}" "${DIR}/json2html-config.json" > /dev/null
fi

echo "==> Previewing article pages"
ids="$(curl -sS "${ARTICLE_LIST}" | python3 -c '
import json, sys
for item in json.load(sys.stdin)["data"]["articleList"]["items"]:
    print(item["_id"])
')"

for id in $ids; do
  path="news/${id}"
  request POST "${ADMIN}/preview/${ORG}/${SITE}/${BRANCH}/${path}" > /dev/null
  echo "    previewed https://${BRANCH}--${SITE}--${ORG}.aem.page/${path}"
  if [[ "$PUBLISH" == true ]]; then
    request POST "${ADMIN}/live/${ORG}/${SITE}/${BRANCH}/${path}" > /dev/null
    echo "    published https://${BRANCH}--${SITE}--${ORG}.aem.live/${path}"
  fi
done

echo "Done."
