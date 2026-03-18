# Federated Learning System

A simple, modular federated learning system demonstrating collaborativemachine learning across multiple clients.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│           Federated Learning Server                  │
│          (Flask REST API - Port 5000)                │
│                                                     │
│  • Global Model Management                         │
│  • Client Update Aggregation                       │
│  • Training Coordination                           │
└─────────────────────────────────────────────────────┘
         ↑                    ↑                    ↑
    REST API             REST API             REST API
         |                    |                    |
         ▼                    ▼                    ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│    Client 1      │ │    Client 2      │ │    Client 3      │
│                  │ │                  │ │                  │
│ Local Training   │ │ Local Training   │ │ Local Training   │
│ Dataset: D1      │ │ Dataset: D2      │ │ Dataset: D3      │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

## Project Structure

```
federated_learning/
├── models/
│   └── linear_model.py          # Linear Regression Model
├── server/
│   └── server.py                # Federated Server (Flask)
├── client/
│   └── client.py                # Client Implementation
├── data/
│   └── data_generator.py        # Data generation utilities
├── utils/
│   ├── aggregator.py            # Model aggregation logic
│   └── metrics.py               # Evaluation metrics
├── demo.py                      # Interactive demonstration
├── requirements.txt             # Python dependencies
└── README.md
```

## Installation

1. **Create and activate a virtual environment** (optional but recommended):
```bash
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

2. **Install dependencies**:
```bash
pip install -r requirements.txt
```

## Running the Demo

### Terminal 1: Start the Server
```bash
python server/server.py
```
Output:
```
Starting Federated Learning Server on http://localhost:5000
Endpoints:
  GET  /health - Health check
  GET  /get_model - Get current global model
  POST /update_model - Submit client update
  POST /aggregate - Aggregate all client updates
  GET  /get_status - Get training status
  POST /reset - Reset server
```

### Terminal 2: Run the Demo
```bash
python demo.py
```

The demo will:
1. ✓ Generate federated data split across 3 clients
2. ✓ Complete 5 federated learning rounds
3. ✓ Train clients in parallel for each round
4. ✓ Aggregate model updates on the server
5. ✓ Evaluate performance on test data
6. ✓ Display final metrics

### What You'll See

```
============================================================
FEDERATED LEARNING ROUND 1/5
============================================================

Phase 1: Clients training locally in parallel...
[client_1] Starting federated round...
[client_1] Downloaded model from round 1
[client_1] Local training completed - MSE: 325.4532
[client_1] Model uploaded - Update received from client_1, round 1

... (similar for client_2 and client_3)

Phase 2: Server aggregating model updates...
============================================================
AGGREGATION SUCCESSFUL
============================================================
Aggregated 3 client updates
New global round: 1

Phase 3: Evaluating model on test data...
Client 1 Evaluation Metrics:
  MSE:  312.4521
  MAE:  12.3456
  RMSE: 17.6789
  R²:   0.4521
```

## API Endpoints

### Server Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | Check server status |
| GET | `/get_model` | Get current global model |
| POST | `/update_model` | Submit client model update |
| POST | `/aggregate` | Aggregate all client updates |
| GET | `/get_status` | Get training status |
| POST | `/reset` | Reset server state |

### Example: Manual Client Training

```python
from client.client import FederatedClient
from data.data_generator import DataGenerator

# Generate data
client_data = DataGenerator.create_federated_split(n_clients=1)
X_train, y_train = client_data[0]
X_test, y_test = DataGenerator.generate_test_data()

# Create client
client = FederatedClient(
    client_id="my_client",
    server_url="http://localhost:5000",
    X_train=X_train,
    y_train=y_train,
    X_test=X_test,
    y_test=y_test
)

# Run 1 federated round
client.federated_round(epochs=1)

# Evaluate
metrics = client.evaluate()
print(f"MSE: {metrics['mse']}")
```

## How Federated Learning Works

### Phase 1: Download Global Model
Each client downloads the current global model from the server.

### Phase 2: Local Training
Clients train the model on their local, private data without sharing raw data.

### Phase 3: Upload Updates
Clients upload their trained model weights back to the server's

### Phase 4: Server Aggregation
The server averages weights from all clients:

$$w_{global} = \frac{1}{N} \sum_{i=1}^{N} w_i$$

Or weighted by dataset size:

$$w_{global} = \sum_{i=1}^{N} \frac{n_i}{N_{total}} w_i$$

### Phase 5: Next Round
The aggregated global model becomes the starting point for the next round.

## Model Details

### Linear Regression
- **Input Features**: 10
- **Output**: Continuous value (regression)
- **Parameters**: Weights (10) + Bias (1)
- **Training**: Ordinary Least Squares locally
- **Aggregation**: Simple averaging or weighted averaging

### Performance Metrics
- **MSE**: Mean Squared Error
- **MAE**: Mean Absolute Error
- **RMSE**: Root Mean Squared Error
- **R²**: Coefficient of determination

## Key Features

✅ **Modular Design**
   - Separate concerns: models, clients, server
   - Easy to swap components

✅ **Simple ML Model**
   - Linear regression (fast training)
   - Trains quickly on CPU

✅ **REST API Communication**
   - Clients and server communicate via HTTP
   - Easy to deploy across different machines

✅ **Parallel Training**
   - Multiple clients train simultaneously
   - ThreadPoolExecutor for concurrent execution

✅ **Non-IID Data**
   - Data distribution differs across clients
   - Realistic federated learning scenario

✅ **Easy to Demonstrate**
   - Complete end-to-end example
   - Real-time metrics and feedback

## Customization

### Change Number of Clients
In `demo.py`, line 76:
```python
NUM_CLIENTS = 5  # Change from 3
```

### Change Number of Rounds
In `demo.py`, line 77:
```python
NUM_ROUNDS = 10  # Change from 5
```

### Use Weighted Aggregation
In `demo.py`, line 173:
```python
if not aggregate_updates(SERVER_URL, client_ids, method='weighted_average'):
```

### Change Data Distribution
In `data_generator.py`, modify `create_federated_split()` for different non-IID scenarios.

### Add More Features
In `demo.py`, line 79:
```python
N_FEATURES = 20  # Increase from 10
```

## Troubleshooting

### "Connection refused" error
- Make sure server is running in another terminal
- Check server is on port 5000

### Slow performance
- Linear regression with 50 samples per client is very fast
- If slow, reduce `n_samples` in `demo.py`

### Port already in use
- Kill the process using port 5000
- Or change port in `server/server.py` line 149

## Next Steps

1. **Try different aggregation methods**: `weighted_average`, custom aggregators
2. **Add more complex models**: Neural network (PyTorch)
3. **Deploy clients on different machines**: Change `localhost` to actual IPs
4. **Implement differential privacy**: Add noise to updates before aggregation
5. **Simulate client failures**: Randomly skip uploads

## References

- McMahan, H. B., et al. "Communication-Efficient Learning of Deep Networks from Decentralized Data." ICML, 2017.
- Kairouz, P., et al. "Advances and Open Problems in Federated Learning." arXiv, 2021.

---

**Author**: Federated Learning Demo System
**Date**: March 2026
**Python Version**: 3.8+
