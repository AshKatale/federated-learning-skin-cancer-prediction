import json
import numpy as np
from flask import Flask, request, jsonify
from datetime import datetime
import uuid

app = Flask(__name__)

rounds_db = {}
clients_db = {}

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'service': 'fl-server',
        'activeRounds': len([r for r in rounds_db.values() if r['status'] == 'active'])
    })

@app.route('/api/rounds', methods=['GET'])
def get_rounds():
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 10, type=int)
    status = request.args.get('status', None)
    
    rounds_list = list(rounds_db.values())
    
    if status:
        rounds_list = [r for r in rounds_list if r['status'] == status]
    
    rounds_list.sort(key=lambda x: x['roundNumber'], reverse=True)
    
    start = (page - 1) * limit
    end = start + limit
    
    return jsonify({
        'success': True,
        'data': {
            'total': len(rounds_list),
            'page': page,
            'limit': limit,
            'rounds': rounds_list[start:end]
        }
    })

@app.route('/api/rounds/<round_id>', methods=['GET'])
def get_round(round_id):
    if round_id not in rounds_db:
        return jsonify({'success': False, 'message': 'Round not found'}), 404
    
    return jsonify({
        'success': True,
        'round': rounds_db[round_id]
    })

@app.route('/api/rounds/initiate', methods=['POST'])
def initiate_round():
    data = request.json or {}
    
    round_number = len(rounds_db) + 1
    round_id = str(uuid.uuid4())
    
    new_round = {
        'id': round_id,
        'roundNumber': round_number,
        'status': 'active',
        'globalModel': {
            'version': f'{round_number}.0',
            'weightsHash': f'hash_{round_id[:16]}',
            'accuracy': 0.0,
            'loss': 0.0
        },
        'clients': [],
        'clientCount': len(data.get('clientList', [])),
        'aggregation': {
            'method': data.get('aggregationMethod', 'FedAvg'),
            'weights': 'weighted_by_samples',
            'secureAggregation': True
        },
        'privacy': {
            'differentialPrivacy': {
                'enabled': True,
                'epsilon': 4.5,
                'delta': 0.00001
            },
            'secureAggregation': True
        },
        'metrics': {
            'globalAccuracy': 0.0,
            'globalLoss': 0.0,
            'convergence': False,
            'convergenceRound': None
        },
        'startedAt': datetime.now().isoformat(),
        'completedAt': None,
        'duration': None
    }
    
    for client_id in data.get('clientList', []):
        new_round['clients'].append({
            'id': client_id,
            'status': 'pending',
            'samplesUsed': 0,
            'trainAccuracy': 0.0,
            'trainLoss': 0.0,
            'completedAt': None
        })
    
    rounds_db[round_id] = new_round
    
    return jsonify({
        'success': True,
        'round': new_round
    }), 201

@app.route('/api/rounds/<round_id>/update-client', methods=['PUT'])
def update_client(round_id):
    if round_id not in rounds_db:
        return jsonify({'success': False, 'message': 'Round not found'}), 404
    
    data = request.json or {}
    round_obj = rounds_db[round_id]
    
    for client in round_obj['clients']:
        if client['id'] == data.get('clientId'):
            client['status'] = data.get('status', 'pending')
            client['samplesUsed'] = data.get('samplesUsed', 0)
            client['trainAccuracy'] = data.get('trainAccuracy', 0.0)
            client['trainLoss'] = data.get('trainLoss', 0.0)
            client['completedAt'] = datetime.now().isoformat()
            
            return jsonify({
                'success': True,
                'client': client
            })
    
    return jsonify({'success': False, 'message': 'Client not found'}), 404

@app.route('/api/rounds/<round_id>/complete', methods=['PUT'])
def complete_round(round_id):
    if round_id not in rounds_db:
        return jsonify({'success': False, 'message': 'Round not found'}), 404
    
    data = request.json or {}
    round_obj = rounds_db[round_id]
    
    round_obj['status'] = 'completed'
    round_obj['globalModel']['accuracy'] = data.get('globalAccuracy', 0.0)
    round_obj['globalModel']['loss'] = data.get('globalLoss', 0.0)
    round_obj['metrics']['globalAccuracy'] = data.get('globalAccuracy', 0.0)
    round_obj['metrics']['globalLoss'] = data.get('globalLoss', 0.0)
    round_obj['metrics']['convergence'] = data.get('convergence', False)
    round_obj['completedAt'] = datetime.now().isoformat()
    
    start_time = datetime.fromisoformat(round_obj['startedAt'])
    end_time = datetime.fromisoformat(round_obj['completedAt'])
    round_obj['duration'] = int((end_time - start_time).total_seconds())
    
    return jsonify({
        'success': True,
        'round': round_obj
    })

@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    rounds_list = list(rounds_db.values())
    completed_rounds = [r for r in rounds_list if r['status'] == 'completed']
    
    all_clients = set()
    for round_obj in completed_rounds:
        for client in round_obj['clients']:
            all_clients.add(client['id'])
    
    accuracy_trend = []
    loss_trend = []
    
    for round_obj in sorted(completed_rounds, key=lambda x: x['roundNumber']):
        accuracy_trend.append({
            'round': round_obj['roundNumber'],
            'accuracy': round_obj['metrics']['globalAccuracy']
        })
        loss_trend.append({
            'round': round_obj['roundNumber'],
            'loss': round_obj['metrics']['globalLoss']
        })
    
    avg_accuracy = np.mean([r['metrics']['globalAccuracy'] for r in completed_rounds]) if completed_rounds else 0.0
    best_accuracy = max([r['metrics']['globalAccuracy'] for r in completed_rounds]) if completed_rounds else 0.0
    
    return jsonify({
        'success': True,
        'analytics': {
            'totalRounds': len(rounds_list),
            'activeRounds': len([r for r in rounds_list if r['status'] == 'active']),
            'completedRounds': len(completed_rounds),
            'averageAccuracy': float(avg_accuracy),
            'bestAccuracy': float(best_accuracy),
            'convergenceRounds': len([r for r in completed_rounds if r['metrics']['convergence']]),
            'averageClientsPerRound': len(all_clients) if completed_rounds else 0,
            'totalClientsParticipated': len(all_clients),
            'accuracyTrend': accuracy_trend,
            'lossTrend': loss_trend,
            'clientParticipationRate': 0.92
        }
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=6000, debug=False)
