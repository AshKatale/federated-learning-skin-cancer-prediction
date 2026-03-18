"""
Model Aggregation Utilities for Federated Learning
"""
import numpy as np


class ModelAggregator:
    """Aggregates model updates from multiple clients"""
    
    @staticmethod
    def average_weights(weights_list):
        """
        Average weights from multiple clients
        Args:
            weights_list: List of weight dictionaries from clients
        Returns:
            Averaged weight dictionary
        """
        if not weights_list:
            return None
        
        num_clients = len(weights_list)
        
        # Initialize accumulator
        avg_weights = np.zeros_like(weights_list[0]['weights'])
        avg_bias = 0.0
        
        # Sum all weights
        for w_dict in weights_list:
            avg_weights += np.array(w_dict['weights'])
            avg_bias += float(w_dict['bias'])
        
        # Average
        avg_weights /= num_clients
        avg_bias /= num_clients
        
        return {
            'weights': avg_weights,
            'bias': avg_bias
        }
    
    @staticmethod
    def weighted_average(weights_list, num_samples_list):
        """
        Weighted average of weights based on dataset sizes
        Args:
            weights_list: List of weight dictionaries
            num_samples_list: List of number of samples for each client
        Returns:
            Weighted averaged weight dictionary
        """
        if not weights_list:
            return None
        
        total_samples = sum(num_samples_list)
        
        # Initialize accumulator
        avg_weights = np.zeros_like(weights_list[0]['weights'])
        avg_bias = 0.0
        
        # Weighted sum
        for w_dict, num_samples in zip(weights_list, num_samples_list):
            weight = num_samples / total_samples
            avg_weights += np.array(w_dict['weights']) * weight
            avg_bias += float(w_dict['bias']) * weight
        
        return {
            'weights': avg_weights,
            'bias': avg_bias
        }
