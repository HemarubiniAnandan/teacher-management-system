# Teacher Management System

![TypeScript](https://img.shields.io/badge/TypeScript-Frontend-blue)
![React](https://img.shields.io/badge/React-Framework-blue)
![Firebase](https://img.shields.io/badge/Firebase-Backend-orange)
![Vite](https://img.shields.io/badge/Vite-Build%20Tool-purple)

A modern web application for managing teacher activities, tracking user sessions, and handling file uploads.
The system provides a clean dashboard interface and uses cloud-based services to store and manage data efficiently.

---

## Overview

The Teacher Management System helps track user activity within the platform.
It allows users to log in, upload files, and monitor usage through a structured interface.

The application uses a **TypeScript-based frontend** and **Firebase services** for backend functionality.

---

## Features

* User authentication
* Activity tracking
* File upload system
* Dashboard interface
* Cloud data storage
* Secure login handling
* Responsive design

---

## Tech Stack

### Frontend

* TypeScript
* React
* Vite
* Tailwind CSS

### Backend / Cloud Services

* Firebase Authentication
* Cloud Firestore
* Firebase Storage

### Development Tools

* Node.js
* npm
* Git

---

## Project Structure

```
teacher-management-system
│
├── src/
│   ├── App.tsx
│   ├── firebase.ts
│   ├── main.tsx
│   └── index.css
│
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── firestore.rules
└── README.md
```

---

## Installation

Clone the repository:

```
git clone https://github.com/your-username/teacher-management-system.git
```

Navigate to the project folder:

```
cd teacher-management-system
```

Install dependencies:

```
npm install
```

Start the development server:

```
npm run dev
```

The application will start at:

```
http://localhost:3000
```

---

## Firebase Configuration

Create a `.env` file in the root folder and add your Firebase configuration:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

## Usage

1. Start the application.
2. Log in using the authentication system.
3. Access the dashboard.
4. Upload files and monitor user activity.

---

## Future Improvements

* Role-based access control
* Activity analytics dashboard
* Admin management panel
* Notification system
* Improved UI components

---

## Author

**Hemarubini Anandan**

---

## License

This project is created for academic and development purposes.

