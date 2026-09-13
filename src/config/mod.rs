use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use crate::{Error, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AsrConfig {
    pub provider: String,
    pub model: String,
    pub api_key: String,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslateConfig {
    pub provider: String,
    pub base_url: String,
    pub model: String,
    pub api_key: String,
    pub target_lang: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub asr: AsrConfig,
    pub translate: TranslateConfig,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            asr: AsrConfig {
                provider: "dashscope".to_string(),
                model: "paraformer-realtime-v2".to_string(),
                api_key: "".to_string(),
                language: "auto".to_string(),
            },
            translate: TranslateConfig {
                provider: "openai".to_string(),
                base_url: "https://api.openai.com/v1".to_string(),
                model: "gpt-3.5-turbo".to_string(),
                api_key: "".to_string(),
                target_lang: "zh".to_string(),
            },
        }
    }
}

impl AppConfig {
    pub fn config_path() -> Result<PathBuf> {
        let home = dirs::home_dir()
            .ok_or_else(|| Error::Config("Cannot find home directory".to_string()))?;
        Ok(home.join("Library/Application Support/pick-up-sound-text/config.json"))
    }

    pub fn load() -> Result<Self> {
        let path = Self::config_path()?;
        if !path.exists() {
            return Ok(Self::default());
        }
        let content = std::fs::read_to_string(&path)?;
        let config = serde_json::from_str(&content)?;
        Ok(config)
    }

    pub fn save(&self) -> Result<()> {
        let path = Self::config_path()?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(self)?;
        std::fs::write(&path, content)?;
        Ok(())
    }
}
