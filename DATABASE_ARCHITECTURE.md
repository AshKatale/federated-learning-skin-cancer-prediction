# Database Architecture

## Overview
The system uses a hybrid database architecture:
- **PostgreSQL**: Authentication and authorization
- **MongoDB**: Predictions, Federated Learning, and other business data

---

## PostgreSQL (Authentication & Authorization)

### Purpose
Stores user credentials and role-based access control information

### Tables

#### `users` Table
- **id** (UUID): Primary key
- **email** (STRING, UNIQUE): User email
- **password** (STRING): Hashed password (bcryptjs)
- **firstName** (STRING): User first name
- **lastName** (STRING): User last name
- **age** (INTEGER): User age
- **gender** (ENUM): male, female, other
- **role** (ENUM): user, doctor, admin
- **isActive** (BOOLEAN): Account status
- **createdAt** (DATE): Account creation date
- **updatedAt** (DATE): Last update date

### Connection Details
- **Host**: `localhost` (configurable via PG_HOST)
- **Port**: `5432` (configurable via PG_PORT)
- **Database**: `skin_cancer_db` (configurable via PG_DATABASE)
- **User**: `postgres` (configurable via PG_USER)
- **Password**: (configurable via PG_PASSWORD)

---

## MongoDB (Predictions & Federated Learning)

### Purpose
Stores prediction results, federated learning rounds, and other non-authentication data

### Collections

#### `predictions` Collection
- **userId** (STRING): UUID reference to PostgreSQL user
- **imageFileName** (STRING): Original filename
- **imageUrl** (STRING): Path/URL to stored image
- **imageSize** (NUMBER): File size in bytes
- **prediction**: Prediction results object
  - **className** (STRING): Skin lesion type (akiec, bcc, bkl, df, mel, nv, vasc)
  - **classId** (NUMBER): Class index
  - **confidence** (NUMBER): Confidence score (0-1)
  - **allProbabilities** (OBJECT): Probabilities for all classes
- **riskLevel** (STRING): Low, Medium, High
- **riskScore** (NUMBER): 0-100 risk score
- **gradcamUrl** (STRING): URL to Grad-CAM heatmap
- **gradcamData** (STRING): Base64 encoded heatmap
- **modelVersion** (STRING): Model version used
- **processingTime** (NUMBER): Processing time in ms
- **doctorNotes** (STRING): Doctor's notes
- **verificationStatus** (STRING): pending, verified, rejected
- **verifiedBy** (STRING): UUID of doctor who verified (or null)
- **reportGenerated** (BOOLEAN): Report generation status
- **reportUrl** (STRING): URL to generated report
- **createdAt** (DATE): Prediction creation date
- **updatedAt** (DATE): Last update date

#### `federatedlearnings` Collection
- **roundNumber** (NUMBER): Unique round identifier
- **status** (STRING): initiated, in-progress, completed, failed
- **globalModelVersion** (STRING): Version of global model
- **globalWeightsUrl** (STRING): URL to model weights
- **globalWeightsHash** (STRING): Hash for integrity verification
- **roundStartTime** (DATE): Round start timestamp
- **roundEndTime** (DATE): Round end timestamp
- **roundDuration** (NUMBER): Duration in seconds
- **totalClients** (NUMBER): Total clients invited
- **participatingClients** (NUMBER): Clients that participated
- **clientList** (ARRAY): Array of client objects
  - **clientId** (STRING): Unique client ID
  - **clientName** (STRING): Client name
  - **status** (STRING): invited, accepted, trained, failed
  - **samplesUsed** (NUMBER): Training samples count
  - **trainingTime** (NUMBER): Training duration in seconds
  - **localModelPerformance** (OBJECT): Metrics (accuracy, loss, f1Score)
  - **parametersHash** (STRING): Hash of trained parameters
- **aggregationMethod** (STRING): FedAvg, FedProx, FedAdam
- **aggregationStrategy** (OBJECT): Aggregation parameters
- **performanceMetrics** (OBJECT): Global model performance
- **createdAt** (DATE): Round creation date

### Connection Details
- **URI**: `mongodb://localhost:27017/skin-cancer-db` (configurable via MONGO_URI)
- **Atlas Support**: Supports MongoDB Atlas connection strings

---

## Environment Variables

```env
# PostgreSQL
PG_USER=postgres
PG_PASSWORD=postgres
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=skin_cancer_db

# MongoDB
MONGO_URI=mongodb://localhost:27017/skin-cancer-db
```

---

## Setup Instructions

### PostgreSQL Setup
1. Install PostgreSQL 12 or higher
2. Create database: `CREATE DATABASE skin_cancer_db;`
3. Set environment variables in `.env`
4. Run initialization: `npm run init-db`

### MongoDB Setup
1. Install MongoDB locally or use MongoDB Atlas
2. Update `MONGO_URI` in `.env`
3. Collections are auto-created on first insert

---

## Migration Strategy

### From Single MongoDB to Hybrid (PostgreSQL + MongoDB)

1. **User Data**:
   - Export users from MongoDB
   - Hash passwords using bcryptjs
   - Import into PostgreSQL users table
   - Update all references from MongoDB ObjectIds to PostgreSQL UUIDs

2. **Prediction Data**:
   - Change `userId` field from ObjectId to String (UUID)
   - Keep all other fields unchanged
   - No data migration needed if done before first production use

3. **Federated Learning Data**:
   - Keep in MongoDB as-is
   - No changes required

---

## Security Considerations

- Passwords are hashed with bcryptjs in PostgreSQL
- JWT tokens are generated using PostgreSQL user IDs
- Role-based access control enforced via PostgreSQL role field
- MongoDB data tied to PostgreSQL user via UUID

---

## Performance Notes

- PostgreSQL handles authentication (typically < 100ms)
- MongoDB handles bulk prediction storage (typically < 200ms)
- Queries span both databases via application logic (not via foreign keys)
- Consider indexing on userId in MongoDB for faster prediction queries

---

## Backup Strategy

### PostgreSQL
- `pg_dump -U postgres -d skin_cancer_db > backup.sql`
- Restore: `psql -U postgres -d skin_cancer_db < backup.sql`

### MongoDB
- `mongodump --db skin_cancer_db --out ./backup`
- Restore: `mongorestore --db skin_cancer_db ./backup/skin_cancer_db`

---

## Usage in Application

### Auth Controller (PostgreSQL)
- All authentication operations use PostgreSQL
- Returns UUIDs as user IDs in JWT tokens

### Prediction Controller (MongoDB)
- All prediction storage uses MongoDB
- References user via UUID (not ObjectId)

### Federated Learning Controller (MongoDB)
- Round management uses MongoDB
- Client IDs stored as strings
