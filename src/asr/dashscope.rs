use crate::asr::{AsrConfig, AsrEvent, AsrProvider, AsrStream};
use crate::{Error, Result};
use async_trait::async_trait;
use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use tokio::sync::mpsc;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use uuid::Uuid;

pub struct DashScopeAsrProvider;

#[async_trait]
impl AsrProvider for DashScopeAsrProvider {
    async fn start_stream(&self, config: &AsrConfig) -> Result<Box<dyn AsrStream>> {
        let task_id = Uuid::new_v4().to_string();
        
        // WebSocket URL
        let url = format!("wss://dashscope.aliyuncs.com/api-ws/v1/inference?Authorization=Bearer%20{}", config.api_key);
        
        // Create WebSocket connection
        let (ws_stream, _) = connect_async(&url)
            .await
            .map_err(|e| Error::Asr(format!("WebSocket connection failed: {}", e)))?;
        
        let (mut write, mut read) = ws_stream.split();
        
        // Send run-task message
        let run_task = json!({
            "header": {
                "action": "run-task",
                "task_id": task_id,
                "streaming": "duplex"
            },
            "payload": {
                "task_group": "audio",
                "task": "asr",
                "function": "recognition",
                "model": config.model,
                "input": {},
                "parameters": {
                    "format": "pcm",
                    "sample_rate": 16000,
                    "language_hints": [config.language],
                    "semantic_punctuation_enabled": false,
                    "max_sentence_silence": 1300,
                    "punctuation_prediction_enabled": true,
                    "inverse_text_normalization_enabled": true
                }
            }
        });
        
        write
            .send(Message::Text(run_task.to_string()))
            .await
            .map_err(|e| Error::Asr(format!("Failed to send run-task: {}", e)))?;
        
        // Wait for task-started
        let (tx, rx) = mpsc::channel(100);
        
        // Spawn task to read WebSocket messages
        tokio::spawn(async move {
            while let Some(msg) = read.next().await {
                match msg {
                    Ok(Message::Text(text)) => {
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                            if let Some(event) = json["header"]["event"].as_str() {
                                match event {
                                    "task-started" => {
                                        let _ = tx.send(Ok(AsrEvent::EndOfStream)).await; // Signal ready
                                    }
                                    "result-generated" => {
                                        if let Some(sentence) = json["payload"]["output"]["sentence"].as_object() {
                                            let text = sentence["text"].as_str().unwrap_or("").to_string();
                                            let begin_time = sentence["begin_time"].as_f64().unwrap_or(0.0) / 1000.0;
                                            let end_time = sentence["end_time"].as_f64().unwrap_or(0.0) / 1000.0;
                                            let sentence_end = sentence["sentence_end"].as_bool().unwrap_or(false);
                                            
                                            if sentence_end {
                                                let _ = tx.send(Ok(AsrEvent::Final {
                                                    text,
                                                    ts_start: begin_time,
                                                    ts_end: end_time,
                                                })).await;
                                            } else {
                                                let _ = tx.send(Ok(AsrEvent::Partial {
                                                    text,
                                                    ts_start: begin_time,
                                                    ts_end: end_time,
                                                })).await;
                                            }
                                        }
                                    }
                                    "task-finished" => {
                                        let _ = tx.send(Ok(AsrEvent::EndOfStream)).await;
                                        break;
                                    }
                                    "task-failed" => {
                                        let error_code = json["header"]["error_code"].as_str().unwrap_or("UNKNOWN").to_string();
                                        let error_message = json["header"]["error_message"].as_str().unwrap_or("Unknown error").to_string();
                                        let _ = tx.send(Ok(AsrEvent::Error {
                                            code: error_code,
                                            message: error_message,
                                        })).await;
                                        break;
                                    }
                                    _ => {}
                                }
                            }
                        }
                    }
                    Ok(Message::Close(_)) => {
                        let _ = tx.send(Ok(AsrEvent::EndOfStream)).await;
                        break;
                    }
                    Err(e) => {
                        let _ = tx.send(Err(Error::Asr(format!("WebSocket error: {}", e)))).await;
                        break;
                    }
                    _ => {}
                }
            }
        });
        
        Ok(Box::new(DashScopeAsrStream {
            write,
            rx,
            task_id,
        }))
    }
}

struct DashScopeAsrStream {
    write: futures_util::stream::SplitSink<tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>, Message>,
    rx: mpsc::Receiver<Result<AsrEvent>>,
    #[allow(dead_code)]
    task_id: String,
}

#[async_trait]
impl AsrStream for DashScopeAsrStream {
    async fn send_audio(&mut self, pcm: &[i16]) -> Result<()> {
        // Convert i16 samples to bytes (little-endian)
        let bytes: Vec<u8> = pcm.iter()
            .flat_map(|&sample| sample.to_le_bytes())
            .collect();
        
        self.write
            .send(Message::Binary(bytes))
            .await
            .map_err(|e| Error::Asr(format!("Failed to send audio: {}", e)))?;
        
        Ok(())
    }
    
    async fn next_event(&mut self) -> Result<AsrEvent> {
        self.rx.recv().await
            .ok_or_else(|| Error::Asr("WebSocket channel closed".to_string()))?
    }
}

impl Drop for DashScopeAsrStream {
    fn drop(&mut self) {
        // Note: Cannot send finish-task in Drop because it's not async
        // The WebSocket will be closed when the stream is dropped
        // In a production implementation, we would send finish-task before dropping
    }
}
