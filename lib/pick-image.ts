import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export interface PickImageOptions {
  allowsMultipleSelection?: boolean;
  selectionLimit?: number;
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
}

function buildPickerOptions(options: PickImageOptions): ImagePicker.ImagePickerOptions {
  const base: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: options.quality ?? 0.8,
    allowsEditing: options.allowsEditing ?? false,
  };

  if (options.aspect) {
    base.aspect = options.aspect;
  }

  if (options.allowsMultipleSelection) {
    base.allowsMultipleSelection = true;
    if (options.selectionLimit != null) {
      base.selectionLimit = options.selectionLimit;
    }
  }

  return base;
}

async function requestLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Allow Milestones to access your photos.');
    return false;
  }
  return true;
}

async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Allow Milestones to use the camera.');
    return false;
  }
  return true;
}

async function pickFromLibrary(options: PickImageOptions): Promise<string[] | null> {
  if (!(await requestLibraryPermission())) return null;

  const result = await ImagePicker.launchImageLibraryAsync(buildPickerOptions(options));
  if (result.canceled) return null;
  return result.assets.map((asset) => asset.uri);
}

async function pickFromCamera(options: PickImageOptions): Promise<string[] | null> {
  if (!(await requestCameraPermission())) return null;

  const { allowsMultipleSelection: _multi, selectionLimit: _limit, ...cameraOptions } = options;
  const result = await ImagePicker.launchCameraAsync(buildPickerOptions(cameraOptions));
  if (result.canceled) return null;
  return [result.assets[0].uri];
}

/** Prompt to take a photo or choose from the library; returns local URIs or null if cancelled. */
export function pickImage(options: PickImageOptions = {}): Promise<string[] | null> {
  if (Platform.OS === 'web') {
    return pickFromLibrary(options);
  }

  return new Promise((resolve) => {
    const finish = (uris: string[] | null) => resolve(uris);

    Alert.alert(
      'Add photo',
      undefined,
      [
        {
          text: 'Take Photo',
          onPress: () => {
            void pickFromCamera(options).then(finish);
          },
        },
        {
          text: 'Choose from Library',
          onPress: () => {
            void pickFromLibrary(options).then(finish);
          },
        },
        { text: 'Cancel', style: 'cancel', onPress: () => finish(null) },
      ],
      { cancelable: true, onDismiss: () => finish(null) },
    );
  });
}
