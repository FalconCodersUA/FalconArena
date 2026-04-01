from pathlib import Path
import os
import sys


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python3 scripts/update-compose-env.py <env-file-path>", file=sys.stderr)
        return 1

    env_path = Path(sys.argv[1]).resolve()
    original_lines = env_path.read_text(encoding="utf-8").splitlines()

    values = {
        "NODE_ENV": os.getenv("NODE_ENV_VALUE", "production"),
        "POSTGRES_DB": os.getenv("POSTGRES_DB_VALUE", ""),
        "POSTGRES_USER": os.getenv("POSTGRES_USER_VALUE", ""),
        "POSTGRES_PASSWORD": os.getenv("POSTGRES_PASSWORD_VALUE", ""),
        "JWT_SECRET": os.getenv("JWT_SECRET_VALUE", ""),
        "BACKEND_PORT": os.getenv("BACKEND_PORT_VALUE", "4000"),
        "PRISMA_SYNC_MODE": os.getenv("PRISMA_SYNC_MODE_VALUE", "dbpush"),
        "APP_DOMAIN": os.getenv("APP_DOMAIN_VALUE", "falconarena.live"),
        "VITE_API_URL": os.getenv("VITE_API_URL_VALUE", "https://falconarena.live"),
        "JOBS_WORKER_ENABLED": os.getenv("JOBS_WORKER_ENABLED_VALUE", "true"),
        "STORAGE_PROVIDER": os.getenv("STORAGE_PROVIDER_VALUE", "local"),
        "STORAGE_LOCAL_DIR": os.getenv("STORAGE_LOCAL_DIR_VALUE", "/app/storage"),
        "STORAGE_LOCAL_PUBLIC_PREFIX": os.getenv("STORAGE_LOCAL_PUBLIC_PREFIX_VALUE", "/uploads"),
        "STORAGE_S3_ENDPOINT": os.getenv("STORAGE_S3_ENDPOINT_VALUE", ""),
        "STORAGE_S3_REGION": os.getenv("STORAGE_S3_REGION_VALUE", "auto"),
        "STORAGE_S3_BUCKET": os.getenv("STORAGE_S3_BUCKET_VALUE", ""),
        "STORAGE_S3_ACCESS_KEY_ID": os.getenv("STORAGE_S3_ACCESS_KEY_ID_VALUE", ""),
        "STORAGE_S3_SECRET_ACCESS_KEY": os.getenv("STORAGE_S3_SECRET_ACCESS_KEY_VALUE", ""),
        "STORAGE_S3_PUBLIC_BASE_URL": os.getenv("STORAGE_S3_PUBLIC_BASE_URL_VALUE", ""),
        "STORAGE_S3_KEY_PREFIX": os.getenv("STORAGE_S3_KEY_PREFIX_VALUE", "falconarena"),
        "STORAGE_S3_FORCE_PATH_STYLE": os.getenv("STORAGE_S3_FORCE_PATH_STYLE_VALUE", "true"),
        "EMAIL_NOTIFICATIONS_ENABLED": os.getenv("EMAIL_NOTIFICATIONS_ENABLED_VALUE", "false"),
        "EMAIL_PROVIDER": os.getenv("EMAIL_PROVIDER_VALUE", "console"),
        "EMAIL_FROM": os.getenv("EMAIL_FROM_VALUE", "no-reply@falconarena.live"),
        "EMAIL_REPLY_TO": os.getenv("EMAIL_REPLY_TO_VALUE", "team@falconarena.live"),
        "RESEND_API_KEY": os.getenv("RESEND_API_KEY_VALUE", ""),
        "GOOGLE_SHEETS_WEBHOOK_URL": os.getenv("GOOGLE_SHEETS_WEBHOOK_URL_VALUE", ""),
        "GOOGLE_SHEETS_WEBHOOK_SECRET": os.getenv("GOOGLE_SHEETS_WEBHOOK_SECRET_VALUE", ""),
        "GOOGLE_SHEETS_DEFAULT_SHEET_NAME": os.getenv("GOOGLE_SHEETS_DEFAULT_SHEET_NAME_VALUE", ""),
    }

    updated_lines = []
    seen_keys = set()

    for line in original_lines:
        if not line or line.lstrip().startswith("#") or "=" not in line:
            updated_lines.append(line)
            continue

        key, _ = line.split("=", 1)
        if key in values:
            updated_lines.append(f"{key}={values[key]}")
            seen_keys.add(key)
        else:
            updated_lines.append(line)

    for key, value in values.items():
        if key not in seen_keys:
            updated_lines.append(f"{key}={value}")

    env_path.write_text("\n".join(updated_lines).rstrip("\n") + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
