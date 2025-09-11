# Express Backend

This project is a Node.js backend server built with Express. It provides a RESTful API with JWT authentication, role-based access control, and error handling middleware.

## Features

- User authentication with JWT tokens
- Secure cookie management for login sessions
- Role-based authorization
- Universal error handling middleware
- Asynchronous error handling utility

## Folder Structure

```
express-backend
├── src
│   ├── app.js
│   ├── server.js
│   ├── config
│   │   └── database.js
│   ├── controllers
│   │   ├── authController.js
│   │   └── userController.js
│   ├── middlewares
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   └── roleCheck.js
│   ├── models
│   │   └── userModel.js
│   ├── routes
│   │   ├── authRoutes.js
│   │   └── userRoutes.js
│   └── utils
│       ├── catchAsync.js
│       ├── appError.js
│       └── jwtUtils.js
├── .env
├── .gitignore
├── package.json
└── README.md
```

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```
   cd express-backend
   ```

3. Install dependencies:
   ```
   npm install
   ```

4. Create a `.env` file in the root directory and add your environment variables.

## Usage

To start the server, run:
```
node src/server.js
```

The server will listen on the specified port defined in the `.env` file.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License.