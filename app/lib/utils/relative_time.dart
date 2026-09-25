/// "2 hours ago", in the parent's language.
///
/// Shown beside a value filled in from the child's own records, so a parent can
/// see at a glance that a glucose reading is from this morning rather than last
/// week — the whole point of showing it at all.
String relativeTime(DateTime then, {required String locale, DateTime? now}) {
  final diff = (now ?? DateTime.now()).difference(then);
  final ta = locale == 'ta';

  if (diff.inMinutes < 1) return ta ? 'இப்போது' : 'just now';
  if (diff.inMinutes < 60) {
    return ta ? '${diff.inMinutes} நிமிடம் முன்' : '${diff.inMinutes} min ago';
  }
  if (diff.inHours < 24) {
    return ta ? '${diff.inHours} மணி முன்' : '${diff.inHours} h ago';
  }
  final days = diff.inDays;
  if (days < 30) {
    return ta
        ? '$days நாள் முன்'
        : (days == 1 ? '1 day ago' : '$days days ago');
  }
  final months = days ~/ 30;
  return ta
      ? '$months மாதம் முன்'
      : (months == 1 ? '1 month ago' : '$months months ago');
}
