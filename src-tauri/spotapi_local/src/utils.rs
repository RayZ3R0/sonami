use anyhow::{anyhow, Result};
use rand::{distributions::Alphanumeric, Rng};
use regex::Regex;

pub fn random_string(len: usize) -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(len)
        .map(char::from)
        .collect()
}

pub fn random_hex_string(len: usize) -> String {
    let mut bytes = vec![0u8; len.div_ceil(2)];
    rand::thread_rng().fill(&mut bytes[..]);
    let hex_string = hex::encode(bytes);
    hex_string[..len].to_string()
}

pub fn extract_js_links(html: &str) -> Vec<String> {
    let re = Regex::new(r#"src="([^"]+\.js)""#).unwrap();
    re.captures_iter(html)
        .map(|cap| cap[1].to_string())
        .collect()
}

pub fn extract_mappings(
    js_code: &str,
) -> Result<(
    std::collections::HashMap<i32, String>,
    std::collections::HashMap<i32, String>,
)> {
    let re_obj = Regex::new(r#"\{(\d+:"[^"]+"(?:,\d+:"[^"]+")*)\}"#).unwrap();

    let matches: Vec<_> = re_obj.find_iter(js_code).map(|m| m.as_str()).collect();

    if matches.len() < 5 {
        return Err(anyhow!(
            "Could not find both mappings in the JS code (matches found: {})",
            matches.len()
        ));
    }

    let map1 = parse_js_dict(matches[3])?;
    let map2 = parse_js_dict(matches[4])?;

    Ok((map1, map2))
}

fn parse_js_dict(s: &str) -> Result<std::collections::HashMap<i32, String>> {
    let content = s.trim_start_matches('{').trim_end_matches('}');
    let mut map = std::collections::HashMap::new();

    let mut current = content;
    while !current.is_empty() {
        if let Some(colon_idx) = current.find(':') {
            let key_str = &current[..colon_idx];
            let key: i32 = key_str
                .parse()
                .map_err(|_| anyhow!("Failed to parse key: {}", key_str))?;

            let remainder = &current[colon_idx + 1..];
            if !remainder.starts_with('"') {
                return Err(anyhow!("Value does not start with quote"));
            }

            if let Some(end_quote_idx) = remainder[1..].find('"') {
                let end_quote_real_idx = end_quote_idx + 1;
                let value = &remainder[1..end_quote_real_idx];
                map.insert(key, value.to_string());

                if remainder.len() > end_quote_real_idx + 1 {
                    if remainder.as_bytes()[end_quote_real_idx + 1] == b',' {
                        current = &remainder[end_quote_real_idx + 2..];
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            } else {
                return Err(anyhow!("Value does not end with quote"));
            }
        } else {
            break;
        }
    }

    Ok(map)
}

pub fn combine_chunks(
    name_map: &std::collections::HashMap<i32, String>,
    hash_map: &std::collections::HashMap<i32, String>,
) -> Vec<String> {
    let mut combined = Vec::new();
    for (key, name) in name_map {
        if let Some(hash) = hash_map.get(key) {
            combined.push(format!("{}.{}.js", name, hash));
        }
    }
    combined
}
