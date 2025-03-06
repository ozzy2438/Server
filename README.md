# 🚀 CareerLens - AI-Powered Job Portal

Welcome to CareerLens - Your AI-Powered Career Companion! 🌟

## 📚 Project Overview

CareerLens is an intelligent job application management platform designed to help professionals effectively manage their job search process. The platform leverages artificial intelligence to analyze resumes and match them with suitable job opportunities.

### Key Features

- 🤖 AI-powered resume analysis
- 🔍 Intelligent job matching based on skills and experience
- 📊 Comprehensive application tracking system
- 📅 Visual timeline for application management
- 🔐 Secure user authentication and data protection

## 🛠️ Technology Stack

### Frontend
- **React.js**: Core library for building the user interface
- **Material UI**: Component library for consistent and responsive design
- **React Router**: For client-side routing and navigation
- **Axios**: For handling API requests
- **FullCalendar**: For interactive calendar views of job applications

### Backend
- **Node.js & Express**: Server-side framework
- **MongoDB & Mongoose**: Database and ODM
- **JWT**: For secure authentication
- **Multer**: For file uploads (resumes)
- **PDF-Parse**: For extracting text from PDF resumes
- **bcryptjs**: For password hashing

### External APIs
- **OpenAI API**: For advanced resume analysis
- **DeepSeek API**: For AI-powered resume evaluations
- **Jooble API**: For job search functionality

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- npm or yarn

### Installation

1. **Clone the repository**
   ```
   git clone https://github.com/yourusername/careerlens.git
   cd careerlens
   ```

2. **Set up the backend**
   ```
   cd backend
   npm install
   ```
   Create a `.env` file based on the provided `.env.example`:
   ```
   cp .env.example .env
   ```
   Then edit the `.env` file with your actual configuration values:
   ```
   PORT=5001
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   OPENAI_API_KEY=your_openai_api_key
   DEEPSEEK_API_KEY=your_deepseek_api_key
   JOOBLE_API_KEY=your_jooble_api_key
   ```

3. **Set up the frontend**
   ```
   cd ../frontend
   npm install
   ```
   Create a `.env` file based on the provided `.env.example`:
   ```
   cp .env.example .env
   ```
   Then edit with your configuration:
   ```
   REACT_APP_API_URL=http://localhost:5001/api
   ```

4. **Start the application**
   
   In the backend directory:
   ```
   npm run dev
   ```
   
   In the frontend directory:
   ```
   npm start
   ```

5. **Access the application**
   
   Open your browser and navigate to `http://localhost:3000`

## 📋 Project Structure

```
careerlens/
├── backend/
│   ├── config/         # Database configuration
│   ├── controllers/    # Request handlers
│   ├── middleware/     # Custom middleware
│   ├── models/         # Database models
│   ├── routes/         # API routes
│   ├── uploads/        # Resume storage
│   ├── .env.example    # Example environment variables
│   └── server.js       # Entry point
├── frontend/
│   ├── public/         # Static files
│   ├── .env.example    # Example environment variables
│   └── src/
│       ├── components/ # React components
│       ├── pages/      # Page components
│       ├── services/   # API services
│       ├── utils/      # Utility functions
│       └── App.js      # Main component
└── README.md           # This file
```

## 🧪 Testing

- **Backend**: API testing with Postman
- **Frontend**: Manual testing for UI/UX
- **User Acceptance Testing**: Conducted with real users

## 🔮 Future Enhancements

- 📱 Mobile application
- 🌐 Integration with more job boards
- 📊 Advanced analytics dashboard
- 🤝 Networking features for job seekers
- 📝 AI-powered cover letter generation

## 👥 Contributors

- Osman Orka

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

Made with ❤️ by the CareerLens Team
