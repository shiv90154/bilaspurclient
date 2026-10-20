/// Backend base URL. Override per build:
///   flutter run --dart-define=API_URL=http://192.168.1.10:3000/api
/// The default points at the host machine as seen from the Android emulator.
const apiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://10.0.2.2:3000/api',
);

/// Turns a server-relative link (`/api/files/KEY?exp=...&sig=...`) into a full URL on the API
/// host, keeping its query (the signature). Absolute links (e.g. a CDN) come back unchanged.
String absoluteUrl(String path) => Uri.parse(apiUrl).resolve(path).toString();

/// Public website with the privacy policy, terms and account deletion pages. Override with
/// --dart-define=WEB_URL=https://example.com; otherwise `api.<domain>` becomes `<domain>`
/// (local dev: port 3000 becomes the web's 3001).
final String webUrl = () {
  const given = String.fromEnvironment('WEB_URL');
  if (given.isNotEmpty) return given;
  final api = Uri.parse(apiUrl);
  final host = api.host.startsWith('api.') ? api.host.substring(4) : api.host;
  final port = api.hasPort && api.port == 3000 ? 3001 : (api.hasPort ? api.port : null);
  return Uri(scheme: api.scheme, host: host, port: port).toString();
}();
