# Skipli Backend - Task Management Platform

## 🚀 Tech Stack

- **Framework**: ExpressJS
- **Authentication**: Cookie JWT authentication
- **Database**: Firebase Firestore

## 📁 Project Structure

```
src/
├── controllers/         # App controllers
├── firebase/            # Firebase admin initialize instance
├── service/             # App services helper (auth, otp, tasks, employee)
├── routes/              # App defined api routes with 
├── types/               # Type definitions
└── utils/               # App utilities
└── app.ts               # App root.
└── middleware.ts        # Authentication middleware to parse JWT token. Require role middleware
```

## 🛠️ Development

### Prerequisites
- Node.js 18+ 
- pnpm

### Installation

```bash
# Clone the repository
cd skipli-be

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local

# Start development server
pnpm dev
```

### Environment Variables

Create a `.env.local` file with the following variables:

```env
PORT=3001
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
JWT_SECRET=
NODEMAILER_MAIL=
NODEMAILER_PASSWORD=
```

### Available Scripts

```bash
pnpm dev         
pnpm build        
pnpm start         
```

