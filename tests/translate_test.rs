use pick_up_sound_text::translate::{TranslateProvider, TranslateRequest};
use pick_up_sound_text::translate::openai::OpenAiCompatibleProvider;

#[tokio::test]
async fn test_openai_provider_creation() {
    let provider = OpenAiCompatibleProvider {
        base_url: "https://api.openai.com/v1".to_string(),
        model: "gpt-3.5-turbo".to_string(),
        api_key: "test_key".to_string(),
    };

    let req = TranslateRequest {
        text: "Hello".to_string(),
        source_lang: "en".to_string(),
        target_lang: "zh".to_string(),
        context: vec![],
        glossary: None,
    };

    let result = provider.translate(req).await;
    assert!(result.is_ok());
}
