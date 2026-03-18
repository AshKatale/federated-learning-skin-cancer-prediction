"""
Architecture and Design Overview
"""

ARCHITECTURE = """
╔═══════════════════════════════════════════════════════════════════╗
║        FEDERATED LEARNING SYSTEM - MODULAR ARCHITECTURE          ║
╚═══════════════════════════════════════════════════════════════════╝

1. ML MODEL LAYER (models/)
   └─ linear_model.py
      • FederatedLinearModel class
      • Methods: train(), predict(), get_weights(), set_weights()
      • Independent of federated learning
      • Can be swapped with NeuralNetworkModel

2. ML UTILITIES LAYER (utils/)
   ├─ aggregator.py
   │  • ModelAggregator.average_weights()
   │  • ModelAggregator.weighted_average()
   │
   └─ metrics.py
      • Metrics.mean_squared_error()
      • Metrics.mean_absolute_error()
      • Metrics.root_mean_squared_error()
      • Metrics.r_squared()

3. DATA LAYER (data/)
   └─ data_generator.py
      • DataGenerator.generate_linear_data()
      • DataGenerator.create_federated_split()
      • DataGenerator.generate_test_data()
      • Simulates non-IID data distribution

4. CLIENT LAYER (client/) - REST HTTP Client
   └─ client.py
      • FederatedClient class
      • Methods:
        - download_model() [GET /get_model]
        - train_local() [local training]
        - upload_model() [POST /update_model]
        - federated_round() [orchestrates all 3]
      • Independently operable
      • Can run on different machines

5. SERVER LAYER (server/) - REST HTTP Server
   └─ server.py
      • Flask REST API on port 5000
      • Endpoints:
        - GET /health - server status
        - GET /get_model - broadcast global model
        - POST /update_model - receive client updates
        - POST /aggregate - aggregate all updates
        - GET /get_status - check pending updates
        - POST /reset - reset state
      • Global model storage
      • Update aggregation logic

╔═══════════════════════════════════════════════════════════════════╗
║                      SEPARATION OF CONCERNS                       ║
╚═══════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────┐
│ FEDERATED LOGIC SEPARATE:                                        │
│ - Server doesn't know about ML details                           │
│ - Client doesn't know about global aggregation                   │
│ - Communication only via REST APIs (HTTP GET/POST)               │
│ - Easy to deploy across different machines/networks              │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ ML LOGIC SEPARATE:                                               │
│ - Models work without server (offline training)                  │
│ - Can train with different algorithms                            │
│ - Model class has clear interface (fit/predict)                  │
│ - Easy to add new model types                                    │
└──────────────────────────────────────────────────────────────────┘

╔═══════════════════════════════════════════════════════════════════╗
║                    DATA FLOW IN ONE ROUND                         ║
╚═══════════════════════════════════════════════════════════════════╝

CLIENT 1                SERVER                CLIENT 2, 3
   |                      |                      |
   |--GET /get_model----> |                      |
   | <--return weights----                       |
   |                      | <---GET /get_model--
   |                      |  --return weights--->
   |  TRAIN LOCAL         |
   | X X X X X            |  TRAIN LOCAL
   |                      | X X X X X
   | --POST /update_model->  
   | (weights, samples)   |
   |                      | <-POST /update_model-
   |                      | (weights, samples)
   |                      |
   |                      | AGGREGATE
   |                      | avg_weights = (w1 + w2 + w3) / 3
   |                      |
   |                      |
   |<--GET /get_model---- [NEW GLOBAL MODEL READY]
   |  return avg_weights  |
   |                      |
   |               NEXT ROUND...
   |

╔═══════════════════════════════════════════════════════════════════╗
║                    KEY DESIGN DECISIONS                           ║
╚═══════════════════════════════════════════════════════════════════╝

1. LINEAR REGRESSION (not neural network)
   ✓ Trains instantly on CPU
   ✓ Easy to demonstrate
   ✓ Perfect for learning
   ✓ Can extend to neural net with examples/custom_model.py

2. REST API (not gRPC or direct sockets)
   ✓ Language-agnostic
   ✓ Works across firewalls
   ✓ Easy to test with curl/Postman
   ✓ Can deploy on different systems

3. SIMPLE AVERAGING (not FedAvg with sampling)
   ✓ Easy to understand
   ✓ Aggregation in one line
   ✓ Can use weighted_average() for fairness

4. IN-MEMORY STATE (not database)
   ✓ Fast for demos
   ✓ Can add SQLite later
   ✓ No dependency complexity

5. SEQUENTIAL ROUNDS (not asynchronous)
   ✓ Easy to debug
   ✓ Clear progress
   ✓ Deterministic results

╔═══════════════════════════════════════════════════════════════════╗
║                    EXTENSION POINTS                               ║
╚═══════════════════════════════════════════════════════════════════╝

1. USE DIFFERENT MODEL:
   - Create class inheriting from FederatedLinearModel
   - Implement: train(), predict(), get_weights(), set_weights()
   - See: examples/custom_model.py

2. ADD NEW AGGREGATION METHOD:
   - Add method to ModelAggregator class
   - Pass method name to /aggregate endpoint
   - See: examples/weighted_aggregation.py

3. USE DIFFERENT DATA DISTRIBUTION:
   - Modify DataGenerator.create_federated_split()
   - Can simulate IID or non-IID scenarios
   - Can add label noise, feature noise, etc.

4. DEPLOY ON MULTIPLE MACHINES:
   - Change localhost to IP addresses
   - Server: python server/server.py --host 192.168.1.100
   - Clients: point to http://192.168.1.100:5000
   - Adjust firewall if needed

5. ADD DIFFERENTIAL PRIVACY:
   - Clip gradients before upload (privacy)
   - Add Laplace/Gaussian noise
   - Inject in FederatedClient.upload_model()

6. ADD SECURE AGGREGATION:
   - Encrypt weights during transmission
   - Decrypt on server
   - Use SSL/TLS for /update_model endpoint

╔═══════════════════════════════════════════════════════════════════╗
║                    FILE DEPENDENCIES                              ║
╚═══════════════════════════════════════════════════════════════════╝

demo.py (orchestrator)
  ├─ client/client.py
  │  ├─ models/linear_model.py
  │  ├─ utils/metrics.py
  │  └─ requests (HTTP lib)
  ├─ data/data_generator.py
  │  └─ numpy, sklearn
  └─ requests (HTTP lib)

server/server.py (server)
  ├─ models/linear_model.py
  ├─ utils/aggregator.py
  └─ flask

quickstart.py (simple example)
  └─ Same as demo.py (smaller scale)

test_api.py (API testing)
  └─ requests (HTTP lib)

visualize.py (training progress)
  ├─ client/client.py
  ├─ data/data_generator.py
  └─ matplotlib

examples/
  ├─ custom_model.py (extending model)
  ├─ manual_round.py (low-level API usage)
  └─ weighted_aggregation.py (custom agg method)
"""

print(ARCHITECTURE)

# Print to file as well
with open(__file__.replace('.py', '_output.txt'), 'w') as f:
    f.write(ARCHITECTURE)
