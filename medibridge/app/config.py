"""Central config. Secrets come from env only, never from code."""
import os
from functools import lru_cache

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    gemini_api_key: SecretStr
    gemini_model: str = "gemini-2.5-flash"
    api_keys: SecretStr  # comma-separated client keys
    allowed_origins: str = "http://localhost:3000"
    environment: str = "development"
    max_upload_mb: int = 5
    max_image_side_px: int = 2048
    rate_limit_per_minute: int = 10
    llm_timeout_seconds: int = 45

    @field_validator("api_keys")
    @classmethod
    def _no_default_keys_in_prod(cls, v: SecretStr) -> SecretStr:
        keys = v.get_secret_value().split(",")
        if os.getenv("ENVIRONMENT") == "production" and any(
            k.strip().startswith("change-me") for k in keys
        ):
            raise ValueError("Default API keys not allowed in production")
        return v

    @property
    def api_key_list(self) -> list[str]:
        return [k.strip() for k in self.api_keys.get_secret_value().split(",") if k.strip()]

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def is_prod(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
