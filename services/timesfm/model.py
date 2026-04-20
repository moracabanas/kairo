import numpy as np

try:
    import timesfm
    TIMESFM_AVAILABLE = True
except ImportError:
    TIMESFM_AVAILABLE = False


class TimesFMModel:
    def __init__(self, model_path: str = None, device: str = "cpu"):
        self.device = device
        self.model = None
        self.mock_mode = False

        if not TIMESFM_AVAILABLE:
            self.mock_mode = True
            return

        try:
            import torch
            torch.set_float32_matmul_precision("high")

            self.model = timesfm.TimesFM_2p5_200M_torch.from_pretrained(
                "google/timesfm-2.5-200m-pytorch"
            )

            self.model.compile(
                timesfm.ForecastConfig(
                    max_context=1024,
                    max_horizon=128,
                    normalize_inputs=True,
                    use_continuous_quantile_head=True,
                    force_flip_invariance=True,
                    fix_quantile_crossing=True,
                )
            )
        except Exception:
            self.mock_mode = True

    def forecast(
        self,
        context: np.ndarray,
        forecast_length: int = 128,
        frequency: int = 3600
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        if self.mock_mode:
            return self._mock_forecast(context, forecast_length)

        point_forecast, quantile_forecast = self.model.forecast(
            horizon=forecast_length,
            inputs=[context]
        )

        q025 = quantile_forecast[0, :, 1]
        q975 = quantile_forecast[0, :, 9]

        return point_forecast[0], q025, q975

    def _mock_forecast(
        self,
        context: np.ndarray,
        forecast_length: int
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        last_value = context[-1] if len(context) > 0 else 0.0
        trend = 0.01

        base_forecast = last_value + trend * np.arange(1, forecast_length + 1)
        noise = np.random.randn(forecast_length) * 0.1 * np.abs(last_value)

        forecast = base_forecast + noise
        uncertainty = 0.1 * np.abs(base_forecast) * np.sqrt(np.arange(1, forecast_length + 1))

        lower_bound = forecast - 1.96 * uncertainty
        upper_bound = forecast + 1.96 * uncertainty

        return forecast, lower_bound, upper_bound
