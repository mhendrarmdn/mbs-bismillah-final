# Direct TopBoss Sync Setup

The app includes a **read-only** server-side sync endpoint at `/api/mbs-sync`.

It is designed to:
1. open the TopBoss student login page;
2. submit the configured company login + role + password;
3. keep the authenticated cookie only inside the server request;
4. read TopBoss pages used by the MBS Engine;
5. return structured data to the browser;
6. never submit business decisions.

## Required Vercel Environment Variables

Configure these in **Vercel → Project → Settings → Environment Variables**.

### Login location

Use either:

```
MBS_ARENA=a7
```

or a full login URL:

```
MBS_LOGIN_URL=https://mbs.top-boss.com/login/a7
```

The historical Simulation-1 HAR used arena `a7`. The competition arena may be different, so update this when needed.

### Company login

```
MBS_COMPANY_LOGIN=<company ID or company name required by that arena>
```

Different TopBoss arenas can ask for Company ID or Company name. The sync parser detects the first non-hidden login field automatically.

### Login role

```
MBS_ROLE_VALUE=CEO
```

The server tries to match this to the visible role text or the HTML option value.

### Password

```
MBS_PASSWORD=<company password>
```

Mark this as a sensitive/secret environment variable.

## Optional overrides

Only use these if TopBoss changes its login form and automatic detection fails:

```
MBS_COMPANY_FIELD=<HTML form field name>
MBS_PASSWORD_FIELD=<HTML form field name>
MBS_ROLE_FIELD=<HTML select field name>
MBS_LOGIN_ACTION=<full login POST URL>
MBS_LOGIN_METHOD=POST
MBS_HOME_URL=https://mbs.top-boss.com/home/a7
```

`MBS_HOME_URL` is normally unnecessary. Direct Sync now derives the arena dashboard from the login URL (for example `/login/a7` → `/home/a7`) and follows safe same-origin redirect URLs returned by the login response. Use the override only if a competition arena uses a non-standard post-login home URL.

## Data pulled by Direct Sync

While the game is running:

- `/decide/env` → environment
- `/analyse/operation` → round / operating history
- `/report/finance` → financial statements
- `/bus/boom` → economy
- `/bus/sales` → **Sales Status competitor history**

After the final round only:

- `/decide/rank` → final rankings

Rankings never feed the live optimizer.

## Security properties

- Credentials are not included in `index.html`.
- Credentials are not returned by the API.
- Credentials are not stored in browser localStorage.
- Credentials are not included in workspace export.
- Credentials should never be committed to GitHub.
- API responses use `Cache-Control: no-store`.
- The current integration is **read-only**. It has no endpoint for submitting TopBoss decisions.

## Using it

After setting the Vercel variables and redeploying:

1. Open MBS Decision Engine.
2. Go to **HAR Import**.
3. Click **Sync from TopBoss**.
4. If authentication succeeds, the same state-update pipeline used by HAR import loads the live data.
5. Run **Prepare Competition View**.

HAR import remains the fallback if TopBoss blocks server-side login or changes the login form.

## Important limitation

The historical HAR was recorded after login, so the exact competition login submit request was not captured. The server therefore discovers the login form dynamically, including hidden CSRF fields, company field, role field, password field, and form action.

If TopBoss uses JavaScript-only authentication, CAPTCHA, a bot challenge, or an arena-specific login flow that cannot be reproduced by normal HTTP form submission, Direct Sync will fail safely and HAR import should be used. A fresh HAR that starts **before pressing Login** would let us calibrate the login flow exactly.


## Troubleshooting Direct Sync

### LOGIN_REQUEST_NOT_DETECTED

TopBoss login pages can be Vue/JavaScript-driven rather than a traditional HTML `<form>`.

Current sync logic now:
- scans regular forms first;
- then scans global `input` / `select` elements and `v-model` fields;
- detects same-origin login requests from `axios.post`, `$.ajax`, or `fetch`;
- reads CSRF metadata when present;
- tries JSON first for JavaScript-driven login and form encoding as a fallback;
- normalizes visible role names such as `CEO` to the internal lowercase value when no static role option is present.

If detection still fails, the Direct Sync panel displays sanitized diagnostics containing detected field names and candidate endpoints. These diagnostics never include the configured password.

### LOGIN_FAILED

This means a login request was detected and sent, but TopBoss did not create an authenticated session.

Check:
1. the Production Vercel environment contains the correct arena/login URL;
2. the Company ID/name matches what that arena expects;
3. `MBS_ROLE_VALUE` matches the visible role (for example `CEO`);
4. the password is current;
5. the project was redeployed after changing Vercel environment variables.

If it still fails, capture a HAR beginning **before pressing Login** and ending after the dashboard loads. That HAR can reveal the exact login endpoint/payload without putting the password into source control.
