# ToEasy Backend API

Production-ready Node.js + Express + PostgreSQL backend for the ToEasy data analytics platform.

## Features

- **User Authentication**: JWT-based auth with email/password
- **Subscription Tiers**: Starter (Free), Professional ($29/mo), Enterprise (Custom)
- **Multi-Workspace**: Create and manage multiple workspaces per user
- **Data Management**: Upload, analyze, and manage datasets with AI
- **Dashboards**: Create interactive dashboards with AI suggestions
- **Data Validation**: Set up validation rules and run data quality checks
- **Payments**: Cashfree payment gateway integration
- **Rate Limiting**: Subscription-based request limits
- **Activity Logging**: Track user actions across the platform
- **Analytics**: Comprehensive usage statistics and reporting

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express 4.18.2
- **Database**: PostgreSQL 15+
- **ORM/Migrations**: Knex.js 3.1.0
- **Authentication**: JWT + bcryptjs
- **AI Integration**: Groq SDK 0.8.0
- **Caching**: Redis 4.6.12 (optional)
- **Security**: Helmet 7.1.0, CORS, Rate Limiting
- **Validation**: Joi 17.11.0
- **Logging**: Winston 3.11.0

## Installation

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+ (optional, for caching)

### Setup

1. **Clone and install dependencies**
```bash
cd backend
npm install
```

2. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start PostgreSQL and Redis** (using Docker)
```bash
docker-compose up -d
```

4. **Run database migrations**
```bash
npm run migrate
```

5. **Start development server**
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/toeasy_dev

# Server
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRY=7d
REFRESH_TOKEN_EXPIRY=30d

# Groq API
GROQ_API_KEY=your-groq-api-key

# Cashfree Payment Gateway
CASHFREE_API_KEY=your-cashfree-api-key
CASHFREE_SECRET_KEY=your-cashfree-secret
CASHFREE_WEBHOOK_SECRET=your-webhook-secret

# Frontend
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=debug
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh JWT token

### Users
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update user profile
- `POST /api/users/change-password` - Change password
- `GET /api/users/usage` - Get usage statistics
- `GET /api/users/activity` - Get activity logs
- `DELETE /api/users/me` - Delete account

### Workspaces
- `GET /api/workspaces` - List all workspaces
- `POST /api/workspaces` - Create workspace
- `GET /api/workspaces/:id` - Get workspace details
- `PUT /api/workspaces/:id` - Update workspace
- `DELETE /api/workspaces/:id` - Delete workspace
- `GET /api/workspaces/:id/stats` - Get workspace statistics

### Datasets
- `GET /api/workspaces/:wid/datasets` - List datasets
- `POST /api/workspaces/:wid/datasets` - Upload dataset
- `GET /api/workspaces/:wid/datasets/:did` - Get dataset details
- `DELETE /api/workspaces/:wid/datasets/:did` - Delete dataset
- `POST /api/workspaces/:wid/datasets/:did/analyze` - Analyze with AI
- `POST /api/workspaces/:wid/datasets/:did/generate` - Generate synthetic data
- `POST /api/workspaces/:wid/datasets/:did/export` - Export dataset

### Dashboards
- `GET /api/workspaces/:wid/dashboards` - List dashboards
- `POST /api/workspaces/:wid/dashboards` - Create dashboard
- `GET /api/workspaces/:wid/dashboards/:did` - Get dashboard
- `PUT /api/workspaces/:wid/dashboards/:did` - Update dashboard
- `DELETE /api/workspaces/:wid/dashboards/:did` - Delete dashboard
- `POST /api/workspaces/:wid/dashboards/:did/suggest` - Get AI suggestions

### Queries
- `POST /api/workspaces/:wid/datasets/:did/query` - Execute query
- `GET /api/workspaces/:wid/datasets/:did/queries` - Query history
- `POST /api/workspaces/:wid/datasets/:did/queries/:qid/export` - Export results

### Validation Rules
- `GET /api/workspaces/:wid/datasets/:did/rules` - List rules
- `POST /api/workspaces/:wid/datasets/:did/rules` - Create rule
- `PUT /api/workspaces/:wid/datasets/:did/rules/:rid` - Update rule
- `DELETE /api/workspaces/:wid/datasets/:did/rules/:rid` - Delete rule
- `POST /api/workspaces/:wid/datasets/:did/rules/suggest` - Get suggestions
- `POST /api/workspaces/:wid/datasets/:did/validate` - Run validation

### Subscriptions
- `GET /api/subscriptions/plans` - List available plans
- `GET /api/subscriptions/current` - Get current subscription
- `POST /api/subscriptions/upgrade` - Upgrade/downgrade
- `POST /api/subscriptions/cancel` - Cancel subscription
- `GET /api/subscriptions/usage` - Get usage stats

### Payments
- `POST /api/payments/create-order` - Create payment order
- `POST /api/payments/webhook` - Cashfree webhook
- `GET /api/payments/status/:orderId` - Check payment status
- `GET /api/payments/history` - Payment history

### Analytics
- `GET /api/analytics/:wid/stats` - Workspace statistics
- `GET /api/analytics/:wid/activity` - Activity logs
- `GET /api/analytics/user/analytics` - User analytics
- `GET /api/analytics/subscription-usage` - Usage by tier
- `POST /api/analytics/:wid/analytics/export` - Export report

## Subscription Tiers

### Starter (Free)
- 3 Datasets
- 500 rows per dataset
- 10 AI queries/day
- 1 Workspace
- Basic support

### Professional ($29/month)
- 50 Datasets
- 100K rows per dataset
- Unlimited AI queries
- 10 Workspaces
- Priority support
- Advanced analytics

### Enterprise (Custom)
- Unlimited everything
- 10M rows per dataset
- Dedicated support
- Custom integrations
- SLA guarantee

## Database Schema

The database consists of 9 main tables:

- **users**: User accounts with authentication
- **subscriptions**: Subscription tier and status
- **workspaces**: User workspaces
- **datasets**: Uploaded data files
- **dashboards**: Interactive dashboards
- **queries**: Executed queries history
- **validation_rules**: Data quality rules
- **activity_logs**: User action audit trail
- **payment_orders**: Payment order tracking

## Development

### Scripts

```bash
# Start development server with auto-reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Run in production
npm start

# Run database migrations
npm run migrate

# Rollback migrations
npm run migrate:rollback

# Seed database
npm run seed

# Run tests (if configured)
npm test

# Format code
npm run format
```

### Docker

Start services locally:
```bash
docker-compose up -d
```

Stop services:
```bash
docker-compose down
```

View logs:
```bash
docker-compose logs -f postgres
```

## Deployment

### Railway

1. Create Railway account at https://railway.app
2. Connect GitHub repository
3. Create PostgreSQL database on Railway
4. Set environment variables in Railway dashboard
5. Deploy from GitHub

### Local Testing

```bash
# Build
npm run build

# Test with production database
NODE_ENV=production npm start
```

## Security

- Passwords hashed with bcryptjs (12 salt rounds)
- JWT tokens with 7-day expiration
- CORS protection enabled
- Helmet security headers
- Rate limiting per subscription tier
- Input validation with Joi
- SQL injection prevention via parameterized queries

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message describing what went wrong"
}
```

HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

## Support

For issues and feature requests, create an issue in the repository.

## License

MIT
