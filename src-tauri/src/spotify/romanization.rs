use ib_romaji::HepburnRomanizer;
use std::sync::LazyLock;

static ROMANIZER: LazyLock<HepburnRomanizer> = LazyLock::new(HepburnRomanizer::default);

pub fn is_japanese_char(c: char) -> bool {
    matches!(c, '\u{3040}'..='\u{309F}' | '\u{30A0}'..='\u{30FF}' | '\u{4E00}'..='\u{9FFF}' | '\u{3400}'..='\u{4DBF}')
}

pub fn contains_japanese(text: &str) -> bool {
    text.chars().any(is_japanese_char)
}

pub fn romanize_japanese(text: &str) -> Option<String> {
    if !contains_japanese(text) {
        return None;
    }

    let result = ROMANIZER.romanize_kana_str_all(text);

    match result {
        Some(s) if s != text && !s.is_empty() => Some(s),
        _ => None,
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
        assert_ne!(s, "Hello ワールド");
    }

    #[test]
    fn test_no_japanese() {
        assert_eq!(romanize_japanese("Hello World"), None);
    }
}
