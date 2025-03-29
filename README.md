# Easy Volume Compressor for Firefox

A Firefox addon that compresses and equalizes audio volume across all media elements to provide a consistent listening experience.

## Features

- **Real-time Audio Processing**: Automatically detects and processes all audio/video elements on web pages.
- **Dynamic Compression**: Evens out volume levels, making quiet sounds louder and loud sounds quieter.
- **Per-site Settings**: Remembers your compression settings for each website.
- **Simple Controls**: User-friendly interface with intuitive controls.
- **Level Visualization**: Visual feedback of audio levels and compression amount.

## How It Works

Easy Volume Compressor intercepts audio from media elements on websites and applies audio compression processing using the Web Audio API. This helps balance audio levels, making quiet dialogues more audible without being startled by sudden loud sounds.

### Compressor Settings

- **Threshold**: Sets the level (in dB) at which compression begins. Signals above this threshold will be compressed.
- **Ratio**: Determines how much compression is applied. Higher ratio means more compression.
- **Attack**: How quickly compression is applied when the signal exceeds the threshold.
- **Release**: How quickly compression is released when the signal falls below the threshold.
- **Output Gain**: Boosts or cuts the overall volume after compression.

## Installation

1. Download the addon from [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/easy-volume-compressor/) (link will be active after publishing).
2. Click "Add to Firefox" to install.
3. The Easy Volume Compressor icon will appear in your toolbar.

## Usage

1. Click the Easy Volume Compressor icon in your toolbar.
2. Toggle the power switch to enable/disable the compressor.
3. Adjust the sliders to fine-tune the compression settings.
4. Settings are saved per website automatically.
5. Click "Reset to Default Settings" to restore default values.

## Compatibility

- Works with Firefox on Windows and macOS.
- Compatible with most websites that use standard HTML5 audio/video elements.

## Development

### Prerequisites

- Node.js and npm

### Building from Source

1. Clone this repository
   ```
   git clone https://github.com/your-username/easy-volume-compressor-firefox.git
   cd easy-volume-compressor-firefox
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Build the addon
   ```
   npm run build
   ```

4. Load the addon in Firefox
   - Open Firefox
   - Enter `about:debugging` in the address bar
   - Click on "This Firefox"
   - Click on "Load Temporary Add-on..."
   - Navigate to the `dist` folder and select any file

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Uses the Web Audio API for audio processing
- Icon design: [Note: Replace with actual credits]
