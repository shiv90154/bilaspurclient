/// Backend base URL. Override per build:
///   flutter run --dart-define=API_URL=http://192.168.1.10:3000/api
/// The default points at the host machine as seen from the Android emulator.
const apiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://10.0.2.2:3000/api',
);
