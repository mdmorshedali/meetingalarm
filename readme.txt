2. Open `index.html` in any modern browser
3. The app will work offline after first load

## How to Use

### Setting Up Your Profile
1. Go to **Settings** tab (⚙️)
2. Enter your name (appears in greeting)
3. Configure SMTP for email reminders (optional):
- Email: your Gmail address
- Password: Gmail App Password (not your regular password)
- Get App Password from Google Account → Security → App Passwords

### Scheduling a Meeting
1. Tap the **+** button or go to **Schedule** tab
2. Click **"New Meeting"**
3. Fill in meeting details:
- Title
- Person name
- Email (for reminders)
- Date and Time
4. Click **Save**
5. Automatic alarms will be created for 1 hour and 15 minutes before

### Managing Alarms
1. Go to **Alarms** tab (🔔)
2. View all upcoming alarms:
- Meeting alarms (1h before and 15min before)
- Manual alarms
3. Use toggle switches to enable/disable any alarm
4. Edit or delete manual alarms

### Editing Meetings
- **Upcoming meetings**: Edit all details (title, person, date, time)
- **Past meetings**: Only status can be changed (upcoming/completed/missed)
- Click the edit icon (✏️) on any meeting

### Sending Emails
1. Go to **Email** tab (📧)
2. Enter recipient email, subject, and message
3. Click **"Send Email"**
4. Email will be sent via configured SMTP

### Customizing Ringtone
1. Go to **Settings** tab
2. Select from built-in ringtones:
- Alarm Clock (Cring Cring) - Classic alarm sound
- Classic Bell
- Digital Alarm
3. Or upload your own audio file

## Data Storage
All data is stored locally in your browser using localStorage:
- Meetings
- Manual alarms
- Email history
- SMTP configuration
- User preferences (name, ringtone, dark mode)

## Technologies Used
- HTML5
- CSS3 (Glassmorphism, CSS Variables, Flexbox, Grid)
- JavaScript (ES6+)
- Web Audio API (for ringtones)
- Vibration API (for mobile)
- Notification API
- LocalStorage API

## Browser Support
- Chrome (desktop & mobile)
- Safari (iOS & macOS)
- Firefox
- Edge
- Opera

## License
MIT License - Free for personal and commercial use

## Credits
- Fonts: Google Fonts (Inter, JetBrains Mono)
- Icons: Font Awesome
- Logo: Vecteezy

---

**Developed with ❤️ for productivity**