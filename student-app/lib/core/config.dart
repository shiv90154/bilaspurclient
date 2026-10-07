/// Backend base URL. Override per build:
///   flutter run --dart-define=API_URL=http://192.168.1.10:3000/api
/// The default points at the host machine as seen from the Android emulator.
const apiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://10.0.2.2:3000/api',
);

/// Turns a server-relative path ("/api/files/...") into a full URL on the API host.
String absoluteUrl(String path) => Uri.parse(apiUrl).replace(path: path, query: null).toString();

/// Public website with the privacy policy, terms and account deletion pages. Override with
/// --dart-define=WEB_URL=https://admin.example.com; otherwise `api.<domain>` becomes `admin.<domain>`
/// (local dev: port 3000 becomes the web's 3001).
final String webUrl = () {
  const given = String.fromEnvironment('WEB_URL');
  if (given.isNotEmpty) return given;
  final api = Uri.parse(apiUrl);
  final host = api.host.startsWith('api.') ? 'admin.${api.host.substring(4)}' : api.host;
  final port = api.hasPort && api.port == 3000 ? 3001 : (api.hasPort ? api.port : null);
  return Uri(scheme: api.scheme, host: host, port: port).toString();
}();
