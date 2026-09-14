use crate::config::OssConfig;
use crate::{Error, Result};
use base64::{engine::general_purpose, Engine as _};
use hmac::{Hmac, Mac};
use reqwest::Client;
use sha1::Sha1;
use std::path::Path;

type HmacSha1 = Hmac<Sha1>;

pub struct OssUploader {
    config: OssConfig,
    client: Client,
}

impl OssUploader {
    pub fn new(config: OssConfig) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }

    /// Upload a file to OSS and return a signed URL (valid for 1 hour)
    pub async fn upload_file(&self, file_path: &Path, object_name: &str) -> Result<String> {
        let file_bytes = std::fs::read(file_path)
            .map_err(|e| Error::Config(format!("Failed to read file: {}", e)))?;

        let content_type = "audio/wav";
        let content_md5 = general_purpose::STANDARD.encode(md5::compute(&file_bytes).as_slice());

        // Add path prefix if configured
        let object_key = if let Some(prefix) = &self.config.path_prefix {
            format!("{}/{}", prefix.trim_matches('/'), object_name)
        } else {
            object_name.to_string()
        };

        let url = format!(
            "https://{}.{}/{}",
            self.config.bucket, self.config.endpoint, object_key
        );

        // Generate OSS signature for PUT request
        let date = chrono::Utc::now().format("%a, %d %b %Y %H:%M:%S GMT").to_string();
        let signature = self.generate_signature(
            "PUT",
            &content_md5,
            content_type,
            &date,
            &object_key,
        );

        let auth_header = format!(
            "OSS {}:{}",
            self.config.access_key_id, signature
        );

        // Upload file
        let response = self
            .client
            .put(&url)
            .header("Authorization", auth_header.clone())
            .header("Content-Type", content_type)
            .header("Content-MD5", content_md5.clone())
            .header("Date", date.clone())
            .body(file_bytes)
            .send()
            .await
            .map_err(|e| Error::Config(format!("OSS upload failed: {}", e)))?;

        let status = response.status();
        let headers = response.headers().clone();
        let response_body = response.text().await.unwrap_or_else(|_| "<failed to read body>".to_string());
        
        tracing::info!("OSS upload response: status={}, headers={:?}, body={}", status, headers, response_body);
        tracing::info!("OSS upload URL: {}", url);
        tracing::info!("OSS Authorization header: {}", auth_header);
        tracing::info!("OSS Content-MD5: {}", content_md5);
        tracing::info!("OSS Date: {}", date);

        if !status.is_success() {
            return Err(Error::Config(format!(
                "OSS upload failed {}: {}",
                status, response_body
            )));
        }

        // Generate signed URL for private access (valid for 1 hour)
        let signed_url = self.generate_signed_url(&object_key, 3600)?;
        Ok(signed_url)
    }

    /// Generate a signed URL for temporary public access to a private object
    /// expires_in: seconds until the URL expires (e.g., 3600 for 1 hour)
    fn generate_signed_url(&self, object_key: &str, expires_in: i64) -> Result<String> {
        let expires = chrono::Utc::now().timestamp() + expires_in;
        
        let string_to_sign = format!(
            "GET\n\n\n{}\n/{}",
            expires,
            format!("{}/{}", self.config.bucket, object_key)
        );

        let mut mac = HmacSha1::new_from_slice(self.config.access_key_secret.as_bytes())
            .expect("HMAC can take key of any size");
        mac.update(string_to_sign.as_bytes());
        let signature = general_purpose::STANDARD.encode(mac.finalize().into_bytes());

        let signed_url = format!(
            "https://{}.{}/{}?OSSAccessKeyId={}&Expires={}&Signature={}",
            self.config.bucket,
            self.config.endpoint,
            object_key,
            urlencoding::encode(&self.config.access_key_id),
            expires,
            urlencoding::encode(&signature)
        );

        Ok(signed_url)
    }

    /// Generate OSS request signature for PUT/DELETE
    fn generate_signature(
        &self,
        method: &str,
        content_md5: &str,
        content_type: &str,
        date: &str,
        object_key: &str,
    ) -> String {
        let string_to_sign = format!(
            "{}\n{}\n{}\n{}\n/{}",
            method,
            content_md5,
            content_type,
            date,
            format!("{}/{}", self.config.bucket, object_key)
        );

        let mut mac = HmacSha1::new_from_slice(self.config.access_key_secret.as_bytes())
            .expect("HMAC can take key of any size");
        mac.update(string_to_sign.as_bytes());
        let result = mac.finalize();
        general_purpose::STANDARD.encode(result.into_bytes())
    }

    /// Delete a file from OSS (optional cleanup)
    pub async fn delete_file(&self, object_name: &str) -> Result<()> {
        let object_key = if let Some(prefix) = &self.config.path_prefix {
            format!("{}/{}", prefix.trim_matches('/'), object_name)
        } else {
            object_name.to_string()
        };

        let url = format!(
            "https://{}.{}/{}",
            self.config.bucket, self.config.endpoint, object_key
        );

        let date = chrono::Utc::now().format("%a, %d %b %Y %H:%M:%S GMT").to_string();
        let signature = self.generate_signature("DELETE", "", "", &date, &object_key);

        let auth_header = format!(
            "OSS {}:{}",
            self.config.access_key_id, signature
        );

        let response = self
            .client
            .delete(&url)
            .header("Authorization", auth_header)
            .header("Date", date)
            .send()
            .await
            .map_err(|e| Error::Config(format!("OSS delete failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(Error::Config(format!(
                "OSS delete failed {}: {}",
                status, error_text
            )));
        }

        Ok(())
    }
}
