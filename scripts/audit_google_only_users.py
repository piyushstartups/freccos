"""
Run against PROD MongoDB BEFORE deploying the Google sign-in removal.

Counts and lists users who would be locked out:
  - auth_provider == "google" AND (password_hash is null or missing)

Usage (set env vars from prod's backend/.env first):
    MONGO_URL='...' DB_NAME='...' python audit_google_only_users.py

Output: console summary + writes /tmp/google_only_users.csv with email,name,id,created_at
so you can email them a reset link before deploy.
"""
import os
import csv
import sys
from pymongo import MongoClient


def main():
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        print("ERROR: set MONGO_URL and DB_NAME env vars.", file=sys.stderr)
        sys.exit(1)
    db = MongoClient(mongo_url)[db_name]

    google_only_filter = {
        "auth_provider": "google",
        "$or": [{"password_hash": None}, {"password_hash": {"$exists": False}}],
    }

    summary = {
        "total_users":          db.users.count_documents({}),
        "password_or_unset":    db.users.count_documents({"$or": [{"auth_provider": "password"},
                                                                  {"auth_provider": {"$exists": False}}]}),
        "google_only_no_pwd":   db.users.count_documents(google_only_filter),
        "google_total":         db.users.count_documents({"auth_provider": "google"}),
        "both_linked":          db.users.count_documents({"auth_provider": "both"}),
    }
    print("=== PROD User Audit ===")
    for k, v in summary.items():
        print(f"  {k:25s} {v}")
    print()

    affected = list(db.users.find(google_only_filter,
                                  {"_id": 0, "id": 1, "email": 1, "name": 1, "created_at": 1}))
    if not affected:
        print("✅ No users would be locked out. Safe to deploy.")
        return
    print(f"⚠️  {len(affected)} users would be LOCKED OUT after deploy:")
    for u in affected[:20]:
        print(f"   - {u.get('email')}   {u.get('name')}   created={u.get('created_at')}")
    if len(affected) > 20:
        print(f"   ... and {len(affected) - 20} more")

    out_path = "/tmp/google_only_users.csv"
    with open(out_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["id", "email", "name", "created_at"])
        w.writeheader()
        for u in affected:
            w.writerow({k: u.get(k, "") for k in ("id", "email", "name", "created_at")})
    print(f"\n📄 Full list written to {out_path}")


if __name__ == "__main__":
    main()
