# Freccos Auth Testing Playbook

Auth: Custom email/password JWT (httpOnly cookies) + Emergent Google OAuth (session_token cookie).

## Seeded users (see /app/memory/test_credentials.md)
- priya@freccos.com / Demo1234!  (invite_code: FRECCOS1)
- arjun@freccos.com / Demo1234!
- sara@freccos.com / Demo1234!

## Curl smoke tests
```
# Login
curl -c cookies.txt -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"priya@freccos.com","password":"Demo1234!"}'

# Me
curl -b cookies.txt $BASE/api/auth/me

# Validate invite
curl -X POST $BASE/api/auth/validate-invite -H "Content-Type: application/json" \
  -d '{"code":"FRECCOS1"}'

# Logout
curl -b cookies.txt -X POST $BASE/api/auth/logout
```

## Critical checks
- bcrypt hashes start with `$2b$`
- Login sets `access_token` and `refresh_token` httpOnly cookies
- /me returns user when cookie present, 401 otherwise
- Invite code validation: FRECCOS1 returns valid=true with referrer name
- Brand-new signup with invite FRECCOS1 mutual-follows Priya
- Google callback POST /api/auth/google/session with valid X-Session-ID exchanges and sets `session_token` cookie

## Frontend cookie usage
All axios calls MUST include `withCredentials: true`. The shared API client at `src/lib/api.js` already does this.
