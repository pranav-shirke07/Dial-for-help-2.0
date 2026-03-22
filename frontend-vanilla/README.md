# Dial For Help — Vanilla Frontend (HTML/CSS/JS)

## Pages
- `index.html`
- `services.html`
- `book.html`
- `worker-signup.html`
- `contact.html`
- `track-booking.html`
- `account-auth.html`
- `account-profile.html`
- `account-notifications.html`
- `admin-login.html`
- `admin-dashboard.html`

## API Configuration
By default frontend uses:
- `window.location.origin + /api`

To override API base URL in browser console:
```js
localStorage.setItem('dial-api-base', 'http://localhost:8001/api')
```

Then reload page.

## Assets
- CSS: `assets/css/styles.css`
- JS modules: `assets/js/*.js`