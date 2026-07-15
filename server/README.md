# Server Setup

## Environment variables

Copy .env.example to .env and fill in the values for SMTP and Twilio if you want real OTP delivery.

### Required for email delivery
- SMTP_HOST
- SMTP_PORT
- SMTP_USER
- SMTP_PASS
- SMTP_FROM

### Required for SMS delivery
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_FROM

If these values are left empty, the server will still start and the OTP flow will continue, but email and SMS delivery will be skipped with a warning.
