pub trait StringExt {
    fn is_empty_or_whitespace(&self) -> bool;
}

impl StringExt for str {
    fn is_empty_or_whitespace(&self) -> bool {
        self.trim().is_empty()
    }
}

impl StringExt for String {
    fn is_empty_or_whitespace(&self) -> bool {
        self.trim().is_empty()
    }
}
