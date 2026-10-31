# Email Setup

Fuel sends transactional email (verification codes, password-reset links) through Spring's
`JavaMailSender` over SMTP. The same code serves every environment. Only configuration changes.

| Environment | Profile | Where mail goes |
|-------------|---------|-----------------|
| Local / Docker Compose | *(default)* | Mailpit catcher, view at `http://localhost:8025`. Nothing reaches real inboxes. |
| Production | `prod` | A real SMTP provider, delivered to the user's actual mailbox (Gmail, Outlook, iCloud, ...). |

## Production

Activate the profile and set the variables below (from your secret manager / deployment
environment, **never** in source control):

```dotenv
SPRING_PROFILES_ACTIVE=prod
MAIL_HOST=<provider SMTP host>
MAIL_PORT=587                     # optional, defaults to 587 (STARTTLS)
MAIL_USERNAME=<provider SMTP username>
MAIL_PASSWORD=<provider SMTP password / API key>
MAIL_FROM=no-reply@<your-verified-domain>
FRONTEND_URL=https://<your-app-domain>
```

The `prod` profile (`application-prod.properties`) always enables SMTP auth and **requires**
STARTTLS. It also sets `spring.mail.test-connection=true`, so the app connects and logs in to the
provider at startup:

- Missing `MAIL_HOST`, `MAIL_FROM` or `FRONTEND_URL`: startup fails with
  `Could not resolve placeholder ...`.
- Missing or wrong `MAIL_USERNAME` / `MAIL_PASSWORD`, or an unreachable provider: startup fails
  with a mail authentication/connection error.

The trade-off is that a provider outage during a deploy blocks startup. That is preferable to an
app that runs but silently can't deliver sign-up codes.

### Provider examples

Any SMTP provider works. Pick one that offers domain verification (SPF/DKIM).

| Provider | `MAIL_HOST` | `MAIL_USERNAME` | `MAIL_PASSWORD` |
|----------|-------------|-----------------|-----------------|
| Amazon SES | `email-smtp.<region>.amazonaws.com` | SES SMTP username | SES SMTP password (not your AWS secret key) |
| SendGrid | `smtp.sendgrid.net` | `apikey` (literal) | SendGrid API key |
| Brevo | `smtp-relay.brevo.com` | Brevo SMTP login | Brevo SMTP key |
| Resend | `smtp.resend.com` | `resend` (literal) | Resend API key |
| Postmark | `smtp.postmarkapp.com` | Server API token | Server API token |
| Gmail / Google Workspace | `smtp.gmail.com` | Full Gmail address | App password (requires 2FA) |

> Gmail is fine for a demo but has a ~500 recipients/day cap and `MAIL_FROM` must be that Gmail
> address. Use a transactional provider for real users.

### Getting into the inbox (not spam)

Gmail, Outlook and iCloud reject or spam-folder mail that isn't authenticated. Before going live:

1. **Own a domain** and use an address on it for `MAIL_FROM` (e.g. `no-reply@fuel.app`).
   `noreply@fuel.local`, the local default, is not deliverable.
2. **Verify the domain with your provider** and add the DNS records it gives you:
   - **SPF** (TXT): authorizes the provider to send for your domain.
   - **DKIM** (CNAME/TXT): signs messages so receivers can verify them.
   - **DMARC** (TXT `_dmarc.<domain>`): start with `v=DMARC1; p=none; rua=mailto:<you>` and
     tighten to `quarantine`/`reject` once reports look clean.
3. **Leave sandbox mode.** New SES accounts can only send to verified addresses until you request
   production access.

Gmail and Yahoo require SPF, DKIM and DMARC for bulk senders. Configure all three from day one.

## Optional tuning

| Variable | Default | Purpose |
|----------|---------|---------|
| `MAIL_CONNECTION_TIMEOUT_MS` | `5000` | SMTP connect timeout |
| `MAIL_TIMEOUT_MS` | `5000` | SMTP read timeout |
| `MAIL_WRITE_TIMEOUT_MS` | `5000` | SMTP write timeout |

JavaMail's own default for all three is *infinite*. The bounds keep a stalled provider from tying up
the `emailTaskExecutor` thread pool.
