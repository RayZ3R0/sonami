use ib_romaji::HepburnRomanizer;
use std::sync::LazyLock;

static ROMANIZER: LazyLock<HepburnRomanizer> = LazyLock::new(HepburnRomanizer::default);

pub fn is_japanese_char(c: char) -> bool {
    matches!(c, '\u{3040}'..='\u{309F}' | '\u{30A0}'..='\u{30FF}' | '\u{4E00}'..='\u{9FFF}' | '\u{3400}'..='\u{4DBF}')
}

pub fn contains_japanese(text: &str) -> bool {
    text.chars().any(is_japanese_char)
}

pub fn is_kana_char(c: char) -> bool {
    matches!(c, '\u{3040}'..='\u{309F}' | '\u{30A0}'..='\u{30FF}')
}

pub fn romanize_japanese(text: &str) -> Option<String> {
    if !contains_japanese(text) {
        return None;
    }

    let mut result = String::with_capacity(text.len());
    let mut current_chunk = String::new();
    let mut is_chunk_kana = false;

    // Helper closure to process chunks
    let mut process_chunk = |chunk: &str, is_kana: bool| {
        if is_kana {
            if let Some(romanized) = ROMANIZER.romanize_kana_str_all(chunk) {
                result.push_str(&romanized);
            } else {
                result.push_str(chunk);
            }
        } else {
            result.push_str(chunk);
        }
    };

    for c in text.chars() {
        let is_kana = is_kana_char(c);

        if is_kana != is_chunk_kana {
            if !current_chunk.is_empty() {
                process_chunk(&current_chunk, is_chunk_kana);
                current_chunk.clear();
            }
            is_chunk_kana = is_kana;
        }
        current_chunk.push(c);
    }

    if !current_chunk.is_empty() {
        process_chunk(&current_chunk, is_chunk_kana);
    }

    if result == text {
        None
    } else {
        Some(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_contains_japanese() {
        assert!(contains_japanese("こんにちは"));
        assert!(contains_japanese("Hello こんにちは"));
        assert!(contains_japanese("カタカナ"));
        assert!(contains_japanese("漢字"));
        assert!(!contains_japanese("Hello World"));
        assert!(!contains_japanese("123"));
    }

    #[test]
    fn test_romanize_hiragana() {
        let result = romanize_japanese("あいうえお");
        assert!(result.is_some());
        assert_eq!(result.unwrap(), "aiueo");
    }

    #[test]
    fn test_romanize_katakana() {
        let result = romanize_japanese("アイウエオ");
        assert!(result.is_some());
        assert_eq!(result.unwrap(), "aiueo");
    }

    #[test]
    fn test_romanize_mixed() {
        let result = romanize_japanese("Hello ワールド");
        assert!(result.is_some());
        let s = result.unwrap();
        assert!(s.contains("Hello"));
        // Expect "Hello wa-rudo" or similar, just verify it changed
        assert_ne!(s, "Hello ワールド");
        assert!(s.contains("wa-rudo"));
    }

    #[test]
    fn test_no_japanese() {
        assert_eq!(romanize_japanese("Hello World"), None);
    }
}
