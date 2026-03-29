"""
Training Orchestrator
Manages federated learning rounds, auto-triggering, and monitoring
"""

import requests
import time
import logging
import json
import os
from datetime import datetime
from pathlib import Path
from client_simulator import ClientSimulator

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class TrainingOrchestrator:
    """Manages FL training orchestration and auto-triggering"""
    
    def __init__(
        self,
        server_url="http://localhost:3001",
        auto_trigger_threshold=20,  # Images before auto-train
        poll_interval=30  # Check every 30 seconds
    ):
        self.server_url = server_url
        self.api_url = f"{server_url}/api/federated-learning"
        self.auto_trigger_threshold = auto_trigger_threshold
        self.poll_interval = poll_interval
        self.simulator = None
        self.is_monitoring = False
    
    def setup_client_simulator(self, num_clients=3, iid=False):
        """Initialize client simulator for testing"""
        logger.info(f"Setting up client simulator: {num_clients} clients, IID={iid}")
        self.simulator = ClientSimulator(
            num_clients=num_clients,
            data_dir='./uploads',
            iid=iid,
            alpha=0.1
        )
    
    def trigger_global_training(self, num_rounds=5, num_clients=3, iid=False):
        """Manually trigger global federated training"""
        try:
            logger.info(f"Triggering global training: {num_rounds} rounds, {num_clients} clients")
            
            response = requests.post(
                f"{self.api_url}/train-global",
                json={
                    'numRounds': num_rounds,
                    'numClients': num_clients,
                    'iid': iid
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                training_id = data.get('training_id')
                logger.info(f"✓ Training initiated (ID: {training_id})")
                return training_id
            else:
                logger.error(f"✗ Failed to start training: {response.text}")
                return None
        except Exception as e:
            logger.error(f"Error triggering training: {e}")
            return None
    
    def trigger_local_training(self, client_id="user", epochs=1):
        """Manually trigger local client training"""
        try:
            logger.info(f"Triggering local training: Client={client_id}, Epochs={epochs}")
            
            response = requests.post(
                f"{self.api_url}/train-local",
                json={
                    'clientId': client_id,
                    'epochs': epochs
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                training_id = data.get('training_id')
                logger.info(f"✓ Local training initiated (ID: {training_id})")
                return training_id
            else:
                logger.error(f"✗ Failed to start training: {response.text}")
                return None
        except Exception as e:
            logger.error(f"Error triggering local training: {e}")
            return None
    
    def get_training_status(self, training_id):
        """Check status of ongoing training"""
        try:
            response = requests.get(f"{self.api_url}/{training_id}/status")
            
            if response.status_code == 200:
                return response.json().get('training')
            else:
                logger.error(f"Failed to get training status: {response.text}")
                return None
        except Exception as e:
            logger.error(f"Error getting training status: {e}")
            return None
    
    def monitor_and_auto_trigger(self):
        """
        Monitor for new images and auto-trigger training when threshold is met
        Runs continuously in the background
        """
        logger.info("Starting auto-trigger monitoring...")
        logger.info(f"Threshold: {self.auto_trigger_threshold} new images")
        
        self.is_monitoring = True
        
        try:
            while self.is_monitoring:
                # Check number of unused images
                if self.simulator:
                    unused_count = self.simulator.get_unused_images_count()
                    
                    if unused_count >= self.auto_trigger_threshold:
                        logger.info(
                            f"✓ Threshold reached: {unused_count} unused images. "
                            f"Triggering training..."
                        )
                        
                        # Trigger global training
                        training_id = self.trigger_global_training(
                            num_rounds=3,
                            num_clients=3,
                            iid=False
                        )
                        
                        if training_id:
                            # Wait for training to complete and check periodically
                            self._wait_for_training(training_id)
                
                # Sleep before next check
                time.sleep(self.poll_interval)
        
        except KeyboardInterrupt:
            logger.info("Monitoring stopped by user")
            self.is_monitoring = False
        except Exception as e:
            logger.error(f"Error in monitoring loop: {e}")
            self.is_monitoring = False
    
    def _wait_for_training(self, training_id, max_wait_seconds=600):
        """Wait for training to complete"""
        start_time = time.time()
        
        while time.time() - start_time < max_wait_seconds:
            status = self.get_training_status(training_id)
            
            if status:
                if status['status'] == 'completed':
                    logger.info(f"✓ Training completed (Duration: {status['duration_seconds']}s)")
                    return True
                elif status['status'] == 'failed':
                    logger.error("✗ Training failed")
                    return False
            
            time.sleep(10)
        
        logger.warning("Training did not complete within timeout")
        return False
    
    def get_analytics(self):
        """Get training analytics"""
        try:
            response = requests.get(f"{self.api_url}/analytics")
            
            if response.status_code == 200:
                return response.json().get('analytics')
            else:
                logger.error(f"Failed to get analytics: {response.text}")
                return None
        except Exception as e:
            logger.error(f"Error getting analytics: {e}")
            return None
    
    def print_analytics(self):
        """Print training analytics to console"""
        analytics = self.get_analytics()
        
        if not analytics:
            logger.info("No analytics available")
            return
        
        logger.info("="*50)
        logger.info("FEDERATED LEARNING ANALYTICS")
        logger.info("="*50)
        logger.info(f"Total Rounds:              {analytics.get('totalRounds', 0)}")
        logger.info(f"Average Accuracy:          {analytics.get('averageAccuracy', 0)}")
        logger.info(f"Best Accuracy:             {analytics.get('bestAccuracy', 0)}")
        logger.info(f"Converged Rounds:          {analytics.get('convergenceRounds', 0)}")
        logger.info(f"Avg Client Participation:  {analytics.get('averageClientParticipation', 0)}")
        logger.info("="*50)


def main():
    """Example usage"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Federated Learning Orchestrator')
    parser.add_argument('--mode', choices=['global', 'local', 'monitor', 'analytics'],
                       default='global', help='Operating mode')
    parser.add_argument('--clients', type=int, default=3, help='Number of clients')
    parser.add_argument('--rounds', type=int, default=5, help='Number of FL rounds')
    parser.add_argument('--epochs', type=int, default=1, help='Local training epochs')
    parser.add_argument('--iid', action='store_true', help='Use IID data distribution')
    parser.add_argument('--threshold', type=int, default=20,
                       help='Auto-trigger threshold (images)')
    
    args = parser.parse_args()
    
    orchestrator = TrainingOrchestrator(
        auto_trigger_threshold=args.threshold
    )
    
    if args.mode == 'global':
        logger.info("MODE: Global Federated Learning")
        training_id = orchestrator.trigger_global_training(
            num_rounds=args.rounds,
            num_clients=args.clients,
            iid=args.iid
        )
        
        if training_id:
            orchestrator._wait_for_training(training_id)
            orchestrator.print_analytics()
    
    elif args.mode == 'local':
        logger.info("MODE: Local Client Training")
        training_id = orchestrator.trigger_local_training(
            client_id='user_1',
            epochs=args.epochs
        )
        
        if training_id:
            orchestrator._wait_for_training(training_id)
    
    elif args.mode == 'monitor':
        logger.info("MODE: Auto-trigger Monitoring")
        orchestrator.setup_client_simulator(
            num_clients=args.clients,
            iid=args.iid
        )
        orchestrator.monitor_and_auto_trigger()
    
    elif args.mode == 'analytics':
        logger.info("MODE: View Analytics")
        orchestrator.print_analytics()


if __name__ == "__main__":
    main()
