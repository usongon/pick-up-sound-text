use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::Argon2;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::RngCore;
use std::path::PathBuf;
use crate::{Error, Result};

/// Key store for encrypting/decrypting API keys
pub struct KeyStore {
    cipher: Aes256Gcm,
}

impl KeyStore {
    /// Create a new KeyStore with a key derived from machine UUID + app salt
    pub fn new() -> Result<Self> {
        let machine_id = Self::get_machine_id()?;
        let salt = Self::get_or_create_salt()?;
        
        // Derive key using Argon2
        let mut key = [0u8; 32];
        Argon2::default()
            .hash_password_into(&machine_id, &salt, &mut key)
            .map_err(|e| Error::Config(format!("Key derivation failed: {}", e)))?;
        
        let cipher = Aes256Gcm::new(&key.into());
        Ok(Self { cipher })
    }
    
    /// Encrypt a plaintext string
    pub fn encrypt(&self, plaintext: &str) -> Result<String> {
        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        let ciphertext = self.cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| Error::Config(format!("Encryption failed: {}", e)))?;
        
        // Combine nonce + ciphertext and encode as base64
        let mut combined = nonce_bytes.to_vec();
        combined.extend_from_slice(&ciphertext);
        Ok(BASE64.encode(combined))
    }
    
    /// Decrypt a base64-encoded ciphertext
    pub fn decrypt(&self, encoded: &str) -> Result<String> {
        let combined = BASE64.decode(encoded)
            .map_err(|e| Error::Config(format!("Base64 decode failed: {}", e)))?;
        
        if combined.len() < 12 {
            return Err(Error::Config("Invalid ciphertext length".to_string()));
        }
        
        let (nonce_bytes, ciphertext) = combined.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);
        
        let plaintext = self.cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| Error::Config(format!("Decryption failed: {}", e)))?;
        
        String::from_utf8(plaintext)
            .map_err(|e| Error::Config(format!("UTF-8 decode failed: {}", e)))
    }
    
    /// Get machine unique identifier (macOS: IOPlatformUUID)
    #[cfg(target_os = "macos")]
    fn get_machine_id() -> Result<Vec<u8>> {
        use std::process::Command;
        
        let output = Command::new("ioreg")
            .args(&["-d2", "-c", "IOPlatformExpertDevice"])
            .output()
            .map_err(|e| Error::Config(format!("Failed to get machine ID: {}", e)))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        let uuid = stdout
            .lines()
            .find(|line| line.contains("IOPlatformUUID"))
            .and_then(|line| line.split('"').nth(3))
            .ok_or_else(|| Error::Config("IOPlatformUUID not found".to_string()))?;
        
        Ok(uuid.as_bytes().to_vec())
    }
    
    #[cfg(not(target_os = "macos"))]
    fn get_machine_id() -> Result<Vec<u8>> {
        // Fallback for other platforms
        Ok(b"default-machine-id".to_vec())
    }
    
    /// Get or create app salt
    fn get_or_create_salt() -> Result<Vec<u8>> {
        let salt_path = Self::salt_path()?;
        
        if salt_path.exists() {
            let salt = std::fs::read(&salt_path)?;
            Ok(salt)
        } else {
            let mut salt = vec![0u8; 32];
            rand::thread_rng().fill_bytes(&mut salt);
            
            if let Some(parent) = salt_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::write(&salt_path, &salt)?;
            
            // Set permissions to 0600 (owner read/write only)
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = std::fs::metadata(&salt_path)?.permissions();
                perms.set_mode(0o600);
                std::fs::set_permissions(&salt_path, perms)?;
            }
            
            Ok(salt)
        }
    }
    
    fn salt_path() -> Result<PathBuf> {
        let home = dirs::home_dir()
            .ok_or_else(|| Error::Config("Cannot find home directory".to_string()))?;
        Ok(home.join("Library/Application Support/pick-up-sound-text/salt"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_encrypt_decrypt() {
        let keystore = KeyStore::new().unwrap();
        let plaintext = "test-api-key-12345";
        
        let encrypted = keystore.encrypt(plaintext).unwrap();
        let decrypted = keystore.decrypt(&encrypted).unwrap();
        
        assert_eq!(plaintext, decrypted);
    }
}
