use std::{collections::HashMap, sync::LazyLock};

macro_rules! t {
    ($expression:expr) => {
        crate::translate::translate($expression)
    };
}
pub(crate) use t;

pub(crate) fn translate(key: &str) -> &str {
    if LOCALE.to_lowercase().contains("ja") {
        JA.get(key).unwrap_or(&"")
    } else {
        EN.get(key).unwrap_or(&"")
    }
}

static LOCALE: LazyLock<String> = LazyLock::new(zouni::shell::get_locale);
static JA: LazyLock<HashMap<&str, &str>> = LazyLock::new(|| {
    HashMap::from([
        ("name", "名前"),
        ("directory", "フォルダ"),
        ("orig_path", "元の場所"),
        ("ddate", "削除日時"),
        ("extension", "種類"),
        ("mdate", "更新日時"),
        ("cdate", "作成日時"),
        ("size", "サイズ"),
        ("AutoAdjustColumnWidth", "列のサイズを自動的に調整する"),
        ("RemoveFromFavorite", "ピン留めから外す"),
        ("Property", "プロパティ"),
        ("Refresh", "再読み込み"),
        ("Undelete", "元に戻す"),
        ("DeleteFromRecycleBin", "完全に削除する"),
        ("EmptyRecycleBin", "ゴミ箱を空にする"),
        ("CopyFullpath", "パスをコピー"),
        ("AdminTerminal", "管理者として端末で開く"),
        ("Terminal", "端末で開く"),
        ("Open", "開く"),
        ("OpenWith", "プログラムから開く"),
        ("SelectApp", "別のプログラムを選択..."),
        ("Copy", "コピー"),
        ("Cut", "切り取り"),
        ("Paste", "貼り付け"),
        ("Trash", "削除"),
        ("AddToFavorite", "ピン留めする"),
        ("OpenInNewWindow", "新しいウィンドウで開く"),
    ])
});
static EN: LazyLock<HashMap<&str, &str>> = LazyLock::new(|| {
    HashMap::from([
        ("name", "Name"),
        ("directory", "Directory"),
        ("orig_path", "Original Location"),
        ("ddate", "Deleted Date"),
        ("extension", "Type"),
        ("mdate", "Modified Date"),
        ("cdate", "Created Date"),
        ("size", "Size"),
        ("AutoAdjustColumnWidth", "Adjust Column Size"),
        ("RemoveFromFavorite", "Unpin"),
        ("Property", "Property"),
        ("Refresh", "Refresh"),
        ("Undelete", "Undelete"),
        ("DeleteFromRecycleBin", "Delete"),
        ("EmptyRecycleBin", "Empty RecycleBin"),
        ("CopyFullpath", "Copy Path"),
        ("AdminTerminal", "Open Terminal(Admin)"),
        ("Terminal", "Open Terminal"),
        ("Open", "Open"),
        ("OpenWith", "Open With"),
        ("SelectApp", "Select another program..."),
        ("Copy", "Copy"),
        ("Cut", "Cut"),
        ("Paste", "Paste"),
        ("Trash", "Trash"),
        ("AddToFavorite", "Pin"),
        ("OpenInNewWindow", "Open New Window"),
    ])
});
