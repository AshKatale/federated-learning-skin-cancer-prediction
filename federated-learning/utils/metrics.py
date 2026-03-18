"""
Evaluation Metrics
"""
import numpy as np


class Metrics:
    """Calculate evaluation metrics"""
    
    @staticmethod
    def mean_squared_error(y_true, y_pred):
        """Calculate MSE"""
        return np.mean((y_true - y_pred) ** 2)
    
    @staticmethod
    def root_mean_squared_error(y_true, y_pred):
        """Calculate RMSE"""
        return np.sqrt(np.mean((y_true - y_pred) ** 2))
    
    @staticmethod
    def mean_absolute_error(y_true, y_pred):
        """Calculate MAE"""
        return np.mean(np.abs(y_true - y_pred))
    
    @staticmethod
    def r_squared(y_true, y_pred):
        """Calculate R-squared score"""
        ss_res = np.sum((y_true - y_pred) ** 2)
        ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
        return 1 - (ss_res / ss_tot)
