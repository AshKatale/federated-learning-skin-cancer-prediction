"""
Federated Learning Server
Aggregates model updates from clients and serves global model
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, jsonify
import numpy as np
from models.linear_model import FederatedLinearModel
from utils.aggregator import ModelAggregator
from utils.metrics import Metrics

app = Flask(__name__)

# Global model
global_model = FederatedLinearModel(input_dim=10)
global_model.initialize_random()

# Track training rounds
training_round = 0
client_updates = {}  # Store client updates for current round


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'round': training_round,
        'clients_ready': len(client_updates)
    })


@app.route('/get_model', methods=['GET'])
def get_model():
    """
    Send current global model to client
    GET /get_model
    """
    weights = global_model.serialize_weights()
    return jsonify({
        'success': True,
        'round': training_round,
        'weights': weights
    })


@app.route('/update_model', methods=['POST'])
def update_model():
    """
    Receive model update from client
    POST /update_model
    Body: {
        'client_id': str,
        'weights': {'weights': [...], 'bias': ...},
        'num_samples': int
    }
    """
    global global_model, training_round, client_updates
    
    try:
        data = request.json
        client_id = data.get('client_id')
        weights = data.get('weights')
        num_samples = data.get('num_samples', 1)
        
        if not client_id or not weights:
            return jsonify({'success': False, 'error': 'Missing client_id or weights'}), 400
        
        # Store update
        client_updates[client_id] = {
            'weights': weights,
            'num_samples': num_samples
        }
        
        return jsonify({
            'success': True,
            'message': f'Update received from {client_id}',
            'round': training_round
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/aggregate', methods=['POST'])
def aggregate():
    """
    Aggregate updates from all clients
    POST /aggregate
    Body: {
        'client_ids': [list of expected client IDs],
        'method': 'average' or 'weighted_average' (default: 'average')
    }
    """
    global global_model, training_round, client_updates
    
    try:
        data = request.json
        expected_clients = data.get('client_ids', list(client_updates.keys()))
        method = data.get('method', 'average')
        
        # Check if all clients have submitted updates
        missing_clients = set(expected_clients) - set(client_updates.keys())
        if missing_clients:
            return jsonify({
                'success': False,
                'error': f'Missing updates from clients: {list(missing_clients)}',
                'received': len(client_updates),
                'expected': len(expected_clients)
            }), 400
        
        # Extract weights and samples
        weights_list = [client_updates[cid]['weights'] for cid in expected_clients]
        num_samples_list = [client_updates[cid]['num_samples'] for cid in expected_clients]
        
        # Aggregate weights
        if method == 'weighted_average':
            aggregated_weights = ModelAggregator.weighted_average(weights_list, num_samples_list)
        else:
            aggregated_weights = ModelAggregator.average_weights(weights_list)
        
        # Update global model
        global_model.set_weights(aggregated_weights)
        
        # Increment training round
        training_round += 1
        
        # Clear updates for next round
        clients_count = len(client_updates)
        client_updates = {}
        
        return jsonify({
            'success': True,
            'message': 'Model aggregated successfully',
            'round': training_round,
            'clients_aggregated': clients_count,
            'aggregation_method': method
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/get_status', methods=['GET'])
def get_status():
    """Get current training status"""
    return jsonify({
        'success': True,
        'training_round': training_round,
        'updates_received': len(client_updates),
        'client_ids': list(client_updates.keys()),
        'model_info': {
            'input_dim': global_model.input_dim,
            'is_trained': global_model.is_trained
        }
    })


@app.route('/reset', methods=['POST'])
def reset():
    """Reset server state"""
    global global_model, training_round, client_updates
    
    global_model = FederatedLinearModel(input_dim=10)
    global_model.initialize_random()
    training_round = 0
    client_updates = {}
    
    return jsonify({
        'success': True,
        'message': 'Server reset successfully'
    })


if __name__ == '__main__':
    print("Starting Federated Learning Server on http://localhost:5000")
    print("Endpoints:")
    print("  GET  /health - Health check")
    print("  GET  /get_model - Get current global model")
    print("  POST /update_model - Submit client update")
    print("  POST /aggregate - Aggregate all client updates")
    print("  GET  /get_status - Get training status")
    print("  POST /reset - Reset server")
    
    app.run(host='localhost', port=5000, debug=False)
